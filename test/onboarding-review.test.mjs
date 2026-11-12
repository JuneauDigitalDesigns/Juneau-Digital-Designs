/**
 * Item 6 of Xander's 2026-11-12 batch: "Ready to build?" as expandable cards, one per chapter,
 * with every answer when open (approved word for word, R1 to R4,
 * https://claude.ai/artifact/1jN9RQefsjuVy5sx65ZPVA).
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { REVIEW, detailLines, reviewCards } from "../app/components/onboarding/wizard/review.ts";
import { CHAPTERS, initialState, screensFor } from "../app/components/onboarding/wizard/model.ts";

const growth = { plan: "growth", signedMode: "forwarded" };

function ridgeline(extra = {}) {
    return {
        ...initialState("marcus@ridgelineair.com", "forwarded"),
        trade: "hvac",
        name: "Ridgeline Heating & Air",
        phone: "(407) 555-0142",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        visitAddress: "yes",
        towns: ["Orlando", "Winter Park", "Maitland"],
        services: [{ name: "AC Installation & Service", tag: "Cooling" }, { name: "Duct sanitizing", tag: "" }],
        serviceFacts: {
            "AC Installation & Service": {
                included: ["Sizing for your home", "Permit and inspection"], typicalJobs: ["AC blowing warm air"], areasMode: "", areas: [], brands: [],
                priceFrom: "$1,500", duration: "A full day", photos: [], questions: [],
            },
        },
        diffs: ["Upfront pricing, no surprises", "Locally owned"],
        tagline: "Comfort first",
        receptionistMode: "forwarded",
        ...extra,
    };
}

test("the new wording, word for word (R1 to R4)", () => {
    assert.equal(REVIEW.counts(5, 1), "5 answered · 1 skipped");
    assert.equal(REVIEW.counts(4, 0), "4 answered", "no skipped part when nothing was skipped");
    assert.equal(REVIEW.skipped, "Skipped");
    assert.equal(REVIEW.openAll, "Open all");
    assert.equal(REVIEW.closeAll, "Close all");
    assert.equal(REVIEW.addressShown, "Shown on your site");
    assert.equal(REVIEW.addressTown, "Town only");
});

test("one card per chapter, in order, each counting its answers and skips", () => {
    const st = ridgeline();
    const cards = reviewCards(screensFor(st, growth), st, growth);
    assert.deepEqual(cards.map((c) => c.label), CHAPTERS.map((c) => c.label));
    for (const c of cards) {
        const questionRows = c.rows.filter((r) => !r.service);
        assert.equal(c.answered + c.skipped, questionRows.length, c.label);
        assert.equal(c.skipped, questionRows.filter((r) => r.skipped).length, c.label);
    }
});

test("every question in a chapter gets a row, with all of its answer (no five-line cap)", () => {
    const st = ridgeline();
    const screens = screensFor(st, growth);
    const cards = reviewCards(screens, st, growth);
    const business = cards[0];
    const ids = business.rows.map((r) => r.id);
    for (const def of screens.filter((x) => x.chapter === 0)) assert.ok(ids.includes(def.id), def.id);
    const contact = business.rows.find((r) => r.id === "contact");
    assert.deepEqual(contact.lines, ["(407) 555-0142", "marcus@ridgelineair.com", "2140 Edgewater Dr, Orlando, FL 32804"]);
    assert.equal(contact.label, "Contact details", "rows are labelled with the side rail's own names");
});

test("a question with no answer shows as skipped", () => {
    const st = ridgeline({ customers: [] });
    const cards = reviewCards(screensFor(st, growth), st, growth);
    const row = cards.flatMap((c) => c.rows).find((r) => r.id === "customers");
    assert.equal(row.skipped, true);
    assert.deepEqual(row.lines, []);
});

test("the address answer reads Shown on your site or Town only", () => {
    assert.deepEqual(detailLines("visit", ridgeline({ visitAddress: "yes" }), growth), ["Shown on your site"]);
    assert.deepEqual(detailLines("visit", ridgeline({ visitAddress: "no" }), growth), ["Town only"]);
    assert.deepEqual(detailLines("visit", ridgeline({ visitAddress: "" }), growth), []);
});

test("each service gets its own row with its status and what was given", () => {
    const st = ridgeline();
    const rows = reviewCards(screensFor(st, growth), st, growth).flatMap((c) => c.rows).filter((r) => r.service);
    assert.deepEqual(rows.map((r) => r.service), ["AC Installation & Service", "Duct sanitizing"]);
    const ac = rows[0];
    assert.equal(ac.id, "details");
    assert.match(ac.lines[1], /2 things included · 1 job customers call about · Starting at \$1,500 · A full day/);
    assert.deepEqual(rows[1].lines, ["No details yet"]);
});

test("the closed card peeks at its first two answers", () => {
    const st = ridgeline();
    const [business] = reviewCards(screensFor(st, growth), st, growth);
    assert.equal(business.peek.length, 2);
    assert.equal(business.peek[0], "HVAC / Heating & Cooling");
});

test("the review screen renders the cards, with Open all and per-row Edit", () => {
    const src = readFileSync(new URL("../app/components/onboarding/wizard/screens.tsx", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("function ReviewScreen"), src.indexOf("function isRequiredOk"));
    assert.match(fn, /reviewCards\(/);
    assert.match(fn, /REVIEW\.openAll/);
    assert.match(fn, /aria-expanded/);
    assert.doesNotMatch(fn, /Still to come/, "skipped questions now show inside their cards");
    assert.doesNotMatch(fn, /slice\(0, 5\)/, "no five-line cap");
});
