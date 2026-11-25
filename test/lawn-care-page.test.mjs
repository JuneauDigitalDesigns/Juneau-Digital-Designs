/**
 * /lawn-care — "Websites and an AI receptionist for lawn care."
 *
 * Xander approved every sentence on 19 Nov 2026, over eight rounds of a mockup, with the
 * instruction that the build match that mockup exactly, desktop and phone. These tests pin the
 * sentences, the things that keep this from being /hvac or /plumbing with the trade swapped (its
 * own devices, its own list of what the receptionist leaves alone, its own searches), and the
 * facts the page must not invent.
 *
 * On the code before this change every test here fails: there is no `app/lawn-care/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, LAWN_CARE_TITLE, LAWN_CARE_DESCRIPTION, lawnCareJsonLd } from "../app/lib/site-seo.ts";
import { SCHEDULES } from "../app/lib/legal/schedules.ts";
import { TRADE_PAGES } from "../app/data/trade-pages.ts";
import { TRADE_SEARCHES } from "../app/data/trade-searches.ts";
import { LAWN_SEARCHES, LAWN_SEARCH_SOURCE } from "../app/data/lawn-searches.ts";
import { AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear } from "../app/data/missed-calls.ts";

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&middot;/g, "·")
        .replace(/\s+/g, " ");

/** The code without its comments: what the page actually ships, for "must not say" checks. */
const code = (p) => prose(read(p).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " "));

const page = prose(read("app/lawn-care/page.tsx"));
const route = prose(read("app/components/lawn-care/LawnRoute.tsx"));
const season = prose(read("app/components/lawn-care/LawnSeason.tsx"));
const signs = prose(read("app/components/lawn-care/LawnSigns.tsx"));
const tour = prose(read("app/components/lawn-care/LawnTour.tsx"));
const css = read("app/globals.css");

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero is the approved words, and the route answers calls mid-mow", () => {
    says(
        page,
        [
            "For lawn care companies",
            'Websites and an AI receptionist for <span className="lawn-coral">lawn care.</span>',
            "We write, build and host your lawn care website. Then every call you can't take gets answered.",
            "Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what they want done, how big the yard is and where, and puts the lead straight into your portal.",
            "While the mower's <span className=\"lawn-coral\">running.</span>",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/lawn-care",
    );
    says(route, ["Alder Ct", "Birch Ln", "Wren Hollow Rd", "Today's route", "Thursday", "Incoming call", "Ringing&hellip;", "Answered by your receptionist"], "the route");
    // Every Get started on the site goes to /contact, and nothing here opens the drawer.
    assert.match(read("app/lawn-care/page.tsx"), /<Link href="\/contact" className="btn primary lg">/);
    assert.doesNotMatch(read("app/lawn-care/page.tsx"), /LeadPanel/, "the page must not depend on the slide-over");
});

