/**
 * The text-alerts choice on both agreement pages: two cards, neither chosen, one required.
 *
 * Xander's retest, 2026-11-15: "it allowed me to put in a phone number and not agree to SMS, there
 * is no point to agree to the SMS if there is no phone number." His decision: "two cards, one that
 * revealed the phone number input and the opt in message with the check box to record their
 * consent, and the other for them to bypass it, if we dont collect their consent, we dont send
 * messages."
 *
 * What it holds the pages and the routes to:
 *  - no card chosen: no agreement;
 *  - Yes: a complete US number AND the registered box ticked, or no agreement; the tick is the
 *    consent, recorded exactly as before;
 *  - No: agrees, with no number and no consent recorded;
 *  - the registered box and words are unchanged and sit directly beside the number;
 *  - the cards' words follow the campaign (v1 promises calls only);
 *  - website-only orders have no cards, as they had no box;
 *  - the "Continue without text alerts?" notice is gone.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-recording-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./vercel-blob-hook.mjs", import.meta.url);
register("./next-link-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_agree",
    RESEND_API_KEY: "re_test",
    OPS_ORDERS_SECRET: "orders-secret",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "private-store-token",
});

const choice = await import("../app/lib/text-alerts-choice.mjs");
const { smsConsentCopy, SMS_CONSENT_V1, SMS_CONSENT_V2 } = await import("../app/lib/sms-consent-text.ts");
const { default: SmsOptIn } = await import("../app/components/agreement/SmsOptIn.tsx");
const { validateAgreementSubmission } = await import("../app/lib/agreement-validate.mjs");
const { createAgreementLink } = await import("../app/lib/agreement-link.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const agree = await import("../app/api/agree/[code]/route.ts");

const { TEXT_ALERTS_CHOICE_ERROR: CHOOSE, TEXT_ALERTS_NUMBER_ERROR: NUMBER, TEXT_ALERTS_TICK_ERROR: TICK } = choice;
const CELL = "(407) 555-0188";

/* ── the words ────────────────────────────────────────────────────────────── */

test("the error lines, word for word", () => {
    assert.equal(CHOOSE, "Choose whether you want text alerts.");
    assert.equal(NUMBER, "Enter a complete 10-digit mobile number, or choose No text messages.");
    assert.equal(TICK, "Tick the box to agree to text alerts, or choose No text messages.");
});

test("each campaign's cards, word for word, picked by OWNER_TEXT_CAMPAIGN through the opt-in's version", () => {
    const saved = process.env.OWNER_TEXT_CAMPAIGN;
    try {
        delete process.env.OWNER_TEXT_CAMPAIGN;
        assert.deepEqual(choice.textAlertsCards(smsConsentCopy().version), {
            heading: "TEXT ALERTS · CHOOSE ONE",
            yes: { title: "Yes, text me about my calls", line: "A short text each time your AI receptionist takes a call." },
            no: { title: "No text messages", line: "I'll check my portal inbox for new leads and calls myself." },
        });
        process.env.OWNER_TEXT_CAMPAIGN = "v2";
        assert.deepEqual(choice.textAlertsCards(smsConsentCopy().version), {
            heading: "TEXT ALERTS · CHOOSE ONE",
            yes: {
                title: "Yes, text me about new leads and calls",
                line: "A short text when a new lead comes in from your website or your AI receptionist takes a call.",
            },
            no: {
                title: "No text messages",
                line: "I'll check my portal inbox for new leads and calls myself. You can turn texts on later in your portal Settings.",
            },
        });
    } finally {
        if (saved === undefined) delete process.env.OWNER_TEXT_CAMPAIGN;
        else process.env.OWNER_TEXT_CAMPAIGN = saved;
    }
    // v1 sends no web-form lead texts and its portal Settings can't turn texts on.
    const v1 = choice.textAlertsCards("sms-consent-v1");
    assert.doesNotMatch(v1.yes.title + v1.yes.line, /lead/i);
    assert.doesNotMatch(v1.no.line, /later|Settings/);
});

/* ── the rule ─────────────────────────────────────────────────────────────── */

test("no card: refused; Yes: needs a complete US number and the tick; No: agrees with nothing", () => {
    const err = (o) => choice.textAlertsChoiceError({ choice: undefined, smsConsent: undefined, alertPhone: undefined, ...o });
    // No card.
    for (const c of [undefined, null, "", "maybe", true]) assert.equal(err({ choice: c }), CHOOSE, String(c));
    // Yes.
    assert.equal(err({ choice: "yes", smsConsent: true, alertPhone: CELL }), null);
    assert.equal(err({ choice: "yes", smsConsent: true, alertPhone: "555" }), NUMBER);
    assert.equal(err({ choice: "yes", smsConsent: true, alertPhone: "" }), NUMBER);
    assert.equal(err({ choice: "yes", smsConsent: true, alertPhone: "+44 7911 123456" }), NUMBER);
    assert.equal(err({ choice: "yes", smsConsent: false, alertPhone: CELL }), TICK, "his retest: a number with no consent");
    assert.equal(err({ choice: "yes", alertPhone: CELL }), TICK);
    assert.equal(err({ choice: "yes", smsConsent: "true", alertPhone: CELL }), TICK, "only a real tick counts");
    // No.
    assert.equal(err({ choice: "no" }), null);
    assert.equal(err({ choice: "no", alertPhone: "" }), null);
    assert.equal(err({ choice: "no", alertPhone: CELL }), CHOOSE, "No never carries a number");
    assert.equal(err({ choice: "no", smsConsent: true }), CHOOSE, "No never carries consent");
});

