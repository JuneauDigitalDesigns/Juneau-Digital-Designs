/**
 * The homepage's "Get started" form (`LeadPanel` → `POST /api/lead`) checks it was sent by a
 * person (Xander, 2026-11-19: "I want to be sure that it's checking to see that the people
 * submitting those are actually people and not bots").
 *
 * **What shipped before this.** `/api/lead` cleaned the fields and put the lead straight on the
 * console's board. No human check and no limit: a script could fill the board at will.
 *
 * The rules, the same as the client sites' lead forms (`lead-admit.ts`, operator decisions of
 * 2026-11-09):
 * - a token Cloudflare rejects, a missing one, a reused one, or one solved on another host is
 *   refused, and nothing is recorded;
 * - Cloudflare unreachable, or the widget unable to run on the page: the lead is still recorded
 *   ("never lose a lead"), marked unverified on its card, under a tighter per-visitor limit;
 * - one visitor (IP) sending again and again is refused.
 *
 * Real route and stores. The network doubles are an in-memory Upstash and a Cloudflare siteverify
 * that behaves like the real one: a token is good once, for one hostname.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const { POST } = await import("../app/api/lead/route.ts");

const HOST = "www.juneaudigitaldesigns.com";
/** The agency's own widget. The client sites' pool widget has a different secret. */
const AGENCY_SECRET = "agency-widget-secret";
const CLIENT_POOL_SECRET = "client-pool-secret";

const redis = fakeUpstash({ url: KV_URL });

let cloudflare = "up";
const spent = new Set();
let secretsUsed = [];
/** `pass:<host>:<action>:<n>` is a token solved on <host>; anything else fails. Good once. */
function siteverify(form) {
    if (cloudflare === "down") return new Response("bad gateway", { status: 502 });
    if (cloudflare === "throw") throw new TypeError("fetch failed");
    secretsUsed.push(form.get("secret"));
    if (![AGENCY_SECRET, CLIENT_POOL_SECRET].includes(form.get("secret"))) {
        return Response.json({ success: false, "error-codes": ["invalid-input-secret"] });
    }
    const token = form.get("response") ?? "";
    if (spent.has(token)) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    spent.add(token);
    const [kind, host, action] = token.split(":");
    if (kind !== "pass") return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
    return Response.json({ success: true, hostname: host, action, challenge_ts: new Date().toISOString() });
}

const realFetch = globalThis.fetch;
let seq = 0;
const solved = (host = HOST, action = "lead") => `pass:${host}:${action}:${++seq}`;

beforeEach(() => {
    redis.reset();
    spent.clear();
    secretsUsed = [];
    cloudflare = "up";
    process.env.TURNSTILE_SECRET_KEY = AGENCY_SECRET;
    process.env.LEAD_FORM_TURNSTILE_SECRET_KEY = CLIENT_POOL_SECRET;
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(input)) return redis.handle(input, init);
        if (String(input) === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
            return siteverify(new URLSearchParams(String(init.body)));
        }
        throw new Error(`unexpected fetch: ${input}`);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const FIELDS = { name: "Dana Reyes", businessName: "Reyes Roofing", phone: "(207) 555-0142", planInterest: "growth" };

async function send(extra = {}, { ip = "203.0.113.9", host = HOST } = {}) {
    const res = await POST(
        new Request(`https://${host}/api/lead`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": `${ip}, 10.0.0.1` },
            body: JSON.stringify({ ...FIELDS, ...extra }),
        }),
    );
    return { status: res.status, body: await res.json() };
}

/** Every lead on the console's board, oldest first. */
async function board() {
    const index = redis.zsets.get("jdd:lead:index") ?? new Map();
    const ids = [...index.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);
    return ids.map((id) => JSON.parse(redis.get(`jdd:lead:item:${id}`)));
}

/* ── refused ─────────────────────────────────────────────────────────── */

test("no token at all is refused, and nothing reaches the board", async () => {
    const r = await send();
    assert.equal(r.status, 403);
    assert.deepEqual(r.body, { error: "not-verified" });
    assert.equal((await board()).length, 0);
});

test("a token Cloudflare rejects is refused", async () => {
    const r = await send({ turnstileToken: "bot-made-this-up" });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "not-verified");
    assert.equal((await board()).length, 0);
});

test("a token solved on another site is refused (the hostname check)", async () => {
    const r = await send({ turnstileToken: solved("attacker.example") });
    assert.equal(r.status, 403);
    assert.equal((await board()).length, 0);
});

test("a token is good once: a replay is refused", async () => {
    const token = solved();
    assert.equal((await send({ turnstileToken: token })).status, 200);
    assert.equal((await send({ turnstileToken: token }, { ip: "198.51.100.7" })).status, 403);
    assert.equal((await board()).length, 1);
});

/* ── passed ──────────────────────────────────────────────────────────── */

test("a person's submission is recorded as verified, checked with the agency's own secret", async () => {
    const r = await send({ turnstileToken: solved() });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { ok: true });
    const [lead] = await board();
    assert.equal(lead.businessName, "Reyes Roofing");
    assert.equal(lead.verification, "passed");
    assert.deepEqual(secretsUsed, [AGENCY_SECRET], "TURNSTILE_SECRET_KEY, not the client pool's");
});

