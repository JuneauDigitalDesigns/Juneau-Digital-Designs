/**
 * The limits on what a public lead form can make us do (`lead-gate.ts`), through the real ingest
 * routes, with nothing a client site needs to redeploy.
 *
 * **What shipped before this.** The only brake was 30 requests a minute per site. A script against
 * one callback site could place 30 AI calls a minute to any numbers it chose, and a resubmitted
 * form re-dialed the same person every time. Every submission that wasn't called texted the owner.
 *
 * The routes and stores are real. The network is the only double: an in-memory Upstash that
 * implements SET NX / INCR / GETDEL for real (so a burst can race), and Twilio.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const OWNER_EMAIL = "arthur@arthursplumbing.com";
const OWNER_PHONE = "+14075550123";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: `MG${"m".repeat(32)}`,
    TWILIO_NOTIFICATION_NUMBER: "+16893292464",
});

const { POST: consentPOST } = await import("../app/api/ingest/call-consent/route.ts");
const { POST: leadPOST } = await import("../app/api/ingest/lead/route.ts");
const { POST: messagePOST } = await import("../app/api/ingest/lead/message/route.ts");
const { listLeads, getLead } = await import("../app/lib/portal-leads.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const { claimCallback, takeOwnerText } = await import("../app/lib/lead-gate.ts");

const ACCT = accountScope(OWNER_EMAIL);
const SLUG = "arthurs-plumbing";
const TOKEN = "t".repeat(64);
const OTHER_TOKEN = "o".repeat(64);

const TEXT =
    "I agree that Arthur's Plumbing may call me back at the number I entered, about this request, using an automated system and an AI-generated voice. The call may be recorded. I don't have to agree in order to buy anything, and I can phone instead.";
const HASH = createHash("sha256").update(TEXT).digest("hex");

const redis = fakeUpstash({
    url: KV_URL,
    resolve: (key) => {
        if (key === `portal:lead:token:v1:${TOKEN}`) return { acctScope: ACCT, slug: SLUG };
        if (key === `portal:lead:token:v1:${OTHER_TOKEN}`) return { acctScope: "acct_other", slug: "other-site" };
        return undefined;
    },
});

let texts = [];
let inFlight = 0;
const realFetch = globalThis.fetch;

beforeEach(() => {
    redis.reset();
    texts = [];
    for (const k of Object.keys(process.env)) if (k.startsWith("GATE_")) delete process.env[k];
    // An owner who opted in, so every lead that is allowed a text really sends one.
    redis.kv.set(`jdd:account:${OWNER_EMAIL}`, { value: JSON.stringify({ email: OWNER_EMAIL }), exp: null });
    redis.kv.set(`sms:consent:account:${OWNER_EMAIL}`, { value: OWNER_PHONE, exp: null });
    redis.kv.set(`sms:consent:state:${OWNER_PHONE}`, {
        value: JSON.stringify({ phone: OWNER_PHONE, status: "granted", updatedAt: "2026-11-01T12:00:00.000Z", accountEmail: OWNER_EMAIL }),
        exp: null,
    });
    globalThis.fetch = async (input, init = {}) => {
        inFlight++;
        try {
            await new Promise((r) => setImmediate(r));
            if (redis.owns(input)) return await redis.handle(input, init);
            if (String(input).startsWith("https://api.twilio.com/")) {
                texts.push(Object.fromEntries(new URLSearchParams(String(init.body))));
                return Response.json({ sid: `SM${"s".repeat(32)}` });
            }
            throw new Error(`unexpected fetch: ${input}`);
        } finally {
            inFlight--;
        }
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

const post = (handler, path, body, token = TOKEN) =>
    handler(
        new Request(`https://www.juneaudigitaldesigns.com${path}`, {
            method: "POST",
            headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
    );

const consent = (phone, token) =>
    post(consentPOST, "/api/ingest/call-consent", {
        phone,
        name: "Maria Lopez",
        businessName: "Arthur's Plumbing",
        text: TEXT,
        textHash: HASH,
        textVersion: "lead-call-consent-v1",
        ip: "203.0.113.9",
        userAgent: "TestBrowser/1.0",
    }, token);

const lead = (body, token) => post(leadPOST, "/api/ingest/lead", body, token);

/** Let the `after()` texts, which the route doesn't await, finish: until no request is in flight. */
async function settle() {
    for (let quiet = 0; quiet < 20; ) {
        await new Promise((r) => setTimeout(r, 5));
        quiet = inFlight === 0 ? quiet + 1 : 0;
    }
}

