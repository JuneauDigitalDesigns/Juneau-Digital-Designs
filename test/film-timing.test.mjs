/**
 * The receptionist film's subtitle timing (`app/components/home/film-timing.ts`).
 *
 * Xander (2026-11-12): the transcript moved too fast, at a flat 2s a line. Approved: each line
 * stays up 0.9s plus 0.23s a word, so a long line gets the time a short one does not need.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { lineMs, callMs } from "../app/components/home/film-timing.ts";

test("a line stays up 0.9s plus 0.23s a word", () => {
    assert.equal(lineMs("Furnace quit overnight and the house is down to 58. Two kids at home."), 900 + 14 * 230);
});

test("words are counted on whitespace, however it is spaced", () => {
    assert.equal(lineMs("  one two   three four  five six seven  "), 900 + 7 * 230);
});

test("no line is shorter than the old flat 2s", () => {
    assert.ok(lineMs("Yes.") >= 2000);
});

test("the call's length is every line plus the rest after the last", () => {
    const lines = ["a b c", "d e f g h i j k"];
    assert.equal(callMs(lines, 1200), lineMs(lines[0]) + lineMs(lines[1]) + 1200);
});