test("the token is not stored on the lead", async () => {
    const token = solved();
    await send({ turnstileToken: token });
    const [lead] = await board();
    assert.ok(!JSON.stringify(lead).includes(token));
});

/* ── fail safe: never lose a lead ───────────────────────────────────── */

for (const [what, set] of [
    ["Cloudflare answers with an error", () => (cloudflare = "down")],
    ["Cloudflare can't be reached", () => (cloudflare = "throw")],
    ["the secret isn't set", () => delete process.env.TURNSTILE_SECRET_KEY],
]) {
    test(`${what}: the lead is still recorded, marked unverified on its card`, async () => {
        set();
        const r = await send({ turnstileToken: solved() });
        assert.equal(r.status, 200);
        const [lead] = await board();
        assert.equal(lead.verification, "unverified");
        assert.match(lead.activity[0].text, /Unverified/, "the card's foot shows the last activity");
    });
}

test("the widget couldn't run on the page: the lead is still recorded, unverified", async () => {
    const r = await send({ turnstileStatus: "error" });
    assert.equal(r.status, 200);
    const [lead] = await board();
    assert.equal(lead.verification, "unverified");
});

test("a verified lead's card says nothing extra", async () => {
    await send({ turnstileToken: solved() });
    const [lead] = await board();
    assert.doesNotMatch(lead.activity[0].text, /Unverified/);
});

/* ── one visitor, again and again ───────────────────────────────────── */

test("one visitor: three verified sends in ten minutes, the fourth is refused; others unaffected", async () => {
    for (let i = 0; i < 3; i++) assert.equal((await send({ turnstileToken: solved() })).status, 200);
    const fourth = await send({ turnstileToken: solved() });
    assert.equal(fourth.status, 429);
    assert.deepEqual(fourth.body, { error: "too-many" });
    assert.equal((await send({ turnstileToken: solved() }, { ip: "198.51.100.7" })).status, 200);
    assert.equal((await board()).length, 4);
});

test("one visitor, unverified: one in ten minutes", async () => {
    assert.equal((await send({ turnstileStatus: "error" })).status, 200);
    assert.equal((await send({ turnstileStatus: "error" })).status, 429);
    assert.equal((await board()).length, 1);
});

test("a failed check costs a visitor nothing against the limit", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await send({ turnstileToken: "nope" })).status, 403);
    assert.equal((await send({ turnstileToken: solved() })).status, 200);
});

/* ── Cloudflare's test keys ─────────────────────────────────────────── */

test("Cloudflare's always-pass test secret passes its dummy token (local development, fixtures)", async () => {
    const DUMMY = "1x0000000000000000000000000000000AA"; // as published: 31 zeros
    process.env.TURNSTILE_SECRET_KEY = DUMMY;
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(input)) return redis.handle(input, init);
        // What Cloudflare answers for it: a placeholder hostname and no action.
        return Response.json({ success: true, hostname: "example.com", "error-codes": [] });
    };
    const r = await send({ turnstileToken: "XXXX.DUMMY.TOKEN.XXXX" });
    assert.equal(r.status, 200);
    assert.equal((await board())[0].verification, "passed");
});

/* ── the form ───────────────────────────────────────────────────────── */

test("the lead form renders the widget, posts its token, and shows the approved words", () => {
    // The form body is `LeadForm` since 19 Nov 2026, so the human check lives in one place rather
    // than being copied. Since the homepage redesign it sits on two pages, the homepage hero and
    // /contact, and both render it.
    const form = readFileSync("app/components/lead/LeadForm.tsx", "utf8");
    assert.match(form, /from "@jdd\/ui\/turnstile"/, "the client sites' hook, not a second copy");
    assert.match(form, /useTurnstile\(turnstileSiteKey\(\)\)/);
    assert.match(form, /ref=\{turnstile\.containerRef\}/);
    assert.match(form, /turnstileToken/);
    assert.match(form, /turnstileStatus: "error"/);
    assert.match(form, /LEAD_FORM_NOT_VERIFIED/);
    assert.match(form, /LEAD_FORM_TOO_MANY/);
    assert.match(form, /turnstile\.reset\(\)/, "a token is good once");
    assert.match(readFileSync("app/components/home/HeroForm.tsx", "utf8"), /<LeadForm\b/, "the homepage hero renders the shared form");
    assert.match(readFileSync("app/contact/ContactForm.tsx", "utf8"), /<LeadForm\b/, "the contact page renders the shared form");
});

test("the route reuses the client forms' Cloudflare check rather than a copy of it", () => {
    const route = readFileSync("app/api/lead/route.ts", "utf8");
    const gate = readFileSync("app/lib/agency-lead-gate.ts", "utf8");
    assert.match(route, /agency-lead-gate/);
    assert.match(gate, /from "\.\/turnstile-verify"/);
    assert.doesNotMatch(gate, /siteverify"|challenges\.cloudflare\.com/);
    assert.match(readFileSync("app/lib/lead-admit.ts", "utf8"), /from "\.\/turnstile-verify"/);
});
