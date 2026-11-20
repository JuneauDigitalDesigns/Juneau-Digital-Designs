/**
 * /plumbing — "Websites and an AI receptionist for plumbers."
 *
 * Xander approved every sentence on 19 Nov 2026, from the third round of a mockup, with the
 * instruction that the build match that mockup exactly. These tests pin the sentences, the things
 * that keep this from being /hvac with the trade swapped (its own devices, its own urgent list,
 * its own searches), and the facts the page must not invent.
 *
 * On the code before this change every test here fails: there is no `app/plumbing/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, PLUMBING_TITLE, PLUMBING_DESCRIPTION, plumbingJsonLd } from "../app/lib/site-seo.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";
import { TRADE_PAGES } from "../app/data/trade-pages.ts";
import { PLUMBING_SEARCHES, PLUMBING_SEARCH_SOURCE } from "../app/data/plumbing-searches.ts";
import { TRADE_SEARCHES } from "../app/data/trade-searches.ts";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "../app/data/missed-calls.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&middot;/g, "·")
        .replace(/\s+/g, " ");

const page = prose(read("app/plumbing/page.tsx"));
const workOrder = prose(read("app/components/plumbing/PlumbingWorkOrder.tsx"));

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero is the approved words, and the phone shows three calls answered", () => {
    says(
        page,
        [
            "For plumbing companies",
            'Websites and an AI receptionist for <span className="plumb-coral">plumbers.</span>',
            "We write, build and host your plumbing website. Then every call you can't take gets answered.",
            "Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what's leaking, how bad it is and where, and puts the lead straight into your portal.",
            'While your hands <span className="plumb-coral">are full.</span>',
            "Under a sink",
            "On a job across town",
            "Sunday night",
            "Ringing&hellip;",
            "Answered by your receptionist",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/plumbing",
    );
    // Every Get started on the site goes to /contact, and nothing here opens the drawer.
    assert.match(read("app/plumbing/page.tsx"), /<Link href="\/contact" className="btn primary lg">/);
    assert.doesNotMatch(read("app/plumbing/page.tsx"), /LeadPanel/, "the page must not depend on the slide-over");
});

test("the receptionist is named before the page calls it 'it'", () => {
    const named = page.indexOf("The AI receptionist");
    const heading = page.indexOf("On a plumbing call, it hears the");
    assert.ok(named > 0 && heading > named, "the 'The AI receptionist' beat must come before the heading");
    says(
        page,
        [
            'On a plumbing call, it hears the <span className="plumb-coral">emergency.</span>',
            "Your AI receptionist is set up for your plumbing business before it takes a single call. It lets the caller explain, then asks one question at a time: what's wrong, how soon, and where.",
            "Example call · in progress",
        ],
        "/plumbing",
    );
});

test("the example call is the standard script's answers, in Xander's wording", () => {
    says(
        page,
        [
            "I can't transfer directly from here, but if I grab your details right now, someone from the team will get back to you as fast as possible.",
            "We're not able to discuss pricing until we know exactly what the job entails. Usually we'll come out and make an estimate while on site.",
            "Yes, we will be able to get out to you, and when a team member calls back, they'll confirm the details with you.",
        ],
        "the receptionist's answers",
    );
    says(
        page,
        [
            "Water's coming through the kitchen ceiling. Can I talk to a plumber right now?",
            "Roughly what does it cost to fix a burst pipe?",
            "We're out past the county line. Do you come out this far?",
        ],
        "the caller's lines",
    );
    // The call visibly ends before the page says where the lead lands (his round-2 note).
    const ended = page.indexOf("Call ended · 1:52");
    const lands = page.indexOf("The call ends. The lead lands");
    assert.ok(ended > 0 && lands > ended, "the call must end before the hand-off heading");
    says(
        page,
        ["And you get a text saying it's there. This is that call, in the portal on your phone.", "Wants a callback"],
        "the hand-off",
    );
});

test("the urgent list is the plumbing design's own emergencies", () => {
    says(
        page,
        [
            'What it treats as <span className="plumb-coral">urgent.</span>',
            "Set at setup from your trade and your services. For a plumber, it starts from these.",
            'what: "Burst pipes", aside: "Water where it shouldn\'t be"',
            'what: "Sewer backups", aside: "Coming up, not going down"',
            'what: "Flooding", aside: "On the floor, through the ceiling"',
            'what: "No hot water", aside: "The heater\'s out"',
        ],
        "the urgent list",
    );
    // Not HVAC's list: carbon monoxide and refrigerant belong to that trade, not this one.
    for (const wrong of ["Carbon monoxide", "refrigerant", "No cooling"]) {
        assert.ok(!page.includes(wrong), `/plumbing carries HVAC's urgent item: ${wrong}`);
    }
});

test("it won't / instead: the four rules, with the approved heading", () => {
    says(
        page,
        [
            'Four things it won\'t do, <span className="plumb-coral">and what it does instead.</span>',
            "It won&apos;t".replace("&apos;", "'"),
            "Instead",
            'never: "Quote a price", instead: "Tells the caller the team goes over the cost before any work starts."',
            'never: "Book a time or promise an arrival"',
            "Takes their details and says someone from the team will call to schedule. That holds in an emergency too.",
            'never: "Say it\'s a person", instead: "Says it\'s a virtual assistant, straight away, whenever it\'s asked."',
            "Says the team will follow up with the right answer, and passes the question to you.",
        ],
        "the rules grid",
    );
});

test("the website section has six points, each with its own picture", () => {
    says(
        page,
        [
            'What&apos;s on your <span className="plumb-coral">plumbing website.</span>'.replace("&apos;", "'"),
            "This is the plumbing design, top to bottom. Yours carries your name, your colours, your photos, your services and your towns.",
            "A callback form up top",
            "Six services, from leaks to remodels",
            "Your towns, one by one",
            "Proof that's yours",
            "Your customers' questions",
            "A second form at the bottom",
            "The plumbing design, with a sample business and sample details.",
        ],
        "the website section",
    );
    // Xander's round-3 note: a point with no section of its own has no picture, so it is gone.
    for (const dropped of ["What you promise, said plainly", "Photos from your own jobs"]) {
        assert.ok(!page.includes(dropped), `a point with no picture came back: ${dropped}`);
    }
    const css = read("app/globals.css");
    for (let i = 1; i <= 6; i++) {
        assert.ok(
            css.includes(`.plumb-slice:nth-child(${i}) .plumb-shot`),
            `slice ${i} has no crop of the design`,
        );
    }
    assert.match(css, /background-image: url\("\/plumbing-site\.webp"\)/);
});

test("the searches are real and sourced, and are not the homepage's list", () => {
    assert.deepEqual(
        PLUMBING_SEARCHES.map((s) => s.typed + s.rest),
        [
            "plumbers near me",
            "plumbing companies near me",
            "plumbing services near me",
            "water heater installation near me",
        ],
    );
    assert.deepEqual(
        PLUMBING_SEARCHES.map((s) => s.perMonth),
        ["823,000", "49,500", "40,500", "22,200"],
    );
    assert.equal(PLUMBING_SEARCH_SOURCE, "Searches a month: Marketkeep, SEO keywords for plumbers, September 2026");

    // Since 19 Nov 2026 the page holds no copy of these facts: both the phrase and the figure come
    // from `trade-searches.ts`, so a corrected count there reaches the page on its own. This is
    // what stops the two lists drifting apart, so it is pinned rather than assumed.
    assert.ok(!read("app/data/plumbing-searches.ts").match(/\d{2},\d{3}|\d{3},\d{3}/), "a count is written out again here");
    for (const s of PLUMBING_SEARCHES) {
        const shared = TRADE_SEARCHES.plumbing.searches.find((t) => t.search === s.typed + s.rest);
        assert.ok(shared, `${s.typed + s.rest} is not in the shared plumbing list`);
        assert.equal(s.perMonth, shared.perMonth, `${s.typed + s.rest} prints a figure the source does not give`);
    }
    // The printed line names Marketkeep, so the shared list must still be Marketkeep's.
    assert.match(TRADE_SEARCHES.plumbing.source, /Marketkeep/);

    says(
        page,
        [
            'What your customers are trying to <span className="plumb-coral">find out.</span>',
            "Nobody with water on the floor is browsing. They search, they call, and they hire whoever answers.",
            "What they search",
            "What they ask on calls",
            "Your site is built to be found for searches like these.",
            "Your receptionist answers the questions you'd normally answer yourself.",
            "Then it takes their details and leaves the job and the price to you.",
            '"Can you really come the same day?"'.replace(/"/g, ""),
            "Do you charge extra for emergency calls?",
            "Can you find the leak without tearing up the walls?",
        ],
        "the questions section",
    );
});

test("the work order is the same sum as the homepage and /hvac", () => {
    // The homepage keeps its own copy inside its calculator. If one moves, both must.
    const home = read("app/components/home/YearCalculator.tsx");
    assert.equal(Number(home.match(/const LEAD_RATE = ([\d.]+)/)[1]), LEAD_RATE);
    assert.equal(Number(home.match(/const CLOSE_RATE = ([\d.]+)/)[1]), CLOSE_RATE);
    assert.equal(Number(home.match(/const AI_RECOVERY_RATE = ([\d.]+)/)[1]), AI_RECOVERY_RATE);
    // 10 calls a week at an $800 job, the starting values on all three pages.
    assert.equal(formatDollars(lostPerYear(10, 800)), "$70.8K");
    assert.equal(formatDollars(lostPerYear(10, 800) * AI_RECOVERY_RATE), "$35.4K");
    says(
        workOrder,
        [
            "Work order",
            "Missed calls · one year",
            "Calls you miss a week",
            "Type your number",
            "Weeks in a year",
            "Are new-business leads",
            "Of leads convert on the call",
            "Your average job",
            "Calculate",
            "Lost to missed calls, a year",
            "Won back with a receptionist",
            'useState("10")',
            'useState("800")',
        ],
        "the work order",
    );
    says(
        page,
        [
            'A burst pipe won\'t wait <span className="plumb-coral">for a callback.</span>',
            "With water on the floor, they won't wait for you to call back.",
            'Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is our own estimate: half.'.replace(/&ldquo;|&rdquo;/g, '"'),
        ],
        "the missed-calls section",
    );
});

test("the close is the shared two asks, at Schedule A's price", () => {
    says(
        page,
        [
            'Call it. <span className="plumb-coral">See who picks up.</span>',
            "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.",
            '<PageAsk className="plumb-ask" />',
        ],
        "the close",
    );
    assert.equal(SCHEDULES.starter.monthlyPrice, 197);
});

test("nothing on the page names a region, or a place the agency does not work in", () => {
    for (const place of ["Maine", "Utah", "California", "Florida", "Georgia", "Alabama"]) {
        assert.ok(!page.includes(place), `/plumbing names ${place}`);
    }
});

test("the page has its approved title, description, sitemap entry and Trades listing", () => {
    assert.equal(PLUMBING_TITLE, "Plumber Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        PLUMBING_DESCRIPTION,
        "We write, build and host your plumbing website, and an AI receptionist answers the calls you miss, 24/7, from burst pipes to water heaters. From $197 a month, no contract.",
    );
    assert.match(read("app/plumbing/page.tsx"), /pageMetadata\("\/plumbing", PLUMBING_TITLE, PLUMBING_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/plumbing"), "/plumbing is not a public path");
    assert.ok(sitemap().some((e) => e.url === `${SITE_URL}/plumbing`), "/plumbing is missing from the sitemap");
    // One list feeds both the nav's Trades menu and the footer's Trades column.
    assert.deepEqual(
        TRADE_PAGES.map((t) => t.href),
        ["/hvac", "/plumbing"],
    );
});

test("the structured data says only what the page says", () => {
    const graph = plumbingJsonLd()["@graph"];
    const service = graph.find((n) => n["@type"] === "Service");
    assert.equal(service.url, `${SITE_URL}/plumbing`);
    assert.equal(service.audience.name, "Plumbing companies");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.provider["@id"], `${SITE_URL}/#organization`);
    assert.equal(service.areaServed, undefined, "the page names no region, so neither may its data");
    const webPage = graph.find((n) => n["@type"] === "WebPage");
    assert.equal(webPage.name, PLUMBING_TITLE);
    assert.equal(webPage.description, PLUMBING_DESCRIPTION);
});

test("the page is its own design, not /hvac with the trade swapped", () => {
    const hvac = read("app/hvac/page.tsx");
    // Devices that belong to the HVAC page and must not appear here.
    for (const hvacOnly of ["hvac-beat", "hvac-signals", "hvac-vs-", "hvac-frame", "hvac-qs", "hvac-sum"]) {
        assert.ok(!page.includes(hvacOnly), `/plumbing reuses an HVAC device: ${hvacOnly}`);
    }
    // Devices that belong to this page.
    for (const own of ["plumb-phone", "plumb-spine", "plumb-em", "plumb-rgrid", "plumb-slices", "plumb-gbox", "plumb-calllog", "plumb-wo"]) {
        assert.ok(page.includes(own), `/plumbing is missing its own device: ${own}`);
    }
    // The two pages share the receptionist's four rules, deliberately, but nothing else verbatim.
    assert.ok(hvac.includes("Quote a price") && page.includes("Quote a price"));
    assert.ok(!page.includes("On an HVAC call"), "an HVAC heading leaked onto /plumbing");
});
