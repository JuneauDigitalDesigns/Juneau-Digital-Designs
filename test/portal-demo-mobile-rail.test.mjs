/**
 * Two homepage fixes on a phone (Xander, 2026-11-19).
 *
 * 1. The portal demo's phone version shows the phone and nothing else: no step rail and no
 *    caption box under it ("those can hide, only show on desktop"). The desktop demo keeps both.
 *    Screen readers still hear each step, from a visually hidden caption, and reduced motion,
 *    which used to wait for the rail, now steps through the finished frames on its own.
 * 2. The calculator heading's "missed calls" never breaks across two lines.
 *
 * Source-level, as there is no browser in this suite.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mobile = readFileSync("app/components/home/PortalDemoMobile.tsx", "utf8");
const desktop = readFileSync("app/components/home/PortalDemo.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

test("the phone demo has no step rail and no visible caption box", () => {
    assert.doesNotMatch(mobile, /s\.steps\b/, "no step rail");
    assert.doesNotMatch(mobile, /s\.controls\b/, "no controls row");
    assert.doesNotMatch(mobile, /s\.phoneCaption\b/, "no caption box");
});

test("the desktop demo keeps its step rail", () => {
    assert.match(desktop, /s\.steps\b/);
});

test("screen readers still hear each step's caption on the phone", () => {
    assert.match(mobile, /className=\{s\.srOnly\} aria-live="polite"/);
    assert.match(mobile, /cap\.caption/);
});

test("reduced motion plays through the finished frames and reaches the closing panel", () => {
    assert.match(mobile, /setT\(reduce \? seg\.to : seg\.from\)/);
    assert.match(mobile, /const closing = run === "done";/);
    assert.match(mobile, /const pausable = run === "playing";/);
});

test("the slot held for the phone demo is the phone's own height", () => {
    assert.match(css, /\.portal-demo-slot \{ min-height: min\(680px, 78vh\); \}/);
});

test('the calculator heading keeps "missed calls" on one line', () => {
    // Since 2026-11-19 every heading's coral words share `.home-em`, which holds them together.
    const home = readFileSync("app/components/home/homepageclient.tsx", "utf8");
    assert.match(home, /How much are your <span className="home-em">missed calls<\/span> worth\?/);
    assert.match(css, /\.home-em \{[^}]*white-space: nowrap;/);
});
