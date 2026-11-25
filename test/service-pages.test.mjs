/**
 * The four service pages and /orlando, as Xander approved them word for word from three rounds of
 * a mockup on 24 Nov 2026 (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM). A changed sentence
 * fails here and goes back to him first.
 *
 * Also held here, because each was a decision of his:
 *  - "local service businesses" is the audience in every h1 and title;
 *  - no line names one trade (the searches and the trades line name several, and say so);
 *  - the service pages name no state; /orlando may name Florida, and only it carries an area;
 *  - prices come from the plan list, and the receptionist is never priced at the website plan;
 *  - every page is a real route, in the sitemap, and in the menus that list it.
 *
 * Source-level, as there is no browser in this suite. Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { SERVICE_PAGES, ORLANDO_PAGE } from "../app/data/service-pages.ts";
import { HVAC_SEARCHES } from "../app/data/hvac-searches.ts";
import { TRADE_SEARCHES } from "../app/data/trade-searches.ts";
import { SCHEDULES, WEB_ONLY_SCHEDULE } from "../app/lib/legal/schedules.ts";
import { WEBSITE_PLAN, RECEPTIONIST_PLAN } from "../app/lib/service-prices.ts";
import * as seo from "../app/lib/site-seo.ts";
import sitemap from "../app/sitemap.ts";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), "utf8");

/** Source text with JSX escapes resolved and whitespace collapsed, so a sentence matches as written. */
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/\{" "\}/g, " ")
        .replace(/\s+/g, " ");

/** The source with its comments taken out, so a rule is checked against what the page shows. */
const copy = (src) => prose(src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " "));

function says(src, sentences, where) {
    const text = prose(src);
    for (const s of sentences) assert.ok(text.includes(s), `${where} no longer says: ${s}`);
}

const PAGES = {
    "/website-design": "app/website-design/page.tsx",
    "/website-hosting": "app/website-hosting/page.tsx",
    "/ai-receptionist": "app/ai-receptionist/page.tsx",
    "/crm": "app/crm/page.tsx",
    "/orlando": "app/orlando/page.tsx",
};
const design = read(PAGES["/website-design"]);
const hosting = read(PAGES["/website-hosting"]);
const receptionist = read(PAGES["/ai-receptionist"]);
const crm = read(PAGES["/crm"]);
const orlando = read(PAGES["/orlando"]);
const carry = read("app/components/services/CarryFrame.tsx");
const search = read("app/components/services/SearchResult.tsx");
const towns = read("app/components/services/TownPages.tsx");

test("every service page and /orlando is a real page, in the sitemap and in the menus", () => {
    const urls = sitemap().map((e) => e.url);
    for (const href of [...SERVICE_PAGES.map((s) => s.href), ORLANDO_PAGE.href]) {
        assert.ok(existsSync(root(PAGES[href])), `${href} has no page`);
        assert.ok(seo.PUBLIC_PATHS.includes(href), `${href} is missing from PUBLIC_PATHS`);
        assert.ok(urls.includes(`${seo.SITE_URL}${href}`), `${href} is missing from the sitemap`);
    }
    assert.deepEqual(
        SERVICE_PAGES.map((s) => [s.label, s.href, s.blurb]),
        [
            ["Website design", "/website-design", "Written, built and hosted for you"],
            ["Hosting + maintenance", "/website-hosting", "Kept fast, secure and up to date"],
            ["AI receptionist", "/ai-receptionist", "Answers the calls you miss, 24/7"],
            ["Portal + CRM", "/crm", "Every lead, worked to Won"],
        ],
    );
    // Never under /portal: proxy.ts puts every /portal address behind the sign-in.
    for (const s of SERVICE_PAGES) assert.doesNotMatch(s.href, /^\/portal/);
});

test("the nav has Services before Trades, and the footer a Services column and Orlando", () => {
    const nav = read("app/components/navbar/navbar.tsx");
    const footer = read("app/components/footer/footer.tsx");
    const services = nav.indexOf('<TradesMenu label="Services" items={SERVICE_PAGES}');
    assert.ok(services > -1, "the Services menu is gone from the bar");
    assert.ok(services < nav.indexOf("<TradesMenu />"), "Services should come before Trades");
    assert.match(nav, /SERVICE_PAGES\.map/, "the phone menu does not list the services");
    assert.match(footer, /SERVICE_PAGES\.map/, "the footer does not read the shared list");
    assert.match(footer, />Services</);
    assert.match(footer, /href=\{ORLANDO_PAGE\.href\}/, "Orlando is missing from the footer");
    assert.match(read("app/components/navbar/TradesMenu.tsx"), /item\.blurb && <small>\{item\.blurb\}<\/small>/);
});