/* ── the opt-in the pages render ──────────────────────────────────────────── */

const render = (copy, chosen) =>
    renderToStaticMarkup(
        createElement(SmsOptIn, {
            copy,
            choice: chosen,
            onChoiceChange: () => {},
            phone: "",
            onPhoneChange: () => {},
            checked: false,
            onCheckedChange: () => {},
        }),
    );
const strip = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");
const yesPanel = (html) => html.match(/<div[^>]*id="text-alerts-yes-panel"[^>]*>/)?.[0] ?? "";

test("on open: two cards, neither chosen, and no number or box showing", () => {
    const html = render(SMS_CONSENT_V1, null);
    const text = strip(html);
    assert.ok(text.includes("TEXT ALERTS · CHOOSE ONE"));
    assert.ok(text.includes("Yes, text me about my calls"));
    assert.ok(text.includes("No text messages"));
    const radios = html.match(/<input[^>]*type="radio"[^>]*>/g) ?? [];
    assert.equal(radios.length, 2);
    for (const r of radios) assert.doesNotMatch(r, /checked/, "neither card is pre-selected");
    assert.match(yesPanel(html), /hidden/, "the number and the box wait for Yes");
    assert.doesNotMatch(html, /OPTIONAL · TEXT ALERTS|Used only if you turn on/);
});

for (const [mode, copy] of [["v1", SMS_CONSENT_V1], ["v2", SMS_CONSENT_V2]]) {
    test(`${mode}, Yes: the number, then the registered unchecked box and words, unchanged`, () => {
        const html = render(copy, "yes");
        assert.doesNotMatch(yesPanel(html), /hidden/);
        // Tags removed with nothing in their place, so the linked words join up as on screen.
        const joined = html.replace(/<[^>]+>/g, "").replace(/&#x27;/g, "'");
        assert.ok(joined.includes(copy.text), "the registered words, exactly");
        const text = strip(html);
        assert.ok(text.includes("Mobile number for text alerts"));
        const box = html.match(/<input type="checkbox"[^>]*name="smsConsent"[^>]*\/>/);
        assert.ok(box, "the registered box");
        assert.doesNotMatch(box[0], /checked/, "never pre-ticked");
        assert.ok(html.indexOf('id="mobile-number-for-text-alerts"') < html.indexOf(box[0]), "the number comes first");
        assert.match(html, /<a [^>]*href="\/sms-terms"[^>]*>SMS Terms<\/a>/);
        assert.match(html, /<a [^>]*href="\/privacy-policy"[^>]*>Privacy Policy<\/a>/);
    });
}

test("No: the number and the box stay hidden", () => {
    assert.match(yesPanel(render(SMS_CONSENT_V1, "no")), /hidden/);
});

/* ── /terms/accept (self-serve) ──────────────────────────────────────────────── */

const NOW = "2026-11-15T15:00:00.000Z";
const submission = (o = {}) => ({
    plan: "growth",
    clientLegalName: "Rivera Plumbing & Drain LLC",
    clientEntityType: "LLC",
    clientAddress: "1420 Example Ave, Orlando, FL 32801",
    signerName: "Marisol Rivera",
    signerTitle: "Owner",
    signerEmail: "marisol@riverapd.example",
    additionalSites: [],
    pageOpenedAt: NOW,
    scrollCompletedAt: NOW,
    receptionistMode: "published",
    termsAccepted: true,
    ...o,
});

test("/terms/accept: the choice is checked by the same rule", () => {
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "maybe" })), CHOOSE);
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "yes", smsConsent: true, alertPhone: "555" })), NUMBER);
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "yes", alertPhone: CELL })), TICK);
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "yes", smsConsent: true, alertPhone: CELL })), null);
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "no" })), null);
    assert.equal(validateAgreementSubmission(submission({ smsChoice: "no", alertPhone: CELL })), CHOOSE);
    // Website-only: no cards, nothing to choose; consent is still refused.
    assert.equal(validateAgreementSubmission(submission({ plan: "starter", receptionistMode: "declined" })), null);
    assert.equal(
        validateAgreementSubmission(submission({ plan: "starter", receptionistMode: "declined", smsChoice: "yes", smsConsent: true, alertPhone: CELL })),
        "Text alerts require a receptionist",
    );
});

