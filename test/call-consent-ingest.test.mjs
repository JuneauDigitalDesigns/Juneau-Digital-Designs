/**
 * Proof of consent to an AI callback (`/api/ingest/call-consent`).
 *
 * **The gap this closes.** A callback that is placed is deliberately not recorded as a lead, so
 * the proof that the visitor agreed to it was thrown away on exactly the calls it exists for.
 * It is kept here instead, by site and phone, and must never reach the client's inbox.
 *
 * The real route and store. The network is the only double: an in-memory Upstash on `fetch`.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { POST } = await import("../app/api/ingest/call-consent/route.ts");
const { getCallConsentLog } = await import("../app/lib/call-consent.ts");

const TOKEN = "t".repeat(64);
const SLUG = "acme-plumbing";
const TOKEN_KEY_MATCH = /token/i;

const TEXT =
    "I agree that Acme Plumbing may call me back at the number I entered, about this request, using an automated system and an AI-generated voice. The call may be recorded. I don't have to agree in order to buy anything, and I can phone instead.";
const HASH = createHash("sha256").update(TEXT).digest("hex");

// Real SET NX / INCR: this route now claims the callback before it saves the consent.
const redis = fakeUpstash({
    url: KV_URL,
    resolve: (key) => (TOKEN_KEY_MATCH.test(key) && key.includes(TOKEN) ? { acctScope: "acct_1", slug: SLUG } : undefined),
});
const { kv, lists } = redis;

const realFetch = globalThis.fetch;

beforeEach(() => {
    redis.reset();
    globalThis.fetch = async (input, init = {}) => {
        if (!redis.owns(input)) throw new Error(`unexpected fetch: ${input}`);
        return redis.handle(input, init);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const proof = (over = {}) => ({
    phone: "+12073181838",
    name: "Santa Juno",
    businessName: "Acme Plumbing",
    text: TEXT,
    textHash: HASH,
    textVersion: "lead-call-consent-v1",
    capturedAt: "2026-11-09T15:00:00.000Z",
    pageUrl: "https://acme.example/contact",
    ip: "203.0.113.9",
    userAgent: "TestBrowser/1.0",
    ...over,
});

const send = (body, token = TOKEN) =>
    POST(
        new Request("https://www.juneaudigitaldesigns.com/api/ingest/call-consent", {
            method: "POST",
            headers: token ? { authorization: `Bearer ${token}` } : {},
            body: JSON.stringify(body),
        }),
    );

test("a consent is kept whole, under the site the token belongs to, with our own clock", async () => {
    const before = Date.now();
    const res = await send(proof({ slug: "someone-elses-site", acctScope: "acct_other" }));
    assert.equal(res.status, 200);

    const [event] = await getCallConsentLog(SLUG, "+12073181838");
    assert.equal(event.slug, SLUG, "the slug comes from the token, never the body");
    assert.equal(event.acctScope, "acct_1");
    assert.equal(event.text, TEXT);
    assert.equal(event.textHash, HASH);
    assert.equal(event.textVersion, "lead-call-consent-v1");
    assert.equal(event.pageUrl, "https://acme.example/contact");
    assert.equal(event.ip, "203.0.113.9");
    assert.equal(event.clientCapturedAt, "2026-11-09T15:00:00.000Z");
    assert.ok(Date.parse(event.recordedAt) >= before, "the server stamps the time that counts");
});

test("consent is append-only and writes nothing a portal inbox reads", async () => {
    await send(proof());
    // A second consent for the same number the same day is refused: that number's one call
    // has been claimed (lead-gate.test.mjs). A day later it is a new call and a new record.
    redis.advance(24 * 60 * 60 * 1000 + 1000);
    await send(proof());
    assert.equal((await getCallConsentLog(SLUG, "+12073181838")).length, 2);
    assert.deepEqual(
        [...kv.keys()].filter((k) => k.startsWith("portal:lead")),
        [],
        "no lead was written; the only other keys are the callback claim's counters",
    );
    assert.deepEqual([...lists.keys()], [`call:consent:log:${SLUG}:+12073181838`]);
});

test("a site without a valid token can't write", async () => {
    assert.equal((await send(proof(), "x".repeat(64))).status, 401);
    assert.equal((await send(proof(), null)).status, 401);
    assert.equal(lists.size, 0);
});

for (const [label, over] of Object.entries({
    "a hash that doesn't cover its words": { textHash: "f".repeat(64) },
    "no wording": { text: "" },
    "no version": { textVersion: "" },
    "no business name": { businessName: "" },
    "an undialable phone": { phone: "not a number" },
})) {
    test(`${label} is refused, so the site won't dial`, async () => {
        assert.equal((await send(proof(over))).status, 400);
        assert.equal(lists.size, 0);
    });
}
