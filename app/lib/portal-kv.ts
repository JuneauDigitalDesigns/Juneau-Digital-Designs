import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        _redis = Redis.fromEnv();
    }
    return _redis;
}

/**
 * Generic read-through cache helpers.
 *
 * The PageSpeed pair below predates these and is kept as a named wrapper because its key
 * carries the date-bucketing rule that makes the cache double as the API rate limit.
 */
export async function getCached<T>(key: string): Promise<T | null> {
    try {
        return await getRedis().get<T>(key);
    } catch (e) {
        // A cache miss and a cache outage should look the same to a caller: fetch it live.
        console.error(`[portal-kv] read failed for ${key}`, e);
        return null;
    }
}

export async function setCached<T>(key: string, ttlSeconds: number, data: T): Promise<void> {
    try {
        await getRedis().set(key, data, { ex: ttlSeconds });
    } catch (e) {
        console.error(`[portal-kv] write failed for ${key}`, e);
    }
}

/** Drop cached entries by exact key. Used by mutation paths, never on a read path. */
export async function dropCached(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
        await getRedis().del(...keys);
    } catch (e) {
        // A failed invalidation is worse than a failed read — say so loudly, but don't throw:
        // the write that triggered it already succeeded and must not be reported as failed.
        console.error(`[portal-kv] INVALIDATION FAILED for ${keys.join(", ")}`, e);
    }
}

/**
 * Read-through cache. Returns the cached value when present, otherwise runs `fetcher`,
 * stores the result and returns it.
 *
 * `fetcher` failures are never cached — a transient upstream error must not be served for
 * the rest of the TTL. Callers that want to cache a *known* negative should return a value
 * representing it rather than throwing.
 */
export async function cached<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
): Promise<T> {
    const hit = await getCached<T>(key);
    if (hit !== null && hit !== undefined) return hit;

    const fresh = await fetcher();
    await setCached(key, ttlSeconds, fresh);
    return fresh;
}

/**
 * Short, stable digest of an account email, for use in cache keys.
 *
 * Two reasons this is not the raw email. Site slugs are unique only *within* an account
 * (`upsertSite` matches on `account.sites.findIndex`), so a key built from slug alone could
 * be shared by two accounts — scoping by account makes that structurally impossible. And
 * keeping addresses out of cache key names means a `SCAN` over the cache namespace doesn't
 * enumerate the client list. The durable record still keys on the address; that's existing
 * behaviour and a separate change.
 */
export function accountScope(email: string): string {
    return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
}

/**
 * Every key holding client-derived data takes an `acctScope`. The only exceptions are
 * `schemaKey` (Airtable column names — no client data) and `accountCacheKey` / the rate
 * limiter, which are already keyed by Clerk user id. If you add a cache key here and it
 * doesn't start with one of those, it needs the scope.
 */

/** Live-ish infra state. Short enough that a client refreshing after a deploy sees it. */
export const INFRA_TTL = 300;
export const infraKey = (acctScope: string, slug: string) =>
    `portal:infra:v2:${acctScope}:${slug}`;

/**
 * Traffic moves once a day; it was the only fully-uncached upstream in the portal.
 *
 * `v2` bump: the payload gained `devices` and `browsers`. A `v1` hit would have served an
 * object missing those fields for up to an hour after deploy.
 */
export const TRAFFIC_TTL = 3_600;
export const trafficKey = (acctScope: string, slug: string, days: number) =>
    `portal:traffic:v3:${acctScope}:${slug}:${days}:${new Date().toISOString().slice(0, 10)}`;

/**
 * Call records. Deliberately short: "did I get a lead?" is the question the portal exists to
 * answer, so a new call must surface in minutes, not hours. Two minutes still collapses a
 * burst of tab switching into a single Airtable read.
 *
 * Account-scoped — this payload contains caller names, numbers, emails and addresses, and
 * must never be reachable from another account's key.
 */
export const CALLS_TTL = 120;
export const callsKey = (acctScope: string, siteSlug: string) =>
    `portal:calls:v1:${acctScope}:${siteSlug}`;

/**
 * Airtable table schema (column names only — no client data, so this one is base-scoped).
 *
 * This is the expensive call: ~1.8s measured. It was cached only in a per-process Map, which
 * evaporates on cold start — precisely when the 1.8s is paid.
 */
export const SCHEMA_TTL = 600;
export const schemaKey = (baseId: string) => `portal:airtable-schema:v1:${baseId}`;

/**
 * Subscription and invoices. Changes at most monthly; twice a day is plenty.
 *
 * Two variants because the Billing tab and the Overview one-liner need different shapes
 * from Stripe, and caching them separately is cheaper than unifying two payloads that no
 * single view ever wants together.
 */
export const BILLING_TTL = 43_200;
export const billingKey = (acctScope: string, siteSlug: string, variant: "full" | "summary" = "full") =>
    `portal:billing:v1:${variant}:${acctScope}:${siteSlug}`;

/**
 * The resolved account, keyed by Clerk user id.
 *
 * Short on purpose: this record decides which sites a client may see. Every write goes
 * through `saveAccount`, which invalidates it immediately, so the TTL is only a backstop for
 * edits made directly in KV.
 */
export const ACCOUNT_TTL = 60;
export const accountCacheKey = (clerkUserId: string) => `portal:acct:v1:${clerkUserId}`;

// One PageSpeed call per client per calendar day (UTC). The cache IS the rate limit.
const PAGESPEED_TTL = 86_400;

function pagespeedKey(slug: string): string {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
    // `v2` bump: invalidates pre-fix entries that cached all-zero results from the
    // wrong response nesting. Old `pagespeed:{slug}:{date}` keys TTL out within 24h.
    return `pagespeed:v2:${slug}:${date}`;
}

export async function getCachedPagespeed(slug: string): Promise<Record<string, unknown> | null> {
    return getRedis().get<Record<string, unknown>>(pagespeedKey(slug));
}

export async function setCachedPagespeed(slug: string, data: Record<string, unknown>): Promise<void> {
    await getRedis().set(pagespeedKey(slug), data, { ex: PAGESPEED_TTL });
}

// 30 requests per minute per user across all portal API routes
export function getPortalRatelimit(): Ratelimit {
    return new Ratelimit({
        redis: getRedis(),
        limiter: Ratelimit.fixedWindow(30, "60s"),
        prefix: "portal:rl",
    });
}
