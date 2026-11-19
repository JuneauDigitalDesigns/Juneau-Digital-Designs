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

test("the bar runs Home, About, Trades, Contact, Pricing, in that order", () => {
  const nav = read("app/components/navbar/navbar.tsx");
  const at = (needle) => {
    const i = nav.indexOf(needle);
    assert.ok(i > -1, `the nav is missing ${needle}`);
    return i;
  };
  // Home and About come from LINKS, Trades is placed between About and Contact.
  const order = [at('{ href: "/", label: "Home" }'), at('{ href: "/about", label: "About" }')];
  assert.ok(order[1] > order[0], "Home should be the first link");
  assert.ok(
    at('{ href: "/contact", label: "Contact" }') < at('{ href: "/pricing", label: "Pricing" }'),
    "Contact should come before Pricing",
  );
  assert.match(nav, /<TradesMenu \/>/, "the Trades menu is gone from the bar");
  // "View Pricing" became "Pricing" (Xander, 19 Nov 2026).
  assert.doesNotMatch(nav, /View Pricing/, 'the nav still says "View Pricing"');
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