test("each call lands ON a lawn being mowed, not between jobs", () => {
    // Xander rejected two rounds that read as "a job finished, then a call came in". Every leg
    // carries the point the phone rang and the point it was answered, both inside the mowing.
    const legs = [...route.matchAll(/ring:\s*(\d+),\s*got:\s*(\d+)/g)].map(([, r, g]) => [Number(r), Number(g)]);
    assert.equal(legs.length, 3, "the route should be three lawns");
    for (const [ring, got] of legs) {
        assert.ok(ring > 0 && ring < got && got < 100, `a call must ring and be answered during the mowing, got ${ring}/${got}`);
    }
    // At rest every lawn is already part-mown with its call answered, so the page is complete
    // before any script runs and for anyone who has asked for less motion.
    assert.match(route, /className="lawn-leg is-rung is-got" data-state="mowing"/);
    assert.match(route, /prefers-reduced-motion: reduce/);
    assert.match(css, /\.lawn-plot \{\s*--p: 78%;/);
});

test("the receptionist's call is the approved wording, and the price is left blank", () => {
    says(
        page,
        [
            "On a lawn call, it asks what <span className=\"lawn-coral\">you'd ask.</span>",
            "Your AI receptionist is set up for your lawn care business before it takes a single call. It lets the caller explain, then asks one question at a time: what they want done, how big the yard is, and where.",
            "Thanks for calling. How can I help?",
            "I need someone to mow every week. The last company stopped showing up.",
            "Roughly how big is the yard, front and back?",
            "About a quarter acre.",
            "What would that run me a visit?",
            "We're not able to give a price until we've seen the yard. Someone from the team will call you back with a quote.",
            "Can I get your name, your address and the best number to reach you?",
            "Erin Castillo, 2210 Wren Hollow Road. Call me on this number.",
            "New lead",
            "Written down as they talk",
            "Weekly mowing",
            "Quarter acre, front and back",
            "Yours to quote",
        ],
        "the call",
    );
    // The price field is the one it never fills in. If that flag is lost the page would claim the
    // receptionist quotes, which is the opposite of what it does.
    assert.match(page, /value: "Yours to quote", yours: true/);
});

test("the lead lands in the portal inbox, and a text follows", () => {
    says(
        page,
        [
            "The call ends. The lead lands <span className=\"lawn-coral\">in your portal.</span>",
            "This is that call, in your portal inbox.",
            "Then you get a text saying it's there.",
            "Erin Castillo",
            "Wants a callback",
            "Wants weekly mowing. About a quarter acre, front and back, at 2210 Wren Hollow Rd. Asked what it costs a visit.",
            "Carol Ostrander",
            "Tammy Reynolds",
        ],
        "where the lead lands",
    );
    // Xander: show the inbox and the text, as on the other trade pages, not the CRM board.
    assert.doesNotMatch(page, /Kanban|\bboard\b/i, "the trade pages show the inbox, not the board");
});

test("lawn care has no emergency list: it has what the receptionist leaves to the owner", () => {
    says(
        page,
        [
            "Three things it leaves <span className=\"lawn-coral\">to you.</span>",
            "It never quotes. It tells the caller the team will call back with one.",
            "It never books a time or promises a day. It takes their details and says someone from the team will call to schedule.",
            "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
            "And whenever it's asked, it says it's a virtual assistant.",
        ],
        "what it leaves to you",
    );
    // No invented urgency. Nobody calls a lawn company with an emergency, and the page must not
    // borrow /plumbing's or /hvac's.
    assert.doesNotMatch(code("app/lawn-care/page.tsx"), /urgent|emergency|burst|no hot water|furnace/i);
});

test("the website section shows the real design, four parts of it", () => {
    says(
        page,
        [
            "What's on your <span className=\"lawn-coral\">lawn care website.</span>",
            "You answer a few questions. We write it, build it and host it. This is the lawn care design. Yours carries your name, your colours, your photos, your services and your neighbourhoods.",
            "The lawn care design, with a sample business and sample details.",
            "Under all of it: titles, a sitemap, structured data, fast pages.",
        ],
        "the website section",
    );
    says(
        tour,
        [
            "They pick how often",
            "Weekly, every other week or a one-time cleanup, picked right beside the quote form. On Growth, the receptionist calls them back within about a minute.",
            "Season by season",
            "Six services, from mowing to edging",
            "Where you already mow",
        ],
        "the tour",
    );
    // One picture, scrolled to each part, with the phone falling back to a picture per point.
    assert.match(css, /\.lawn-view,\s*\.lawn-shot \{[^}]*background-image: url\("\/lawn-care-site\.webp"\)/s);
    assert.match(css, /\.lawn-frame \{ display: none; \}/);
});

test("the searches are real, sourced, drawn to scale, and not the homepage's list", () => {
    assert.deepEqual(
        LAWN_SEARCHES.map((s) => s.search),
        ["lawn mowing", "lawn care", "lawn care companies", "grass cutting service"],
    );
    assert.deepEqual(
        LAWN_SEARCHES.map((s) => s.perMonth),
        ["301,000", "90,500", "12,100", "8,100"],
    );
    assert.equal(LAWN_SEARCH_SOURCE, "Searches a month: Marketkeep, SEO keywords for landscapers, August 2026");
    // The page holds no figure of its own: both the phrase and the count come from the site's one
    // keyword list, so a corrected count reaches this page without anyone copying it across.
    assert.ok(!/\d{2},\d{3}|\d{3},\d{3}/.test(code("app/data/lawn-searches.ts")), "a count is written out again here");
    for (const s of LAWN_SEARCHES) {
        const shared = TRADE_SEARCHES["lawn-care"].searches.find((t) => t.search === s.search);
        assert.ok(shared, `${s.search} is not in the shared lawn care list`);
        assert.equal(s.perMonth, shared.perMonth, `${s.search} prints a figure the source does not give`);
    }
    assert.match(TRADE_SEARCHES["lawn-care"].source, /Marketkeep/);
    // Drawn to scale against the biggest, which is why the last two are short.
    assert.equal(LAWN_SEARCHES[0].share, "100.00%");
    assert.equal(LAWN_SEARCHES[1].share, "30.07%");
    assert.equal(LAWN_SEARCHES[3].share, "2.69%");
});

test("the questions on the yard signs are examples, and the grass is the page's only green", () => {
    says(signs, ["Do you mow in my neighbourhood?", "Could those brown patches be grubs?", "Can you start this week?", "Asked on a call"], "the signs");
    says(
        page,
        [
            "What your customers are trying to <span className=\"lawn-coral\">find out.</span>",
            "The grass keeps growing while they look. They search, they call, and they hire whoever answers.",
            "Your site is built to be found for searches like these.",
            "Your receptionist answers the questions you'd normally answer yourself.",
        ],
        "what they're trying to find out",
    );
    // Xander approved this grass on sight and asked for nothing about it to change. The seeds and
    // sizes below are what draw that particular lawn.
    const blades = read("app/components/lawn-care/blades.ts");
    assert.match(blades, /SIGN_BACK = \{ height: 100, seed: 11, min: 44, max: 92/);
    assert.match(blades, /SIGN_FRONT = \{ height: 100, seed: 29, min: 14, max: 40/);
    // The ground line runs to the outermost blade, not to the box's edge.
    assert.match(css, /\.lawn-signs::after \{[^}]*left: var\(--lawn-gl, 0px\); right: var\(--lawn-gr, 0px\)/s);
});

test("a missed call is counted as a season, and the street of lawns grows with the numbers", () => {
    says(
        page,
        [
            "A missed call is a <span className=\"lawn-coral\">whole season.</span>",
            "Most people who call a business and reach a recording just hang up and call the next name on the list. In lawn care, whoever answers gets every visit after that.",
            "Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. \"Won back\" is our own estimate: half.",
        ],
        "the sum",
    );
    says(
        season,
        [
            "You miss",
            "calls a week.",
            "A customer pays",
            "a visit,",
            "visits a season.",
            "One customer, one season:",
            "Won back with a receptionist",
            "Lost to missed calls, a year",
            "Every lawn here is a customer you'd have won this year.",
            "Every lawn here is ${street.per} customers you'd have won this year.",
            "Mown: won back with a receptionist",
            "Overgrown: still lost",
        ],
        "the calculator",
    );
    // The rates are the shared, sourced ones; only what a won call is worth differs.
    assert.match(season, /AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, formatDollars, lostPerYear/);
    assert.equal(LEAD_RATE, 0.37);
    assert.equal(CLOSE_RATE, 0.46);
    assert.equal(AI_RECOVERY_RATE, 0.5);
    // 10 missed calls a week, $45 a visit, 30 visits: the page's own starting numbers.
    const lost = lostPerYear(10, 45 * 30);
    assert.equal(formatDollars(lost), "$119K");
    assert.equal(formatDollars(lost * AI_RECOVERY_RATE), "$59.7K");
    // Why a street (Xander, 20 Nov 2026): the share won back never moves, because it is a fixed
    // half, so a single lawn mown to that share stopped in the same place whatever was typed. The
    // number of customers does move, so that is what the street draws: one lawn per customer lost,
    // the won-back ones mown. Ten missed calls a week is 89 lawns, 44 of them mown.
    assert.doesNotMatch(season, /MOWN_SHARE|lawn-meadow/, "the single lawn is back");
    const customers = 10 * 52 * LEAD_RATE * CLOSE_RATE;
    assert.equal(Math.round(customers), 89);
    assert.equal(Math.round(customers * AI_RECOVERY_RATE), 44);
    assert.match(season, /const customersLost = \(missedPerWeek: number\) => missedPerWeek \* 52 \* LEAD_RATE \* CLOSE_RATE;/);
    // One lawn a customer up to 160, then ten, then a hundred, so the street stays readable.
    assert.match(season, /customers <= 160 \? 1 : customers <= 1600 \? 10 : 100/);
    // The mower cuts it back and forth, the way a lawn is cut: every other row is reversed, and
    // the mower faces the way it is going. It never jumps back to the start of a row.
    assert.match(season, /r % 2 \? \[\.\.\.row\]\.reverse\(\) : row/);
    assert.match(season, /back \? " scaleX\(-1\)" : ""/);
    // Timers, not animation frames, so the run finishes in a background tab too.
    assert.doesNotMatch(season, /requestAnimationFrame/);
});

test("the page has its approved title, description, sitemap entry and Trades listing", () => {
    assert.equal(LAWN_CARE_TITLE, "Lawn Care Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        LAWN_CARE_DESCRIPTION,
        `We write, build and host your lawn care website, and an AI receptionist answers the calls you miss, 24/7, from weekly mowing to spring cleanups. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`,
    );
    assert.match(page, /pageMetadata\("\/lawn-care", LAWN_CARE_TITLE, LAWN_CARE_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/lawn-care"));
    assert.equal(sitemap().filter((e) => e.url === `${SITE_URL}/lawn-care`).length, 1);
    assert.deepEqual(TRADE_PAGES.find((t) => t.href === "/lawn-care"), { label: "Lawn Care", href: "/lawn-care" });
    // The homepage's trade line links each trade that has a page, without changing its words.
    assert.match(read("app/components/home/homepageclient.tsx"), /<Link href="\/lawn-care" className="home-trade-link">lawn care<\/Link>/);
    // The close is the shared pair, as every other page's is.
    assert.match(page, /<PageAsk className="lawn-ask" \/>/);
    says(page, ["Call it. <span className=\"lawn-coral\">See who picks up.</span>", "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract."], "the close");
});

test("the structured data says only what the page says", () => {
    const [webpage, service] = lawnCareJsonLd()["@graph"];
    assert.equal(webpage.url, `${SITE_URL}/lawn-care`);
    assert.equal(webpage.name, LAWN_CARE_TITLE);
    assert.equal(service.audience.name, "Lawn care companies");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.description, LAWN_CARE_DESCRIPTION);
});

test("the page is its own design, not /hvac or /plumbing with the trade swapped", () => {
    // Google treats near-identical trade pages as doorway pages. None of the other pages' devices
    // may appear here, and none of their class prefixes.
    const shipped = code("app/lawn-care/page.tsx");
    assert.doesNotMatch(shipped, /hvac|plumb/i);
    for (const borrowed of ["While your hands", "work order", "burst pipe", "ringing rows", "Six slices"]) {
        assert.ok(!shipped.toLowerCase().includes(borrowed.toLowerCase()), `/lawn-care borrowed: ${borrowed}`);
    }
    // Its own devices: a route of lawns, the call written down field by field, one moving picture,
    // searches as mowing passes, questions on yard signs, the sum drawn as a lawn.
    for (const own of ["lawn-route", "lawn-hw", "lawn-tour", "lawn-passes", "lawn-signs", "lawn-street"]) {
        assert.ok(css.includes(`.${own}`), `the stylesheet lost ${own}`);
    }
    // No region is named: that is settled site-wide, and never Maine, Utah or California.
    assert.doesNotMatch(page + season + signs + tour, /Florida|Georgia|Alabama|Maine|Utah|California/);
});
