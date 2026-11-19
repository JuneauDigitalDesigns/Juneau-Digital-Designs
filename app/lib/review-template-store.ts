import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Where a site's own review message is kept (2026-11-19). One string per site, under the account
 * scope like every other per-site portal record. Absent means the default.
 *
 * No TTL: it is a setting the client chose, not a cache. Every read failure is "use the
 * default", so an outage never blocks a review request; it only sends the standard words.
 */
const key = (acct: string, slug: string) => `portal:review-template:v1:${acct}:${slug}`;

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error("Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
        }
        _redis = Redis.fromEnv();
    }
    return _redis;
}

export async function getReviewTemplate(acct: string, slug: string): Promise<string | null> {
    try {
        const v = await getRedis().get<string>(key(acct, slug));
        return typeof v === "string" && v.trim() ? v : null;
    } catch (e) {
        console.error("[review-template] read failed", e);
        return null;
    }
}

export async function setReviewTemplate(acct: string, slug: string, template: string | null): Promise<void> {
    if (template === null) await getRedis().del(key(acct, slug));
    else await getRedis().set(key(acct, slug), template);
}
