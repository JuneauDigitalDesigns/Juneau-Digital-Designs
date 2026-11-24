/**
 * /pricing for the four-plan lineup (24 Nov 2026): Starter ($97, website only), Starter + AI
 * Receptionist (today's Starter), Growth and Enterprise.
 *
 * The promises these check are the ones a wrong edit would break quietly:
 *  - the website-only Starter never claims the phone (no receptionist, calls, minutes or texts);
 *  - "On every plan" says only what every plan gets, Starter included;
 *  - no price is typed into the page or the FAQ: every figure reads the plan summary, so these
 *    pass before and after the plan-price change moves Starter to $297 and adds the $97 plan;
 *  - the new-lead text line shows only under the v2 owner-text campaign;
 *  - the FAQ answers the new lineup changed say what was approved.
 *
 * On the code before this change every test here fails: there is no `app/data/every-plan.ts`
 * or `app/data/website-plan.ts`, the website-only answer talks the asker out of it, and the
 * card list has no website plan.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { PRICING_FAQS, LIVE_FAQ_ID } from "../app/data/faq.ts";
import { EVERY_PLAN } from "../app/data/every-plan.ts";
import { WEBSITE_PLAN } from "../app/data/website-plan.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const pricing = readFileSync(root("app/components/pricing/pricingpageclient.tsx"), "utf8");
const page = readFileSync(root("app/pricing/page.tsx"), "utf8");
const dollars = (n) => `$${n.toLocaleString("en-US")}`;
const answer = (q) => {
  const entry = PRICING_FAQS.find((e) => e.q === q);
  assert.ok(entry, `/pricing has no answer to "${q}"`);
  return Array.isArray(entry.a) ? entry.a : [entry.a];
};

/** The website Starter's card, from its key to the next card's. */
function websiteCard() {
  const start = pricing.indexOf('key: "website"');
  const end = pricing.indexOf('key: "starter"', start);
  assert.ok(start > 0 && end > start, "the card list no longer has a website card before the receptionist one");
  return pricing.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, "");
}

test("the website-only Starter card claims nothing about the phone", () => {
  const card = websiteCard();
  assert.match(card, /name: "Starter"/);
  assert.match(card, /tierLine: "Starter catches every web lead\."/);
  assert.match(card, /schedule: WEBSITE_PLAN/);
  assert.doesNotMatch(card, /receptionist|minutes?\b|calls?\b|text (?:the|after|alert)|24\/7/i);
  assert.match(card, /Website only\. We leave your phone alone\./);
});

test("the website Starter's button stays inactive until it has a sign-up flow", () => {
  const card = websiteCard();
  assert.match(card, /checkout: null/);
  assert.match(card, /cta: "Coming soon"/);
  assert.match(pricing, /pricing-cta-off" disabled/);
});

test("today's Starter is renamed and keeps its checkout", () => {
  assert.match(pricing, /name: "Starter \+ AI Receptionist"/);
  assert.match(pricing, /schedule: starter,[\s\S]*?checkout: "starter"/);
  assert.match(pricing, /leadIn: "Everything in Starter \+ AI Receptionist, plus"/);
});

test("no price is typed into the page: every figure reads the plan summary", () => {
  const code = pricing.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\$\s?\d/, "a dollar figure is typed into pricingpageclient.tsx");
  assert.doesNotMatch(code, /\b(?:100|350|1,?050) AI minutes/, "a minutes figure is typed into pricingpageclient.tsx");
});

test("the text line follows the owner-text campaign: new-lead texts only under v2", () => {
  assert.match(
    pricing,
    /leadTextsLive\s*\?\s*"A summary of every call, and a text the moment a new lead arrives"\s*:\s*"A summary of every call, and a text after every call"/,
  );
  assert.match(page, /leadTextsLive=\{ownerLeadAlertsEnabled\(\)\}/);
});

test("'On every plan' says only what every plan gets, Starter included", () => {
  assert.deepEqual(EVERY_PLAN.map((p) => p.title), ["A custom 4+ page site", "Hosted and looked after", "Month to month"]);
  for (const p of EVERY_PLAN) {
    assert.doesNotMatch(`${p.title} ${p.detail}`, /receptionist|calls?\b|text|minutes/i, `"${p.title}" is not true of Starter`);
  }
  assert.match(pricing, /EVERY_PLAN\.map/);
});

test("the website-only answer names Starter, with both prices from the plan summary and kept apart", () => {
  const [a] = answer("Can I get the website without the AI receptionist?");
  assert.ok(a.includes(`for ${dollars(WEBSITE_PLAN.monthlyPrice)} a month and leave your phone alone`));
  assert.ok(a.includes(`Starter + AI Receptionist is ${dollars(SCHEDULES.starter.monthlyPrice)} a month`));
  assert.doesNotMatch(a, /—/, "house style: no em dashes in client copy");
  // D11: the receptionist never sits next to the website price.
  const withWebsitePrice = a.split(/(?<=\.)\s+/).find((s) => s.includes(dollars(WEBSITE_PLAN.monthlyPrice)));
  assert.doesNotMatch(withWebsitePrice, /receptionist/i);
});

test("the minutes answer and the live-time answer fit the four plans", () => {
  assert.match(answer("What happens if I go over my minutes?")[0], /On Starter \+ AI Receptionist especially/);
  const [first] = answer("How fast can I be live?");
  assert.equal(first, "You'll have a preview site within 72 hours of sending your onboarding form back, and you're fully live within a week.");
  assert.ok(PRICING_FAQS.some((e) => e.id === LIVE_FAQ_ID), "the carrier tags have nothing to open");
});

test("the 30-day refund reaches the 'not happy' answer", () => {
  assert.match(answer("What if I'm not happy with the site?")[0], /If you cancel within your first 30 days, we refund that first month's fee \(the onboarding fee isn't refunded\)\./);
});

test("the FAQ is an accordion whose answers stay in the HTML", () => {
  assert.match(pricing, /aria-expanded=\{open\}/);
  assert.match(pricing, /hidden=\{!open\}/, "answers must be hidden, not unmounted, so search engines still read them");
});
