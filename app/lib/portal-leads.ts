import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { zWebLead, type WebLead } from "@jdd/schema";
import { normalizeE164 } from "./phone";

/**
 * Web-form leads captured into the portal.
 *
 * Replaces Resend email delivery. A lead used to exist only as an HTML email, so it was gone the
 * moment the owner deleted it — no record in the portal, none in Airtable, nowhere to act on it.
 *
 * This is **state, not cache**: a miss changes what renders rather than making a read slow, so
 * nothing here is served from a short TTL and writes happen on mutation. It keeps its own Redis
 * handle for the same reason `portal-crm.ts` and `sms-consent.ts` do — the data is ours, unlike
 * the read-only Airtable call log these leads sit beside in the Inbox.
 *
 * **Contact identity is `normalizeE164(phone)`**, the same id the CRM groups calls by, so a form
 * submission and a later phone call from the same person collapse onto one customer. `buildInbox`
 * relies on that to pair an enquiry with the callback that followed it.
 *
 * Every key carries `acctScope` (`accountScope(account.email)`) — the invariant the rest of the
 * portal namespaces hold, because these records are caller PII and a key must never be reachable
 * from another account's scope. The one exception is the ingest-token index, which is keyed by the
 * token itself; see `resolveIngestToken`.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error(
                "Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN",
            );
        }
        _redis = Redis.fromEnv();
    }
    return _redis;
}

/**
 * Long backstop expiry rather than none, mirroring `portal-crm.ts`: a dormant account eventually
 * stops occupying keys, but within any realistic active window a lead is permanent. Refreshed on
 * every write to the record.
 */
const LEAD_TTL = 60 * 60 * 24 * 400; // ~400 days

const leadKey = (acct: string, slug: string, leadId: string) =>
    `portal:lead:v1:${acct}:${slug}:${leadId}`;
/** Sorted set scored by `createdAt` epoch ms, so the Inbox can read newest-first without a SCAN. */
const leadIndexKey = (acct: string, slug: string) => `portal:lead:index:v1:${acct}:${slug}`;
/** token → { acctScope, slug }. Keyed by the secret itself, so possession is the authorisation. */
const leadTokenKey = (token: string) => `portal:lead:token:v1:${token}`;

export interface IngestTokenOwner {
    acctScope: string;
    slug: string;
}

/* ── ingest tokens ────────────────────────────────────────────────────────── */

/**
 * Mint a token value. Callers persist it to the client's `.env.local` *and* register it here.
 *
 * 32 bytes of hex. Deliberately not a UUID: this is a bearer credential, so it wants full entropy
 * rather than a format with version bits carved out of it.
 */
export function newIngestToken(): string {
    return (randomUUID() + randomUUID()).replace(/-/g, "");
}

/**
 * Point a token at an account + site. Called by provisioning, never by a request path.
 *
 * No TTL: the token lives as long as the client does. Revocation is an explicit delete, because a
 * token that silently expires takes the client's lead capture down with it and the failure would
 * surface as "the form stopped working" weeks later.
 */
export async function registerIngestToken(
    token: string,
    owner: IngestTokenOwner,
): Promise<void> {
    await getRedis().set(leadTokenKey(token), owner);
}

/**
 * Resolve a bearer token to the account + site it may write to, or null.
 *
 * **This is the whole authorisation model for ingest.** The account and slug come from here and
 * never from the request body: a client site that could name its own slug could post leads into
 * another client's account. Rotating a client's token is a delete plus a register.
 */
export async function resolveIngestToken(
    token: string | null | undefined,
): Promise<IngestTokenOwner | null> {
    if (!token || typeof token !== "string" || token.length < 32) return null;
    try {
        return (await getRedis().get<IngestTokenOwner>(leadTokenKey(token))) ?? null;
    } catch (e) {
        // A KV outage must not look like a bad token to the caller — the route turns null into
        // 401, and a client site retrying a 401 forever would be the wrong answer to an outage.
        console.error("[portal-leads] token resolve failed", e);
        throw e;
    }
}

export async function revokeIngestToken(token: string): Promise<void> {
    await getRedis().del(leadTokenKey(token));
}

/* ── leads ────────────────────────────────────────────────────────────────── */

