/**
 * MSA v5.5: a site is four or more pages (Xander, 2026-11-12).
 *
 * Sites now carry a page per service with enough detail to support one, so the agreement can no
 * longer cap a site at five pages or call the build a four-page site. These pin the approved
 * wording on every plan's document, the words `hashTermsForPlan` hashes and the client signs.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { getTermsForPlan, TERMS_VERSION } from "../app/lib/legal/index.ts";

const PLANS = [
    ["starter", {}],
    ["starter", { webOnly: true }],
    ["growth", {}],
    ["enterprise", {}],
];

function text(sections) {
    const out = [];
    const block = (b) => {
        if (b.text) out.push(b.text);
        if (b.items) out.push(...b.items.map((i) => (typeof i === "string" ? i : JSON.stringify(i))));
        if (b.rows) out.push(...b.rows.map((r) => JSON.stringify(r)));
    };
    for (const s of sections) {
        s.intro.forEach(block);
        for (const sub of s.subsections) sub.blocks.forEach(block);
    }
    return out.join("\n");
}

test("the version moved off v5.4 with the wording", () => {
    assert.notEqual(TERMS_VERSION, "v5.4");
});

for (const [plan, opts] of PLANS) {
    const label = `${plan}${opts.webOnly ? " (web-only)" : ""}`;
    const doc = text(getTermsForPlan(plan, opts).sections);

    test(`${label}: no page cap of five and no "four-page" build`, () => {
        assert.doesNotMatch(doc, /four-page/);
        assert.doesNotMatch(doc, /up to five pages/);
        assert.doesNotMatch(doc, /beyond five/);
        assert.doesNotMatch(doc, /fifth page/);
    });

    test(`${label}: a site is defined as four (4) or more pages, word for word`, () => {
        assert.match(
            doc,
            /a "site" is a website at a single domain\. The standard build delivered under every plan is a site of four \(4\) or more pages: Home, Services, About, and Contact, an individual page for each service for which the Client provides enough detail to support one, and an optional additional page\./,
        );
        assert.match(doc, /Pages beyond those described above are not included in any plan/);
    });

    // Growth's Schedule A carries the site line by reference ("Everything included in the
    // Starter plan"), so it names no pages of its own.
    test(`${label}: Schedule A names four (4) or more pages`, () => {
        if (plan === "growth") return assert.match(doc, /Everything included in the Starter plan/);
        assert.match(doc, /four \(4\) or more pages/);
        assert.match(doc, /plus individual service pages where the Client's information supports them/);
    });
}
