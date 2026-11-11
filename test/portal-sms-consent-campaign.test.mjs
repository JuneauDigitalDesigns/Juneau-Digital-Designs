/**
 * Portal Settings › Text alerts under each campaign.
 *
 * The approved (v1) campaign registers one place an owner opts in: the agreement page, before
 * purchase. Settings let an owner opt in, or move alerts to a new number (which is a grant of that
 * number), from inside the portal: a flow the live campaign never declared. Xander, 2026-11-11:
 * under v1 owners can still turn texts off there, but can't opt in or change the number, and the
 * API must refuse both, not only the UI. Under v2 everything works as before.
 *
 * And nothing already stored is touched: consents recorded under `sms-consent-v2` stay valid,
 * deliverable and byte for byte as they were, whichever campaign is live.
 *
 * Real route, consent store and campaign switch, with the session lookup swapped
 * (`portal-sms-consent-hook.mjs`) and an in-memory Upstash. The Settings card is rendered for real.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./portal-sms-consent-hook.mjs", import.meta.url);
register("./next-link-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const route = await import("../app/api/portal/sms-consent/route.ts");
const { getConsentLog, getConsentStateForAccount, isDeliverable } = await import("../app/lib/sms-consent.ts");
const { SMS_CONSENT_V1, SMS_CONSENT_V2 } = await import("../app/lib/sms-consent-text.ts");
const { default: SettingsSection } = await import("../app/components/portal/SettingsSection.tsx");

const EMAIL = "owner@arthursplumbing.com";
const PHONE = "+14075550123";
const NEW_PHONE = "+14075550199";
const V2_HASH = "8f05b3bedd688820a666c740e7dcf2720a6161a319742ade984836ea3666c460";

/** A grant exactly as the portal stored it under v2, before this change. */
const STORED_V2_GRANT = {
    id: "0b6f0e7e-5a54-4d0e-9a59-8d3c4d1f2a10",
    phone: PHONE,
    action: "granted",
    source: "agreement",
    occurredAt: "2026-11-02T14:00:00.000Z",
    ip: "203.0.113.4",
    userAgent: "Mozilla/5.0",
    consentTextHash: V2_HASH,
    consentTextVersion: "sms-consent-v2",
    agreementId: "agr_1",
    accountEmail: EMAIL,
};

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;

function seedV2Consent() {
    redis.kv.set(`sms:consent:account:${EMAIL}`, { value: PHONE, exp: null });
    redis.kv.set(`sms:consent:state:${PHONE}`, {
        value: JSON.stringify({ phone: PHONE, status: "granted", updatedAt: STORED_V2_GRANT.occurredAt, accountEmail: EMAIL }),
        exp: null,
    });
    redis.lists.set(`sms:consent:log:${PHONE}`, [JSON.stringify(STORED_V2_GRANT)]);
}