/* ── /terms/[code] (the close wizard's link) ──────────────────────────────── */

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
        email: "arthur@arthursplumbing.com",
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

const redis = fakeUpstash({ url: KV_URL });
const realHandle = redis.handle;
const realFetch = globalThis.fetch;
const seed = (key, value) => redis.kv.set(key, { value: JSON.stringify(value), exp: null });
const saved = () => JSON.parse(redis.get("jdd:order:ord_agree"));
const consentKeys = () => [...redis.kv.keys()].filter((k) => k.startsWith("sms:consent:"));

beforeEach(() => {
    redis.reset();
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
        if (url.startsWith("https://api.resend.com/")) return Response.json({ id: "email_1" });
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const submit = (code, overrides = {}, forOrder = order()) =>
    agree.POST(
        new Request(`http://agency.test/api/agree/${code}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", "user-agent": "phone-browser" },
            body: JSON.stringify({
                accepted: true,
                termsHash: termsHashForOrder(forOrder, "master"),
                pageOpenedAt: "2026-11-15T15:00:00Z",
                scrollCompletedAt: "2026-11-15T15:02:00Z",
                ...overrides,
            }),
        }),
        { params: Promise.resolve({ code }) },
    );

test("the link: Yes with a number and no tick is refused, and nothing is recorded", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code, { smsChoice: "yes", alertPhone: CELL });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, TICK);
    assert.equal(saved().status, "draft");
    assert.deepEqual(consentKeys(), []);
});

test("the link: no card, a bad number, or a No carrying a number are refused", async () => {
    const { code } = await createAgreementLink(order());
    for (const [body, line] of [
        [{ smsChoice: "maybe" }, CHOOSE],
        [{ smsChoice: "yes", smsConsent: true, alertPhone: "555", smsConsentVersion: "sms-consent-v1" }, NUMBER],
        [{ smsChoice: "no", alertPhone: CELL }, CHOOSE],
        [{ smsChoice: "no", smsConsent: true, alertPhone: CELL, smsConsentVersion: "sms-consent-v1" }, CHOOSE],
    ]) {
        const res = await submit(code, body);
        assert.equal(res.status, 400, JSON.stringify(body));
        assert.equal((await res.json()).error, line);
    }
    assert.equal(saved().status, "draft");
    assert.deepEqual(consentKeys(), []);
});

test("the link: Yes with a number and the tick agrees and holds the consent", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code, { smsChoice: "yes", smsConsent: true, alertPhone: CELL, smsConsentVersion: "sms-consent-v1" });
    assert.equal(res.status, 200);
    assert.equal(saved().status, "terms-accepted");
    const pending = JSON.parse(redis.get(`sms:consent:pending:${saved().agreementId}`));
    assert.equal(pending.phone, "+14075550188");
    assert.equal(pending.consentTextVersion, "sms-consent-v1");
});

test("the link: No agrees with no number and no consent", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code, { smsChoice: "no" });
    assert.equal(res.status, 200);
    assert.equal(saved().status, "terms-accepted");
    assert.deepEqual(consentKeys(), []);
});

test("the link: a website-only order has no cards and agrees without a choice", async () => {
    const webOnly = order({ plan: "starter", receptionistMode: "declined", forwardingNumber: undefined });
    seed("jdd:order:ord_agree", webOnly);
    const { code } = await createAgreementLink(webOnly);
    const res = await submit(code, {}, webOnly);
    assert.equal(res.status, 200);
});

/* ── the pages ────────────────────────────────────────────────────────────── */

for (const file of ["app/components/agreement/AgreeLinkClient.tsx", "app/components/agreement/AgreementClient.tsx"]) {
    test(`${file}: checks the choice with the shared rule before posting, sends it, and never ticks the box`, () => {
        const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        const check = src.indexOf("textAlertsChoiceError(");
        const post = src.search(/[fF]etch\(\s*[`"]\/api\/agree/);
        assert.ok(check > 0, "calls textAlertsChoiceError");
        assert.ok(check < post, "before it posts");
        assert.match(src, /smsChoice: textChoice/, "sends the choice");
        assert.doesNotMatch(src, /setSmsConsent\(true\)/, "nothing ticks the box for them");
        assert.doesNotMatch(src, /SmsSkipNotice|smsSkipNotice|alertPhoneProblem/, "the old notice and number rule are gone");
    });
}

test("the 'Continue without text alerts?' notice is removed", () => {
    for (const f of ["app/lib/sms-skip-notice.mjs", "app/components/agreement/SmsSkipNotice.tsx", "test/agreement-sms-skip-notice.test.mjs"]) {
        assert.equal(existsSync(new URL(`../${f}`, import.meta.url)), false, f);
    }
});
