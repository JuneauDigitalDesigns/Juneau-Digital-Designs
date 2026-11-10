/**
 * The /faq page, and the footer links to it and to /terms.
 *
 * The homepage's "Before you call." section moved to its own page on 9 Nov 2026, rebuilt from
 * the /pricing FAQ (the fullest and most current set) plus the four homepage questions /pricing
 * never had. Both pages read `app/data/faq.ts`, so these check the promise that makes: /faq
 * carries every pricing answer, word for word, and the four extras, once each.
 *
 * On the code before this change every test here fails: there is no `app/data/faq.ts`, no
 * `app/faq/page.tsx`, and the footer links to neither /faq nor /terms.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { FAQ_GROUPS, PRICING_FAQS, LIVE_FAQ_ID } from "../app/data/faq.ts";
import { DEMO_TEL_DISPLAY } from "../app/data/demo-line.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));

const HOMEPAGE_EXTRAS = [
  "Will it sound like a robot?",
  "What if it can't answer something?",
  "Do I have to write the content?",
  "Will I show up on Google?",
];

test("/faq carries every /pricing answer and the four homepage questions, once each", () => {
  const onFaq = FAQ_GROUPS.flatMap((g) => g.entries);
  const questions = onFaq.map((e) => e.q);
  assert.equal(new Set(questions).size, questions.length, "a question appears twice on /faq");

  for (const entry of PRICING_FAQS) {
    // The same object, not a copy: an edit to the answer reaches both pages.
    assert.ok(onFaq.includes(entry), `/faq is missing the pricing answer "${entry.q}"`);
  }
  for (const q of HOMEPAGE_EXTRAS) {
    assert.ok(questions.includes(q), `/faq is missing "${q}"`);
  }
  assert.equal(onFaq.length, PRICING_FAQS.length + HOMEPAGE_EXTRAS.length);
});

test("the robot answer gives the demo number instead of pointing at the page", () => {
  const robot = FAQ_GROUPS.flatMap((g) => g.entries).find((e) => e.q === "Will it sound like a robot?");
  assert.match(String(robot.a), new RegExp(DEMO_TEL_DISPLAY.replace(/[()]/g, "\\$&")));
  assert.doesNotMatch(String(robot.a), /bottom of this page/);
});

test("the Growth card's carrier-approval tags still have an answer to land on", () => {
  assert.ok(PRICING_FAQS.some((e) => e.id === LIVE_FAQ_ID));
  const pricing = readFileSync(root("app/components/pricing/pricingpageclient.tsx"), "utf8");
  assert.match(pricing, /PRICING_FAQS\.map/, "/pricing no longer prints the shared answers");
});

test("/faq exists and is public, signed out", () => {
  assert.ok(existsSync(root("app/faq/page.tsx")), "app/faq/page.tsx is missing");
  const proxy = readFileSync(root("proxy.ts"), "utf8");
  const m = /isPortalRoute\s*=\s*createRouteMatcher\(\[([^\]]*)\]/.exec(proxy);
  assert.ok(m, "proxy.ts no longer declares isPortalRoute the way this test expects");
  const matchers = [...m[1].matchAll(/"([^"]+)"/g)].map(([, p]) => new RegExp(`^${p}$`));
  assert.equal(matchers.some((re) => re.test("/faq")), false, "/faq is behind Clerk");
});

test("the footer links to /faq and to /terms as the Service Agreement", () => {
  const footer = readFileSync(root("app/components/footer/footer.tsx"), "utf8");
  assert.match(footer, /href="\/faq"[^>]*>FAQ</);
  assert.match(footer, /href="\/terms"[^>]*>Service Agreement</);
});
