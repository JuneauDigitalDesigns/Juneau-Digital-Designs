import "server-only";
import { Redis } from "@upstash/redis";
import {
    accountKey,
    accountByUserKey,
    normalizeEmail,
    createAccount,
    upsertSite,
    zPortalAccount,
    type PortalAccount,
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
