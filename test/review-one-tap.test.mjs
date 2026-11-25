/**
 * One-tap review requests and the site's own review message (Xander, 2026-11-19).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const t = await import("../app/lib/review-template.ts");
const { defaultReviewMessage } = await import("../app/lib/review-message.ts");

test("the default template sends exactly the old default once a name is filled in", () => {
    const tpl = t.defaultReviewTemplate("Peak Comfort HVAC");
    assert.ok(tpl.startsWith("Hi [first name], thanks for choosing Peak Comfort HVAC!"));
    assert.equal(t.renderReviewTemplate(tpl, "Robert Ochoa"), defaultReviewMessage("Robert Ochoa", "Peak Comfort HVAC"));
    assert.equal(t.renderReviewTemplate(tpl, null), defaultReviewMessage(null, "Peak Comfort HVAC"));
});

test("a custom message fills every [first name] and is trimmed and capped", () => {
    assert.equal(t.renderReviewTemplate("Thanks [first name]! [first name], a review?", "Ana Park"), "Thanks Ana! Ana, a review?");
    assert.equal(t.cleanReviewTemplate("   "), null);
    assert.equal(t.cleanReviewTemplate(42), null);
    assert.equal(t.cleanReviewTemplate("x".repeat(500)).length, t.REVIEW_TEMPLATE_MAX);
});

test("the server composes a one-tap send from the saved message, never trusting a browser for it", () => {
    const route = read("app/api/portal/review-request/route.ts");
    assert.match(route, /getReviewTemplate\(acct, ctx\.site\.slug\)/);
    assert.match(route, /renderReviewTemplate\(/);
    // Link and STOP are still appended server-side.
    assert.match(route, /composeReviewMessage\(text, reviewUrl\)/);
});

test("the Review button is one tap and confirms in his words", () => {
    const rec = read("app/components/portal/crm/CustomerRecord.tsx");
    assert.match(rec, /"Review request sent!"/);
    assert.match(rec, /body: JSON\.stringify\(\{ phone: customer\.phone \}\)/);
});

test("More links the review message for Growth, and the screen keeps the auto-added sentence", () => {
    assert.match(read("app/components/portal/MoreScreen.tsx"), /tabHref\("more\/review"/);
    assert.match(read("app/components/portal/ReviewMessageScreen.tsx"), /Your Google review link and “Reply STOP to opt out” are added automatically\./);
});
