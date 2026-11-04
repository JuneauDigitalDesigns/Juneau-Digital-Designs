/**
 * Two pieces of customer-facing copy that can cost a client something real, and the note a
 * review request leaves behind.
 *
 * Both copy rules are the kind that come back: the words are easy to retype, the harm is
 * invisible from inside the portal, and the person who reintroduces them will be trying to be
 * helpful. So they are checked here rather than trusted to review.
 *
 * Imports the real implementations through the transpile hooks `npm test` registers — see
 * `ts-transpile.mjs`.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
    defaultReviewMessage,
    greetingName,
    reviewRequestActivity,
} from "../app/lib/review-message.ts";

/* ── the review request may not buy a review ──────────────────────────────── */

test("the default review message offers nothing in return", () => {
    /**
     * It used to end "As a thank-you, show us your review for 10% off your next service."
     *
     * Google prohibits incentivised reviews, and the penalty lands on the business rather than
     * on us: reviews stripped, profile flagged. It was the *default*, so every client who never
     * edited it sent it. A discount, a draw, a freebie or a thank-you conditional on leaving
     * one are all the same rule, which is why this looks for the shapes rather than the string.
     */
    const body = defaultReviewMessage("Rosalind Mackay", "Your HVAC Code");

    for (const banned of [
        /\d+\s*%/,
        /\boff\b/i,
        /discount/i,
        /voucher/i,
        /coupon/i,
        /free\b/i,
        /gift/i,
        /reward/i,
        /prize/i,
        /draw\b/i,
        /in return/i,
        /thank-you,/i,
    ]) {
        assert.ok(!banned.test(body), `the default message matched ${banned}`);
    }
});

test("the default message still greets by name and names the business", () => {
    // Removing the incentive must not leave a limp message: the two things that make it read
    // as a person rather than a bulk send are the first name and the business.
    const body = defaultReviewMessage("Rosalind Mackay", "Your HVAC Code");

    assert.match(body, /^Hi Rosalind,/);
    assert.match(body, /Your HVAC Code/);
    assert.match(body, /Google review/);
    // It is an SMS, and the client's edit is capped at 320 before the link and STOP tail.
    assert.ok(body.length < 320, `default body is ${body.length} characters`);
});

test("a caller with no name still gets a greeting, not a gap", () => {
    assert.match(defaultReviewMessage(null, "Your HVAC Code"), /^Hi there,/);
    assert.equal(greetingName(null), "there");
    assert.equal(greetingName("   "), "there");
    assert.equal(greetingName("Rosalind Mackay"), "Rosalind");
});

/* ── carrier approval has no date ─────────────────────────────────────────── */

/** Every .ts/.tsx under app/, which is all the copy the portal and the site can show. */
function sourceFiles(dir) {
    const out = [];
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
        else if (/\.tsx?$/.test(entry)) out.push(path);
    }
    return out;
}

test("no customer-facing copy promises when the carriers will approve", () => {
    /**
     * A2P 10DLC approval is the carriers' decision. "Usually about two more weeks" was the
     * honest average and still the wrong thing to print: it is us promising something we do
     * not control, and the client who reads it is owed an explanation on day fifteen.
     *
     * `homepageclient.tsx` settled this first and says so in a comment — "a timeframe here
     * would be ours promising theirs". The portal said it in five separate places anyway,
     * which is exactly how a rule that lives only in one file's comment gets lost.
     */
    const offenders = [];
    for (const file of sourceFiles("app")) {
        const src = readFileSync(file, "utf8");
        for (const [i, line] of src.split("\n").entries()) {
            // Comments are where the real timescale belongs — whoever maintains this needs to
            // know it is 13–20 business days. The rule is about what a client reads.
            if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue;
            // Narrow on purpose: a duration beside *approval or registration*. A porting
            // deadline mentions carriers and thirty days while promising nothing about what
            // the carriers will decide, so "carrier" alone is too loose a trigger.
            if (!/approv|registration/i.test(line)) continue;
            if (/\b(\d+|one|two|three|four|a few|couple)\b[^.]{0,24}\b(day|week)s?\b/i.test(line)) {
                offenders.push(`${file}:${i + 1}`);
            }
        }
    }
    assert.deepEqual(offenders, [], `these promise a carrier timeframe:\n${offenders.join("\n")}`);
});

/* ── a sent review request shows on the customer ──────────────────────────── */

test("a review request becomes a timeline entry that says who did it", () => {
    // Sending one was recorded against the phone number and nowhere else, so the customer's
    // own history never showed they had been asked.
    const entry = reviewRequestActivity("Rosalind Mackay");

    assert.equal(entry.kind, "review-request");
    assert.equal(entry.actor, "client", "the client asked; the customer did not do this");
    assert.equal(entry.summary, "You asked Rosalind Mackay for a Google review");
});

test("a nameless customer still reads as a sentence", () => {
    assert.equal(reviewRequestActivity(null).summary, "You asked them for a Google review");
    assert.equal(reviewRequestActivity("  ").summary, "You asked them for a Google review");
});
