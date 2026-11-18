// Pressure washing in the onboarding wizard (@jdd/schema v1.40.0). The tile, services, suggestions,
// slots and default palette all come from the schema; these are the agency's own hand-keyed maps.
// Approved by Xander word for word on 2026-11-18 from the mockup canvas: the credential chips (W61),
// the tagline example (W1, without its full stop), the stat captions (W62). Decided the same day: no
// equipment brands screen for this trade.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { menuFor } from "@jdd/schema";
import {
    BRAND_SUGGESTIONS,
    CERT_SUGGESTIONS,
    STAT_LABELS,
    TAGLINE_EXAMPLES,
    initialState,
    screensFor,
} from "../app/components/onboarding/wizard/model.ts";

const PW = "pressure-washing";
const growth = { plan: "growth", signedMode: "forwarded" };

test("the schema knows the trade, under its approved tile label", () => {
    assert.equal(menuFor(PW)?.label, "Pressure Washing / Soft Washing");
});

test("credential chips, the tagline example and the stat captions are the approved words", () => {
    assert.deepEqual(CERT_SUGGESTIONS[PW], ["Licensed", "Insured", "PWNA member", "UAMCC member", "BBB accredited"]);
    assert.equal(TAGLINE_EXAMPLES[PW], "The right pressure for every surface");
    assert.equal(STAT_LABELS.propertiesCleaned, "Properties cleaned");
    assert.equal(STAT_LABELS.quoteTurnaround, "Quote turnaround");
});

test("every stat the template asks for has a caption", () => {
    for (const s of menuFor(PW).templateSlots.stats) assert.ok(STAT_LABELS[s.key], s.key);
});

test("no equipment brands screen; the radius and numbers screens are asked, as the template needs them", () => {
    assert.equal(BRAND_SUGGESTIONS[PW], undefined);
    const ids = screensFor({ ...initialState("owner@example.com", "forwarded"), trade: PW }, growth).map((s) => s.id);
    assert.ok(!ids.includes("brands"), "no brands screen");
    assert.ok(ids.includes("certs"), "credential chips");
    assert.ok(ids.includes("radius"), "service radius, as car detailing asks it");
    assert.ok(ids.includes("numbers"), "properties cleaned and quote turnaround");
});

test("the trade tile has its own glyph", () => {
    const src = readFileSync(new URL("../app/components/onboarding/wizard/screens.tsx", import.meta.url), "utf8");
    assert.match(src, /"pressure-washing": "[^"]+"/);
});
