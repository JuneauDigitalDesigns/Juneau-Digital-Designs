/**
 * /auto-detailing — "Websites and an AI receptionist for auto detailers."
 *
 * Xander approved every sentence on 25 Nov 2026, over two rounds of a mockup, with the instruction
 * that the build match that mockup exactly, desktop and phone. These tests pin the sentences, the
 * things that keep this from being /hvac, /plumbing or /lawn-care with the trade swapped (its own
 * devices, its own list of what the receptionist leaves alone, its own searches), and the facts the
 * page must not invent.
 *
 * On the code before this change every test here fails: there is no `app/auto-detailing/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, AUTO_DETAILING_TITLE, AUTO_DETAILING_DESCRIPTION, autoDetailingJsonLd } from "../app/lib/site-seo.ts";
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

const page = prose(read("app/auto-detailing/page.tsx"));
const bay = prose(read("app/components/auto-detailing/DetailBay.tsx"));
const dash = prose(read("app/components/auto-detailing/DetailDash.tsx"));
const phone = prose(read("app/components/auto-detailing/DetailPhone.tsx"));
const css = read("app/globals.css");

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero is the approved words, and the car is polished while the call is answered", () => {
    says(
        page,
        [
            "For auto detailing businesses",
            'Websites and an AI receptionist for <span className="detail-coral">auto detailers.</span>',
            "We write, build and host your detailing website. Then every call you can't take gets answered.",
            "Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what car it is, what it needs and where it's parked, and puts the lead straight into your portal.",
            "While you're <span className=\"detail-coral\">mid-detail.</span>",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/auto-detailing",
    );
    // The hero shows a car being polished, not a foam wash (round 1 was rejected), with the call
    // answered mid-detail. At rest it is half polished with the call answered, so a still frame and
    // a reduced-motion visitor both read correctly.
    assert.match(bay, /is-answered/);
    assert.match(bay, /polished/);
    assert.match(bay, /prefers-reduced-motion/);
    // A timer, not animation frames, so the loop keeps going in a background tab.
    assert.doesNotMatch(bay, /requestAnimationFrame/);
    assert.match(page, /<Link href="\/contact" className="btn primary lg">/);
});

test("the receptionist's call is the approved wording, and the price is left blank", () => {
    says(
        page,
        [
            "On a detailing call, it asks <span className=\"detail-coral\">about the car.</span>",
            "Your AI receptionist is set up for your detailing business before it takes a single call. It lets the caller explain, then asks one question at a time: what it needs, what car it is, and where it's parked.",
            "Thanks for calling. How can I help?",
            "I spilled coffee and a milkshake all over the back seat of my truck.",
            "Sorry to hear that. Are the seats cloth or leather?",
            "Cloth. It's a 2019 F-150.",
            "And where's the truck right now?",
            "It's in my driveway.",
            "What's that going to cost me?",
            "We're not able to give a price until we've seen the truck. Someone from the team will call you back with a quote.",
            "Vehicle check-in",
            "Interior: a spill on the back seat",
            "2019 F-150, cloth seats",
            "At home, in the driveway",
            "Yours to quote",
            "Back seat",
        ],
        "the call",
    );
    // The price field is the one it never fills in. If that flag is lost the page would claim the
    // receptionist quotes, which is the opposite of what it does.
    assert.match(page, /val: "Yours to quote",\s*yours: true/);
});

test("the lead lands in the portal inbox, and the phone text follows", () => {
    says(
        page,
        [
            "The call ends. The lead lands <span className=\"detail-coral\">in your portal.</span>",
            "This is that call, in your portal inbox, and the text you get.",
            "Noel Bautista",
            "Wants a callback",
            "Coffee and a milkshake spilled on the back seat of a 2019 F-150. Cloth seats. The truck is in his driveway. Asked what it costs.",
            "Jim Petrakis",
            "Example lead. Example text.",
        ],
        "where the lead lands",
    );
    // The phone is the homepage's: the text the owner gets, buzzing on scroll into view.
    says(phone, ["Your phone", "New call lead in your portal", "Name: Noel Bautista", "buzz"], "the phone");
    // Show the inbox and the text, as on the other trade pages, not the CRM board.
    assert.doesNotMatch(page, /Kanban|\bboard\b/i, "the trade pages show the inbox, not the board");
});

test("auto detailing has no emergency list: it has what the receptionist hands back to the owner", () => {
    says(
        page,
        [
            "Three things it hands back <span className=\"detail-coral\">to you.</span>",
            "It never quotes. It tells the caller the team will call back with one.",
            "It never books a time or promises a day. It takes their details and says someone from the team will call to schedule.",
            "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
            "And whenever it's asked, it says it's a virtual assistant.",
        ],
        "what it hands back",
    );
    // No invented urgency borrowed from /plumbing or /hvac.
    assert.doesNotMatch(code("app/auto-detailing/page.tsx"), /urgent|emergency|burst|no hot water|furnace/i);
});

test("the website section shows the real example site, as three phone screens", () => {
    says(
        page,
        [
            "What's on your <span className=\"detail-coral\">detailing website.</span>",
            "You answer a few questions. We write it, build it and host it. This is Autobridge Car Detailing, an example site we built. Yours carries your name, your colours, your photos, your services and your towns.",
            "Your number, then a form",
            "A page for each service",
            "Your customers' questions",
            "Autobridge Car Detailing is an example business, not a client.",
            "Under all of it: titles, a sitemap, structured data, fast pages.",
        ],
        "the website section",
    );
    // Three real screens from the live Autobridge site, shipped as production assets.
    for (const n of [1, 2, 3]) {
        assert.ok(existsSync(fileURLToPath(new URL(`../public/auto-detailing-site-${n}.webp`, import.meta.url))), `missing screen ${n}`);
        assert.ok(page.includes(`/auto-detailing-site-${n}.webp`), `the page does not use screen ${n}`);
    }
});

test("the searches are on plates, the questions on stickers, with no invented count", () => {
    says(
        page,
        [
            "What your customers are trying to <span className=\"detail-coral\">find out.</span>",
            "Nobody waits long with a milkshake in the back seat. They search, they call, and they hire whoever answers.",
            "Car detailing",
            "Mobile detailing service",
            "Ceramic coating",
            "Paint correction specialist",
            "Search phrases: Ranktracker, Car Detailing SEO",
            "Do you come to me, or do I bring it in?",
            "Would polishing take those scratches out?",
            "How long will you need the car?",
            "Your site is built to be found for searches like these.",
            "Your receptionist answers the questions you'd normally answer yourself.",
        ],
        "the searches and questions",
    );
    // Detailing has no reliable monthly count, so the plates print none.
    assert.doesNotMatch(code("app/auto-detailing/page.tsx"), /\d{2},\d{3}|\d{3},\d{3}/, "the page prints a search count it should not have");
});

test("a missed call is counted as one job, and the odometers roll to the sourced sum", () => {
    says(
        page,
        [
            "A missed call drives <span className=\"detail-coral\">to the next shop.</span>",
            "Most people who call a business and reach a recording just hang up and call the next name on the list.",
            "Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. \"Won back\" is our own estimate: half.",
        ],
        "the sum",
    );
    says(dash, ["Calls you miss a week", "Your average job", "× 52 weeks × 37% are new-business leads × 46% convert on the call", "Lost to missed calls, a year", "Won back with a receptionist"], "the dash");
    // The rates are the shared, sourced ones, and a missed call is one job (not a season).
    assert.match(dash, /AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear/);
    assert.equal(LEAD_RATE, 0.37);
    assert.equal(CLOSE_RATE, 0.46);
    assert.equal(AI_RECOVERY_RATE, 0.5);
    // The chain's percentages must match those rates.
    assert.ok(dash.includes(`${Math.round(LEAD_RATE * 100)}% are new-business leads`));
    assert.ok(dash.includes(`${Math.round(CLOSE_RATE * 100)}% convert on the call`));
    // 10 missed calls a week, $300 a job: the page's own starting numbers, as the odometers read.
    assert.match(dash, /useState\("10"\)/);
    assert.match(dash, /useState\("300"\)/);
    const lost = lostPerYear(10, 300);
    assert.equal(Math.round(lost), 26551);
    assert.equal(Math.round(lost * AI_RECOVERY_RATE), 13276);
});

test("the page has its approved title, description, sitemap entry and Trades listing", () => {
    assert.equal(AUTO_DETAILING_TITLE, "Auto Detailing Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        AUTO_DETAILING_DESCRIPTION,
        `We write, build and host your detailing website, and an AI receptionist answers the calls you miss, 24/7, from interior details to ceramic coatings. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`,
    );
    assert.match(page, /pageMetadata\("\/auto-detailing", AUTO_DETAILING_TITLE, AUTO_DETAILING_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/auto-detailing"));
    assert.equal(sitemap().filter((e) => e.url === `${SITE_URL}/auto-detailing`).length, 1);
    assert.deepEqual(TRADE_PAGES.find((t) => t.href === "/auto-detailing"), { label: "Auto Detailing", href: "/auto-detailing" });
    // The homepage's trade line links auto detailing now that it has a page, without changing its words.
    assert.match(read("app/components/home/homepageclient.tsx"), /<Link href="\/auto-detailing" className="home-trade-link">auto detailing<\/Link>/);
    // The close is the shared pair, as every other page's is.
    assert.match(page, /<PageAsk className="detail-ask" \/>/);
    says(page, ["Call it. <span className=\"detail-coral\">See who picks up.</span>", "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract."], "the close");
});

test("the structured data says only what the page says", () => {
    const [webpage, service] = autoDetailingJsonLd()["@graph"];
    assert.equal(webpage.url, `${SITE_URL}/auto-detailing`);
    assert.equal(webpage.name, AUTO_DETAILING_TITLE);
    assert.equal(service.audience.name, "Auto detailing businesses");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.description, AUTO_DETAILING_DESCRIPTION);
    // No region: the page names none (the example-site screenshots are not the page's own copy).
    assert.ok(!("areaServed" in service), "a trade page must not claim an area served");
});

test("the page is its own design, not /hvac, /plumbing or /lawn-care with the trade swapped", () => {
    // Google treats near-identical trade pages as doorway pages. None of the other pages' devices
    // may appear here, and none of their class prefixes.
    const shipped = code("app/auto-detailing/page.tsx");
    assert.doesNotMatch(shipped, /lawn-|plumb-|hvac/i);
    for (const borrowed of ["While your hands", "While the mower", "whole season", "street of lawns", "yard signs", "work order"]) {
        assert.ok(!shipped.toLowerCase().includes(borrowed.toLowerCase()), `/auto-detailing borrowed: ${borrowed}`);
    }
    // Its own devices: a polished car, a check-in sheet, tree air fresheners, phone screens, license
    // plates, windshield stickers, the sum on a dashboard.
    for (const own of ["detail-bay", "detail-sheet", "detail-trees", "detail-phones", "detail-plates", "detail-shield", "detail-dash", "detail-odo"]) {
        assert.ok(css.includes(`.${own}`), `the stylesheet lost ${own}`);
    }
    // No region is named in the page's own copy: that is settled site-wide, and never Maine, Utah or
    // California. (The example-site screenshots are image files, not the page's text.)
    assert.doesNotMatch(page + bay + dash + phone, /Florida|Georgia|Alabama|Orlando|Maine|Utah|California/);
});
