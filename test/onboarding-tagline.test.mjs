/**
 * The tagline question (finding F-C2a, end-to-end test 2026-11-10). The wizard never asked for
 * one, so the console filled the trade template's sample tagline and only an operator edit
 * replaced it. Xander approved the question word for word on 2026-11-11 ("Approve as drafted",
 * mockup https://claude.ai/artifact/BaoLxNU2Gd9JPLhh4yW3CA, items T1 to T6).
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBrandIntakeToIntake, zBrandIntakeSubmission } from "@jdd/schema";

import { MAX_TAGLINE, TAGLINE_EXAMPLES, buildPayload, initialState, isAnswered, restoreDraft, screensFor } from "../app/components/onboarding/wizard/model.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { buildSubmission } from "../app/lib/onboarding-submission.ts";

const NOW = new Date("2026-11-11T12:00:00Z");
const growth = { plan: "growth", signedMode: "forwarded" };
const client = (extra = {}) => ({
    ...initialState("marcus@ridgelineair.com", "forwarded"),
    trade: "hvac",
    name: "Ridgeline Heating & Air",
    phone: "(407) 555-0142",
    address: "2140 Edgewater Dr, Orlando, FL 32804",
    towns: ["Orlando"],
    services: [{ name: "AC Installation & Service", tag: "Cooling" }],
    ...extra,
});

test("a skippable Tagline screen sits in Your look, just before Logo (T1, T2)", () => {
    const screens = screensFor(client(), growth);
    const ids = screens.map((x) => x.id);
    const i = ids.indexOf("tagline");
    assert.ok(i > 0, "the tagline screen exists");
    assert.equal(ids[i + 1], "logo");
    const def = screens[i];
    assert.equal(def.nav, "Tagline");
    assert.equal(def.chapter, 3, "chapter 4, Your look");
    assert.equal(def.skippable, true);
    assert.equal(def.focus, "brand");
});

test("the approved wording, word for word (T3 to T6)", () => {
    assert.equal(C.taglineQ, "Do you have a tagline?");
    assert.equal(C.taglineHelp, "A few words that sit under your business name at the top and bottom of your site.");
    assert.equal(C.taglineSkip, "No tagline? Skip this. We'll suggest one for you to approve.");
    assert.equal(C.taglineExample("Comfort in every season"), "e.g. Comfort in every season");
});

test("each trade's example is its template's sample tagline, without the full stop", () => {
    assert.equal(TAGLINE_EXAMPLES.hvac, "Comfort in every season");
    for (const id of ["hvac", "roofing", "plumbing", "lawn-care", "car-detailing", "health"]) {
        assert.ok(TAGLINE_EXAMPLES[id], id);
        assert.doesNotMatch(TAGLINE_EXAMPLES[id], /\.$/, id);
    }
});

test("the tagline is sent trimmed, on one line, at most 60 characters; blank is left out", () => {
    assert.equal(MAX_TAGLINE, 60);
    const p = buildPayload(client({ tagline: "  Cool homes,\n  happy   families  " }), growth, NOW);
    assert.equal(p.tagline, "Cool homes, happy families");
    assert.equal(zBrandIntakeSubmission.safeParse(p).success, true);
    assert.equal(buildPayload(client({ tagline: "x".repeat(80) }), growth, NOW).tagline.length, 60);
    assert.equal("tagline" in buildPayload(client({ tagline: "   " }), growth, NOW), false);
});

test("answered when there's a tagline; a draft keeps it", () => {
    assert.equal(isAnswered("tagline", client({ tagline: "" })), false);
    assert.equal(isAnswered("tagline", client({ tagline: "Comfort first" })), true);
    const restored = restoreDraft({ ...client({ tagline: "Comfort first" }) }, initialState("marcus@ridgelineair.com", "forwarded"));
    assert.equal(restored.tagline, "Comfort first");
});

test("the server keeps it, and the mapper puts it under the business name", () => {
    const p = buildPayload(client({ tagline: "Comfort first" }), growth, NOW);
    const r = buildSubmission(p, { slug: "ridgeline", plan: "growth", status: "pending-onboarding", receptionistMode: "forwarded" });
    assert.equal(r.ok, true);
    assert.equal(r.submission.tagline, "Comfort first");
    const intake = mapBrandIntakeToIntake(r.submission);
    assert.equal(intake.sites[0].brand.tagline, "Comfort first");
});
