/**
 * What a caller said on a recorded call about texts now governs whether they get texted.
 *
 * The agent has asked every caller since 2026-11-04 and the answer went into the Call Log, where
 * nothing read it: once a client's texting went live, an owner could text someone who had said no
 * on a recording. And after "no, use my cell", the yes is about the cell.
 *
 * `spokenConsentFor` is pure, so this imports the real one. The routes are checked for the gate.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { consentBlock, NOT_AGREED_MESSAGE, spokenConsentFor } from "../app/lib/spoken-consent.ts";
import { buildInbox, callTouchesPhone, promotionInput } from "../app/lib/crm-contacts.ts";

const LANDLINE = "+12075550100";
const CELL = "+12075550142";

const call = (over = {}) => ({
    id: "rec1",
    date: "2026-11-08T12:00:00.000Z",
    callerName: "Dana",
    callerNumber: LANDLINE,
    callbackNumber: null,
    summary: null,
    durationSeconds: 60,
    callType: "outbound",
    outcome: null,
    site: null,
    email: null,
    address: null,
    recordingUrl: null,
    priority: null,
    smsConsent: "granted",
    ...over,
});
const LATER = "2026-11-09T12:00:00.000Z";

test("a yes or a no covers the number the call was on", () => {
    assert.equal(spokenConsentFor([call()], LANDLINE), "granted");
    assert.equal(spokenConsentFor([call({ smsConsent: "declined" })], LANDLINE), "declined");
});

test('after "no, use my cell", the yes is about the cell and not the line they called from', () => {
    const calls = [call({ callbackNumber: "2075550142" })];
    assert.equal(spokenConsentFor(calls, CELL), "granted");
    assert.equal(spokenConsentFor(calls, LANDLINE), "unknown", "they never agreed about this one");
});

test("a no covers both numbers on the call", () => {
    const calls = [call({ callbackNumber: "2075550142", smsConsent: "declined" })];
    assert.equal(spokenConsentFor(calls, CELL), "declined");
    assert.equal(spokenConsentFor(calls, LANDLINE), "declined");
});

test("never answering blocks, and can't lift an earlier no", () => {
    assert.equal(spokenConsentFor([call({ smsConsent: "unknown" })], LANDLINE), "unknown");
    const noThenSilence = [call({ smsConsent: "declined" }), call({ id: "rec2", date: LATER, smsConsent: "unknown" })];
    assert.equal(spokenConsentFor(noThenSilence, LANDLINE), "declined");
});

test("a later real answer replaces an earlier one, in either direction, in any row order", () => {
    const no = call({ smsConsent: "declined" });
    const yes = call({ id: "rec2", date: LATER, smsConsent: "granted" });
    assert.equal(spokenConsentFor([no, yes], LANDLINE), "granted");
    assert.equal(spokenConsentFor([yes, no], LANDLINE), "granted");
    assert.equal(spokenConsentFor([call(), call({ id: "rec2", date: LATER, smsConsent: "declined" })], LANDLINE), "declined");
});

test("no call on record, or a row older than the column, is not this rule's business", () => {
    assert.equal(spokenConsentFor([], LANDLINE), null);
    assert.equal(spokenConsentFor([call({ smsConsent: null })], LANDLINE), null);
    assert.equal(spokenConsentFor([call()], "+12075559999"), null);
    assert.equal(spokenConsentFor([call()], null), null);
});

test("what blocks", () => {
    assert.equal(consentBlock("declined"), "declined");
    assert.equal(consentBlock("unknown"), "not-agreed");
    assert.equal(consentBlock("granted"), null);
    assert.equal(consentBlock(null), null);
    assert.equal(NOT_AGREED_MESSAGE, "This customer hasn't agreed to texts, so we can't message them.");
});

test("both ways of texting a customer check it before sending", () => {
    for (const path of ["messages", "review-request"]) {
        const src = readFileSync(new URL(`../app/api/portal/${path}/route.ts`, import.meta.url), "utf8");
        const gate = src.indexOf("await checkSpokenConsent(");
        assert.ok(gate > -1, `${path} has no consent check`);
        assert.ok(gate < src.indexOf("await sendSms("), `${path} sends before it checks`);
        assert.match(src, /spoken === "unavailable"/, `${path} must refuse when the log can't be read`);
    }
});

test("a promoted customer starts on the number they asked to be reached at", () => {
    const [item] = buildInbox({ calls: [call({ callbackNumber: "2075550142" })], leads: [] });
    assert.equal(promotionInput(item).phone, CELL);
    const [plain] = buildInbox({ calls: [call()], leads: [] });
    assert.equal(promotionInput(plain).phone, LANDLINE);
});

test("that customer's timeline still has the call they gave the number on", () => {
    const c = call({ callbackNumber: "2075550142" });
    assert.equal(callTouchesPhone(c, CELL), true);
    assert.equal(callTouchesPhone(c, LANDLINE), true);
    assert.equal(callTouchesPhone(c, "+12075559999"), false);
    assert.equal(callTouchesPhone(call({ callerNumber: null }), ""), false);
});