export interface RecordLeadInput {
    acctScope: string;
    slug: string;
    name?: string | null;
    phoneRaw?: string | null;
    email?: string | null;
    message?: string | null;
    /** Everything else the form posted, already stringified and length-capped by the caller. */
    fields?: Record<string, string>;
    callbackPlaced?: boolean;
}

/**
 * Persist one lead and index it.
 *
 * `leadId` is random rather than derived from the content: two identical enquiries from the same
 * person an hour apart are two leads, not one. Ordering comes from the index's score, not the id,
 * so it does not need to be sortable — which is why this uses the built-in `randomUUID()` instead
 * of adding a ULID dependency.
 */
export async function recordLead(input: RecordLeadInput): Promise<WebLead> {
    const now = new Date();
    const phoneRaw = input.phoneRaw?.trim() || null;

    const lead: WebLead = {
        leadId: randomUUID(),
        slug: input.slug,
        name: input.name?.trim() || null,
        phone: phoneRaw ? normalizeE164(phoneRaw) : null,
        phoneRaw,
        email: input.email?.trim() || null,
        message: input.message?.trim() || null,
        fields: input.fields ?? {},
        createdAt: now.toISOString(),
        readAt: null,
        source: "web-form",
        callbackPlaced: input.callbackPlaced ?? false,
    };

    const redis = getRedis();
    const key = leadKey(input.acctScope, input.slug, lead.leadId);
    const index = leadIndexKey(input.acctScope, input.slug);

    await redis.set(key, lead, { ex: LEAD_TTL });
    await redis.zadd(index, { score: now.getTime(), member: lead.leadId });
    await redis.expire(index, LEAD_TTL);

    return lead;
}

/**
 * Every stored lead for one site, newest first.
 *
 * Corrupt records are skipped rather than thrown on. A single bad write should not take down the
 * whole Inbox — and `zWebLead` is the released contract, so anything failing it did not come from
 * this module and we have no idea what it is.
 */
export async function listLeads(
    acctScope: string,
    slug: string,
    limit = 500,
): Promise<WebLead[]> {
    const redis = getRedis();
    const ids = await redis.zrange<string[]>(leadIndexKey(acctScope, slug), 0, limit - 1, {
        rev: true,
    });
    if (!ids || ids.length === 0) return [];

    const records = (await redis.mget<unknown[]>(
        ...ids.map((id) => leadKey(acctScope, slug, id)),
    )) as unknown[];

    const out: WebLead[] = [];
    for (const raw of records) {
        if (!raw) continue;
        const parsed = zWebLead.safeParse(raw);
        if (parsed.success) out.push(parsed.data);
        else console.error("[portal-leads] skipping malformed lead record");
    }
    return out;
}

/** One lead by id, or null. Validated on the way out for the same reason as `listLeads`. */
export async function getLead(
    acctScope: string,
    slug: string,
    leadId: string,
): Promise<WebLead | null> {
    const raw = await getRedis().get<unknown>(leadKey(acctScope, slug, leadId));
    if (!raw) return null;
    const parsed = zWebLead.safeParse(raw);
    return parsed.success ? parsed.data : null;
}

/**
 * Stamp `readAt`. Idempotent — a second call does not move the timestamp, because "when did the
 * owner first see this" is the question it answers.
 */
export async function markLeadRead(
    acctScope: string,
    slug: string,
    leadId: string,
): Promise<WebLead | null> {
    const existing = await getLead(acctScope, slug, leadId);
    if (!existing) return null;
    if (existing.readAt) return existing;

    const next: WebLead = { ...existing, readAt: new Date().toISOString() };
    await getRedis().set(leadKey(acctScope, slug, leadId), next, { ex: LEAD_TTL });
    return next;
}

/**
 * Delete every lead and the index for one site. For teardown.
 *
 * Takes the ingest token so the token index goes with it — a token that outlives the client is a
 * live credential pointing at an account that no longer exists.
 */
export async function purgeLeads(
    acctScope: string,
    slug: string,
    token?: string | null,
): Promise<number> {
    const redis = getRedis();
    const index = leadIndexKey(acctScope, slug);
    const ids = (await redis.zrange<string[]>(index, 0, -1)) ?? [];
    if (ids.length > 0) {
        await redis.del(...ids.map((id) => leadKey(acctScope, slug, id)));
    }
    await redis.del(index);
    if (token) await revokeIngestToken(token);
    return ids.length;
}
