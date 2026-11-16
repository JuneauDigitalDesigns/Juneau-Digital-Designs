/**
 * The mobile number for text alerts formats as it's typed (Xander, 2026-11-16, from his test):
 * "(407) 555-0288", on both agreement pages, inside the Yes card. Paste, backspace and a leading
 * +1 behave, and the caret stays beside the digit it was beside. What is posted stays E.164.
 *
 * `typePhone` is the console's lead-card formatter (`console/src/lib/phoneInput.ts`, jdd-ops),
 * copied because the agency can't import from the console. The first four tests are the console's
 * own (`console/test/phone-input.test.mjs`), so the two copies are held to the same behaviour.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatPhoneDisplay } from "@jdd/schema";

register("./next-link-hook.mjs", import.meta.url);

const { typePhone } = await import("../app/lib/phone-typing.ts");
const { normalizeUsPhone } = await import("../app/lib/phone.mjs");
const { textAlertsChoiceError } = await import("../app/lib/text-alerts-choice.mjs");
const { SMS_CONSENT_V1 } = await import("../app/lib/sms-consent-text.ts");
const { default: SmsOptIn } = await import("../app/components/agreement/SmsOptIn.tsx");

/** Types `chars` one at a time at the end, as a person would. */
function typeAll(chars) {
    let value = "";
    for (const ch of chars) value = typePhone(value, value + ch, value.length + 1).value;
    return value;
}

/* ── the console's tests (plus a typed +1) ───────────────────────────────────────── */

test("digits format as they are typed", () => {
    assert.equal(typePhone("", "4", 1).value, "(4");
    assert.equal(typeAll("407"), "(407");
    assert.equal(typeAll("4075"), "(407) 5");
    assert.equal(typeAll("4075550"), "(407) 555-0");
    assert.equal(typeAll("4075550288"), "(407) 555-0288");
    assert.equal(typeAll("4075550288"), formatPhoneDisplay("4075550288"), "the shared formatter at 10 digits");
});

test("a paste in any common form, and a leading 1 or +1, comes out the same", () => {
    for (const pasted of ["+1 407-555-0288", "1.407.555.0288", "407 555 0288", "(407)555-0288", "14075550288", "+14075550288"]) {
        assert.equal(typePhone("", pasted, pasted.length).value, "(407) 555-0288", pasted);
    }
    assert.equal(typeAll("14075"), "(407) 5", "a typed leading 1 is the country code");
    assert.equal(typeAll("+14075"), "(407) 5", "a typed +1 too");
});

test("backspace over a dash or a bracket removes the digit before it, and the caret stays put", () => {
    // "(407) 555-|0399", backspace: the dash goes, so the 5 before it goes instead.
    assert.deepEqual(typePhone("(407) 555-0399", "(407) 5550399", 9), { value: "(407) 550-399", caret: 8 });
    // Backspace over the space after ")".
    assert.deepEqual(typePhone("(407) 5", "(407)5", 5), { value: "(405", caret: 3 });
    // Deleting a digit in the middle keeps the caret where it was.
    assert.deepEqual(typePhone("(407) 555-0399", "(40) 555-0399", 3), { value: "(405) 550-399", caret: 3 });
    // Clearing it.
    assert.deepEqual(typePhone("(4", "(", 1), { value: "", caret: 0 });
});

test("anything that is not a US number is left exactly as typed", () => {
    assert.equal(typePhone("", "+44 20 7946 0958", 16).value, "+44 20 7946 0958");
    assert.equal(typePhone("(407) 555-0288", "(407) 555-02881", 15).value, "(407) 555-02881");
    assert.equal(typePhone("", "ext 12", 6).value, "ext 12");
});

/* ── on the agreement pages ───────────────────────────────────────────────── */

test("what is posted stays E.164, and the formatted number passes the Yes card's rule", () => {
    const shown = typeAll("4075550288");
    assert.equal(normalizeUsPhone(shown), "+14075550288");
    assert.equal(textAlertsChoiceError({ choice: "yes", smsConsent: true, alertPhone: shown }), null);
    // A half-typed number is still refused, formatted or not.
    assert.notEqual(textAlertsChoiceError({ choice: "yes", smsConsent: true, alertPhone: typeAll("40755") }), null);
    // Both pages send normalizeUsPhone(...) of the field, never the field as shown.
    for (const file of ["app/components/agreement/AgreeLinkClient.tsx", "app/components/agreement/AgreementClient.tsx"]) {
        const src = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
        assert.match(src, /normalizeUsPhone\((?:alertPhone|form\.alertPhone)\)/, file);
    }
});

test("the Yes card's number field formats with typePhone and puts the caret back", () => {
    const src = readFileSync(new URL("../app/components/agreement/SmsOptIn.tsx", import.meta.url), "utf8");
    assert.match(src, /typePhone\(phone, e\.target\.value, e\.target\.selectionStart \?\? e\.target\.value\.length\)/);
    assert.match(src, /setSelectionRange\(caret, caret\)/);
    // Rendered with a stored value, the field shows it as given (formatting happens while typing).
    const html = renderToStaticMarkup(
        createElement(SmsOptIn, {
            copy: SMS_CONSENT_V1,
            choice: "yes",
            onChoiceChange: () => {},
            phone: "(407) 555-0288",
            onPhoneChange: () => {},
            checked: false,
            onCheckedChange: () => {},
        }),
    );
    assert.match(html, /id="mobile-number-for-text-alerts"[^>]*value="\(407\) 555-0288"/);
});
