import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Signal records written by the portal to notify the console.
 *
 * Cancel requests:
 *   jdd:cancel-request:{slug}  — record (no TTL — 60-day Enterprise notice outlives the
 *                                 30-day TTL that pendingKv uses; console clears on teardown)
 *   jdd:cancel-request:index   — sorted set, score=requestedAt, member=slug
 *
 * Featured requests:
 *   jdd:featured-request:{slug} — record (no TTL)
 *   jdd:featured-request:index  — sorted set, score=optedInAt, member=slug
 *
 * Subscription reverse index (written at cancel time so the Stripe webhook can map back):
 *   jdd:sub-to-slug:{subscriptionId} — slug (string, no TTL)
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

// ── Cancel signals ────────────────────────────────────────────────────────────

const CANCEL_KEY = (slug: string) => `jdd:cancel-request:${slug}`;
const CANCEL_INDEX = "jdd:cancel-request:index";

export interface CancelRequestRecord {
    slug: string;
    siteName: string;
    plan: string;
    accountEmail: string;
    requestedAt: number; // epoch ms
    effectiveAt: number; // epoch ms — the Stripe cancel_at timestamp (× 1000)
    stripeSubscriptionId: string;
}

export async function writeCancelSignal(record: CancelRequestRecord): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.set(CANCEL_KEY(record.slug), record),
        redis.zadd(CANCEL_INDEX, { score: record.requestedAt, member: record.slug }),
    ]);
}

export async function deleteCancelSignal(slug: string): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.del(CANCEL_KEY(slug)),
        redis.zrem(CANCEL_INDEX, slug),
    ]);
}

// ── Featured request signals ──────────────────────────────────────────────────

const FEATURED_REQ_KEY = (slug: string) => `jdd:featured-request:${slug}`;
const FEATURED_REQ_INDEX = "jdd:featured-request:index";

export interface FeaturedRequestRecord {
    slug: string;
    siteName: string;
    siteUrl?: string;
    accountEmail: string;
    optedInAt: number;
    quote?: string;
    showName: boolean;
    showLink: boolean;
}

export async function writeFeaturedRequest(record: FeaturedRequestRecord): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.set(FEATURED_REQ_KEY(record.slug), record),
        redis.zadd(FEATURED_REQ_INDEX, { score: record.optedInAt, member: record.slug }),
    ]);
}

export async function deleteFeaturedRequest(slug: string): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.del(FEATURED_REQ_KEY(slug)),
        redis.zrem(FEATURED_REQ_INDEX, slug),
    ]);
}

// ── Subscription → slug reverse index ────────────────────────────────────────

const SUB_TO_SLUG_KEY = (subId: string) => `jdd:sub-to-slug:${subId}`;

/** Written when the client cancels so the Stripe webhook can find the slug. */
export async function writeSubToSlug(subscriptionId: string, slug: string): Promise<void> {
    await getRedis().set(SUB_TO_SLUG_KEY(subscriptionId), slug);
}

export async function getSlugBySubscription(subscriptionId: string): Promise<string | null> {
    return getRedis().get<string>(SUB_TO_SLUG_KEY(subscriptionId));
}

// ── Published featured sites (homepage) ──────────────────────────────────────

const FEATURED_PUB_INDEX = "jdd:featured:published";
const FEATURED_PUB_KEY = (slug: string) => `jdd:featured:published:${slug}`;

/**
 * What the homepage actually renders. Consent is baked in here rather than honored at
 * render time: a name or link the client opted out of is simply absent from the record, so
 * it can never reach the browser's HTML. `businessName` and `url` are therefore either both
 * present (a credited listing) or both absent (an anonymous one) — see the featured route
 * and the console publish step, which are the two writers.
 */
export interface PublishedFeaturedSite {
    slug: string;
    image: string; // path under /public (e.g. /featured/{slug}.webp)
    businessName?: string; // present iff credited
    url?: string; // present iff credited — name and link move together
    quote?: string; // testimonial, if the client gave one
}

/** Read by app/page.tsx (server component). Returns [] gracefully when KV is absent. */
export async function getPublishedFeaturedSites(): Promise<PublishedFeaturedSite[]> {
    try {
        const redis = getRedis();
        const slugs = await redis.zrange<string[]>(FEATURED_PUB_INDEX, 0, -1, { rev: true });
        if (!slugs.length) return [];
        const items = await Promise.all(slugs.map((s) => redis.get<PublishedFeaturedSite>(FEATURED_PUB_KEY(s))));
        return items.filter((x): x is PublishedFeaturedSite => x !== null);
    } catch {
        return [];
    }
}

/**
 * Publish a site to the homepage. Mirror of `removePublishedFeaturedSite`. `optedInAt` is
 * the sort score — newest featured sites lead the row (`getPublishedFeaturedSites` reads
 * the index `rev`). Kept off the record itself so nothing but display data ships to the
 * client.
 */
export async function writePublishedFeaturedSite(
    site: PublishedFeaturedSite,
    optedInAt: number,
): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.set(FEATURED_PUB_KEY(site.slug), site),
        redis.zadd(FEATURED_PUB_INDEX, { score: optedInAt, member: site.slug }),
    ]);
}

/** Remove a site from the published set — called by the Stripe subscription.deleted webhook. */
export async function removePublishedFeaturedSite(slug: string): Promise<void> {
    const redis = getRedis();
    await Promise.all([
        redis.del(FEATURED_PUB_KEY(slug)),
        redis.zrem(FEATURED_PUB_INDEX, slug),
    ]);
}
