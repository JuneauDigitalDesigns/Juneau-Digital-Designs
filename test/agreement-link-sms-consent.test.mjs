/**
 * An order's private agreement link (`/agree/[code]`) collects the owner SMS opt-in the way the
 * `/agreement` page does (Xander, 2026-11-11: "add the opt-in agreement to the agreement page
 * that we use when we send a on-sales call client a link ... Technically, it is still the
 * agreement page").
 *
 * Before this, a client closed on a sales call had nowhere to opt in once the v1 campaign made
 * portal Settings turn-off only: the link page had no box at all.
 *
 * What it holds the link page to:
 *  - the box shows beside the mobile number field, unticked, in the live campaign's words (v1:
 *    the registered text; v2: today's text), and not at all on a website-only order;
 *  - agreeing without it works and records no consent;
 *  - a ticked box is held exactly as `/agreement` holds one (acceptance time, IP, user agent,
 *    number, version, hash) and becomes the account's consent when the order is paid, which is
 *    when `textAccountOwner` starts texting, and not before.
 *
 * Real routes, page, fulfilment and owner-text path. The network is the only double: an in-memory
 * Upstash, a Blob `put` that keeps nothing, a Clerk that counts invitations, Resend and Twilio.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-recording-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./vercel-blob-hook.mjs", import.meta.url);
register("./next-link-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
const NOTIFICATION_NUMBER = "+16893292464";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_agree",
    RESEND_API_KEY: "re_test",
    OPS_ORDERS_SECRET: "orders-secret",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "private-store-token",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`,
    TWILIO_AUTH_TOKEN: "test-auth",
    TWILIO_MESSAGING_SERVICE_SID: `MG${"m".repeat(32)}`,
    TWILIO_NOTIFICATION_NUMBER: NOTIFICATION_NUMBER,
});

const { createAgreementLink } = await import("../app/lib/agreement-link.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const agree = await import("../app/api/agree/[code]/route.ts");
const { default: AgreePage } = await import("../app/agree/[code]/page.tsx");
const { fulfilOperatorPayment } = await import("../app/lib/checkout-fulfillment.ts");
const { textAccountOwner } = await import("../app/lib/lead-alert.ts");
const { getConsentLog, getConsentStateForAccount, isDeliverable } = await import("../app/lib/sms-consent.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");

/** As registered in the approved campaign's message flow (read live from Twilio 2026-11-11). */
const V1_TEXT =
    "Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile number above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies based on call volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.";
const V1_HASH = "ec4b199541d31b556e643c6a387198ae73daf3df3a41b68a18147505c7c725b8";
/** Today's text, unchanged since 2026-10-31. */
const V2_TEXT =
    "Yes, text me call summaries, new-lead alerts, and service alerts about my own Juneau Digital Designs account at the mobile number above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies based on call and lead volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.";
const V2_HASH = "8f05b3bedd688820a666c740e7dcf2720a6161a319742ade984836ea3666c460";

const EMAIL = "arthur@arthursplumbing.com";
const CELL = "+14075550188";

const order = (o = {}) => ({
    id: "ord_agree",
    version: 1,
    source: "operator-call",
    status: "draft",
    leadId: "lead_1",
    siteSlug: "arthurs-plumbing",
    plan: "growth",
    period: "monthly",
    pricing: { kind: "standard" },
    client: {
        legalName: "Arthur's Plumbing LLC",
        entityType: "LLC",
        address: "1 Main St, Orlando, FL 32801",
        contactName: "Arthur Dent",
        contactTitle: "Owner",
        email: EMAIL,
        phone: "+14075550123",
    },
    vertical: "plumbing",
    receptionistMode: "forwarded",
    forwardingNumber: "+14075550123",
    operator: "xander",
    events: [],
    createdAt: 1793800000000,
    updatedAt: 1793800000000,
    ...o,
});
const webOnlyOrder = () => order({ plan: "starter", receptionistMode: "declined", forwardingNumber: undefined });

/* ── the network ──────────────────────────────────────────────────────────── */

const redis = fakeUpstash({ url: KV_URL });
// `persist` (the agreement kept past its TTL) is answered here: the shared fake doesn't speak it.
const realHandle = redis.handle;
let texts = [];
const realFetch = globalThis.fetch;