test("titles and descriptions are the approved ones, with local service businesses", () => {
    assert.equal(seo.WEBSITE_DESIGN_TITLE, "Website Design for Local Service Businesses | JDD");
    assert.equal(seo.HOSTING_TITLE, "Hosting + Maintenance for Local Service Businesses | JDD");
    assert.equal(seo.AI_RECEPTIONIST_TITLE, "24/7 AI Receptionist for Local Service Businesses | JDD");
    assert.equal(seo.CRM_TITLE, "Lead Portal + CRM for Local Service Businesses | JDD");
    assert.equal(seo.ORLANDO_TITLE, "Orlando Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        seo.WEBSITE_DESIGN_DESCRIPTION,
        `We write, build and host a custom website for your local service business, with service pages, town pages and a search-ready build. From $${WEBSITE_PLAN.monthlyPrice} a month, no contract.`,
    );
    assert.equal(
        seo.HOSTING_DESCRIPTION,
        `Fast hosting, SSL, daily backups, uptime monitoring and two content edits a month, handled for you. Your domain stays in your name. From $${WEBSITE_PLAN.monthlyPrice} a month.`,
    );
    for (const [src, h1] of [
        [design, 'Website design for <span className="svc-em">local service businesses.</span>'],
        [hosting, 'Website hosting and maintenance for <span className="svc-em">local service businesses.</span>'],
        [receptionist, 'A 24/7 AI receptionist for <span className="svc-em">local service businesses.</span>'],
        [crm, 'A lead portal and CRM for <span className="svc-em">local service businesses.</span>'],
        [orlando, 'Website design and an AI receptionist <span className="svc-em">in Orlando.</span>'],
    ]) {
        assert.ok(prose(src).includes(h1), `h1 changed: ${h1}`);
        assert.equal((src.match(/<h1\b/g) ?? []).length, 1, "each page has exactly one h1");
    }
});

test("prices come from the plan list; the receptionist is never priced at the website plan", () => {
    assert.equal(RECEPTIONIST_PLAN, SCHEDULES.starter);
    assert.equal(WEBSITE_PLAN, SCHEDULES.website ?? WEB_ONLY_SCHEDULE);
    assert.equal(WEBSITE_PLAN.hasVoiceAgent, false, "the website price must be a plan without the receptionist");
    // "$0" (hosting's "Extra to pay") is not a price; any other dollar figure must come from the plan list.
    for (const src of [design, hosting, receptionist, crm, orlando]) {
        assert.doesNotMatch(copy(src), /\$[1-9]/, "a price is typed into a page instead of read from the plan list");
    }
    assert.match(receptionist, /RECEPTIONIST_PLAN\.monthlyPrice/);
    assert.doesNotMatch(receptionist, /WEBSITE_PLAN/);
});

test("/website-design says what was approved", () => {
    says(design, [
        "You answer a few questions. We write it, build it and host it. After that, there's nothing for you to do.",
        "From a few answers to a",
        "Most people are done in one sitting.",
        "The writing is what stalls everyone for six months, so we took it off your plate.",
        "Within 72 hours of sending your onboarding form back.",
        "Your site, your receptionist, your portal, and the texts we send you about new leads.",
        "Built from the details you give us, in your name, your colours, your services and your towns.",
        "Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that work on phones.",
        "What we won't do is promise you a ranking.",
        "We build you a new one and bring over the content worth keeping. You won't have to start from scratch.",
        "Websites start at ${WEBSITE_PLAN.monthlyPrice} a month. Month to month, no contract.",
    ], "/website-design");
    says(carry, [
        "Name and phone number, nothing else to fill in.",
        "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
        "We don't write reviews, and a section with nothing real in it stays off your site.",
        "A demo site, with sample details.",
    ], "what every site carries");
    assert.doesNotMatch(carry, /On Growth/, "point 01 is the website on its own here");
});

test("every search on /website-design is a sourced one, under a made-up business", () => {
    const sourced = new Set([
        ...HVAC_SEARCHES.map((s) => s.search),
        ...Object.values(TRADE_SEARCHES).flatMap((t) => t.searches.map((s) => s.search)),
    ]);
    const searches = [...search.matchAll(/search: "([^"]+)"/g)].map((m) => m[1]);
    assert.equal(searches.length, 6);
    for (const s of searches) assert.ok(sourced.has(s), `not a sourced search: ${s}`);
    for (const t of search.matchAll(/title: "([^"]+)"/g)) assert.match(t[1], /\| Your Business Co\.$/);
    says(search, ["A made-up business. Not a promise about where anyone ranks."], "the search result");
});

