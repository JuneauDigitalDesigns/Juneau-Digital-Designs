#!/usr/bin/env node
/**
 * Give every existing AI-callback consent record its five-year expiry.
 *
 *   node --env-file=<env> scripts/expire-call-consent-logs.mjs           # preview only
 *   node --env-file=<env> scripts/expire-call-consent-logs.mjs --write   # set the expiries
 *
 * Needs KV_REST_API_URL and KV_REST_API_TOKEN.
 *
 * `call:consent:log:{slug}:{phone}` keys written before the retention rule have no TTL at all
 * (TTL -1), so they would outlive the client privacy policy ("kept for five years, as proof of that
 * agreement"). New writes set it themselves (`recordCallConsent`); this is the one-off for the rest.
 *
 * For each key with no expiry, it sets one at five years after the newest event's `recordedAt`:
 * the same rule the write path applies, which counts from the latest agreement for that number.
 * A key whose five years have already run out is reported and left alone, for a person to decide.
 * A key that already has an expiry is never touched. The expiry is set with `NX` (only if the key
 * still has none), so a consent recorded mid-run keeps the fresh five years its write gave it.
 *
 * Prints counts and key counts only, never phone numbers: these are visitors' records.
 *
 * Exit codes: 0 finished · 1 some key could not be read or set · 2 missing config
 */
import { pathToFileURL } from "node:url";

/** Five years, in seconds. Must equal `CALL_CONSENT_TTL_SECONDS` in `app/lib/call-consent.ts`. */
export const CALL_CONSENT_TTL_SECONDS = 5 * 365 * 24 * 60 * 60;

export const MATCH = "call:consent:log:*";

/** Only a key with no expiry (TTL -1) is this script's. -2 is a key that is gone. */
export const needsExpiry = (ttl) => Number(ttl) === -1;

/**
 * When a record should expire: five years after its newest event's `recordedAt`.
 *
 * Returns `{ expireAt }` (unix seconds) when that moment is still ahead, `{ expired: true }` when
 * it has passed, and `{ unreadable: true }` when no event carries a usable `recordedAt`, so nothing
 * is set from a guess.
 */
export function plannedExpiry(events, nowMs = Date.now()) {
    let newest = -Infinity;
    for (const e of events ?? []) {
        const event = typeof e === "string" ? safeParse(e) : e;
        const t = Date.parse(event?.recordedAt ?? "");
        if (Number.isFinite(t) && t > newest) newest = t;
    }
    if (newest === -Infinity) return { unreadable: true };
    const expireAtMs = newest + CALL_CONSENT_TTL_SECONDS * 1000;
    if (expireAtMs <= nowMs) return { expired: true, newestRecordedAt: new Date(newest).toISOString() };
    return { expireAt: Math.floor(expireAtMs / 1000), newestRecordedAt: new Date(newest).toISOString() };
}

function safeParse(s) {
    try {
        return JSON.parse(s);
    } catch {
        return null;
    }
}

/** Every key matching `match`, across all SCAN pages. */
async function scanAll(redis, match) {
    const keys = [];
    let cursor = "0";
    do {
        const [next, page] = await redis.scan(cursor, { match, count: 200 });
        keys.push(...page);
        cursor = String(next);
    } while (cursor !== "0");
    return keys;
}

/** The backfill itself, on an injected store so a test can run the real logic. */
export async function expireCallConsentLogs({ redis, write, now = Date.now(), log = console.log }) {
    const summary = { found: 0, alreadyExpiring: 0, planned: 0, set: 0, pastFiveYears: 0, unreadable: 0, failed: 0 };
    const keys = await scanAll(redis, MATCH);
    summary.found = keys.length;

    for (const key of keys) {
        try {
            if (!needsExpiry(await redis.ttl(key))) {
                summary.alreadyExpiring += 1;
                continue;
            }
            const plan = plannedExpiry(await redis.lrange(key, 0, -1), now);
            if (plan.unreadable) {
                summary.unreadable += 1;
                continue;
            }
            if (plan.expired) {
                summary.pastFiveYears += 1;
                continue;
            }
            summary.planned += 1;
            if (write) {
                await redis.expireat(key, plan.expireAt, "NX");
                summary.set += 1;
            }
        } catch {
            summary.failed += 1;
        }
    }

    log(`consent records found: ${summary.found}`);
    log(`  already expiring, left alone: ${summary.alreadyExpiring}`);
    log(`  no expiry, five years still ahead: ${summary.planned}${write ? ` (set: ${summary.set})` : " (preview: nothing set)"}`);
    log(`  no expiry, five years already past, left alone to decide by hand: ${summary.pastFiveYears}`);
    log(`  no readable recordedAt, left alone: ${summary.unreadable}`);
    if (summary.failed) log(`  failed to read or set: ${summary.failed}`);
    return summary;
}

async function main() {
    const write = process.argv.includes("--write");
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
        console.error("Missing KV_REST_API_URL / KV_REST_API_TOKEN.");
        process.exit(2);
    }
    const { Redis } = await import("@upstash/redis");
    // Raw strings back from LRANGE: plannedExpiry parses them itself.
    const redis = new Redis({
        url: process.env.KV_REST_API_URL,
        token: process.env.KV_REST_API_TOKEN,
        automaticDeserialization: false,
    });
    console.log(write ? "WRITE: setting expiries" : "PREVIEW: nothing will be changed (pass --write to set them)");
    const summary = await expireCallConsentLogs({ redis, write });
    process.exit(summary.failed ? 1 : 0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