const seed = (key, value) => redis.kv.set(key, { value: JSON.stringify(value), exp: null });
const read = (key) => {
    const v = redis.get(key);
    return v === undefined ? null : JSON.parse(v);
};
const saved = () => read("jdd:order:ord_agree");
const consentKeys = () => [...redis.kv.keys()].filter((k) => k.startsWith("sms:consent:"));

beforeEach(() => {
    redis.reset();
    texts = [];
    globalThis.__clerk = { created: 0 };
    delete process.env.OWNER_TEXT_CAMPAIGN;
    seed("jdd:order:ord_agree", order());
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (redis.owns(url)) {
            const body = JSON.parse(init.body);
            const cmds = url.endsWith("/pipeline") ? body : [body];
            if (cmds.every((c) => String(c[0]).toLowerCase() === "persist")) {
                return url.endsWith("/pipeline") ? Response.json(cmds.map(() => ({ result: 1 }))) : Response.json({ result: 1 });
            }
            return realHandle(input, init);
        }
        if (url.startsWith("https://api.resend.com/")) {
            return Response.json({ id: "email_1" });
        }
        if (url.startsWith("https://api.twilio.com/")) {
            texts.push(Object.fromEntries(new URLSearchParams(String(init.body))));
            return Response.json({ sid: `SM${"s".repeat(32)}` });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OWNER_TEXT_CAMPAIGN;
});

const submit = (code, overrides = {}, forOrder = order()) =>
    agree.POST(
        new Request(`http://agency.test/api/agree/${code}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "phone-browser" },
            body: JSON.stringify({
                accepted: true,
                termsHash: termsHashForOrder(forOrder, "master"),
                pageOpenedAt: "2026-11-11T15:00:00Z",
                scrollCompletedAt: "2026-11-11T15:02:00Z",
                ...overrides,
            }),
        }),
        { params: Promise.resolve({ code }) },
    );

/** The link page, rendered the way a browser first receives it. */
async function pageText(code) {
    const html = renderToStaticMarkup(await AgreePage({ params: Promise.resolve({ code }) }));
    return { html, text: html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'") };
}

/* ── what the page shows ──────────────────────────────────────────────────── */

test("v1: the link page shows the registered opt-in, word for word, unticked, beside the mobile number", async () => {
    const { code } = await createAgreementLink(order());
    const { html, text } = await pageText(code);
    assert.ok(text.includes(V1_TEXT), "the registered checkbox text");
    assert.ok(!text.includes(V2_TEXT));
    assert.ok(text.includes("Mobile number for text alerts"), "the label, \"text alerts\" in both modes");
    assert.ok(text.includes("OPTIONAL · TEXT ALERTS"));
    assert.ok(text.includes("Optional. Used only if you turn on call summary texts below."), "v1 keeps its hint");
    assert.doesNotMatch(text, /call alerts|CALL ALERT TEXTS/);
    assert.match(html, /<a [^>]*href="\/sms-terms"[^>]*>SMS Terms<\/a>/);
    assert.match(html, /<a [^>]*href="\/privacy-policy"[^>]*>Privacy Policy<\/a>/);
    const box = html.match(/<input type="checkbox"[^>]*name="smsConsent"[^>]*\/>/);
    assert.ok(box, "the consent box");
    assert.doesNotMatch(box[0], /checked/, "never pre-ticked");
    assert.ok(html.indexOf('id="mobile-number-for-text-alerts"') < html.indexOf(box[0]), "the number field comes first");
});

test("v2: the link page shows today's text", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    const { code } = await createAgreementLink(order());
    const { text } = await pageText(code);
    assert.ok(text.includes(V2_TEXT));
    assert.ok(!text.includes(V1_TEXT));
    assert.ok(text.includes("Mobile number for text alerts"));
    assert.ok(text.includes("OPTIONAL · TEXT ALERTS"));
    assert.ok(text.includes("Optional. Used only if you turn on text alerts below."), "v2's hint");
    assert.doesNotMatch(text, /call alerts|CALL ALERT TEXTS|call summary texts below/);
});

test("a website-only order has nothing to text about, so no opt-in", async () => {
    seed("jdd:order:ord_agree", webOnlyOrder());
    const { code } = await createAgreementLink(webOnlyOrder());
    const { html, text } = await pageText(code);
    assert.ok(text.includes("I have read and agree"), "the page itself renders");
    assert.doesNotMatch(html, /name="smsConsent"/);
    assert.ok(!text.includes(V1_TEXT));
});

/* ── what it records ──────────────────────────────────────────────────────── */

test("agreeing without the box records the agreement and no consent", async () => {
    const { code } = await createAgreementLink(order());
    // A number typed and the box left empty: the page sends neither, and nothing is kept.
    const res = await submit(code);
    assert.equal(res.status, 200);
    assert.equal(saved().status, "terms-accepted");
    assert.ok(saved().agreementId);
    assert.deepEqual(consentKeys(), []);
});

for (const [mode, version, hash] of [
    ["v1", "sms-consent-v1", V1_HASH],
    ["v2", "sms-consent-v2", V2_HASH],
]) {
    test(`${mode}: a ticked box is held against the new agreement, as /agreement holds one`, async () => {
        if (mode === "v2") process.env.OWNER_TEXT_CAMPAIGN = "v2";
        const { code } = await createAgreementLink(order());
        const res = await submit(code, { smsConsent: true, alertPhone: "(407) 555-0188", smsConsentVersion: version });
        assert.equal(res.status, 200);

        const agreementId = saved().agreementId;
        const record = read(`jdd:agreement:${agreementId}`) ?? read(`agreement:${agreementId}`);
        const pending = read(`sms:consent:pending:${agreementId}`);
        assert.deepEqual(pending, {
            agreementId,
            phone: CELL,
            capturedAt: record.audit.signedAt,
            ip: "203.0.113.9",
            userAgent: "phone-browser",
            consentTextHash: hash,
            consentTextVersion: version,
            signerEmail: EMAIL,
        });
        // Held, not live: nothing is texted for a purchase that hasn't happened.
        assert.equal(redis.get(`sms:consent:account:${EMAIL}`), undefined);
    });
}

test("a ticked box with no usable number, or on a website-only order, records nothing", async () => {
    const { code } = await createAgreementLink(order());
    const bad = await submit(code, { smsConsent: true, alertPhone: "12", smsConsentVersion: "sms-consent-v1" });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).error, "A valid mobile number is required to enable text alerts");
    assert.equal(saved().status, "draft");

    seed("jdd:order:ord_agree", webOnlyOrder());
    const webOnly = await createAgreementLink(webOnlyOrder());
    const res = await submit(webOnly.code, { smsConsent: true, alertPhone: CELL, smsConsentVersion: "sms-consent-v1" }, webOnlyOrder());
    assert.equal(res.status, 400);
    assert.equal(saved().status, "draft");
    assert.deepEqual(consentKeys(), []);
});

test("the consent reaches textAccountOwner once the order is paid, and not before", async () => {
    const { code } = await createAgreementLink(order());
    assert.equal((await submit(code, { smsConsent: true, alertPhone: CELL, smsConsentVersion: "sms-consent-v1" })).status, 200);
    const agreementId = saved().agreementId;

    const acctScope = accountScope(EMAIL);
    const ownerText = () => textAccountOwner({ acctScope, slug: "arthurs-plumbing", body: "Juneau Digital Designs call alert", tag: "test" });

    // Accepted, payment link out, not paid.
    seed("jdd:order:ord_agree", { ...saved(), status: "awaiting-payment", payment: { method: "link", stripeCustomerId: "cus_1" } });
    seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: [], createdAt: 1, updatedAt: 1 });
    assert.deepEqual(await ownerText(), { sent: false, reason: "no-consent" });

    await fulfilOperatorPayment("ord_agree", { ref: "cs_1", checkoutSessionId: "cs_1", customerId: "cus_1", subscriptionId: "sub_1", amountTotal: 49700 });

    // The close is untouched: fulfilled, with one portal invitation.
    assert.equal(saved().status, "fulfilled");
    assert.equal(globalThis.__clerk.created, 1);

    const state = await getConsentStateForAccount(EMAIL);
    assert.ok(isDeliverable(state), "granted for the account");
    assert.equal(state.phone, CELL);
    const [event] = await getConsentLog(CELL);
    assert.equal(event.action, "granted");
    assert.equal(event.source, "agreement");
    assert.equal(event.agreementId, agreementId);
    assert.equal(event.consentTextVersion, "sms-consent-v1");
    assert.equal(event.consentTextHash, V1_HASH);
    assert.equal(event.ip, "203.0.113.9");

    const sent = await ownerText();
    assert.equal(sent.sent, true);
    assert.equal(texts.length, 1);
    assert.equal(texts[0].To, CELL);
});