beforeEach(() => {
    redis.reset();
    delete process.env.OWNER_TEXT_CAMPAIGN;
    globalThis.__portalSms = { email: EMAIL };
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(String(input))) return redis.handle(input, init);
        throw new Error(`unexpected fetch: ${String(input)}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.OWNER_TEXT_CAMPAIGN;
});

const post = async (body) => {
    const res = await route.POST(
        new Request("http://localhost/api/portal/sms-consent", {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20", "user-agent": "portal-browser" },
            body: JSON.stringify(body),
        }),
    );
    return { status: res.status, body: await res.json() };
};

/* ── v1: turn off only ────────────────────────────────────────────────────── */

test("v1: the API refuses an opt-in and records nothing", async () => {
    const res = await post({ enabled: true, phone: PHONE });
    assert.equal(res.status, 403);
    assert.equal(await getConsentStateForAccount(EMAIL), null);
    assert.deepEqual(await getConsentLog(PHONE), []);
});

test("v1: the API refuses a number change and leaves the existing consent exactly as it was", async () => {
    seedV2Consent();
    const res = await post({ enabled: true, phone: NEW_PHONE });
    assert.equal(res.status, 403);
    assert.equal((await getConsentStateForAccount(EMAIL)).phone, PHONE);
    assert.deepEqual(await getConsentLog(PHONE), [STORED_V2_GRANT]);
    assert.deepEqual(await getConsentLog(NEW_PHONE), []);
});

test("v1: turning texts off works", async () => {
    seedV2Consent();
    const res = await post({ enabled: false });
    assert.equal(res.status, 200);
    assert.equal(res.body.consent.status, "revoked");
    const state = await getConsentStateForAccount(EMAIL);
    assert.equal(isDeliverable(state), false);
    const log = await getConsentLog(PHONE);
    assert.deepEqual(log[0], STORED_V2_GRANT, "the grant is never edited");
    assert.equal(log[1].action, "revoked");
    assert.equal(log[1].source, "portal-settings");
});

/* ── v2: as before ────────────────────────────────────────────────────────── */

test("v2: opt-in, number change and turning off all work, each recorded under today's wording", async () => {
    process.env.OWNER_TEXT_CAMPAIGN = "v2";

    const on = await post({ enabled: true, phone: "(407) 555-0123" });
    assert.equal(on.status, 200);
    assert.equal(on.body.consent.phone, PHONE);
    let [grant] = await getConsentLog(PHONE);
    assert.equal(grant.consentTextVersion, "sms-consent-v2");
    assert.equal(grant.consentTextHash, V2_HASH);

    const moved = await post({ enabled: true, phone: NEW_PHONE });
    assert.equal(moved.status, 200);
    assert.equal(moved.body.consent.phone, NEW_PHONE);
    assert.equal((await getConsentLog(PHONE)).at(-1).action, "revoked");
    [grant] = await getConsentLog(NEW_PHONE);
    assert.equal(grant.action, "granted");
    assert.equal(grant.consentTextVersion, "sms-consent-v2");

    const off = await post({ enabled: false });
    assert.equal(off.status, 200);
    assert.equal(off.body.consent.status, "revoked");
});

/* ── nothing stored is invalidated ────────────────────────────────────────── */

test("a consent stored under v2 stays valid and deliverable under v1, byte for byte", async () => {
    seedV2Consent();
    const before = redis.get(`sms:consent:state:${PHONE}`);
    for (const mode of [undefined, "v2"]) {
        if (mode) process.env.OWNER_TEXT_CAMPAIGN = mode;
        const state = await getConsentStateForAccount(EMAIL);
        assert.ok(isDeliverable(state), `deliverable under ${mode ?? "v1"}`);
        assert.equal(state.phone, PHONE);
        assert.deepEqual(await getConsentLog(PHONE), [STORED_V2_GRANT]);
    }
    assert.equal(redis.get(`sms:consent:state:${PHONE}`), before);
    // The words it was recorded against still hash to what it carries.
    const { hashConsentText } = await import("../app/lib/sms-consent.ts");
    assert.equal(hashConsentText(SMS_CONSENT_V2.text), STORED_V2_GRANT.consentTextHash);
});

/* ── the Settings card ────────────────────────────────────────────────────── */

const site = {
    slug: "arthurs-plumbing",
    name: "Arthur's Plumbing",
    plan: "growth",
    status: "live",
    featured: null,
};
const settings = (smsCampaign, smsConsent) =>
    renderToStaticMarkup(
        createElement(SettingsSection, {
            site,
            accountEmail: EMAIL,
            accountProfile: null,
            smsConsent,
            smsCampaign,
            smsConsentCopy: smsCampaign === "v1" ? SMS_CONSENT_V1 : SMS_CONSENT_V2,
            agreements: [],
        }),
    );
const textOf = (html) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ");
const alertsCard = (html) => {
    const text = textOf(html);
    const start = text.indexOf("Text alerts");
    return start < 0 ? "" : text.slice(start, text.indexOf("Featured", start) > 0 ? text.indexOf("Featured", start) : undefined);
};

test("v1 Settings: an owner with texts on sees the number and Turn off, and nothing to opt in with", () => {
    const html = settings("v1", { phone: PHONE, status: "granted" });
    const card = alertsCard(html);
    assert.match(card, /Text alerts are on\./);
    assert.match(card, /Turn off/);
    assert.doesNotMatch(card, /Turn on text alerts|Turn on call alerts|Update number/);
    assert.ok(!textOf(html).includes(SMS_CONSENT_V1.text.slice(0, 40)), "no consent box");
    assert.ok(!textOf(html).includes(SMS_CONSENT_V2.text.slice(0, 40)), "no consent box");
    assert.match(html, /<input[^>]*value="\+14075550123"[^>]*readOnly|<input[^>]*readonly=""[^>]*value="\+14075550123"|<input[^>]*value="\+14075550123"[^>]*readonly=""/i);
});

test("v1 Settings: an owner without texts has no card to opt in from", () => {
    for (const consent of [null, { phone: PHONE, status: "revoked" }]) {
        const text = textOf(settings("v1", consent));
        assert.doesNotMatch(text, /Text alerts|Turn on|Mobile number for alerts/);
    }
});

test("v2 Settings: as before, with the button saying text alerts", () => {
    const off = textOf(settings("v2", null));
    assert.match(off, /Turn on text alerts/);
    assert.doesNotMatch(off, /call alerts/i);
    assert.ok(off.includes(SMS_CONSENT_V2.text.slice(0, 60)), "today's consent text beside the box");
    assert.match(textOf(settings("v2", { phone: PHONE, status: "granted" })), /Update number/);
});
