import "server-only";
import { Redis } from "@upstash/redis";
import { isDeepLinkId } from "./crm-contacts";

/**
 * Which Inbox items the client has opened: the bold and the blue dot (Xander, 2026-11-12,
 * "make this feel a little bit more like an email inbox").
 *
 * One set per site, of inbox ids — a call's Airtable record id or `lead:{leadId}`, the same id
 * space as the archive and the deep links. Opening a lead adds its row's ids; Mark unread takes
 * them out. Portal-side for calls as well as leads, for the reason the archive gives: a call's
 * row is the client's own Airtable log, which this portal reads and does not write.
 *
 * Leads used to carry their own notion of read (`WebLead.readAt`, a first-seen stamp). That
 * stamp cannot be taken back without losing what it records, and Mark unread has to work, so
 * the Inbox reads this set for both sources and leaves `readAt` alone.
 *
 * Read state plays no part in Needs you. Opening a lead is not handling it (`isNeedsYou`).
 */

/** The archive's backstop, for the same reason: state about a client's leads, not a cache. */
export const READ_TTL_SECONDS = 60 * 60 * 24 * 400;

/** A row is one caller's run of calls; a hundred is someone else's script (as the archive). */
const MAX_IDS = 100;

const readIndex = (a: string, s: string) => `portal:inbox:v1:read:${a}:${s}`;

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

export async function setRead(acct: string, slug: string, ids: string[], read: boolean): Promise<void> {
    if (ids.length === 0) return;
    const redis = getRedis();
    const key = readIndex(acct, slug);
    if (read) {
        await redis.sadd(key, ids[0], ...ids.slice(1));
        // Refreshed on every open, so an account in use never loses its read state.
        await redis.expire(key, READ_TTL_SECONDS);
        return;
    }
    await redis.srem(key, ids[0], ...ids.slice(1));
}

export async function readRefs(acct: string, slug: string): Promise<Set<string>> {
    const refs = (await getRedis().smembers<string[]>(readIndex(acct, slug))) ?? [];
    return new Set(refs);
}

/**
 * Delete the read set for one site. **For teardown**, beside `purgeLeads` and `purgeArchive`:
 * otherwise a torn-down account leaves its callers' Airtable record ids behind for 400 days.
 */
export async function purgeRead(acct: string, slug: string): Promise<number> {
    const redis = getRedis();
    const n = (await redis.scard(readIndex(acct, slug))) ?? 0;
    await redis.del(readIndex(acct, slug));
    return n;
}

export type ReadRequest = { ok: true; ids: string[]; read: boolean } | { ok: false; error: string };

/**
 * The route's body: `{ ids, read? }`. Ids are checked against the two real shapes before they
 * reach a key, as the archive route does; `read` defaults to true, since opening is the
 * common case and Mark unread is the one that says `false`.
 */
export function parseReadRequest(body: unknown): ReadRequest {
    const b = (body ?? {}) as Record<string, unknown>;
    const ids = Array.isArray(b.ids)
        ? b.ids.filter((v): v is string => typeof v === "string" && isDeepLinkId(v))
        : [];
    if (ids.length === 0) return { ok: false, error: "Nothing to mark" };
    if (ids.length > MAX_IDS) return { ok: false, error: "Too many items at once" };
    return { ok: true, ids, read: b.read !== false };
}
