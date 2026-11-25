/**
 * The agency's brand marks in the nav and footer. Since 25 Nov 2026 (Xander) the nav shows the
 * monogram alone, at every width, as the link home; the footer shows the wordmark alone. Both
 * marks are transparent files; the old boxed lockup (/JDD_mark.webp) is gone from both.
 * (The earlier monogram | hairline | wordmark nav came from the mockup
 * https://claude.ai/artifact/Tv1x1gqfbNr9RAMx6hxPyh.)
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

test("the nav is the monogram alone, linking home; the footer is the wordmark alone", () => {
    const brand = nav.match(/<Link href="\/" aria-label="Juneau Digital Designs, home" className="nav-brand">([\s\S]*?)<\/Link>/);
    assert.ok(brand, "the brand must be a link to / that names the business");
    assert.match(brand[1], /src=\{MONOGRAM\.src\}/, "the nav brand shows the monogram");
    assert.doesNotMatch(nav, /WORDMARK/, "the wordmark is the footer's, not the nav's");
    assert.doesNotMatch(nav, /nav-brand-(rule|word|stacked)/, "no hairline or wordmark left in the nav");
    assert.match(footer, /src=\{WORDMARK\.src\}/);
    assert.doesNotMatch(footer, /MONOGRAM/, "the footer shows the wordmark only");
    for (const src of [nav, footer]) assert.doesNotMatch(src, /JDD_mark\.webp/, "the old boxed lockup is still in use");
});

test("sizes: the monogram 40px tall at every width, the footer wordmark up to 64px", () => {
    assert.match(css, /\.nav-brand-mono \{[^}]*height: 40px/);
    assert.doesNotMatch(css, /\.nav-brand-mono[^{]*\{[^}]*display: none/, "the monogram must never be hidden");
    assert.match(css, /\.footer-brand \{[^}]*max-height: 64px/);
});

test("the menu below 1040px, the brand hard left, the bar full width", () => {
    assert.match(css, /@media \(max-width: 1039px\) \{\s*\.nav-bar/);
    assert.match(css, /@media \(min-width: 1040px\) \{\s*\.nav-menu-sm \{ display: none; \}/);
    assert.ok(nav.includes('className="nav-menu-sm '), "the phone menu must hide at the same width the burger does");
    assert.doesNotMatch(nav, /nav-bar[^"]*max-w-7xl/, "the bar runs the full width");
    assert.match(css, /\.nav-links \{[^}]*justify-content: flex-end/);
});
