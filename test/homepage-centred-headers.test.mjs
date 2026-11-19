/**
 * Homepage section headers: centred, with a coral close (Xander, 2026-11-19, mockups A + C).
 *
 * Every section heading is centred and its last words are coral, as "missed calls" already was
 * in the calculator. Where a paragraph follows the heading it is centred, a size up, under a
 * short coral rule. Not one word of copy changes: each heading's text, tags stripped, is
 * exactly what it was.
 *
 * Source-level, as there is no browser in this suite.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/components/home/homepageclient.tsx", "utf8");
const featured = readFileSync("app/components/home/FeaturedSites.tsx", "utf8");
const css = readFileSync("app/globals.css", "utf8");

/** Every <h2> in a source file, as [its text with tags and JSX whitespace collapsed, its raw markup]. */
function headings(src) {
    return [...src.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)].map((m) => [
        m[1].replace(/<[^>]+>/g, "").replace(/\{" "\}/g, " ").replace(/\s+/g, " ").trim(),
        m[1],
    ]);
}
const all = [...headings(home), ...headings(featured)];
const byText = Object.fromEntries(all);

const CORAL = {
    "A website that makes the phone ring.": "phone ring.",
    "Then someone picks up.": "picks up.",
    "And nothing slips.": "nothing slips.",
    "How much are your missed calls worth?": "missed calls",
    "Real sites, real clients.": "real clients.",
    "Every plan starts here.": "starts here.",
};

test("every homepage heading keeps its exact words", () => {
    assert.deepEqual(all.map(([t]) => t).sort(), Object.keys(CORAL).sort());
});

test("each heading's coral words are its payoff, in one home-em span", () => {
    for (const [text, words] of Object.entries(CORAL)) {
        const spans = [...byText[text].matchAll(/<span className="home-em">([^<]+)<\/span>/g)].map((m) => m[1]);
        assert.deepEqual(spans, [words], text);
    }
});

test("the coral words are coral and never break across two lines", () => {
    assert.match(css, /\.home-em \{[^}]*color: var\(--accent-2\);[^}]*white-space: nowrap;/);
});

test("section heads are centred, and the paragraph under one sits a size up under a coral rule", () => {
    assert.match(css, /\.home-head \{[^}]*text-align: center;/);
    assert.match(css, /\.home-head-copy::before \{[^}]*background: var\(--accent-2\);/);
    assert.match(css, /\.home-head \.home-lede \{[^}]*font-size: clamp\(18px, 1\.55vw, 22px\);/);
    for (const section of ["WebsiteSection", "ReceptionistSection", "ClosingSection"]) {
        const body = home.slice(home.indexOf(`function ${section}`), home.indexOf("\n}\n", home.indexOf(`function ${section}`)));
        assert.match(body, /className="home-head"/, section);
    }
    assert.match(featured, /className="home-head"/);
});

test("the left-aligned splits are gone: 01 no longer splits, 02 stacks its words over the film", () => {
    assert.doesNotMatch(home, /home-split/);
    assert.doesNotMatch(css, /\.home-split/);
    assert.doesNotMatch(css, /\.home-duo \{ grid-template-columns/);
});
