import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

/**
 * Proof that a website visitor agreed to be called back by a client's AI receptionist.
 *
 * It lives here rather than with the lead because a callback that was placed is deliberately not
 * recorded as a lead: an unanswered one must leave nothing in the client's portal inbox, and that
 * is exactly the call where the proof may be asked for later. Nothing in the portal reads these
 * keys.
 *
 * Same rules as `sms-consent.ts`: append-only, and every event stands on its own, words included,
 * even after the wording and the account have changed. Unlike it, this record expires: see
 * `CALL_CONSENT_TTL_SECONDS`.
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

const logKey = (slug: string, phone: string) => `call:consent:log:${slug}:${phone}`;

/**
 * Five years (5 × 365 days), in seconds. The client privacy policy, approved 2026-11-16, says:
 * "Your agreement to a call back: kept for five years, as proof of that agreement."
 *
 * Every write refreshes it, so the five years count from the LATEST agreement for that number on
 * that site: an earlier event in the same list lives until five years after the newest one. A
 * Redis TTL belongs to the key, not to an item in the list.
 *
 * `scripts/expire-call-consent-logs.mjs` holds a copy (it is plain Node and can't import this);
 * `test/expire-call-consent-logs.test.mjs` pins the two equal.
 */
export const CALL_CONSENT_TTL_SECONDS = 5 * 365 * 24 * 60 * 60;

export interface CallConsentEvent {
    id: string;
    /** Resolved from the site's token, never from the request body. */
    slug: string;
    acctScope: string;
    phone: string;
    name: string | null;
    businessName: string;
    /** The exact sentence the visitor ticked. */
    text: string;
    textHash: string;
    textVersion: string;
    /** Our clock. This is the time that counts. */
    recordedAt: string;
    /** The visitor's clock, kept for diagnostics only. */
    clientCapturedAt: string | null;
    pageUrl: string | null;
    ip: string;
    userAgent: string;
}

export async function recordCallConsent(
    input: Omit<CallConsentEvent, "id" | "recordedAt">,
): Promise<CallConsentEvent> {
    const event: CallConsentEvent = {
        ...input,
        id: randomUUID(),
        recordedAt: new Date().toISOString(),
    };
    const key = logKey(input.slug, input.phone);
    // One transaction, so a record never exists without its expiry.
    await getRedis().multi().rpush(key, event).expire(key, CALL_CONSENT_TTL_SECONDS).exec();
    return event;
}

/** Every consent this site holds for one number, oldest first. */
export async function getCallConsentLog(slug: string, phone: string): Promise<CallConsentEvent[]> {
    return getRedis().lrange<CallConsentEvent>(logKey(slug, phone), 0, -1);
}
