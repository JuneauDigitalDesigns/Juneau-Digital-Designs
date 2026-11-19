/**
 * The agency site's search basics: sitemap, robots, page metadata and structured data.
 *
 * Before 19 Nov 2026 none of these existed: /sitemap.xml was a 404, robots.txt had no rules, the
 * homepage inherited "Innovative Web Design and UI/UX Solutions", and no page had a canonical
 * address, link preview or schema.org data. On the code before this change every test here fails
 * because `app/sitemap.ts`, `app/robots.ts` and `app/lib/site-seo.ts` do not exist.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import robots from "../app/robots.ts";
import {
    SITE_URL,
    HOME_TITLE,
    HOME_DESCRIPTION,
    PRICING_DESCRIPTION,
    pageMetadata,
    plansJsonLd,
    faqJsonLd,
    organizationJsonLd,
    jsonLdString,
} from "../app/lib/site-seo.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";
import { FAQ_GROUPS } from "../app/data/faq.ts";
import { CONTACT } from "../app/data/contact.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");

test("the sitemap lists every public page at the www address and nothing private", () => {
    const urls = sitemap().map((e) => e.url);
    for (const path of ["/", "/about", "/pricing", "/faq", "/activation", "/terms", "/privacy-policy", "/sms-terms"]) {
        assert.ok(urls.includes(path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`), `sitemap is missing ${path}`);
    }
    for (const url of urls) {
        assert.ok(url.startsWith("https://www.juneaudigitaldesigns.com/"), `${url} is not on the www host`);
        assert.doesNotMatch(url, /\/(portal|api|start|pay|checkout)(\/|$)|\/terms\/./, `${url} is private`);
    }
});

test("robots.txt lets crawlers in, keeps them off the API, and points at the sitemap", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.equal(rule.userAgent, "*");
    assert.equal(rule.allow, "/");
    assert.deepEqual(rule.disallow, ["/api/"]);
    assert.equal(r.sitemap, "https://www.juneaudigitaldesigns.com/sitemap.xml");
});

test("the homepage title and description are the approved wording, and the old default is gone", () => {
    assert.equal(HOME_TITLE, "Website + 24/7 AI Receptionist for Service Businesses | JDD");
    assert.equal(
        HOME_DESCRIPTION,
        "We write, build and host your website, and an AI receptionist answers the calls you miss, 24/7. Every lead lands in one inbox. Month to month.",
    );
    assert.doesNotMatch(read("app/layout.tsx"), /description: "Innovative Web Design/);
    assert.match(read("app/page.tsx"), /pageMetadata\("\/", HOME_TITLE, HOME_DESCRIPTION\)/);
});

test("each public page gets a canonical address and a link preview that repeat its own title", () => {
    const m = pageMetadata("/faq", "FAQ | Juneau Digital Designs", "Answers.");
    assert.equal(m.alternates.canonical, "/faq");
    assert.equal(m.openGraph.url, "/faq");
    assert.equal(m.openGraph.title, "FAQ | Juneau Digital Designs");
    assert.equal(m.openGraph.description, "Answers.");
    assert.equal(m.twitter.title, "FAQ | Juneau Digital Designs");
    for (const [file, path] of [
        ["app/about/page.tsx", "/about"],
        ["app/pricing/page.tsx", "/pricing"],
        ["app/faq/page.tsx", "/faq"],
        ["app/activation/page.tsx", "/activation"],
        ["app/terms/page.tsx", "/terms"],
        ["app/privacy-policy/page.tsx", "/privacy-policy"],
        ["app/sms-terms/page.tsx", "/sms-terms"],
    ]) {
        assert.match(read(file), new RegExp(`pageMetadata\\(\\s*"${path}"`), `${file} does not use pageMetadata("${path}")`);
    }
    assert.match(read("app/layout.tsx"), /metadataBase: new URL\(SITE_URL\)/);
});

test("the pricing description is the approved wording", () => {
    assert.equal(
        PRICING_DESCRIPTION,
        "Monthly pricing for a small business website, a 24/7 AI receptionist that works as your answering service, and a portal where every lead lands. Month to month, no contract.",
    );
});

test("the portal, sign-in included, is kept out of search results", () => {
    assert.match(read("app/portal/layout.tsx"), /robots: \{ index: false, follow: false \}/);
});

test("the plan offers carry Schedule A's names and prices", () => {
    const offers = plansJsonLd().offers;
    assert.deepEqual(
        offers.map((o) => [o.name, o.price]),
        ["starter", "growth", "enterprise"].map((s) => [SCHEDULES[s].name, SCHEDULES[s].monthlyPrice]),
    );
});

test("the organization data uses the footer's phone and email", () => {
    const org = organizationJsonLd()["@graph"][0];
    assert.equal(org.email, CONTACT.email);
    assert.equal(org.telephone, "+14079847493");
});

test("FAQ markup carries every question /faq prints, the new answering-service one included", () => {
    const entries = FAQ_GROUPS.flatMap((g) => g.entries);
    const ld = faqJsonLd(entries);
    assert.equal(ld.mainEntity.length, entries.length);
    const q = ld.mainEntity.find((e) => e.name === "Is this an answering service?");
    assert.ok(q, "the answering-service question is missing");
    assert.equal(
        q.acceptedAnswer.text,
        "Yes, an AI one that only picks up when you don't. It answers 24/7 in English or Spanish, takes the caller's name, number and what the job is, puts the lead in your portal and texts you that it's there. Minutes come with your plan: 100 on Starter, 350 on Growth. Extra minutes are $0.20 each.",
    );
});

test("JSON-LD cannot close its own script tag", () => {
    assert.doesNotMatch(jsonLdString({ a: "</script><script>alert(1)</script>" }), /<\/script/i);
});

test("the homepage names the trades under the hero", () => {
    assert.match(
        read("app/components/home/homepageclient.tsx"),
        /Built for HVAC, plumbing, roofing, lawn care, pressure washing and detailing businesses\./,
    );
});