/**
 * What every deployed callback site's `/api/contact` does today, step for step: save the consent,
 * dial only on a 2xx, otherwise record the lead. So this is the burst against a live site.
 */
async function submitToTodaysRoute(phone = "+12073181838", message = "Leak under the sink") {
    const saved = await consent(phone);
    if (saved.ok) return { called: true };
    const res = await lead({ name: "Maria Lopez", phone, message });
    return { called: false, status: res.status, body: await res.json() };
}

/* ── the burst ────────────────────────────────────────────────────────────── */

test("a burst of 20 identical submissions places ONE call and leaves at most ONE lead", async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => submitToTodaysRoute()));
    await settle();

    assert.equal(results.filter((r) => r.called).length, 1, "the number is dialed once, not 20 times");
    const leads = await listLeads(ACCT, SLUG);
    assert.equal(leads.length, 1, "the 19 that weren't called are one lead, not 19");
    assert.equal(leads[0].fields.timesSent, "19");
    assert.equal(leads[0].message, "Leak under the sink", "the same words aren't repeated");
    assert.equal(texts.length, 1, "the owner is texted once about the one lead");
    for (const r of results.filter((r) => !r.called)) assert.equal(r.status, 200, "every visitor is answered normally");
});

test("resubmitting later the same day never re-dials the number", async () => {
    assert.equal((await submitToTodaysRoute()).called, true);
    redis.advance(6 * 60 * 60 * 1000);
    const again = await submitToTodaysRoute();
    assert.equal(again.called, false);
    assert.equal(again.status, 200, "it lands in the inbox instead");
    assert.equal((await listLeads(ACCT, SLUG)).length, 1);
});

test("the number can be called again after 24 hours", async () => {
    assert.equal((await submitToTodaysRoute()).called, true);
    redis.advance(24 * 60 * 60 * 1000 + 1000);
    assert.equal((await submitToTodaysRoute()).called, true);
});

test("a refused callback writes no consent record: no call, nothing to prove", async () => {
    await consent("+12073181838");
    const res = await consent("+12073181838");
    assert.equal(res.status, 429);
    assert.equal((await res.json()).reason, "number-recent");
    assert.equal(redis.lists.get(`call:consent:log:${SLUG}:+12073181838`).length, 1);
});

/* ── across sites, and the daily caps ─────────────────────────────────────── */

test("one number is called by at most two of our sites in a day", async () => {
    const sites = ["a", "b", "c"].map((s) => ({ acct: "acct_x", slug: `site-${s}` }));
    const out = [];
    for (const s of sites) out.push((await claimCallback(s.acct, s.slug, "+12073181838")).ok);
    assert.deepEqual(out, [true, true, false]);
});

test("a site places at most 100 callbacks a day, and the 101st lead is still recorded", async () => {
    for (let i = 0; i < 100; i++) {
        assert.equal((await claimCallback(ACCT, SLUG, `+1407555${String(i).padStart(4, "0")}`)).ok, true, `call ${i + 1}`);
    }
    const held = await claimCallback(ACCT, SLUG, "+14075559999");
    assert.deepEqual(held, { ok: false, reason: "site-daily" });

    // Through the route: no call, and the lead is in the inbox (never throttle a genuine lead).
    const r = await submitToTodaysRoute("+14075558888");
    assert.equal(r.called, false);
    assert.equal(r.status, 200);
    assert.equal((await listLeads(ACCT, SLUG)).length, 1);
});

test("a held call doesn't use up the number's 24 h: the next day it can be called", async () => {
    process.env.GATE_CALLBACK_SITE_DAILY = "0";
    assert.equal((await claimCallback(ACCT, SLUG, "+12073181838")).ok, false);
    delete process.env.GATE_CALLBACK_SITE_DAILY;
    assert.equal((await claimCallback(ACCT, SLUG, "+12073181838")).ok, true, "nothing was kept for a call never placed");
});

