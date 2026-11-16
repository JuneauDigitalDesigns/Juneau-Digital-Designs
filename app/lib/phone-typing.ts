/**
 * A US phone formatted as it's typed: "(407) 555-0288". Used by the mobile number for text alerts
 * on both agreement pages (Xander, 2026-11-16, from his test).
 *
 * A copy of the console's lead-card formatter, `typePhone` in jdd-ops
 * `console/src/lib/phoneInput.ts`. The agency can't import from the console, and
 * `test/agreement-phone-typing.test.mjs` runs the console's own test cases against this copy, so
 * the two keep the same behaviour. Change both together.
 *
 * A complete number is @jdd/schema's `formatPhoneDisplay`, the one the sites and the agency's
 * onboarding use; this adds only the steps on the way there ("(407", "(407) 555-0") and keeps the
 * caret beside the digit it was beside. A pasted "+1 407-555-0288", "1.407.555.0288" or a typed
 * leading 1 reads as the same number (no US area code starts with 1). Anything else, a "+44 …"
 * number, more than ten digits, letters, is left exactly as typed, never guessed at.
 *
 * Backspace over a bracket, space or dash would delete only the punctuation, which formatting puts
 * straight back, so the key would seem dead: it removes the digit before it instead.
 *
 * Display only: what the pages post is still `normalizeUsPhone(...)` of the field, E.164.
 *
 * CLIENT-SAFE.
 */
import { formatPhoneDisplay } from "@jdd/schema";

const digitsOf = (s: string) => s.replace(/\D/g, "");

function partial(d: string): string {
    if (d.length === 0) return "";
    if (d.length <= 3) return `(${d}`;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    if (d.length < 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    return formatPhoneDisplay(d);
}

/** The caret after the `n`th digit of `s` (0: the very start). */
function caretAfterDigits(s: string, n: number): number {
    if (n <= 0) return 0;
    let seen = 0;
    for (let i = 0; i < s.length; i++) {
        if (/\d/.test(s[i]) && ++seen === n) return i + 1;
    }
    return s.length;
}

/**
 * `prev` is the field's value before this keystroke or paste, `next` the browser's value after it
 * and `caret` its caret there. Returns the value to show and where the caret goes.
 */
export function typePhone(prev: string, next: string, caret: number): { value: string; caret: number } {
    const asTyped = { value: next, caret };
    if (/[a-z]/i.test(next) || (/^\s*\+/.test(next) && !/^\s*\+\s*1/.test(next))) return asTyped;

    let digits = digitsOf(next);
    let before = digitsOf(next.slice(0, caret)).length;

    // A deleted bracket, space or dash: take the digit before it with it.
    if (next.length === prev.length - 1 && digits === digitsOf(prev) && before > 0) {
        digits = digits.slice(0, before - 1) + digits.slice(before);
        before -= 1;
    }

    // The country code: a leading 1 is never part of a US number.
    if (digits.startsWith("1")) {
        digits = digits.slice(1);
        before = Math.max(0, before - 1);
    }
    if (digits.length > 10) return asTyped;

    const value = partial(digits);
    return { value, caret: before >= digits.length ? value.length : caretAfterDigits(value, before) };
}
