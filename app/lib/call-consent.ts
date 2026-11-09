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
 * Same rules as `sms-consent.ts`: append-only, no TTL, and every event stands on its own, words
 * included, even after the wording and the account have changed.
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
    await getRedis().rpush(logKey(input.slug, input.phone), event);
    return event;
}

/** Every consent this site holds for one number, oldest first. */
export async function getCallConsentLog(slug: string, phone: string): Promise<CallConsentEvent[]> {
    return getRedis().lrange<CallConsentEvent>(logKey(slug, phone), 0, -1);
}
