/**
 * /roofing — "Websites and an AI receptionist for roofers."
 *
 * Xander approved every sentence on 25 Nov 2026, over two rounds of a mockup, with the instruction
 * that the build match that mockup exactly, desktop and phone. These tests pin the sentences, the
 * things that keep this from being one of the other five trade pages with the trade swapped (its own
 * devices, its own triage question, its own searches), and the facts the page must not invent.
 *
 * On the code before this change every test here fails: there is no `app/roofing/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, ROOFING_TITLE, ROOFING_DESCRIPTION, roofingJsonLd } from "../app/lib/site-seo.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";
import { TRADE_PAGES } from "../app/data/trade-pages.ts";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear } from "../app/data/missed-calls.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&middot;/g, "·")
        .replace(/&times;/g, "×")
        .replace(/&hellip;/g, "…")
        .replace(/\s+/g, " ");

/** The code without its comments: what the page actually ships, for "must not say" checks. */
const code = (p) => prose(read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " "));

const page = prose(read("app/roofing/page.tsx"));
const roof = prose(read("app/components/roofing/RfRoof.tsx"));
const roofs = prose(read("app/components/roofing/RfRoofs.tsx"));
const phone = prose(read("app/components/roofing/RfPhone.tsx"));
const css = read("app/globals.css");

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero is the approved words, and the roof is shingled while the call is answered", () => {
    says(
        page,
        [
            "For roofing companies",
            'Websites and an AI receptionist for <span className="rf-coral">roofers.</span>',
            "We write, build and host your roofing website. Then every call you can't take gets answered.",
            "Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what's wrong with the roof, whether water's coming in and where, and puts the lead straight into your portal.",
            "While you're up <span className=\"rf-coral\">on the roof.</span>",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/roofing",
    );
    says(roof, ["Incoming call", "Not yet", "Ringing…", "Answered by your receptionist"], "the hero roof");
    // The nail gun is carried down the ladder and set down at its foot, not faded.
    assert.match(roof, /const REST = \{ x: 352, y: 286, rot: -6 \}/);
    assert.match(roof, /between\(END, REST, k\)/);
    assert.match(roof, /prefers-reduced-motion/);
    // A timer, not animation frames, so the loop keeps going in a background tab.
    assert.doesNotMatch(roof, /requestAnimationFrame/);
    assert.match(page, /<Link href="\/contact" className="btn primary lg">/);
});

test("on a roofing call it checks for water first, and the call forks", () => {
    says(
        page,
        [
            "On a roofing call, it checks <span className=\"rf-coral\">for water first.</span>",
            "Your AI receptionist is set up for your roofing business before it takes a single call. It lets the caller explain, then asks the question that matters most after a storm: is water coming in right now?",
            "\"We have water coming through the bedroom ceiling since the storm last night.\"",
            "\"Sorry to hear that. Is water still coming in right now?\"",
            "Yes · water coming in",
            "\"A little. We've got a bucket under it.\"",
            "\"Understood. I've marked this urgent so the team sees it first.\"",
            "Top of your inbox, flagged for a callback",
            "No · it can wait",
            "Quotes, inspections and replacements.",
            "\"Someone from the team will call you back with a quote.\"",
            "In your inbox for the team",
            "Call ended · 0:52",
        ],
        "the call",
    );
    // Approved: the receptionist marks it urgent, it never promises when the callback comes.
    assert.doesNotMatch(code("app/roofing/page.tsx"), /first thing this morning|within the hour|right away/i);
});

test("the lead lands in the portal inbox, and the phone text follows", () => {
    says(
        page,
        [
            "The call ends. The lead lands <span className=\"rf-coral\">in your portal.</span>",
            "This is that call, in your portal inbox, and the text you get.",
            "Dave Kowalski",
            "Water coming through the bedroom ceiling since last night's storm. Still leaking a little, with a bucket under it.",
            "Jim Petrakis",
            "Wind took a few shingles off the back slope. Any day but Friday works.",
            "Example lead. Example text.",
        ],
        "where the lead lands",
    );
    says(phone, ["Your phone", "6:48", "New call lead in your portal", "Name: Dave Kowalski", "buzz"], "the phone");
    assert.doesNotMatch(page, /Kanban|\bboard\b/i, "the trade pages show the inbox, not the board");
});

test("what the receptionist never nails down, on shingle tabs", () => {
    says(
        page,
        [
            "Three things it never <span className=\"rf-coral\">nails down.</span>",
            "It never quotes. It tells the caller the team will call back with one.",
            "It never books a time or promises a day. It takes their details, flags the urgent ones, and says someone from the team will call to schedule.",
            "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
            "And whenever it's asked, it says it's a virtual assistant.",
        ],
        "what it never nails down",
    );
    assert.doesNotMatch(code("app/roofing/page.tsx"), /no hot water|furnace|water heater|dispatch/i);
});

test("the website section shows the real example site, as three phone screens", () => {
    says(
        page,
        [
            "What's on your <span className=\"rf-coral\">roofing website.</span>",
            "You answer a few questions. We write it, build it and host it. Yours carries your name, your colours, your photos, your services and your towns.",
            "Your number, then a form",
            "A page for each service",
            "Roof repair, replacement, storm and leak repair, inspections and gutters. A service gets its own page when you've told us enough to fill one.",
            "Your customers' questions",
            "Your Roofing Co. is an example business, not a client.",
            "Under all of it: titles, a sitemap, structured data, fast pages.",
        ],
        "the website section",
    );
    for (const n of [1, 2, 3]) {
        assert.ok(existsSync(fileURLToPath(new URL(`../public/roofing-site-${n}.webp`, import.meta.url))), `missing screen ${n}`);
        assert.ok(page.includes(`/roofing-site-${n}.webp`), `the page does not use screen ${n}`);
    }
});

