/**
 * The one-off that gives existing AI-callback consent records their five-year expiry.
 *
 * Records written before 2026-11-16 have no TTL, so the privacy policy's "kept for five years"
 * would be false for them. The backfill must count from the newest agreement, exactly like the
 * write path, must never touch a key that already expires, must leave alone a record whose five
 * years are already over (that is a deletion, and a person's call), and must change nothing in a
 * preview.
 *
 * Pure logic plus the run on an injected store. It is never run against real KV from a test.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

import {
    CALL_CONSENT_TTL_SECONDS as SCRIPT_TTL,
    expireCallConsentLogs,
    needsExpiry,
    plannedExpiry,
} from "../scripts/expire-call-consent-logs.mjs";

register("./server-only-hook.mjs", import.meta.url);
const { CALL_CONSENT_TTL_SECONDS } = await import("../app/lib/call-consent.ts");

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-11-16T12:00:00.000Z");
const at = (iso) => ({ recordedAt: iso });

test("the script's five years are the write path's five years", () => {
    assert.equal(SCRIPT_TTL, CALL_CONSENT_TTL_SECONDS);
    assert.equal(SCRIPT_TTL, 157_680_000);
});

test("only a key with no expiry is the backfill's", () => {
    assert.equal(needsExpiry(-1), true);
    assert.equal(needsExpiry(-2), false, "a key that is gone");
    assert.equal(needsExpiry(0), false);
    assert.equal(needsExpiry(3600), false, "one that already expires is left as it is");
});

test("expiry is five years after the NEWEST event, whatever order the list is in", () => {
    const plan = plannedExpiry(
        [at("2026-11-10T09:00:00.000Z"), at("2026-11-12T09:00:00.000Z"), at("2026-11-11T09:00:00.000Z")],
        NOW,
    );
    assert.equal(plan.newestRecordedAt, "2026-11-12T09:00:00.000Z");
    assert.equal(plan.expireAt, Date.parse("2026-11-12T09:00:00.000Z") / 1000 + CALL_CONSENT_TTL_SECONDS);
});

test("events read back as raw JSON strings are understood the same way", () => {
    const plan = plannedExpiry([JSON.stringify(at("2026-11-12T09:00:00.000Z"))], NOW);
    assert.equal(plan.expireAt, Date.parse("2026-11-12T09:00:00.000Z") / 1000 + CALL_CONSENT_TTL_SECONDS);
});

test("a record whose five years are already past is reported, not given a new five", () => {
    const old = new Date(NOW - 5 * YEAR_MS - 1000).toISOString();
    assert.equal(plannedExpiry([at(old)], NOW).expired, true);
    const justInside = new Date(NOW - 5 * YEAR_MS + 60_000).toISOString();
    assert.equal(plannedExpiry([at(justInside)], NOW).expireAt, Math.floor((NOW + 60_000) / 1000));
});

test("no usable recordedAt means no guess", () => {
    assert.deepEqual(plannedExpiry([], NOW), { unreadable: true });
    assert.deepEqual(plannedExpiry([at("not a date"), "{bad json", null], NOW), { unreadable: true });
});

function store() {
    const recent = "2026-11-01T00:00:00.000Z";
    const ancient = new Date(NOW - 6 * YEAR_MS).toISOString();
    const keys = new Map([
        ["call:consent:log:a:+1", { ttl: -1, events: [at("2026-10-01T00:00:00.000Z"), at(recent)] }],
        ["call:consent:log:a:+2", { ttl: 1000, events: [at(recent)] }],
        ["call:consent:log:b:+3", { ttl: -1, events: [at(ancient)] }],
        ["call:consent:log:b:+4", { ttl: -1, events: [{}] }],
    ]);
    const calls = [];
    return {
        keys,
        calls,
        redis: {
            scan: async (_cursor, { match }) => ["0", [...keys.keys()].filter((k) => k.startsWith(match.slice(0, -1)))],
            ttl: async (k) => keys.get(k)?.ttl ?? -2,
            lrange: async (k) => keys.get(k)?.events ?? [],
            expireat: async (...args) => void calls.push(args),
        },
    };
}

test("the preview changes nothing", async () => {
    const s = store();
    const summary = await expireCallConsentLogs({ redis: s.redis, write: false, now: NOW, log: () => {} });
    assert.deepEqual(s.calls, []);
    assert.deepEqual(
        { found: summary.found, already: summary.alreadyExpiring, planned: summary.planned, past: summary.pastFiveYears, unreadable: summary.unreadable },
        { found: 4, already: 1, planned: 1, past: 1, unreadable: 1 },
    );
});

test("--write sets one expiry, only where none exists, and only if there is still none", async () => {
    const s = store();
    const summary = await expireCallConsentLogs({ redis: s.redis, write: true, now: NOW, log: () => {} });
    assert.equal(summary.set, 1);
    assert.deepEqual(s.calls, [
        ["call:consent:log:a:+1", Date.parse("2026-11-01T00:00:00.000Z") / 1000 + CALL_CONSENT_TTL_SECONDS, "NX"],
    ]);
});

test("its output names no phone number", async () => {
    const s = store();
    const lines = [];
    await expireCallConsentLogs({ redis: s.redis, write: true, now: NOW, log: (l) => lines.push(l) });
    assert.doesNotMatch(lines.join("\n"), /\+\d/);
});
