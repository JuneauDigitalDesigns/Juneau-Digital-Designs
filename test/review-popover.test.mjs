import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * "Request a review" opens as a window right below its button, not a drawer from the right
 * (Xander, 2026-11-12). The composer's rules are unchanged: the server still appends the review
 * link and the STOP line, and one request per number still locks the button.
 *
 * Held at source level: the portal has no signed-in test account, and none of this is visible to
 * the compiler.
 */

function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

const dialog = code("app/components/portal/ReviewRequestDialog.tsx");
const record = code("app/components/portal/crm/CustomerRecord.tsx");
const section = code("app/components/portal/crm/CustomersSection.tsx");
const popover = code("app/components/portal/ui/Popover.tsx");

test("the review composer is a popover, not a drawer", () => {
    assert.doesNotMatch(dialog, /from "\.\/ui\/Drawer"/);
    assert.match(dialog, /from "\.\/ui\/Popover"/);
    assert.match(dialog, /<Popover\b/);
});

test("the board no longer opens a review drawer of its own", () => {
    assert.doesNotMatch(section, /ReviewRequestDialog/);
    assert.doesNotMatch(section, /setReviewFor/);
});

test("the popover is anchored inside the same wrapper as the button that opens it", () => {
    // ReviewAnchor draws the button and its popover side by side; each place it is used puts
    // them in one `relative` row (the panel header's actions, the phone sheet's actions).
    const from = record.indexOf("function ReviewAnchor");
    const rest = record.slice(from);
    const anchor = rest.slice(0, rest.search(/\r?\n\}\r?\n/));
    assert.match(anchor, /<ReviewRequestDialog\b/);
    assert.match(anchor, /data-tour="crm-drawer-review"/);
    const uses = [...record.matchAll(/<ReviewAnchor\b/g)].map((m) => m.index);
    assert.equal(uses.length, 2, "the panel header and the phone sheet both anchor the popover");
    for (const at of uses) {
        const open = record.lastIndexOf("<div", at);
        assert.match(record.slice(open, record.indexOf(">", open)), /\brelative\b/, "no relative wrapper");
    }
});

test("Esc closes the popover before the record underneath sees it", () => {
    // The record panel and the phone sheet both close on Esc from a document listener. Capture
    // on document runs first, so the popover can take the key without closing the record.
    assert.match(popover, /addEventListener\("keydown", onKey, true\)/);
    assert.match(popover, /e\.stopPropagation\(\)/);
    assert.match(popover, /role="dialog"/);
    // Non-modal: the record stays usable and keeps its own focus trap.
    assert.doesNotMatch(popover, /aria-modal/);
});

test("the composer keeps its server-appended link and STOP line", () => {
    assert.match(dialog, /Your Google review link and “Reply STOP to opt out” are added automatically\./);
    assert.match(dialog, /alreadySent/);
    assert.match(dialog, /\/api\/portal\/review-request/);
});