test("/website-hosting: the plan summary's lines, the portal's words, and the guarantee", () => {
    says(hosting, [
        "Once your site is live, we keep it running. Hosting, security, backups and your edits are on us.",
        "No separate hosting bill, no plugin updates, no renewals to remember. It's all on the one monthly bill.",
        "Hosting on enterprise-grade infrastructure (Vercel)",
        "Your domain, registered and renewed in your own Cloudflare account",
        "Ask for a change to your words or your colours, twice a month, and we make it. Bigger changes, like a new layout or an extra page, are quoted first.",
        "Shows up quickly.",
        "Reacts straight away.",
        "Nothing jumps around.",
        "There is no minimum term, no commitment period, and no cancellation fee on any plan. It's month to month.",
        "A 30-day money-back guarantee.*",
        "* Cancel within 30 days of your first payment and we refund the subscription fee you paid for that first month. The onboarding fee paid at sign-up isn't refunded: it covers the work of setting up your website.",
    ], "/website-hosting");
});

test("/ai-receptionist: the owner's phone rings first, and no line names one trade", () => {
    says(receptionist, [
        "The AI never answers before you do. A caller rings your real phone first, and only if nobody picks up does the AI step in. It is replacing your voicemail, not replacing you.",
        "Your phone rings first",
        "Pick up and it's your call, the same as always.",
        "No answer",
        "On another call, or asleep.",
        "Only then, the AI receptionist answers",
        "It never answers before you do. 24/7, in English or in Spanish.",
        "A price question",
        "Can you give me a rough idea what this would cost?",
        "A scheduling question",
        "I'm actually a virtual assistant. I work with the team to make sure your request gets to the right person fast.",
        "Says it's a virtual assistant, straight away, whenever it's asked.",
        "Call our demo line and decide for yourself. That's why it's there. We'd rather you hear it than take our word for it.",
        "Plans with the AI receptionist start at ${RECEPTIONIST_PLAN.monthlyPrice} a month, website included. Month to month, no contract.",
    ], "/ai-receptionist");
    // "On a roof" came out (Xander, 24 Nov 2026: nothing that names one trade).
    assert.doesNotMatch(copy(receptionist), /roof|lawn|HVAC|plumb|detailing|attic/i);
    // The phone's step must come before the receptionist's.
    const shown = copy(receptionist);
    assert.ok(shown.indexOf("Your phone rings first") < shown.indexOf("No answer"));
    assert.ok(shown.indexOf("No answer") < shown.indexOf("Only then, the AI receptionist answers"));
});

test("/crm: the inbox, the text to your phone, and /pricing's Growth lines", () => {
    says(crm, [
        "Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.",
        "The moment a new lead is added, a text goes to your phone saying it's there.",
        "With the AI receptionist, your portal becomes a pipeline you run from Lead to Won.",
        "A calendar for every job",
        "Book job visits, estimates and follow-up calls against each customer, in one month view.",
        "On Starter + AI and Growth",
        "Text customers back from your business number, right in your portal.",
        "Ask for a Google review in one tap when the job is done.",
        "Web form leads get a call back automatically, within about a minute.",
        "AI lead qualification, a searchable call log with recordings, and urgency and caller names pulled from every call.",
    ], "/crm");
    // The sample people are the portal tour's no-trade set, so no single trade shows.
    assert.match(crm, /TRADE_SAMPLES\.other/);
    says(read("app/components/services/LeadPhone.tsx"), ["Your phone"], "the phone");
});

test("/orlando: Florida in the intro and the data only; no in-person offer; three real town pages", () => {
    says(orlando, [
        "I'm Xander Juneau. I live in Winter Garden, Florida, and I work with the local trades in and around Orlando.",
        "A 407 number, answered by the person who builds your site.",
        "We build you a website that gets you found and noticed. Then we go a step further and replace your voicemail with a 24/7 receptionist. Every lead lands in one place.",
        "Listed on the site, with a page for a town when there's something real to say about it.",
    ], "/orlando");
    assert.doesNotMatch(copy(orlando), /in person|come to you/i, "Xander doesn't meet clients in person");
    for (const slug of ["winter-park", "maitland", "oviedo"]) assert.match(towns, new RegExp(`slug: "${slug}"`));
    assert.match(read("app/data/contact.ts"), /phoneDisplay: "\(407\)/, "the page says it's a 407 number");

    const data = JSON.stringify(seo.orlandoJsonLd());
    assert.match(data, /"areaServed":\{"@type":"City","name":"Orlando","containedInPlace":\{"@type":"State","name":"Florida"\}\}/);
});

test("the service pages name no state and carry no area", () => {
    for (const src of [design, hosting, receptionist, crm, carry, search]) {
        assert.doesNotMatch(copy(src), /Florida|Georgia|Alabama|\bFL\b|Orlando/);
    }
    for (const build of [seo.websiteDesignJsonLd, seo.hostingJsonLd, seo.aiReceptionistJsonLd, seo.crmJsonLd]) {
        assert.doesNotMatch(JSON.stringify(build()), /areaServed|Florida/);
    }
});
