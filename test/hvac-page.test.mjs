/**
 * /hvac — "A website and AI receptionist for HVAC companies."
 *
 * Xander approved every sentence of this page word for word on 19 Nov 2026, from the fourth
 * round of a mockup. These tests pin those sentences, so an edit that quietly rewords the page
 * fails here rather than going live. They also pin the things that keep it from being a doorway
 * page (the HVAC urgent list, the HVAC services, the real searches), the numbers it prints and
 * where they come from, and how the rest of the site links to it.
 *
 * On the code before this change every test here fails: there is no `app/hvac/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, HVAC_TITLE, HVAC_DESCRIPTION, hvacJsonLd } from "../app/lib/site-seo.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";
import { HVAC_SEARCHES, MARKETKEEP_SOURCE } from "../app/data/hvac-searches.ts";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "../app/data/missed-calls.ts";
import { DEMO_SITE_URL } from "../app/data/demo-site.ts";
import { TRADE_PAGES } from "../app/data/trade-pages.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const page = read("app/hvac/page.tsx");
const calculator = read("app/components/hvac/HvacCalculator.tsx");
const start = read("app/components/hvac/HvacStart.tsx");

/** Source text with JSX escapes resolved and whitespace collapsed, so a sentence matches as written. */
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&times;/g, "×")
        .replace(/\s+/g, " ");
const text = prose(page);

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero and the 'when it picks up' beats are the approved words", () => {
    says(
        text,
        [
            "For heating and cooling companies",
            'A website and AI receptionist for <span className="hvac-coral">HVAC companies.</span>',
            "We write, build and host your heating and cooling website. Then the calls you miss get answered.",
            "A caller rings your real phone first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what's wrong and how urgent it is, and the lead goes straight into your portal.",
            'When it <span className="hvac-coral">picks up.</span>',
            "You're in an attic.",
            "You're on another call.",
            "It's two in the morning.",
            "Picked up",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/hvac",
    );
    says(prose(start), ["Get started", "View plans + pricing", 'href="/pricing"'], "the hero asks");
});

test("the receptionist is named before the page calls it 'it'", () => {
    const named = text.indexOf("<Voice live /> The AI receptionist </p>");
    const it = text.indexOf("On an HVAC call, it knows what's");
    assert.ok(named > 0 && it > named, "the 'The AI receptionist' beat must come before the heading");
    says(
        text,
        [
            "Your AI receptionist is set up for heating and cooling before it takes a single call. It lets the caller explain, then asks one question at a time: what's wrong, how soon, and where.",
            "Example calls",
            "Caller asks",
            "Receptionist answers",
        ],
        "/hvac",
    );
});

test("the receptionist's lines are its real HVAC script's, word for word", () => {
    // These three replies are what the HVAC receptionist actually says (jdd-ops
    // clients/_e2e_test_*/agent-prompt.txt). Rewording them here would put words in its mouth.
    says(
        text,
        [
            "Okay, I hear you. The team treats this as a priority and they'll be in touch as fast as possible. Let me grab a few quick details.",
            "I don't have the schedule in front of me, but someone from the team will reach out shortly and get that locked in for you.",
            "I'm actually a virtual assistant. I work with the team to make sure your request gets to the right person fast.",
        ],
        "the example calls",
    );
    says(
        text,
        [
            "Our AC quit this afternoon and the house is getting hot. My mother's staying with us and she's elderly.",
            "Can you get someone out tonight?",
            "Wait, am I talking to a real person?",
        ],
        "the example calls",
    );
});

test("the HVAC urgent list is the script's, carbon monoxide included", () => {
    says(
        text,
        [
            'what: "No cooling or no heat", detail: "when the weather makes that dangerous"',
            'what: "A burning smell", detail: "coming from the system"',
            'what: "Sparking or smoke", detail: "or any electrical problem"',
            'what: "A heavy water leak", detail: "or a refrigerant or gas smell"',
            'what: "Someone vulnerable at home", detail: "a young child, an older adult, a medical condition"',
            'what: "Carbon monoxide", detail: "Always urgent"',
            "What it treats as urgent",
        ],
        "the urgent list",
    );
});

