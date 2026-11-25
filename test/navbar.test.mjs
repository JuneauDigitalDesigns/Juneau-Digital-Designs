/**
 * The nav bar: three zones, one filled button, Portal hard right.
 *
 * Reordered on 19 Nov 2026 from option A of a mockup Xander picked. His complaint was that
 * "View Pricing and Portal both being orange sort of call to action buttons is a little bit
 * confusing", so the one thing these tests guard hardest is that the bar keeps exactly one
 * filled button. The rest pins the order and the pieces he asked for.
 *
 * On the code before this change every test here fails: the bar had no Home link, said
 * "View Pricing", and rendered Portal as a second `.btn.primary`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { CONTACT } from "../app/data/contact.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const nav = read("app/components/navbar/navbar.tsx");
const css = read("app/globals.css");

test("exactly one filled button in the bar, and it is the phone number", () => {
  // `btn primary` is the coral fill. Two of them was the thing Xander called confusing.
  const filled = nav.match(/className="btn primary[^"]*"/g) ?? [];
  assert.equal(filled.length, 2, "expected the call button at two widths and nothing else filled");
  for (const cls of filled) {
    assert.match(cls, /nav-tel/, `a filled button that is not the call button: ${cls}`);
  }
  assert.doesNotMatch(nav, /href="\/pricing" className="btn primary/, "Pricing is filled again");
});

test("the call button dials the contact number, not the demo line", () => {
  assert.match(nav, /href=\{CONTACT\.phoneHref\}/, "the call button does not use the contact number");
  assert.match(nav, /\{CONTACT\.phoneDisplay\}/, "the call button does not show the number");
  assert.equal(CONTACT.phoneHref, "tel:+14079847493");
  // The demo line is a different number for a different job; it belongs in the page asks.
  assert.doesNotMatch(nav, /DEMO_TEL/, "the nav is dialling the demo line");
});

test("Portal is last, outlined, with a door glyph beside its word", () => {
  const portal = nav.indexOf('href="/portal"');
  const tel = nav.indexOf("CONTACT.phoneHref");
  assert.ok(portal > tel, "Portal should come after the call button");
  assert.match(nav, /className="nav-portal"/, "Portal is not the outlined style");
  assert.match(nav, /<DoorGlyph \/>/, "Portal has no door glyph");
  assert.match(css, /\.nav-portal \{[^}]*border: 1px solid var\(--fg\)/s, "Portal has no ink outline");
  assert.doesNotMatch(css, /\.nav-portal \{[^}]*background: var\(--accent-2\)/s, "Portal is filled coral again");
  // Hard right: the actions column is pushed to the end of the grid.
  assert.match(css, /\.nav-actions \{[^}]*justify-self: end/s, "the actions are not against the right edge");
});

// Was "centred in the bar". Since 24 Nov 2026 (Xander, with the new brand marks) the links sit
// right, beside the actions, so the brand can sit hard against the left edge.
test("the links are in their own column, set right beside the actions", () => {
  assert.match(css, /\.nav-bar \{[^}]*grid-template-columns: auto 1fr auto/s, "the bar is not three zones");
  assert.match(css, /\.nav-links \{[^}]*justify-content: flex-end/s, "the links are not set right");
});

test("the glyphs are hidden from screen readers, since each sits beside its own word", () => {
  const icons = read("app/components/navbar/NavIcons.tsx");
  const hidden = icons.match(/aria-hidden="true"/g) ?? [];
  assert.equal(hidden.length, 2, "both glyphs should be aria-hidden");
});

test("the phone bar keeps a call button and hides the wide ones", () => {
  assert.match(nav, /nav-tel-sm/, "there is no phone-sized call button");
  assert.match(nav, /aria-label=\{`Call \$\{CONTACT\.phoneDisplay\}`\}/, "the icon-only call button is unlabelled");
  assert.match(css, /\.nav-tel-sm \{ display: none;/, "the small call button is not hidden on desktop");
  assert.match(css, /\.nav-links, \.nav-portal:not\(\.nav-portal-sm\), \.nav-tel:not\(\.nav-tel-sm\) \{ display: none; \}/);
});

test("every page in the bar is one the sitemap knows about", async () => {
  const { PUBLIC_PATHS } = await import("../app/lib/site-seo.ts");
  for (const href of nav.match(/href="\/[a-z-]*"/g) ?? []) {
    const path = href.slice(6, -1);
    if (path === "/portal") continue; // deliberately out of the sitemap: it needs a login
    assert.ok(PUBLIC_PATHS.includes(path), `the nav links to ${path}, which is not a public path`);
  }
});