test("the all-sites cap is 100 for every site that takes callbacks", async () => {
    process.env.GATE_CALLBACK_SITE_DAILY = "2";
    const ok = [];
    for (const slug of ["s1", "s2", "s3"]) {
        for (let i = 0; i < 2; i++) ok.push((await claimCallback("acct_y", slug, `+1321555${slug.slice(1)}${i}00`)).ok);
    }
    assert.deepEqual(ok, [true, true, true, true, true, true], "3 sites × 2 fit under 2 × 3");
    // A fourth call on s1 is over s1's own cap; the global one is never the first to bind.
    assert.equal((await claimCallback("acct_y", "s1", "+13215559999")).reason, "site-daily");
});

test("the store being down means no call", async () => {
    globalThis.fetch = async (input) => {
        if (redis.owns(input)) return new Response("down", { status: 503 });
        throw new Error("unexpected");
    };
    assert.deepEqual(await claimCallback(ACCT, SLUG, "+12073181838"), { ok: false, reason: "store" });
});

/* ── the owner side ───────────────────────────────────────────────────────── */

test("different people: every lead recorded, the owner texted at most 6 times an hour", async (t) => {
    // The hourly bucket is the wall clock's hour, so the test moves Date itself (the fake store
    // reads the same clock for its TTLs).
    t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-11-09T15:10:00Z") });
    for (let i = 0; i < 9; i++) {
        const res = await lead({ name: "Visitor", phone: `+1407555${String(i).padStart(4, "0")}` });
        assert.equal(res.status, 200);
    }
    await settle();
    assert.equal((await listLeads(ACCT, SLUG)).length, 9, "every lead is in the inbox");
    assert.equal(texts.length, 6, "only the texts are held back");

    t.mock.timers.tick(60 * 60 * 1000);
    await lead({ name: "Visitor", phone: "+14075550099" });
    await settle();
    assert.equal(texts.length, 7, "a new hour, a new allowance");
});

test("an owner text count that can't be read still sends the text", async () => {
    const real = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        if (redis.owns(input) && /"incr"/i.test(init.body)) return new Response("down", { status: 503 });
        return real(input, init);
    };
    assert.equal(await takeOwnerText(ACCT, SLUG), true);
});

test("the same person by email joins their earlier lead too", async () => {
    await lead({ name: "Dana", email: "Dana@Example.com", message: "Quote please" });
    await lead({ name: "Dana", email: "dana@example.com", message: "Also the water heater" });
    await settle();
    const leads = await listLeads(ACCT, SLUG);
    assert.equal(leads.length, 1);
    assert.equal(leads[0].message, "Quote please\n\nAlso the water heater");
    assert.equal(texts.length, 1);
});

test("a day later the same person is a new lead", async () => {
    await lead({ phone: "+12073181838" });
    redis.advance(24 * 60 * 60 * 1000 + 1000);
    await lead({ phone: "+12073181838" });
    assert.equal((await listLeads(ACCT, SLUG)).length, 2);
});

test("one site's leads never merge with another's", async () => {
    await lead({ phone: "+12073181838" });
    await lead({ phone: "+12073181838" }, OTHER_TOKEN);
    assert.equal((await listLeads(ACCT, SLUG)).length, 1);
    assert.equal((await listLeads("acct_other", "other-site")).length, 1);
});

/* ── the follow-up message box ────────────────────────────────────────────── */

const message = (leadId, text, token) => post(messagePOST, "/api/ingest/lead/message", { leadId, message: text }, token);

test("a submission allows one follow-up message, within 30 minutes", async () => {
    const { leadId } = await (await lead({ phone: "+12073181838" })).json();
    assert.equal((await message(leadId, "Leak under the sink")).status, 200);
    assert.equal((await message(leadId, "and again")).status, 409, "a second one is refused");
    assert.equal((await getLead(ACCT, SLUG, leadId)).message, "Leak under the sink");

    const { leadId: later } = await (await lead({ phone: "+14075550001" })).json();
    redis.advance(31 * 60 * 1000);
    assert.equal((await message(later, "too late")).status, 409, "the window closes");
});

test("a lead id alone is not enough to post into a lead nobody just submitted", async () => {
    const { leadId } = await (await lead({ phone: "+12073181838" })).json();
    assert.equal((await message(leadId, "hi", OTHER_TOKEN)).status, 409, "another site's token");
    assert.equal((await message("00000000-0000-0000-0000-000000000000", "hi")).status, 409);
});
