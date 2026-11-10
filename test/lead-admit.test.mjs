/**
 * The human check and its single-use admission (`/api/ingest/admit`, `lead-admit.ts`).
 *
 * **What shipped before this.** Nothing checked that a person sent a form, and a site's ingest
 * token was all it took to write a lead, save a consent and so place a call. A leaked token, or a
 * script against `/api/contact`, could do all of it at will.
 *
 * Real routes and stores. The network doubles are an in-memory Upstash (real SET NX / INCR) and a
 * Cloudflare siteverify that behaves like the real one: a token is good once, for one hostname.
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

const { POST: admitPOST } = await import("../app/api/ingest/admit/route.ts");
const { POST: consentPOST } = await import("../app/api/ingest/call-consent/route.ts");
const { POST: leadPOST } = await import("../app/api/ingest/lead/route.ts");
const { listLeads } = await import("../app/lib/portal-leads.ts");
const { siteMovedKey } = await import("../app/lib/lead-admit.ts");

const ACCT = "acct_1";
const SLUG = "arthurs-plumbing";
const TOKEN = "t".repeat(64);
const OTHER_TOKEN = "o".repeat(64);
const HOST = "arthursplumbing.vercel.app";
const SECRET = "live-secret-for-tests";

const TEXT =
    "I agree that Arthur's Plumbing may call me back at the number I entered, about this request, using an automated system and an AI-generated voice. The call may be recorded. I don't have to agree in order to buy anything, and I can phone instead.";
const HASH = createHash("sha256").update(TEXT).digest("hex");

const redis = fakeUpstash({
    url: KV_URL,
    resolve: (key) => {
        if (key === `portal:lead:token:v1:${TOKEN}`) return { acctScope: ACCT, slug: SLUG };
        if (key === `portal:lead:token:v1:${OTHER_TOKEN}`) return { acctScope: "acct_2", slug: "other-site" };
        return undefined;
    },
});

/**
 * Cloudflare, as it behaves: `pass:<host>` is a token solved on <host> (action "lead"), good
 * once; anything else fails. `cloudflare` switches the whole service to down or throwing.
 */
let cloudflare = "up";
const spent = new Set();
let siteverifyCalls = 0;
function siteverify(form) {
    siteverifyCalls++;
    if (cloudflare === "down") return new Response("bad gateway", { status: 502 });
    if (cloudflare === "throw") throw new TypeError("fetch failed");
    if (form.get("secret") !== process.env.TURNSTILE_SECRET_KEY) {
        return Response.json({ success: false, "error-codes": ["invalid-input-secret"] });
    }
    const token = form.get("response") ?? "";
    if (spent.has(token)) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    spent.add(token);
    const [kind, host, action = "lead"] = token.split(":");
    if (kind !== "pass") return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
    return Response.json({ success: true, hostname: host, action, challenge_ts: new Date().toISOString() });
}

const realFetch = globalThis.fetch;
let tokenSeq = 0;
/** A token as the widget would hand it over after a solve on `host`. */
const solved = (host = HOST) => `pass:${host}:lead:${++tokenSeq}`;