test("the inbox preview copies the real inbox row and its labels", () => {
    says(
        text,
        ["What lands in your portal", "Needs you", "Wants a callback", "Then you get a text saying it's there."],
        "the inbox preview",
    );
    // The labels must stay the portal's own, or the preview shows a screen that does not exist.
    const model = read("app/components/portal/inbox/model.ts");
    assert.match(model, /callback: "Wants a callback"/);
    assert.match(read("app/components/portal/inbox/InboxToolbar.tsx"), /needs: "Needs you"/);
});

test("never / instead: the receptionist's four hard rules and what it does in their place", () => {
    says(
        text,
        [
            'What it will <span className="hvac-coral">never do.</span>',
            "What it does instead.",
            'never: "Quote a price", instead: "Tells the caller the team goes over the cost before any work starts."',
            'never: "Book a time or promise an arrival"',
            "Takes their details and says someone from the team will call to schedule. That holds in an emergency too.",
            'never: "Say it\'s a person", instead: "Says it\'s a virtual assistant, straight away, whenever it\'s asked."',
            'never: "Guess about your business"',
            "Says the team will follow up with the right answer, and passes the question to you.",
        ],
        "never / instead",
    );
});

test("the website section shows the real HVAC demo and its six points", () => {
    says(
        text,
        [
            "You answer a few questions. We write it, build it and host it. This is the HVAC design. Yours carries your name, your colours, your services and your towns.",
            "Scroll it. A demo site, with sample details.",
            "Visit site",
            "Name and phone number, nothing else to fill in. On Growth, the receptionist calls them back within about a minute.",
            "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
            "Heating, cooling, maintenance plans, air quality, heat pumps, emergency calls. A service gets its own page when you've told us enough to fill one.",
            "Listed on the site, with a page for a town when there's something real to say about it.",
            // Xander, round 1: name the client's own job photos.
            "Photos from your real jobs and your business, your reviews, your certifications, the brands you install. We don't write reviews, and a section with nothing real in it stays off your site.",
            "Answered in your words, from what you tell us.",
            "Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that work on phones.",
        ],
        "the website section",
    );
    assert.equal(DEMO_SITE_URL, "https://e2etestgrowth.vercel.app");
    assert.match(read("app/components/home/homepageclient.tsx"), /import \{ DEMO_SITE_URL \} from "@\/app\/data\/demo-site"/);
});

test("the searches are the real ones, with their published monthly counts and source", () => {
    assert.deepEqual(HVAC_SEARCHES, [
        { search: "ac repairs near me", perMonth: "246,000" },
        { search: "why is my ac not blowing cold air", perMonth: null },
        { search: "hvac companies near me", perMonth: "110,000" },
        { search: "how long do ac units last", perMonth: null },
        { search: "air conditioner service near me", perMonth: "40,500" },
    ]);
    assert.equal(MARKETKEEP_SOURCE, "Searches a month: Marketkeep, HVAC keyword research, August 2026");
    says(
        text,
        [
            'What your customers are trying to <span className="hvac-coral">find out.</span>',
            "A homeowner with a dead system isn't browsing. They have a short list of questions, and they call the company that answers them.",
            "What they're searching for",
            "Your site is built to be found for searches like these.",
            "Your services and your towns get their own pages, and your customers' questions get straight answers, all written from what you tell us.",
            "What they're asking on calls",
            'const ASKED = ["Can someone come today?", "Do you work in my town?", "Do you have a maintenance plan?"]',
            "Your receptionist is built to answer the questions you'd normally answer yourself.",
            "Then it takes their details and leaves the money and the job to you.",
        ],
        "the questions section",
    );
});