test("the searches lead with the phrase, each with its sourced count in shingles", () => {
    says(
        page,
        [
            "What your customers are trying to <span className=\"rf-coral\">find out.</span>",
            "After a storm, everyone calls a roofer at once. They search, they call, and they hire whoever answers.",
            '{ q: "roof company near me", n: 165000 }',
            '{ q: "roof repair near me", n: 90500 }',
            '{ q: "roof inspection", n: 40500 }',
            '{ q: "roof leak repair", n: 33100 }',
            "const PER_SHINGLE = 10000;",
            "searches a month",
            "One shingle for every 10,000 searches a month. Marketkeep, SEO keywords for roofing companies, August 2026",
            "Is that a repair, or a whole new roof?",
            "Do you work with insurance claims?",
            "Can someone look at it before the next storm?",
            "Your site is built to be found for searches like these.",
            "Your receptionist answers the questions you'd normally answer yourself.",
        ],
        "the searches and questions",
    );
    // Most-searched first.
    const order = ["roof company near me", "roof repair near me", "roof inspection", "roof leak repair"].map((q) => page.indexOf(q));
    assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("a missed call is counted as one job, and both roofs shingle up to the sourced sum", () => {
    says(
        page,
        [
            "A missed call is a roof <span className=\"rf-coral\">someone else gets.</span>",
            "Most people who call a business and reach a recording just hang up and call the next name on the list.",
            "Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. \"Won back\" is our own estimate: half.",
        ],
        "the sum",
    );
    says(
        roofs,
        [
            "Calls you miss a week",
            "Your average job",
            "× 52 weeks × 37% are new-business leads × 46% convert on the call",
            "Lost to missed calls, a year",
            "Won back with a receptionist",
            "Topped out: over $150K",
            "A full roof is $150K a year: six courses of $25K. Past that it's topped out, and the figures stay exact.",
        ],
        "the roofs",
    );
    assert.match(roofs, /AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear/);
    assert.match(roofs, /const MAX = 150000;/);
    assert.match(roofs, /const VN = 6;/);
    assert.equal(LEAD_RATE, 0.37);
    assert.equal(CLOSE_RATE, 0.46);
    assert.equal(AI_RECOVERY_RATE, 0.5);
    // 10 missed calls a week, $450 a job: the page's own starting numbers (the sample leak repair).
    assert.match(roofs, /useState\("10"\)/);
    assert.match(roofs, /useState\("450"\)/);
    const lost = lostPerYear(10, 450);
    assert.equal(Math.round(lost), 39827);
    assert.equal(Math.round(lost * AI_RECOVERY_RATE), 19913);
});

test("the page has its approved title, description, sitemap entry and Trades listing", () => {
    assert.equal(ROOFING_TITLE, "Roofing Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        ROOFING_DESCRIPTION,
        `We write, build and host your roofing website, and an AI receptionist answers the calls you miss, 24/7, from storm leaks to full replacements. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`,
    );
    assert.match(page, /pageMetadata\("\/roofing", ROOFING_TITLE, ROOFING_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/roofing"));
    assert.equal(sitemap().filter((e) => e.url === `${SITE_URL}/roofing`).length, 1);
    // Under Pressure Washing, last in the Trades menu and the footer.
    assert.deepEqual(TRADE_PAGES.at(-1), { label: "Roofing", href: "/roofing" });
    assert.equal(TRADE_PAGES.at(-2).href, "/pressure-washing");
    assert.match(read("app/components/home/homepageclient.tsx"), /<Link href="\/roofing" className="home-trade-link">roofing<\/Link>/);
    assert.match(page, /<PageAsk className="rf-ask" \/>/);
    says(page, ["Call it. <span className=\"rf-coral\">See who picks up.</span>", "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract."], "the close");
});

test("the structured data says only what the page says", () => {
    const [webpage, service] = roofingJsonLd()["@graph"];
    assert.equal(webpage.url, `${SITE_URL}/roofing`);
    assert.equal(webpage.name, ROOFING_TITLE);
    assert.equal(service.audience.name, "Roofing companies");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.description, ROOFING_DESCRIPTION);
    assert.ok(!("areaServed" in service), "a trade page must not claim an area served");
});

test("the page is its own design, not one of the other trade pages with the trade swapped", () => {
    const shipped = code("app/roofing/page.tsx");
    assert.doesNotMatch(shipped, /lawn-|plumb-|hvac|detail-|pw-/i);
    for (const borrowed of ["While your hands", "While the mower", "While the water", "whole season", "mid-detail", "down the drain", "nozzle"]) {
        assert.ok(!shipped.toLowerCase().includes(borrowed.toLowerCase()), `/roofing borrowed: ${borrowed}`);
    }
    // Its own devices: a roof shingled in the hero, the call as a triage fork, shingle tabs, phone
    // screens, search phrases with shingle counts, plates on a ladder, the sum as two roofs.
    for (const own of ["rf-job", "rf-triage", "rf-course", "rf-phones", "rf-srows", "rf-ladder", "rf-vroofs"]) {
        assert.ok(css.includes(`.${own}`), `the stylesheet lost ${own}`);
    }
    // No invented claims from the roofing template: no certifications, warranties or review stars.
    assert.doesNotMatch(shipped + roofs, /GAF|warranty|certified|★|\d\.\d stars/i);
    // No region is named in the page's own copy: that is settled site-wide, and never Maine, Utah or
    // California. (The example-site screenshots are image files, not the page's text.)
    assert.doesNotMatch(page + roof + roofs + phone, /Florida|Georgia|Alabama|Orlando|Maine|Utah|California/);
});
