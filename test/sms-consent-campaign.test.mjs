/**
 * The owner SMS opt-in follows the A2P campaign that is live (`OWNER_TEXT_CAMPAIGN`, the switch
 * from #96), the same way the owner texts already do.
 *
 * **What this encodes.** The approved (v1) campaign, read live from Twilio 2026-11-11, registers
 * one checkbox text and one place to collect it: the Service Agreement page, beside the mobile
 * number field, unchecked, separate from accepting the agreement, before purchase. Production was
 * showing a different text (`sms-consent-v2`, which adds new-lead alerts the v1 campaign never
 * declares). Xander, 2026-11-11: under v1, fall back to exactly what is registered; keep today's
 * text for v2. The registered text is the one this repo shipped on 2026-08-13 as `sms-consent-v1`,
 * so the original id and hash are reused and earlier v1 records stay provable.
 *
 * Labels around the box say "text alerts", not "call alerts", in both modes (Xander, 2026-11-11).
 *
 * Real implementations: the wording module, the shared opt-in component, the real `POST
 * /api/agreement` (side effects swapped by `agreement-route-hook.mjs`, consent store on an
 * in-memory Upstash), the welcome email and the SMS Terms page.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./agreement-route-hook.mjs", import.meta.url);
register("./next-link-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "private-store-token",
});

const consentText = await import("../app/lib/sms-consent-text.ts");
const { hashConsentText } = await import("../app/lib/sms-consent.ts");
const { default: SmsOptIn, SMS_OPT_IN_PHONE_ERROR } = await import("../app/components/agreement/SmsOptIn.tsx");
const { POST } = await import("../app/api/agreement/route.ts");
const { renderWelcomeEmail } = await import("../app/lib/welcome-email.ts");
const { default: SmsTermsPage } = await import("../app/sms-terms/page.tsx");
const { validateAgreementSubmission } = await import("../app/lib/agreement-validate.mjs");

/** The approved campaign's checkbox text, exactly as its message flow registers it. */
const V1_TEXT =
    "Yes, text me call summaries and service alerts from Juneau Digital Designs at the mobile number above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies based on call volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.";
/** The hash `sms-consent-v1` records carried from 2026-08-13 until v2 replaced the text. */
const V1_HASH = "ec4b199541d31b556e643c6a387198ae73daf3df3a41b68a18147505c7c725b8";
/** Today's text, unchanged. */
const V2_TEXT =
    "Yes, text me call summaries, new-lead alerts, and service alerts about my own Juneau Digital Designs account at the mobile number above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies based on call and lead volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.";
/** The hash every `sms-consent-v2` record stored since 2026-10-31 carries. */
const V2_HASH = "8f05b3bedd688820a666c740e7dcf2720a6161a319742ade984836ea3666c460";

const strip = (html) => html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");

/* ── the wording ──────────────────────────────────────────────────────────── */

test("v1 is the registered checkbox text, word for word, under its original id and hash", () => {
    assert.equal(consentText.SMS_CONSENT_V1.text, V1_TEXT);
    assert.equal(consentText.SMS_CONSENT_V1.version, "sms-consent-v1");
    assert.equal(hashConsentText(consentText.SMS_CONSENT_V1.text), V1_HASH);
});

test("v2 is today's text, unchanged, under its id and hash", () => {
    assert.equal(consentText.SMS_CONSENT_V2.text, V2_TEXT);
    assert.equal(consentText.SMS_CONSENT_V2.version, "sms-consent-v2");
    assert.equal(hashConsentText(consentText.SMS_CONSENT_V2.text), V2_HASH);
});

test("the switch: unset or anything but v2 shows v1; exactly v2 shows v2", () => {
    assert.equal(consentText.smsConsentCopy({}), consentText.SMS_CONSENT_V1);
    assert.equal(consentText.smsConsentCopy({ OWNER_TEXT_CAMPAIGN: "V2" }), consentText.SMS_CONSENT_V1);
    assert.equal(consentText.smsConsentCopy({ OWNER_TEXT_CAMPAIGN: "v3" }), consentText.SMS_CONSENT_V1);
    assert.equal(consentText.smsConsentCopy({ OWNER_TEXT_CAMPAIGN: "v2" }), consentText.SMS_CONSENT_V2);
});