test("the calculator is the homepage's sum, with the homepage's rates", () => {
    // The homepage keeps its own copy inside its component. If one moves, both must.
    const home = read("app/components/home/homepageclient.tsx");
    assert.equal(Number(home.match(/const LEAD_RATE = ([\d.]+)/)[1]), LEAD_RATE);
    assert.equal(Number(home.match(/const CLOSE_RATE = ([\d.]+)/)[1]), CLOSE_RATE);
    assert.equal(Number(home.match(/const AI_RECOVERY_RATE = ([\d.]+)/)[1]), AI_RECOVERY_RATE);
    // 10 calls a week at an $800 job, the starting values on both pages.
    assert.equal(formatDollars(lostPerYear(10, 800)), "$70.8K");
    assert.equal(formatDollars(lostPerYear(10, 800) * AI_RECOVERY_RATE), "$35.4K");
    says(
        prose(calculator),
        [
            "Calls you miss a week",
            "Weeks",
            "Are new-business leads",
            "Of leads convert on the call",
            "Your average job",
            "Type your own two numbers over the coral ones",
            "Calculate",
            "Lost to missed calls, a year",
            "Won back with a receptionist",
            'useState("10")',
            'useState("800")',
        ],
        "the calculator",
    );
    says(
        text,
        [
            'The call you miss <span className="hvac-coral">calls someone else.</span>',
            "Most people who call a business and reach a recording just hang up and call the next name on the list. For a home service business, that call is often a job.",
            'Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. "Won back" is our own estimate: half.',
        ],
        "the missed-calls section",
    );
});

test("the close is the same two asks every page ends on, at Schedule A's price", () => {
    says(
        text,
        [
            'Hear it take <span className="hvac-coral">a call.</span>',
            "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.",
            '<PageAsk className="hvac-ask" />',
        ],
        "the close",
    );
    assert.equal(SCHEDULES.starter.monthlyPrice, 197);
});

test("nothing on the page names a region the agency does not work in", () => {
    for (const place of ["Maine", "Utah", "California"]) {
        assert.ok(!page.includes(place), `/hvac names ${place}`);
    }
});

test("the page has its approved title and description, a sitemap entry and links in", () => {
    assert.equal(HVAC_TITLE, "HVAC Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        HVAC_DESCRIPTION,
        "We write, build and host your HVAC website, and an AI receptionist answers the heating and cooling calls you miss, 24/7. From $197 a month, no contract.",
    );
    assert.match(page, /pageMetadata\("\/hvac", HVAC_TITLE, HVAC_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/hvac"), "/hvac is not a public path");
    assert.ok(sitemap().some((e) => e.url === `${SITE_URL}/hvac`), "/hvac is missing from the sitemap");
    // The footer and the nav's Trades menu both render `TRADE_PAGES`, so being in that list is
    // what puts /hvac in both. It used to be written into the footer's own markup.
    assert.ok(
        TRADE_PAGES.some((t) => t.href === "/hvac"),
        "/hvac is not in TRADE_PAGES, so neither the footer nor the nav links to it",
    );
    // The homepage's trade line links HVAC without changing its approved words.
    const home = prose(read("app/components/home/homepageclient.tsx"));
    assert.ok(
        home.includes(
            'Built for <Link href="/hvac" className="home-trade-link">HVAC</Link>, plumbing, roofing, lawn care, pressure washing and detailing businesses.',
        ),
        "the homepage trade line changed",
    );
});

test("the structured data says only what the page says", () => {
    const graph = hvacJsonLd()["@graph"];
    const service = graph.find((n) => n["@type"] === "Service");
    assert.equal(service.url, `${SITE_URL}/hvac`);
    assert.equal(service.audience.name, "HVAC companies");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.provider["@id"], `${SITE_URL}/#organization`);
    // No region: the page names none, and naming one is Xander's undecided call (C7).
    assert.equal(service.areaServed, undefined);
    const webPage = graph.find((n) => n["@type"] === "WebPage");
    assert.equal(webPage.name, HVAC_TITLE);
    assert.equal(webPage.description, HVAC_DESCRIPTION);
});
