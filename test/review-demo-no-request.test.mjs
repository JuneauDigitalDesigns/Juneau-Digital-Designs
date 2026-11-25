/**
 * The Growth demo's Review tap never sends a review request (2026-11-19).
 *
 * The demo plays the real customer record on sample data. Until 2026-11-19 it held the old review
 * window open (`forceOpen` into `ReviewAnchor`, which drew `ReviewRequestDialog`); the record is
 * one tap now, and so is the demo, so the window and its plumbing are gone. A one-tap Review on
 * the live record POSTs `/api/portal/review-request`; on the demo's sample customer it must only
 * show the note, "Review request sent!", and reach no route at all.
 *
 * `reviewTap` is the decision, run here for real (transpiled from the record's own source, which
 * cannot be imported whole outside Next); the rest holds the wiring at source level, because there
 * is no browser in this suite and no test account to sign in with.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const RECORD = "app/components/portal/crm/CustomerRecord.tsx";
const src = readFileSync(RECORD, "utf8").replace(/\r\n/g, "\n");
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** One top-level function's source, from its declaration to its closing brace. */
function fn(name) {
    const at = code.search(new RegExp(`\\n(export )?function ${name}\\b`));
    assert.ok(at >= 0, `${name} is in the record`);
    const rest = code.slice(at + 1);
    return rest.slice(0, rest.search(/\n\}\n/) + 2);
}

test("reviewTap: the demo shows the note, the live record sends", () => {
    const js = ts.transpileModule(fn("reviewTap").replace(/^export /, ""), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const reviewTap = new Function(`${js}; return reviewTap;`)();
    assert.equal(reviewTap(true), "toast");
    assert.equal(reviewTap(false), "send");
});

test("a Review tap goes through reviewTap, and the demo's branch returns before any request", () => {
    const anchor = fn("ReviewAnchor");
    // The only network call in the button is the one-tap send, to the review-request route.
    assert.equal(anchor.match(/fetch\(/g).length, 1);
    assert.match(anchor, /fetch\(`\/api\/portal\/review-request\?site=/);
    const send = anchor.slice(anchor.indexOf("async function sendNow"), anchor.indexOf("function onClick"));
    assert.match(send, /fetch\(/, "the request lives in sendNow");
    // sendNow is called once, from onClick, after the demo has already returned.
    assert.equal(anchor.match(/sendNow\b/g).length, 2, "declared once, called once");
    const click = anchor.slice(anchor.indexOf("function onClick"), anchor.indexOf("return (", anchor.indexOf("function onClick")));
    const guard = click.indexOf('if (reviewTap(demo) === "toast")');
    const ret = click.indexOf("return;", guard);
    const call = click.indexOf("void sendNow()");
    assert.ok(guard >= 0 && ret > guard && call > ret, "demo: note, return; then the send");
    assert.match(click.slice(guard, ret), /setToast\(\{ ok: true, text: "Review request sent!" \}\)/);
    // Both buttons (the panel's and the phone's round one) use that handler and nothing else.
    assert.equal(anchor.match(/onClick=\{onClick\}/g).length, 2);
    assert.doesNotMatch(anchor, /onClick=\{\(\) => void sendNow\(\)\}|onClick=\{sendNow\}/);
});

test("the record tells the button it is the demo's whenever it is handed the demo's data", () => {
    assert.match(code, /const isDemo = Boolean\(demo\);/);
    assert.match(code, /const reviewProps: ReviewAnchorProps = \{[\s\S]*?demo: isDemo,[\s\S]*?\};/);
    assert.equal(code.match(/<ReviewAnchor \{\.\.\.review\}/g).length, 2, "the panel header and the phone header");
});

test("the live one-tap path and its note are unchanged", () => {
    const anchor = fn("ReviewAnchor");
    assert.match(anchor, /body: JSON\.stringify\(\{ phone: customer\.phone \}\)/);
    assert.match(anchor, /if \(res\.ok\) \{\s*setToast\(\{ ok: true, text: "Review request sent!" \}\);\s*onSent\(\);/);
    assert.match(anchor, /<ReviewToast ok=\{toast\.ok\} text=\{toast\.text\} onDone=\{\(\) => setToast\(null\)\} \/>/);
    // The note still portals to the page for the live record; the demo draws it inline.
    assert.match(fn("ReviewToast"), /createPortal\(/);
    assert.match(fn("ReviewToast"), /if \(inline\)/);
});

test("the old review window and its demo hook are gone", () => {
    assert.equal(existsSync("app/components/portal/ReviewRequestDialog.tsx"), false);
    assert.doesNotMatch(code, /forceOpen|ReviewRequestDialog|reviewOpen/);
    // The board never had a review drawer of its own again (kept from the popover test).
    const section = readFileSync("app/components/portal/crm/CustomersSection.tsx", "utf8");
    assert.doesNotMatch(section, /ReviewRequestDialog|setReviewFor/);
});