test("a submission's version names the words it showed; none means a page from before, which showed v2", () => {
    assert.equal(consentText.smsConsentCopyForVersion("sms-consent-v1"), consentText.SMS_CONSENT_V1);
    assert.equal(consentText.smsConsentCopyForVersion("sms-consent-v2"), consentText.SMS_CONSENT_V2);
    assert.equal(consentText.smsConsentCopyForVersion(undefined), consentText.SMS_CONSENT_V2);
    assert.equal(consentText.smsConsentCopyForVersion("sms-consent-v9"), null);
});

/* ── the opt-in both agreement pages render ───────────────────────────────── */

const renderOptIn = (copy) =>
    renderToStaticMarkup(
        createElement(SmsOptIn, { copy, phone: "", onPhoneChange: () => {}, checked: false, onCheckedChange: () => {} }),
    );

test("v1 opt-in: the registered text beside the number field, unticked, labelled text alerts, the v1 hint", () => {
    const html = renderOptIn(consentText.SMS_CONSENT_V1);
    const text = strip(html);
    assert.ok(text.includes(V1_TEXT));
    assert.ok(text.includes("━ OPTIONAL · TEXT ALERTS"));
    assert.ok(text.includes("━ Mobile number for text alerts"));
    assert.ok(text.includes("Optional. Used only if you turn on call summary texts below."));
    assert.doesNotMatch(text, /call alert/i);
    assert.match(html, /<a [^>]*href="\/sms-terms"[^>]*>SMS Terms<\/a>/);
    assert.match(html, /<a [^>]*href="\/privacy-policy"[^>]*>Privacy Policy<\/a>/);
    assert.doesNotMatch(html.match(/<input type="checkbox"[^>]*>/)[0], /checked/);
});

test("v2 opt-in: today's text, labelled text alerts, the v2 hint", () => {
    const text = strip(renderOptIn(consentText.SMS_CONSENT_V2));
    assert.ok(text.includes(V2_TEXT));
    assert.ok(text.includes("━ OPTIONAL · TEXT ALERTS"));
    assert.ok(text.includes("━ Mobile number for text alerts"));
    assert.ok(text.includes("Optional. Used only if you turn on text alerts below."));
    assert.doesNotMatch(text, /call alert|call summary texts below/i);
});

test("the validation messages say text alerts", () => {
    assert.equal(SMS_OPT_IN_PHONE_ERROR, "Enter a valid mobile number for text alerts, or uncheck the text alerts box.");
    const base = {
        plan: "starter", clientLegalName: "R LLC", clientEntityType: "LLC", clientAddress: "1 A St", signerName: "M R",
        signerTitle: "Owner", signerEmail: "m@r.example", additionalSites: [], termsAccepted: true,
        pageOpenedAt: "2026-11-11T15:00:00Z", scrollCompletedAt: "2026-11-11T15:01:00Z", receptionistMode: "published",
    };
    assert.equal(validateAgreementSubmission({ ...base, smsConsent: true, alertPhone: "12" }), "A valid mobile number is required to enable text alerts");
    assert.equal(
        validateAgreementSubmission({ ...base, receptionistMode: "declined", smsConsent: true, alertPhone: "(407) 555-0143" }),
        "Text alerts require a receptionist",
    );
});

