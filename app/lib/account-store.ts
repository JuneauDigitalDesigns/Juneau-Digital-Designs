import "server-only";
import { Redis } from "@upstash/redis";
import {
    accountKey,
    accountByUserKey,
    normalizeEmail,
    createAccount,
    upsertSite,
    upsertSiteBySessionId,
    zPortalAccount,
    type PortalAccount,
    type PortalSite,
    type PortalSiteInput,
} from "@jdd/schema";

/**
 * Portal account store — the source of truth for which sites a client can see.
 *
 * Replaces the old approach of keeping this in Clerk `publicMetadata` (browser-readable,
 * and read-modify-written by several actors at once). The record lives under
 * `jdd:account:{email}` with a `jdd:account-by-user:{clerkUserId}` index.
 *
 * NOTE: there is deliberately **no TTL** here — unlike `portal-kv.ts` (a cache) and the
 * old pending-client store, this is durable state.
 *
 * All merge logic lives in @jdd/schema as pure, unit-tested functions; this module only
 * does I/O.
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        _redis = Redis.fromEnv();
    }
    return _redis;
}

/** Read an account by email. Returns null when absent or when the stored shape is invalid. */
export async function getAccount(email: string): Promise<PortalAccount | null> {
    const raw = await getRedis().get<unknown>(accountKey(email));
    if (!raw) return null;

    const parsed = zPortalAccount.safeParse(raw);
    if (!parsed.success) {
        console.error("[account-store] invalid account record", normalizeEmail(email), parsed.error.issues);
        return null;
    }
    return parsed.data;
}

/** Read an account via the clerkUserId index — survives a later email change in Clerk. */
export async function getAccountByUserId(clerkUserId: string): Promise<PortalAccount | null> {
    const email = await getRedis().get<string>(accountByUserKey(clerkUserId));
    return email ? getAccount(email) : null;
}

export async function saveAccount(account: PortalAccount): Promise<void> {
    await getRedis().set(accountKey(account.email), account);
}

/**
 * Bind a Clerk user to an account (write-once in practice: the portal only calls this
 * when the stored clerkUserId doesn't already match, and re-writing the same value is
 * harmless if two tabs race on a first load).
 */
export async function linkClerkUser(account: PortalAccount, clerkUserId: string): Promise<PortalAccount> {
    const next: PortalAccount = { ...account, clerkUserId, updatedAt: Date.now() };
    await saveAccount(next);
    await getRedis().set(accountByUserKey(clerkUserId), next.email);
    return next;
}

/**
 * Add (or update) a site on the account, creating the account if this is the client's
 * first one. Safe for a returning client submitting a second onboarding with the same
 * email — `upsertSite` preserves every other site.
 *
 * Read-modify-write, but these writes are rare and actor-specific (an onboarding submit,
 * a provisioning run, a manual repair), unlike the per-page-load merge this design
 * replaced.
 */
export async function addSiteToAccount(email: string, site: PortalSiteInput): Promise<PortalAccount> {
    const existing = (await getAccount(email)) ?? createAccount(email);
    const next = upsertSite(existing, site);
    await saveAccount(next);
    return next;
}

// ── Console pending-onboarding index ─────────────────────────────────────────

const PENDING_TTL = 60 * 60 * 24 * 30; // 30 days
const PENDING_INDEX_KEY = "jdd:pending-onboard:index";
const pendingKey = (slug: string) => `jdd:pending-onboard:${slug}`;

export interface PendingOnboardRecord {
    slug: string;
    signerEmail: string;
    signerName: string;
    sessionId: string;
    plan: string;
    name: string;
    createdAt: number;
}

async function writePendingRecord(site: PortalSite): Promise<void> {
    const redis = getRedis();
    const record: PendingOnboardRecord = {
        slug: site.slug,
        signerEmail: site.signerEmail ?? "",
        signerName: site.signerName ?? "",
        sessionId: site.sessionId ?? "",
        plan: site.plan,
        name: site.name ?? site.slug,
        createdAt: site.addedAt,
    };
    await Promise.all([
        redis.set(pendingKey(site.slug), record, { ex: PENDING_TTL }),
        redis.zadd(PENDING_INDEX_KEY, { score: site.addedAt, member: site.slug }),
    ]);
}

async function deletePendingRecord(slug: string): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.del(pendingKey(slug)),
        redis.zrem(PENDING_INDEX_KEY, slug),
    ]);
}

/**
 * Create a pending site when Stripe payment succeeds (before the wizard is filled).
 * Idempotent — skips insertion when a site with the same sessionId already exists.
 * Also writes the console's pending-onboard index so the roster sees the new client.
 */
export async function createPendingSite(email: string, site: PortalSite): Promise<PortalAccount> {
    const existing = (await getAccount(email)) ?? createAccount(email);
    if (existing.sites.some((s) => s.sessionId === site.sessionId)) {
        return existing;
    }
    const next = upsertSite(existing, site);
    await Promise.all([saveAccount(next), writePendingRecord(site)]);
    return next;
}

/**
 * Mark onboarding complete: find the pending site by sessionId and overwrite it with the
 * real wizard data (new slug, brand name, status "building", onboardingCompletedAt).
 * Falls back to slug-based upsert if no site has that sessionId (old-flow compat).
 * Also cleans up the console's pending-onboard index.
 */
export async function completeSiteOnboarding(
    email: string,
    sessionId: string,
    updates: PortalSiteInput,
): Promise<PortalAccount> {
    const existing = (await getAccount(email)) ?? createAccount(email);
    const oldSite = existing.sites.find((s) => s.sessionId === sessionId);
    const next = upsertSiteBySessionId(existing, sessionId, updates);
    await saveAccount(next);
    if (oldSite) {
        await deletePendingRecord(oldSite.slug).catch(() => {});
    }
    return next;
}
