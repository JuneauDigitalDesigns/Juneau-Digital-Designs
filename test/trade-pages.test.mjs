/**
 * The Trades menu, and the one list behind it.
 *
 * The nav and the footer both read `app/data/trade-pages.ts`, so a trade page is added in one
 * place. These tests hold that: a page in the list must be a real route and must be in the
 * sitemap, which is the pair that would otherwise drift as trades are added one at a time.
 *
 * On the code before this change every test here fails: there is no `app/data/trade-pages.ts`
 * and no `app/components/navbar/TradesMenu.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { TRADE_PAGES } from "../app/data/trade-pages.ts";
import { PUBLIC_PATHS, SITE_URL } from "../app/lib/site-seo.ts";
import sitemap from "../app/sitemap.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), "utf8");

test("every trade in the menu is a real page, in the sitemap", () => {
  assert.ok(TRADE_PAGES.length > 0, "the Trades menu would be empty");
  const urls = sitemap().map((e) => e.url);
  for (const trade of TRADE_PAGES) {
    assert.match(trade.href, /^\/[a-z0-9-]+$/, `${trade.href} is not a plain path`);
    assert.ok(existsSync(root(`app${trade.href}/page.tsx`)), `${trade.href} has no page`);
    assert.ok(PUBLIC_PATHS.includes(trade.href), `${trade.href} is missing from PUBLIC_PATHS`);
    assert.ok(urls.includes(`${SITE_URL}${trade.href}`), `${trade.href} is missing from the sitemap`);
    assert.ok(trade.label.trim().length > 0, `${trade.href} has no label`);
  }
});

test("HVAC is in the menu", () => {
  assert.ok(
    TRADE_PAGES.some((t) => t.href === "/hvac" && t.label === "HVAC"),
    "the first trade page is not listed",
  );
});

test("the nav and the footer both read the shared list, not their own markup", () => {
  const nav = read("app/components/navbar/navbar.tsx");
  const menu = read("app/components/navbar/TradesMenu.tsx");
  const footer = read("app/components/footer/footer.tsx");
  for (const [name, src] of [["the nav", nav], ["the Trades menu", menu], ["the footer", footer]]) {
    assert.match(src, /TRADE_PAGES/, `${name} does not read the shared list`);
    assert.doesNotMatch(src, /href="\/hvac"/, `${name} still hard-codes a trade page`);
  }
});

test("About and Trades are outlined pills, side by side, About first", () => {
  const nav = read("app/components/navbar/navbar.tsx");
  const about = nav.indexOf('href="/about"');
  const trades = nav.indexOf("<TradesMenu />");
  assert.ok(about > -1 && trades > about, "About should come before Trades in the desktop nav");
  assert.match(nav, /className="nav-pill"/, "About is not a pill");
  const css = read("app/globals.css");
  assert.match(css, /\.nav-pill \{/, "the pill style is missing");
  assert.match(css, /border: 1px solid var\(--fg\)/, "the pill has no ink outline");
  assert.doesNotMatch(css, /\.nav-link\b/, "the old plain-link style is still there");
});

test("the menu opens by click and keyboard as well as hover, and says so to a screen reader", () => {
  const menu = read("app/components/navbar/TradesMenu.tsx");
  // Hover alone would leave the menu unreachable on a phone and by keyboard.
  for (const handler of ["onMouseEnter", "onMouseLeave", "onClick", "onFocus", "onBlur", "onKeyDown"]) {
    assert.match(menu, new RegExp(handler), `the menu has no ${handler}`);
  }
  assert.match(menu, /aria-expanded=\{open\}/, "the trigger does not report its state");
  assert.match(menu, /aria-haspopup/, "the trigger does not say it opens a menu");
  assert.match(menu, /"Escape"/, "Escape does not close the menu");
  assert.match(menu, /useReducedMotion/, "the animation ignores a reduced-motion preference");
});
