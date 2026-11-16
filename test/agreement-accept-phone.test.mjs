/**
 * An agreement is never accepted with a partial or foreign number in a phone box.
 *
 * Found in Xander's front-to-back test, 2026-11-15: "I scrolled down the agreement ticked to
 * agree, put 555 in the phone box and clicked accept and it took it as a valid
 * agreement/acceptance." With the text-alerts box unticked, the link page threw away whatever was
 * in the number box and the agreement went through. Ticked, "555" was already refused.
 *
 * What it holds both agreement pages to, browser and server:
 *  - the number box, if anything is typed in it, holds a complete US number, ticked or not;
 *  - blank with the box unticked still agrees: the number and the texts stay optional;
 *  - the forwarding number on `/agreement` is a complete US number too.
 *
 * The browser check is `alertPhoneProblem`, the same function the routes call; the last test
 * holds both pages to calling it before they submit.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
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

const { normalizeUsPhone } = await import("../app/lib/phone.mjs");
const { alertPhoneProblem, ALERT_PHONE_UNTICKED_ERROR } = await import("../app/lib/agreement-phone.mjs");
const { validateAgreementSubmission } = await import("../app/lib/agreement-validate.mjs");
const { createAgreementLink } = await import("../app/lib/agreement-link.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const agree = await import("../app/api/agree/[code]/route.ts");

/* ── the rule ─────────────────────────────────────────────────────────────── */

test("a US number is ten digits in NANP shape, and nothing shorter, longer or foreign", () => {
    for (const ok of ["(407) 555-0143", "407-555-0143", "4075550143", "1 407 555 0143", "+1 (407) 555-0143"]) {
        assert.equal(normalizeUsPhone(ok), "+14075550143", ok);
    }
    for (const bad of [
        "555", "5550143", "407555014", "407 555 01433", "", "   ", "abc",
        "+44 7911 123456", // a real UK mobile: no US campaign can text it
        "+52 55 1234 5678",
        "(107) 555-0143", "(007) 555-0143", // no area code starts 0 or 1
        "(407) 155-0143", "(407) 055-0143", // no exchange does either
        "(911) 555-0143", "(411) 555-0143", // service codes, not area codes
        "2 407 555 0143", // 11 digits not starting with 1
    ]) {
        assert.equal(normalizeUsPhone(bad), null, bad);
    }
});

test("the number box: ticked needs a valid number; unticked allows blank, and nothing else invalid", () => {
    // The test that shipped this: unticked, "555".
    assert.equal(alertPhoneProblem(false, "555"), "invalid-unticked");
    assert.equal(alertPhoneProblem(undefined, "555"), "invalid-unticked");
    assert.equal(alertPhoneProblem(false, 555), "invalid-unticked", "a number sent as JSON is not a blank box");
    assert.equal(alertPhoneProblem(false, "+44 7911 123456"), "invalid-unticked");
    // Optional stays optional.
    assert.equal(alertPhoneProblem(false, ""), null);
    assert.equal(alertPhoneProblem(false, "   "), null);
    assert.equal(alertPhoneProblem(false, undefined), null);
    assert.equal(alertPhoneProblem(false, null), null);
    assert.equal(alertPhoneProblem(false, "(407) 555-0143"), null);
    // Ticked.
    assert.equal(alertPhoneProblem(true, "555"), "consent-needs-number");
    assert.equal(alertPhoneProblem(true, ""), "consent-needs-number");
    assert.equal(alertPhoneProblem(true, "+44 7911 123456"), "consent-needs-number");
    assert.equal(alertPhoneProblem(true, "(407) 555-0143"), null);
});

/* ── /agreement (self-serve) ──────────────────────────────────────────────── */

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

test("/agreement refuses '555' in the number box, ticked or not, and still agrees with it blank", () => {
    assert.equal(validateAgreementSubmission(submission({ alertPhone: "555" })), ALERT_PHONE_UNTICKED_ERROR);
    assert.equal(validateAgreementSubmission(submission({ smsConsent: false, alertPhone: "555" })), ALERT_PHONE_UNTICKED_ERROR);
    assert.equal(
        validateAgreementSubmission(submission({ smsConsent: true, alertPhone: "555" })),
        "A valid mobile number is required to enable text alerts",
    );
    assert.equal(
        validateAgreementSubmission(submission({ smsConsent: true, alertPhone: "+44 7911 123456" })),
        "A valid mobile number is required to enable text alerts",
    );
    assert.equal(validateAgreementSubmission(submission()), null);
    assert.equal(validateAgreementSubmission(submission({ alertPhone: "" })), null);
    assert.equal(validateAgreementSubmission(submission({ smsConsent: true, alertPhone: "(407) 555-0143" })), null);
});