test("both agreement pages render the one shared opt-in, with the wording the server picked", () => {
    const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
    for (const p of ["app/components/agreement/AgreementClient.tsx", "app/components/agreement/AgreeLinkClient.tsx"]) {
        const src = read(p);
        assert.match(src, /<SmsOptIn\b/, `${p} renders SmsOptIn`);
        assert.match(src, /smsConsentVersion: smsConsentCopy\.version/, `${p} sends the version it showed`);
        assert.doesNotMatch(src, /splitConsentText\(/, `${p} renders the consent text only through SmsOptIn`);
    }
    assert.match(read("app/agreement/page.tsx"), /smsConsentCopy=\{smsConsentCopy\(\)\}/);
    assert.match(read("app/agree/[code]/page.tsx"), /smsConsentCopy=\{smsConsentCopy\(\)\}/);
});

/* ── /api/agreement records the words shown ───────────────────────────────── */

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;
let state;
beforeEach(() => {
    redis.reset();
    delete process.env.OWNER_TEXT_CAMPAIGN;
    state = {
        userId: "user_rivera",
        accounts: { user_rivera: { email: "marisol@riverapd.example", sites: [], createdAt: 0, updatedAt: 0 } },
        calls: [],
        afterTasks: [],
        savedAgreements: [],
        savedAccounts: [],
        emailsTo: [],
    };
    globalThis.__agreementRoute = state;
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(String(input))) return redis.handle(input, init);
        throw new Error(`unexpected fetch: ${String(input)}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OWNER_TEXT_CAMPAIGN;
});

async function sign(overrides = {}) {
    const res = await POST(
        new Request("http://localhost/api/agreement", {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.7", "user-agent": "laptop-browser" },
            body: JSON.stringify({
                plan: "starter",
                clientLegalName: "Rivera Plumbing & Drain LLC",
                clientEntityType: "LLC",
                clientAddress: "1420 Example Ave, Orlando, FL 32801",
                signerName: "Marisol Rivera",
                signerTitle: "Owner",
                signerEmail: "marisol@riverapd.example",
                additionalSites: [],
                billingPeriod: "monthly",
                pageOpenedAt: "2026-11-11T15:00:00.000Z",
                scrollCompletedAt: "2026-11-11T15:01:00.000Z",
                receptionistMode: "published",
                termsAccepted: true,
                ...overrides,
            }),
        }),
    );
    return { status: res.status, ...(await res.json()) };
}
const pendingFor = (id) => {
    const v = redis.get(`sms:consent:pending:${id}`);
    return v === undefined ? null : JSON.parse(v);
};

test("v1: a ticked box on /agreement is held with the registered version and hash", async () => {
    const out = await sign({ smsConsent: true, alertPhone: "+14075550143", smsConsentVersion: "sms-consent-v1" });
    assert.equal(out.status, 200);
    const pending = pendingFor(out.agreement_id);
    assert.equal(pending.consentTextVersion, "sms-consent-v1");
    assert.equal(pending.consentTextHash, V1_HASH);
    assert.equal(pending.phone, "+14075550143");
    assert.equal(pending.ip, "198.51.100.7");
    assert.equal(pending.userAgent, "laptop-browser");
});

test("v2: a ticked box on /agreement is held with today's version and hash", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    const out = await sign({ smsConsent: true, alertPhone: "+14075550143", smsConsentVersion: "sms-consent-v2" });
    const pending = pendingFor(out.agreement_id);
    assert.equal(pending.consentTextVersion, "sms-consent-v2");
    assert.equal(pending.consentTextHash, V2_HASH);
});

test("a page loaded before this deploy showed v2, so its tick is recorded as v2 whatever the switch says", async () => {
    const out = await sign({ smsConsent: true, alertPhone: "+14075550143" });
    assert.equal(pendingFor(out.agreement_id).consentTextVersion, "sms-consent-v2");
});

test("a version this deploy doesn't know records nothing; no tick records no consent", async () => {
    const unknown = await sign({ smsConsent: true, alertPhone: "+14075550143", smsConsentVersion: "sms-consent-v9" });
    assert.equal(unknown.status, 400);
    assert.equal(state.savedAgreements.length, 0);

    const none = await sign();
    assert.equal(none.status, 200);
    assert.equal(pendingFor(none.agreement_id), null);
    assert.deepEqual([...redis.kv.keys()].filter((k) => k.startsWith("sms:consent:")), []);
});

/* ── the other places the opt-in is described ─────────────────────────────── */

const welcome = () =>
    renderWelcomeEmail({
        signerEmail: "m@r.example",
        signerName: "Marisol Rivera",
        clientLegalName: "Rivera Plumbing & Drain LLC",
        plan: "growth",
        receptionistMode: "published",
        siteSlug: "rivera",
    }).html;

test("v1: the welcome email doesn't send the client to opt in from Settings; v2 does, as before", () => {
    assert.doesNotMatch(welcome(), /Settings &rarr; Text alerts/);
    assert.doesNotMatch(welcome(), /Get a text for every new lead/);
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    assert.match(welcome(), /Settings &rarr; Text alerts/);
    assert.match(welcome(), /Get a text for every new lead/);
});

test("/sms-terms quotes the wording the agreement pages show", () => {
    assert.ok(strip(renderToStaticMarkup(SmsTermsPage())).includes(V1_TEXT));
    process.env.OWNER_TEXT_CAMPAIGN = "v2";
    assert.ok(strip(renderToStaticMarkup(SmsTermsPage())).includes(V2_TEXT));
});
