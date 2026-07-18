import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) {
        _redis = Redis.fromEnv();
    }
    return _redis;
}

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
