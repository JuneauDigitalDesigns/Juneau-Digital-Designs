/**
 * No consent on record, no text: every way the portal texts a customer is gated on consent.
 *
 * Found in the client A2P audit, 2026-11-16. The portal blocked a number whose call answer was "no"
 * or never given, but a customer with no call on record, from the website form or added by hand,
 * could be texted with no consent check at all. The form's own consent record was stored on the
 * lead and read by nothing. Xander's decision: "every portal text, review requests included" is
 * gated on the customer's consent being collected and attached to their record, failing closed.
 *
 * Consent is one of:
 *  - a clear yes on a recorded call, for that exact number (`spoken-consent.ts`); or
 *  - the website form's SMS consent record on the lead the customer came from, with the approved
 *    wording's version and hash, for the same number.
 * Anything else, including a call log that can't be read, refuses.
 *
 * Real routes, real stores (an in-memory Upstash), real plan gate. Twilio is a fetch stub that
 * records what would have been sent.
 *
 * Run: `npm test`
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./portal-crm-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
});

const redis = fakeUpstash({ url: KV_URL });
let sent = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (redis.owns(url)) return redis.handle(input, init);
    if (url.startsWith("https://api.twilio.com/")) {
        sent.push(Object.fromEntries(new URLSearchParams(String(init.body))));
        return Response.json({ sid: `SM${"s".repeat(32)}` });
    }
    return realFetch(input, init);
};

/** Growth, carriers approved, a number and service to send from, a review link. No call log. */
const SITE = {
    slug: "your-hvac",
    name: "Your HVAC Co.",
    plan: "growth",
    status: "live",
    a2pStatus: "verified",
    twilioNumber: "+14075550100",
    messagingServiceSid: `MG${"m".repeat(32)}`,
    googleReviewUrl: "https://g.page/r/test/review",
};
const OWNER = "owner@yourhvac.test";
globalThis.__portalCrm = { email: OWNER, site: SITE };

const crm = await import("../app/lib/portal-crm.ts");
const leads = await import("../app/lib/portal-leads.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const { NOT_AGREED_MESSAGE } = await import("../app/lib/spoken-consent.ts");
const rules = await import("../app/lib/text-consent.ts");
const { sendSms } = await import("../app/lib/twilio.ts");
const messagesRoute = await import("../app/api/portal/messages/route.ts");
const reviewRoute = await import("../app/api/portal/review-request/route.ts");

const ACCT = accountScope(OWNER);
const CELL = "+14075550188";
const OTHER = "+14075550199";

/** The approved form wording, @jdd/ui v1.7.0 `LEAD_SMS_CONSENT_TEXT`, and its hash. */
const FORM_TEXT =
    "By giving us your number you agree we may text you about your enquiry. Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.";
const FORM_HASH = createHash("sha256").update(FORM_TEXT).digest("hex");
const FORM_CONSENT = JSON.stringify({ basis: "web-form", textHash: FORM_HASH, textVersion: "lead-sms-consent-v1", capturedAt: "2026-11-16T12:00:00Z" });

beforeEach(() => {
    redis.reset();
    sent = [];
});

const post = async (route, body) => {
    const res = await route.POST(
        new Request("https://portal.test/api?site=your-hvac", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }),
    );
    return { status: res.status, json: await res.json() };
};
const reply = (customerId) => post(messagesRoute, { customerId, body: "We can come Thursday at 9. Does that work?" });
const askReview = (phone) => post(reviewRoute, { phone, messageBody: "Thanks for choosing us!" });

const manualCustomer = async (phone = CELL) =>
    (await crm.createCustomer(ACCT, SITE.slug, { name: "Dana", phone, source: "manual" }, "user_test")).customer;
const formCustomer = async ({ consent = FORM_CONSENT, leadPhone = CELL, customerPhone = CELL } = {}) => {
    const lead = await leads.recordLead({
        acctScope: ACCT,
        slug: SITE.slug,
        name: "Dana",
        phoneRaw: leadPhone,
        message: "AC is out",
        fields: consent ? { consent } : {},
    });
    const { customer } = await crm.createCustomer(
        ACCT,
        SITE.slug,
        { name: "Dana", phone: customerPhone, source: "web-form", sourceRef: `lead:${lead.leadId}` },
        "user_test",
    );
    return customer;
};

/* ── the routes ───────────────────────────────────────────────────────────── */

test("a customer added by hand, with no consent anywhere, can't be texted or sent a review request", async () => {
    const c = await manualCustomer();
    const r = await reply(c.customerId);
    assert.equal(r.status, 409);
    assert.equal(r.json.error, NOT_AGREED_MESSAGE);
    const rv = await askReview(CELL);
    assert.equal(rv.status, 409);
    assert.equal(rv.json.error, NOT_AGREED_MESSAGE);
    assert.deepEqual(sent, [], "nothing reached Twilio");
});

test("a form customer whose lead carries no consent record can't be texted", async () => {
    const c = await formCustomer({ consent: null });
    assert.equal((await reply(c.customerId)).status, 409);
    assert.equal((await askReview(CELL)).status, 409);
    assert.deepEqual(sent, []);
});

test("a form consent record with the wrong wording, or about another number, doesn't count", async () => {
    const forged = JSON.stringify({ basis: "web-form", textHash: "0".repeat(64), textVersion: "lead-sms-consent-v1" });
    const a = await formCustomer({ consent: forged });
    assert.equal((await reply(a.customerId)).status, 409, "a hash that isn't the approved wording");
    redis.reset();
    const b = await formCustomer({ leadPhone: OTHER, customerPhone: CELL });
    assert.equal((await reply(b.customerId)).status, 409, "the lead's consent was for another number");
    assert.deepEqual(sent, []);
});

