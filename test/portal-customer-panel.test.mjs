import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * The desktop customer record is a wide panel over a dimmed board (portal UX rework, Q4).
 *
 * None of the rules below can be seen by the compiler, and the portal has no signed-in test
 * account to exercise them in a browser, so they are held at source level, the same way
 * `portal-tour-and-back.test.mjs` holds the "All customers" fix this builds on.
 */

/** Code only: the explanatory comments name the old patterns on purpose. */
function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

const section = code("app/components/portal/crm/CustomersSection.tsx");
const panel = code("app/components/portal/crm/CustomerPanel.tsx");
const drawer = code("app/components/portal/crm/CustomerDrawer.tsx");
const record = code("app/components/portal/crm/CustomerRecord.tsx");

test("the board stays mounted under an open record", () => {
    // The record used to replace the board from an early return.
    assert.doesNotMatch(section, /if\s*\(\s*openId\s*&&\s*!isMobile\s*\)\s*\{\s*return/);
    assert.match(section, /<CustomerPanel\s+open=\{panelOpen\}/);
    assert.match(section, /variant="panel"/);
});

test("the board behind an open panel is inert", () => {
    assert.match(section, /inert=\{panelOpen\}/);
    // The panel itself must sit outside the inert subtree, or it is inert too.
    const inertAt = section.lastIndexOf("<div", section.indexOf("inert={panelOpen}"));
    const boardClose = section.indexOf("<CustomerPanel", inertAt);
    const between = section.slice(inertAt, boardClose);
    // Every <div> opened from the inert one onward (itself included) is closed by then.
    const opens = (between.match(/<div\b(?![^>]*\/>)/g) ?? []).length;
    const closes = (between.match(/<\/div>/g) ?? []).length;
    assert.equal(opens, closes, "CustomerPanel is rendered inside the inert board");
});

test("the phone sheet only opens on a phone", () => {
    // Now that the board renders on a desktop too, an ungated sheet would open under the panel.
    assert.match(section, /<CustomerDrawer\s+open=\{openId !== null && isMobile\}/);
});

test("the panel is a modal dialog with every way out", () => {
    assert.match(panel, /role="dialog"/);
    assert.match(panel, /aria-modal="true"/);
    assert.match(panel, /e\.key === "Escape"/);
    assert.match(panel, /e\.key !== "Tab"/, "no focus trap");
    assert.match(panel, /onClick=\{onClose\}/, "the dimmed strip does not close it");
    // Kept mounted for the exit animation.
    assert.match(panel, /<AnimatePresence/);
    assert.match(panel, /exit=\{/);
});

test("the panel honours reduced motion", () => {
    assert.match(panel, /useReducedMotion\(\)/);
});

test("the panel gives the keyboard to the tour and to dialogs on top of it", () => {
    assert.match(panel, /driver-active/);
    assert.match(panel, /\[aria-modal="true"\]/);
});

test("the panel stacks under Drawer and far under the tour", () => {
    const z = panel.match(/z-\[(\d+)\]/);
    assert.ok(z, "the panel layer has no explicit z-index");
    const value = Number(z[1]);
    // `Drawer` (Request a review) is z-40/50 and must open on top; driver.js is 10000+.
    assert.ok(value < 40, `panel z-index ${value} would cover the review dialog`);
    assert.ok(value > 30, `panel z-index ${value} would sit under the phone tab bar`);
});

test("focus can return to the card that opened the record", () => {
    // A card has to be focusable to be focused on click, and findable after a stage change.
    const card = section.slice(section.indexOf("function BoardCard"));
    assert.match(card, /tabIndex=\{0\}/);
    assert.match(card, /data-customer-id=\{row\.customerId\}/);
    assert.match(card, /data-tour="crm-card"/);
    assert.match(panel, /data-customer-id="\$\{CSS\.escape/);
});

test("the Text button does not push a hash entry that Back would land on", () => {
    assert.match(record, /href="#crm-sms"\s+onClick=\{\(e\) => \{[\s\S]*?e\.preventDefault\(\)/);
});

test("the phone sheet's way back reads All customers", () => {
    assert.match(drawer, /back="All customers"/);
});