test("/agreement refuses a partial or foreign forwarding number", () => {
    for (const bad of ["555", "407555014", "+44 7911 123456"]) {
        assert.equal(
            validateAgreementSubmission(submission({ receptionistMode: "forwarded", forwardingNumber: bad })),
            "A valid number to forward is required",
            bad,
        );
    }
    assert.equal(validateAgreementSubmission(submission({ receptionistMode: "forwarded", forwardingNumber: "+14075550123" })), null);
});

test("/agreement refuses blank-after-trim names and a malformed email", () => {
    assert.equal(validateAgreementSubmission(submission({ signerName: "   " })), "Missing signer name");
    assert.equal(validateAgreementSubmission(submission({ clientLegalName: " " })), "Missing client legal name");
    for (const bad of ["marisol", "marisol@", "marisol@riverapd", " ", "a b@c.d"]) {
        assert.equal(validateAgreementSubmission(submission({ signerEmail: bad })), "Invalid signer email", bad);
    }
    assert.equal(validateAgreementSubmission(submission({ termsAccepted: false })), "Please tick the box to agree to the Terms of Service");
});

/* ── /agree/[code] (the close wizard's link) ──────────────────────────────── */

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

const submit = (code, overrides = {}) =>
    agree.POST(
        new Request(`http://agency.test/api/agree/${code}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9", "user-agent": "phone-browser" },
            body: JSON.stringify({
                accepted: true,
                termsHash: termsHashForOrder(order(), "master"),
                pageOpenedAt: "2026-11-15T15:00:00Z",
                scrollCompletedAt: "2026-11-15T15:02:00Z",
                ...overrides,
            }),
        }),
        { params: Promise.resolve({ code }) },
    );

test("the link refuses '555' with the box unticked, and the order stays a draft", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code, { alertPhone: "555" });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, ALERT_PHONE_UNTICKED_ERROR);
    assert.equal(saved().status, "draft");
    assert.equal(saved().agreementId, undefined);
});

test("the link refuses '555' and a foreign number with the box ticked", async () => {
    const { code } = await createAgreementLink(order());
    for (const alertPhone of ["555", "+44 7911 123456"]) {
        const res = await submit(code, { smsConsent: true, alertPhone, smsConsentVersion: "sms-consent-v1" });
        assert.equal(res.status, 400, alertPhone);
        assert.equal((await res.json()).error, "A valid mobile number is required to enable text alerts");
    }
    assert.equal(saved().status, "draft");
    assert.deepEqual(consentKeys(), []);
});

test("the link still agrees with the number box blank and unticked, and with a valid number", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code, { alertPhone: "" });
    assert.equal(res.status, 200);
    assert.equal(saved().status, "terms-accepted");
    assert.deepEqual(consentKeys(), [], "no consent without the box");
});

test("the link refuses the tick box left empty and a stale or missing read-through", async () => {
    const { code } = await createAgreementLink(order());
    assert.equal((await submit(code, { accepted: false })).status, 400);
    assert.equal((await submit(code, { scrollCompletedAt: undefined })).status, 400);
    assert.equal((await submit(code, { termsHash: "stale" })).status, 400);
    assert.equal(saved().status, "draft");
});

/* ── the pages ────────────────────────────────────────────────────────────── */

// Since 2026-11-15 the number lives in the Yes card of a required choice, so the pages check it with
// `textAlertsChoiceError` (`test/agreement-text-alerts-choice.test.mjs`), which holds the same
// complete-US-number rule. The server keeps `alertPhoneProblem` for pages loaded before that.
test("both pages check the number with a US-only rule before they submit", () => {
    for (const file of ["app/components/agreement/AgreeLinkClient.tsx", "app/components/agreement/AgreementClient.tsx"]) {
        const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        const check = src.indexOf("textAlertsChoiceError(");
        const post = src.search(/[fF]etch\(\s*[`"]\/api\/agree/);
        assert.ok(check > 0, `${file} calls textAlertsChoiceError`);
        assert.ok(post > check, `${file} checks before it posts`);
        assert.doesNotMatch(src, /normalizeE164\(/, `${file} uses the US-only rule, not normalizeE164`);
    }
});
