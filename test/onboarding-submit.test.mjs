/**
 * The onboarding wizard may only be sent by an explicit click on Send.
 *
 * It used to submit through `<form onSubmit={handleSubmit}>`, and two things sent it before the
 * client reached Review, redirecting them to the portal with the site already marked "building":
 *
 * 1. Next and Submit were one unkeyed footer `<button>` whose `type` flipped to "submit" on the last
 *    step. Clicking Next on the step before Review re-rendered that same DOM node as a submit
 *    button mid-click, and the browser submitted the form. Reproduced against React 19.2.7.
 * 2. Enter in a step with exactly one text input is an implicit form submission.
 *
 * There is no DOM test runner in this repo, so these are source-level checks, like the other
 * structural tests here. Each one fails on the wizard as it was before the fix.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const WIZARD = "../app/components/onboarding/onboardingpageclient.tsx";
/** The wizard's code with comments removed, so the explanation of the old bug can't trip a check. */
const source = readFileSync(fileURLToPath(new URL(WIZARD, import.meta.url)), "utf8")
    .replace(/\/\*[^]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

/** Every JSX opening tag for `name`, attributes included (tags may span lines). */
function openingTags(name) {
    const out = [];
    const re = new RegExp(`<${name}\\b`, "g");
    let m;
    while ((m = re.exec(source))) {
        // Walk to the tag's closing `>`, skipping over `{...}` expressions (which contain `=>`).
        let depth = 0;
        let i = m.index + name.length + 1;
        for (; i < source.length; i++) {
            const c = source[i];
            if (c === "{") depth++;
            else if (c === "}") depth--;
            else if (c === ">" && depth === 0) break;
        }
        out.push(source.slice(m.index, i + 1));
    }
    return out;
}

test("no element in the wizard is a native submit button", () => {
    assert.doesNotMatch(source, /type=["']submit["']/, 'a type="submit" button can send the wizard from a stray click or Enter');
});

test("the form's own submit event is cancelled and never sends", () => {
    const forms = openingTags("form");
    assert.equal(forms.length, 1, "expected exactly one <form> in the wizard");
    const [form] = forms;
    assert.doesNotMatch(form, /handleSubmit/, "the form's submit event must not call handleSubmit (Enter in a lone input would send)");
    assert.match(form, /onSubmit=\{[^]*preventDefault\(\)/, "the form must cancel its native submit");
});

test("handleSubmit is only ever called from a click", () => {
    const uses = [...source.matchAll(/handleSubmit\b/g)].map((m) => {
        const lineStart = source.lastIndexOf("\n", m.index) + 1;
        return source.slice(lineStart, source.indexOf("\n", m.index));
    });
    const calls = uses.filter((line) => !/const handleSubmit\s*=/.test(line));
    assert.ok(calls.length >= 1, "expected the Send button to call handleSubmit");
    for (const line of calls) {
        assert.match(line, /handleSubmit\(\)/, `handleSubmit must be invoked directly from a click handler, found: ${line.trim()}`);
    }
});

test("Next and Send are distinct, keyed, type=button elements", () => {
    const buttons = openingTags("button");
    const next = buttons.filter((b) => /onClick=\{next\}/.test(b));
    const send = buttons.filter((b) => /handleSubmit\(\)/.test(b));
    assert.ok(next.length >= 1, "expected a Next button wired to next()");
    assert.equal(send.length, 1, "expected exactly one Send button");
    const footerNext = next.find((b) => /key=["']next["']/.test(b));
    assert.ok(footerNext, 'the footer Next button needs key="next" so React never reuses it as Send');
    assert.match(send[0], /key=["']send["']/, 'the Send button needs key="send"');
    assert.match(send[0], /type=["']button["']/, "Send must be type=button and send from its click handler");
});