beforeEach(() => {
    redis.reset();
    spent.clear();
    siteverifyCalls = 0;
    cloudflare = "up";
    process.env.TURNSTILE_SECRET_KEY = SECRET;
    delete process.env.INGEST_REQUIRE_ADMISSION;
    for (const k of Object.keys(process.env)) if (k.startsWith("GATE_")) delete process.env[k];
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

const post = async (handler, path, body, token = TOKEN) => {
    const res = await handler(
        new Request(`https://www.juneaudigitaldesigns.com${path}`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );
    return { status: res.status, body: await res.json() };
};

const admit = (over = {}, token) =>
    post(admitPOST, "/api/ingest/admit", {
        turnstileToken: solved(),
        ip: "203.0.113.9",
        phone: "+12073181838",
        wantsCallback: true,
        host: HOST,
        deployment: "production",
        ...over,
    }, token);

const consent = (phone, admissionId, token) =>
    post(consentPOST, "/api/ingest/call-consent", {
        phone,
        businessName: "Arthur's Plumbing",
        text: TEXT,
        textHash: HASH,
        textVersion: "lead-call-consent-v1",
        ...(admissionId === undefined ? {} : { admissionId }),
    }, token);

const lead = (body, token) => post(leadPOST, "/api/ingest/lead", body, token);

/**
 * What the new `/api/contact` does, step for step: admit; on "allowed" save consent and dial;
 * otherwise record the lead with the admission.
 */
async function submit({ ip = "203.0.113.9", phone = "+12073181838", turnstileToken = solved() } = {}) {
    const a = await admit({ ip, phone, turnstileToken });
    if (a.status !== 200) return { refused: a.body.error };
    if (a.body.callback === "allowed") {
        const c = await consent(phone, a.body.admissionId);
        if (c.status === 200) return { called: true };
    }
    const l = await lead({ name: "Maria", phone, admissionId: a.body.admissionId });
    return { called: false, lead: l.status };
}

/* ── the burst ────────────────────────────────────────────────────────────── */

test("a burst of 20 from one visitor: one call, at most one lead, the rest told to wait", async () => {
    const out = await Promise.all(Array.from({ length: 20 }, () => submit()));
    assert.equal(out.filter((o) => o.called).length, 1, "one call");
    assert.equal((await listLeads(ACCT, SLUG)).length, 1, "at most one lead");
    assert.equal(out.filter((o) => o.refused === "too-many").length, 17, "past 3 in 10 minutes: message B");
});

test("a burst of 20 from 20 different addresses for one number: still one call, one lead", async () => {
    const out = await Promise.all(Array.from({ length: 20 }, (_, i) => submit({ ip: `198.51.100.${i}` })));
    assert.equal(out.filter((o) => o.called).length, 1);
    assert.equal((await listLeads(ACCT, SLUG)).length, 1);
    assert.equal(out.filter((o) => o.refused).length, 0, "nobody was refused: they were people");
});

/* ── the human check ──────────────────────────────────────────────────────── */

test("no token, or one Cloudflare rejects, is refused before anything is claimed", async () => {
    for (const turnstileToken of [undefined, "", "garbage"]) {
        const r = await admit({ turnstileToken });
        assert.deepEqual([r.status, r.body.error], [403, "not-verified"]);
    }
    assert.equal(
        [...redis.kv.keys()].filter((k) => k.includes(":cb:")).length,
        0,
        "no number was claimed for a call",
    );
});

test("a token is good once: replaying it is refused", async () => {
    const t = solved();
    assert.equal((await admit({ turnstileToken: t })).status, 200);
    assert.equal((await admit({ turnstileToken: t, phone: "+14075550001" })).status, 403);
});

test("a token solved on another client's site is refused here", async () => {
    const r = await admit({ turnstileToken: solved("someone-else.vercel.app") });
    assert.equal(r.status, 403);
});

test("a token issued for another purpose is refused", async () => {
    const r = await admit({ turnstileToken: `pass:${HOST}:login:${++tokenSeq}` });
    assert.equal(r.status, 403);
});

/* ── a token alone writes nothing ─────────────────────────────────────────── */

test("with the site moved over, a leaked ingest token alone can't save a consent or a lead", async () => {
    await admit({ turnstileToken: "garbage" }); // its production route has asked once: moved over
    assert.equal((await consent("+12073181838")).status, 403);
    assert.equal((await lead({ phone: "+12073181838" })).status, 403);
    assert.equal((await lead({ phone: "+12073181838", admissionId: "f".repeat(32) })).status, 403);
    assert.equal((await listLeads(ACCT, SLUG)).length, 0);
});

test("an admission is spent once per use, for its own site only", async () => {
    const { body } = await admit({ wantsCallback: false });
    assert.equal(body.callback, "held");
    assert.equal((await consent("+12073181838", body.admissionId)).status, 403, "no callback was claimed");
    assert.equal((await lead({ phone: "+12073181838", admissionId: body.admissionId }, OTHER_TOKEN)).status, 403);
    assert.equal((await lead({ phone: "+12073181838", admissionId: body.admissionId })).status, 200);
    assert.equal((await lead({ phone: "+12073181838", admissionId: body.admissionId })).status, 403, "spent");
});

test("a consent admission is for the number it claimed, not another", async () => {
    const { body } = await admit();
    assert.equal(body.callback, "allowed");
    assert.equal((await consent("+14075550001", body.admissionId)).status, 403);
    assert.equal((await consent("+12073181838", body.admissionId)).status, 200);
});

test("an admission expires after 10 minutes", async () => {
    const { body } = await admit({ wantsCallback: false });
    redis.advance(10 * 60 * 1000 + 1000);
    assert.equal((await lead({ phone: "+12073181838", admissionId: body.admissionId })).status, 403);
});

test("a site still on the old route keeps working until it is moved over", async () => {
    // Nothing from this site has asked for an admission, so nothing marks it as moved.
    assert.equal((await consent("+12073181838")).status, 200, "the old route's consent, with the claim");
    assert.equal((await consent("+12073181838")).status, 429, "and the claim still holds the second call");
    assert.equal((await lead({ phone: "+14075550001" })).status, 200);

    process.env.INGEST_REQUIRE_ADMISSION = "on";
    assert.equal((await lead({ phone: "+14075550002" })).status, 403, "the global switch moves every site");
});

test("only the production route moves a site over: a preview asking leaves production working", async () => {
    await admit({ deployment: "preview", wantsCallback: false });
    assert.equal(redis.get(siteMovedKey(ACCT, SLUG)), undefined);
    assert.equal((await lead({ phone: "+14075550003" })).status, 200, "production, still on the old route, records leads");

    await admit({ deployment: "production", wantsCallback: false });
    assert.equal((await lead({ phone: "+14075550004" })).status, 403);
});

test("a token is checked against the host the form was posted to", async () => {
    assert.equal((await admit({ host: "www.arthursplumbing.com", turnstileToken: solved("www.arthursplumbing.com") })).status, 200, "a custom domain needs no setup here");
    assert.equal((await admit({ host: "ArthursPlumbing.vercel.app:443", phone: "+14075550005" })).status, 200, "case and port don't matter");
    assert.equal((await admit({ host: "www.arthursplumbing.com", phone: "+14075550006" })).status, 403, "solved on the vercel.app host, spent on the domain");
});

/* ── fail safe ────────────────────────────────────────────────────────────── */

for (const state of ["down", "throw"]) {
    test(`Cloudflare ${state}: no call, the lead recorded and marked, one per visitor per 10 minutes`, async () => {
        cloudflare = state;
        const first = await submit({ phone: "+12073181838" });
        assert.deepEqual(first, { called: false, lead: 200 });
        const [stored] = await listLeads(ACCT, SLUG);
        assert.equal(stored.fields.verification, "unavailable");
        assert.equal(stored.fields.admissionId, undefined, "plumbing isn't stored with the lead");

        assert.deepEqual(await submit({ phone: "+14075550001" }), { refused: "too-many" });
        assert.deepEqual(await submit({ phone: "+14075550001", ip: "198.51.100.7" }), { called: false, lead: 200 });
    });
}

test("no Turnstile secret on the agency: nobody is called, nobody is refused", async () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    assert.deepEqual(await submit(), { called: false, lead: 200 });
    assert.equal(siteverifyCalls, 0);
});

test("a submission that fails the check doesn't count against the visitor", async () => {
    for (let i = 0; i < 5; i++) await admit({ turnstileToken: "garbage" });
    const ok = await Promise.all([1, 2, 3].map((i) => admit({ phone: `+1407555000${i}`, wantsCallback: false })));
    assert.deepEqual(ok.map((r) => r.status), [200, 200, 200]);
});

test("10 submissions per visitor per site a day", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-09T01:00:00Z") });
    const statuses = [];
    for (let i = 0; i < 11; i++) {
        statuses.push((await admit({ phone: `+140755501${String(i).padStart(2, "0")}`, wantsCallback: false })).status);
        t.mock.timers.tick(11 * 60 * 1000);
    }
    assert.deepEqual(statuses, [...Array(10).fill(200), 429]);
});