test("a form customer with the approved consent record on their lead can be texted and asked for a review", async () => {
    const c = await formCustomer();
    const r = await reply(c.customerId);
    assert.equal(r.status, 200, JSON.stringify(r.json));
    const rv = await askReview(CELL);
    assert.equal(rv.status, 200, JSON.stringify(rv.json));
    assert.equal(sent.length, 2);
    assert.ok(sent.every((s) => s.To === CELL && s.MessagingServiceSid === SITE.messagingServiceSid));
});

test("an opt-out still wins over a form consent", async () => {
    const c = await formCustomer();
    await crm.recordReviewSend({ acctScope: ACCT, e164: CELL, sentBy: "x", siteSlug: SITE.slug, messageSid: null, deliveryStatus: "unknown" });
    await crm.markReviewOptOut(ACCT, CELL);
    assert.equal((await reply(c.customerId)).status, 409);
    assert.deepEqual(sent, []);
});

/* ── the last line: sendSms itself ────────────────────────────────────────── */

test("sendSms refuses a customer-lane text that didn't come through the consent gate", async () => {
    await assert.rejects(
        sendSms({ to: CELL, body: "hi", lane: "customer", messagingServiceSid: SITE.messagingServiceSid, from: SITE.twilioNumber }),
        /consent/i,
    );
    await assert.rejects(
        sendSms({
            to: CELL,
            body: "hi",
            lane: "customer",
            messagingServiceSid: SITE.messagingServiceSid,
            from: SITE.twilioNumber,
            consent: { phone: CELL, basis: "call" },
        }),
        /consent/i,
        "a look-alike object is not a consent the gate issued",
    );
    assert.deepEqual(sent, []);
});

/* ── the rule ─────────────────────────────────────────────────────────────── */

test("the decision, case by case, failing closed", () => {
    const d = (o) => rules.decideTextConsent({ optedOut: false, spoken: null, formCovers: false, ...o });
    assert.deepEqual(d({}), { ok: false, reason: "not-agreed" }, "no evidence at all");
    assert.deepEqual(d({ formCovers: true }), { ok: true, basis: "web-form" });
    assert.deepEqual(d({ spoken: "granted" }), { ok: true, basis: "call" });
    assert.deepEqual(d({ spoken: "declined", formCovers: true }), { ok: false, reason: "declined" }, "a no on a call beats the form");
    assert.deepEqual(d({ spoken: "unknown", formCovers: true }), { ok: false, reason: "not-agreed" }, "as before: an unanswered ask blocks");
    assert.deepEqual(d({ spoken: "unavailable", formCovers: true }), { ok: false, reason: "unavailable" }, "can't read the call log: no");
    assert.deepEqual(d({ optedOut: true, spoken: "granted" }), { ok: false, reason: "opted-out" });
});

test("a form consent covers only its own number, and only the approved wording", () => {
    const lead = (over = {}) => ({ phone: CELL, phoneRaw: CELL, fields: { consent: FORM_CONSENT }, ...over });
    assert.equal(rules.formConsentCovers(lead(), CELL), true);
    assert.equal(rules.formConsentCovers(lead(), OTHER), false);
    assert.equal(rules.formConsentCovers(lead({ fields: {} }), CELL), false);
    assert.equal(rules.formConsentCovers(lead({ fields: { consent: "not json" } }), CELL), false);
    assert.equal(rules.formConsentCovers(lead({ fields: { consent: JSON.stringify({ basis: "web-form", textHash: FORM_HASH, textVersion: "lead-sms-consent-v9" }) } }), CELL), false);
    assert.equal(rules.formConsentCovers(null, CELL), false);
    assert.equal(rules.LEAD_SMS_CONSENT_HASHES["lead-sms-consent-v1"], FORM_HASH, "pinned to @jdd/ui v1.7.0's wording");
});

/** @jdd/ui v1.9.0 `LEAD_SMS_CONSENT_TEXT` (v2, 2026-11-20): v1 respelled "inquiry". */
const FORM_TEXT_V2 =
    "By giving us your number you agree we may text you about your inquiry. Message and data rates may apply. Message frequency varies. Reply STOP to opt out, HELP for help.";
/** The hash @jdd/ui's own test pins for v2, so the two repos are held to one wording. */
const FORM_HASH_V2 = "729ea625dbf0c0d592b3fb6724803609eac36593495eb02b67a021665da79169";

test("the respelled form wording (v2) is approved, and v1 records still are", () => {
    // Without the v2 row, every lead from a v1.9.0 form reads as no consent and can't be texted.
    assert.equal(createHash("sha256").update(FORM_TEXT_V2).digest("hex"), FORM_HASH_V2);
    assert.equal(rules.LEAD_SMS_CONSENT_HASHES["lead-sms-consent-v2"], FORM_HASH_V2);
    const lead = (consent) => ({ phone: CELL, phoneRaw: CELL, fields: { consent: JSON.stringify(consent) } });
    const v2 = { basis: "web-form", textHash: FORM_HASH_V2, textVersion: "lead-sms-consent-v2" };
    assert.equal(rules.formConsentCovers(lead(v2), CELL), true, "a v2 form lead can be texted");
    assert.equal(rules.formConsentCovers({ phone: CELL, phoneRaw: CELL, fields: { consent: FORM_CONSENT } }, CELL), true, "v1 leads still can");
    // A version names exactly one wording: each hash under the other's name is refused.
    assert.equal(rules.formConsentCovers(lead({ ...v2, textHash: FORM_HASH }), CELL), false);
    assert.equal(rules.formConsentCovers(lead({ ...v2, textVersion: "lead-sms-consent-v1" }), CELL), false);
});
