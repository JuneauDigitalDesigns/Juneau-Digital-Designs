/**
 * The agency's brand marks in the nav and footer (Xander, 24 Nov 2026, from the mockup
 * https://claude.ai/artifact/Tv1x1gqfbNr9RAMx6hxPyh): the nav shows monogram | dark hairline |
 * wordmark, the wordmark alone below 640px; the footer shows the wordmark alone. Both marks are
 * transparent files; the old boxed lockup (/JDD_mark.webp) is gone from both.
 *
 * Source-level, as there is no browser in this suite. Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { MONOGRAM, WORDMARK } from "../app/data/brand-marks.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), "utf8");
const nav = read("app/components/navbar/navbar.tsx");
const footer = read("app/components/footer/footer.tsx");
const css = read("app/globals.css");

test("both marks are real files, with their own pixel sizes", () => {
    for (const mark of [MONOGRAM, WORDMARK]) assert.ok(existsSync(root(`public${mark.src}`)), `${mark.src} is missing`);
    assert.deepEqual([MONOGRAM.width, MONOGRAM.height], [3200, 1684]);
    assert.deepEqual([WORDMARK.width, WORDMARK.height], [4800, 773]);
});

test("the nav is monogram | hairline | wordmark; the footer is the wordmark alone", () => {
    const mono = nav.indexOf("src={MONOGRAM.src}");
    const rule = nav.indexOf('className="nav-brand-rule"');
    const word = nav.indexOf("src={WORDMARK.src}");
    assert.ok(mono > -1 && mono < rule && rule < word, "the nav's order is monogram, hairline, wordmark");
    assert.match(footer, /src=\{WORDMARK\.src\}/);
    assert.doesNotMatch(footer, /MONOGRAM/, "the footer shows the wordmark only");
    for (const src of [nav, footer]) assert.doesNotMatch(src, /JDD_mark\.webp/, "the old boxed lockup is still in use");
});

test("approved sizes, and the wordmark alone below 640px", () => {
    assert.match(css, /\.nav-brand-mono \{[^}]*height: 30px/);
    assert.match(css, /\.nav-brand-word \{[^}]*height: 44px/);
    assert.match(css, /\.footer-brand \{[^}]*max-height: 64px/);
    assert.match(css, /@media \(max-width: 639px\) \{\s*\.nav-brand-mono,\s*\.nav-brand-rule \{ display: none; \}/);
});
