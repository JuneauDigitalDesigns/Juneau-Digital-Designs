/**
 * Items 1 to 3 of Xander's 2026-11-12 batch, approved word for word (mockup
 * https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA, E1, E2, A1 to A5):
 * 1. Business email no longer talks about leads going elsewhere (they never go to email).
 * 2. Every pre-filled field says "We pre-filled this. Check it's right.", and only when it really
 *    was pre-filled (Xander: "only shows up if it's actually been pre-filled").
 * 3. The address step asks "Show your address on your site?", yes or no, with the same data.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PREFILL_LINE, prefillLine } from "../app/components/onboarding/wizard/prefill-notes.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { buildPayload, initialState } from "../app/components/onboarding/wizard/model.ts";

const screens = readFileSync(new URL("../app/components/onboarding/wizard/screens.tsx", import.meta.url), "utf8");

test("the pre-filled line, word for word (E1, E2)", () => {
    assert.equal(PREFILL_LINE, "We pre-filled this. Check it's right.");
});

test("it shows only while the field still holds what we pre-filled", () => {
    assert.equal(prefillLine("Ridgeline Heating & Air", "Ridgeline Heating & Air"), PREFILL_LINE);
    assert.equal(prefillLine(" Ridgeline Heating & Air ", "Ridgeline Heating & Air"), PREFILL_LINE);
    assert.equal(prefillLine("Ridgeline HVAC", "Ridgeline Heating & Air"), null, "edited");
    assert.equal(prefillLine("", "Ridgeline Heating & Air"), null, "cleared");
    assert.equal(prefillLine("Ridgeline Heating & Air", ""), null, "never pre-filled");
    assert.equal(prefillLine("Ridgeline Heating & Air", undefined), null, "never pre-filled");
});

test("email compares without case or spaces, and shows nothing when no email was pre-filled", () => {
    assert.equal(prefillLine("Marcus@RidgelineAir.com", " marcus@ridgelineair.com ", { email: true }), PREFILL_LINE);
    assert.equal(prefillLine("office@ridgelineair.com", "marcus@ridgelineair.com", { email: true }), null);
    assert.equal(prefillLine("marcus@ridgelineair.com", "", { email: true }), null);
});

test("no screen says leads go elsewhere, or names the source, any more", () => {
    assert.doesNotMatch(screens, /leads should go somewhere else/);
    assert.doesNotMatch(screens, /From your call with us\. Check it's right\./);
    assert.doesNotMatch(screens, /From your agreement\. Check it's right\./);
    assert.match(screens, /prefillLine\(state\.email, p\.prefillEmail, \{ email: true \}\)/, "the email note is conditional");
});

test("the address step's wording (A1 to A5)", () => {
    assert.equal(C.visitNav, "Your address");
    assert.equal(C.visitQ, "Show your address on your site?");
    assert.equal(C.visitHelp, "If customers don't come to you, we can show just your town.");
    assert.equal(C.visitYes, "Yes, show my address");
    assert.equal(C.visitYesDetail, "Your full address shows on your site.");
    assert.equal(C.visitNo, "No, keep it off");
    assert.equal(C.visitNoDetail, "We'll show your town instead of your street address.");
});

test("the data is unchanged: yes shows the address, no hides the street", () => {
    const base = { ...initialState("m@r.co", "forwarded"), trade: "hvac", name: "R", phone: "4075550142", address: "2140 Edgewater Dr, Orlando, FL 32804", towns: ["Orlando"] };
    const growth = { plan: "growth", signedMode: "forwarded" };
    assert.equal(buildPayload({ ...base, visitAddress: "yes" }, growth).serviceAreaBusiness, false);
    assert.equal(buildPayload({ ...base, visitAddress: "no" }, growth).serviceAreaBusiness, true);
    assert.equal("serviceAreaBusiness" in buildPayload({ ...base, visitAddress: "" }, growth), false);
});
