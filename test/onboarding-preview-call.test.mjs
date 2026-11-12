/**
 * Item 5 of Xander's 2026-11-12 batch (approved word for word, N1): the site preview's Call button
 * follows the choice on "How will calls reach your receptionist?". "Use the new number as my
 * business number" shows "Call · New number"; otherwise it shows the number the client gave.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CALL_NEW_NUMBER, previewCallLabel } from "../app/components/onboarding/wizard/preview-call.ts";

test("the new-number label, word for word (N1)", () => {
    assert.equal(CALL_NEW_NUMBER, "Call · New number");
});

test("new number as the business number: the label, whatever was typed", () => {
    assert.equal(previewCallLabel({ phone: "4075550142", receptionistMode: "published" }), "Call · New number");
    assert.equal(previewCallLabel({ phone: "", receptionistMode: "published" }), "Call · New number");
});

test("forwarding, website only, or nothing chosen yet: their own number, formatted", () => {
    for (const mode of ["forwarded", "declined", ""]) {
        assert.equal(previewCallLabel({ phone: "4075550142", receptionistMode: mode }), "Call (407) 555-0142", mode);
    }
    assert.equal(previewCallLabel({ phone: "", receptionistMode: "forwarded" }), "Call now");
});

test("every Call button on the preview uses it", () => {
    const src = readFileSync(new URL("../app/components/onboarding/wizard/SiteWireframe.tsx", import.meta.url), "utf8");
    assert.doesNotMatch(src, /Call \{state\.phone/, "no button prints the raw phone any more");
    assert.ok((src.match(/previewCallLabel\(state\)/g) ?? []).length >= 3, "nav, footer and home nav");
});
