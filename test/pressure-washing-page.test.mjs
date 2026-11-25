/**
 * /pressure-washing — "Websites and an AI receptionist for pressure washing."
 *
 * Xander approved every sentence on 25 Nov 2026, over several rounds of a mockup, with the
 * instruction that the build match that mockup exactly, desktop and phone. These tests pin the
 * sentences, the things that keep this from being one of the other four trade pages with the trade
 * swapped (its own devices, its own list of what the receptionist leaves alone, its own searches),
 * and the facts the page must not invent.
 *
 * On the code before this change every test here fails: there is no `app/pressure-washing/page.tsx`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

import sitemap from "../app/sitemap.ts";
import { PUBLIC_PATHS, SITE_URL, PRESSURE_WASHING_TITLE, PRESSURE_WASHING_DESCRIPTION, pressureWashingJsonLd } from "../app/lib/site-seo.ts";
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

const page = prose(read("app/pressure-washing/page.tsx"));
const driveway = prose(read("app/components/pressure-washing/PwDriveway.tsx"));
const gauge = prose(read("app/components/pressure-washing/PwGauge.tsx"));
const phone = prose(read("app/components/pressure-washing/PwPhone.tsx"));
const css = read("app/globals.css");

function says(src, sentences, where) {
    for (const s of sentences) assert.ok(src.includes(s), `${where} no longer says: ${s}`);
}

test("the hero is the approved words, and the driveway is washed while the call is answered", () => {
    says(
        page,
        [
            "For pressure washing companies",
            'Websites and an AI receptionist for <span className="pw-coral">pressure washing.</span>',
            "We write, build and host your pressure washing website. Then every call you can't take gets answered.",
            "Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in Spanish. It finds out what needs washing, how big it is and when they need it done, and puts the lead straight into your portal.",
            "While the water's <span className=\"pw-coral\">running.</span>",
            "<b>Only then.</b> It never answers before you do.",
        ],
        "/pressure-washing",
    );
    // The wand is set down on the ground when the job is done (round 2c), not faded.
    assert.match(driveway, /layWand/);
    assert.match(driveway, /prefers-reduced-motion/);
    // A timer, not animation frames, so the loop keeps going in a background tab.
    assert.doesNotMatch(driveway, /requestAnimationFrame/);
    assert.match(page, /<Link href="\/contact" className="btn primary lg">/);
});

test("the receptionist's call is the approved wording, noted as it happens, and the price is left blank", () => {
    says(
        page,
        [
            "On a wash call, it asks what <span className=\"pw-coral\">needs washing.</span>",
            "Your AI receptionist is set up for your pressure washing business before it takes a single call. It lets the caller explain, then asks one question at a time: what needs washing, how big it is, and when they need it done.",
            "Thanks for calling. How can I help?",
            "Our back deck is covered in green mildew and we're hosting on Saturday.",
            "Happy to help. Is the deck wood or composite, and roughly how big is it?",
            "Wood, about 300 square feet.",
            "Since you're hosting Saturday, I'll flag this as urgent for the team.",
            "What's a deck wash like that going to run?",
            "We're not able to give a price until we've seen the deck. Someone from the team will call you back with a quote.",
            "Noted · needs washing",
            "Noted · size",
            "Flagged · when",
            "Left for you · price",
            "By the time it hangs up, you have the whole job.",
        ],
        "the call",
    );
    // The price is the one thing it never fills in; if that is lost the page would claim it quotes.
    assert.match(page, /v: "Yours to quote", kind: "yours"/);
});

test("the lead lands in the portal inbox, and the phone text follows", () => {
    says(
        page,
        [
            "The call ends. The lead lands <span className=\"pw-coral\">in your portal.</span>",
            "This is that call, in your portal inbox, and the text you get.",
            "Dave Kowalski",
            "Green mildew all over the back deck and he's hosting on Saturday. Wood, about 300 square feet. Asked what it costs.",
            "Tammy Reynolds",
            "Example lead. Example text.",
        ],
        "where the lead lands",
    );
    says(phone, ["Your phone", "New call lead in your portal", "Name: Dave Kowalski", "buzz"], "the phone");
    assert.doesNotMatch(page, /Kanban|\bboard\b/i, "the trade pages show the inbox, not the board");
});

test("pressure washing has no emergency list: it has what the receptionist never touches", () => {
    says(
        page,
        [
            "Three things it never <span className=\"pw-coral\">touches.</span>",
            "It never quotes. It tells the caller the team will call back with one.",
            "It never books a time or promises a day. It takes their details, flags the deadline, and says someone from the team will call to schedule.",
            "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
            "And whenever it's asked, it says it's a virtual assistant.",
        ],
        "what it never touches",
    );
    // The real colour-code nozzle tips.
    says(page, ["0°", "25°", "40°"], "the nozzle tips");
    assert.doesNotMatch(code("app/pressure-washing/page.tsx"), /burst|no hot water|furnace|water heater/i);
});

test("the website section shows the real example site, as three phone screens", () => {
    says(
        page,
        [
            "What's on your <span className=\"pw-coral\">pressure washing website.</span>",
            "You answer a few questions. We write it, build it and host it. Yours carries your name, your colours, your photos, your services and your towns.",
            "Your number, then a form",
            "A page for each service",
            "Your customers' questions",
            "Your Pressure Washing Co. is an example business, not a client.",
            "Under all of it: titles, a sitemap, structured data, fast pages.",
        ],
        "the website section",
    );
    for (const n of [1, 2, 3]) {
        assert.ok(existsSync(fileURLToPath(new URL(`../public/pressure-washing-site-${n}.webp`, import.meta.url))), `missing screen ${n}`);
        assert.ok(page.includes(`/pressure-washing-site-${n}.webp`), `the page does not use screen ${n}`);
    }
});

test("the searches are search bars, the questions on door hangers, with no invented count", () => {
    says(
        page,
        [
            "What your customers are trying to <span className=\"pw-coral\">find out.</span>",
            "The grime isn't going anywhere, but the customer is. They search, they call, and they hire whoever answers.",
            "power washing near me",
            "pressure washing services",
            "house pressure washing",
            "soft wash roof cleaning",
            "Search phrases: Marketkeep, SEO keywords for pressure washing",
            "Is a soft wash safe for the shingles?",
            "Can you get the oil stains out of the driveway?",
            "Do I need to be home for it?",
            "Your site is built to be found for searches like these.",
            "Your receptionist answers the questions you'd normally answer yourself.",
        ],
        "the searches and questions",
    );
    // The source's two tables disagree on counts, so the page prints none.
    assert.doesNotMatch(code("app/pressure-washing/page.tsx"), /\d{2},\d{3}|\d{3},\d{3}/, "the page prints a search count it should not have");
});

test("a missed call is counted as one job, and the gauge sweeps to the sourced sum", () => {
    says(
        page,
        [
            "A missed call is money <span className=\"pw-coral\">down the drain.</span>",
            "Most people who call a business and reach a recording just hang up and call the next name on the list.",
            "Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. \"Won back\" is our own estimate: half.",
        ],
        "the sum",
    );
    says(gauge, ["Calls you miss a week", "Your average job", "× 52 weeks × 37% are new-business leads × 46% convert on the call", "Lost to missed calls, a year", "Won back with a receptionist"], "the gauge");
    assert.match(gauge, /AI_RECOVERY_RATE, CLOSE_RATE, LEAD_RATE, lostPerYear/);
    assert.equal(LEAD_RATE, 0.37);
    assert.equal(CLOSE_RATE, 0.46);
    assert.equal(AI_RECOVERY_RATE, 0.5);
    assert.ok(gauge.includes(`${Math.round(LEAD_RATE * 100)}% are new-business leads`));
    assert.ok(gauge.includes(`${Math.round(CLOSE_RATE * 100)}% convert on the call`));
    // 10 missed calls a week, $450 a job: the page's own starting numbers (the sample deck wash).
    assert.match(gauge, /useState\("10"\)/);
    assert.match(gauge, /useState\("450"\)/);
    const lost = lostPerYear(10, 450);
    assert.equal(Math.round(lost), 39827);
    assert.equal(Math.round(lost * AI_RECOVERY_RATE), 19913);
});

test("the page has its approved title, description, sitemap entry and Trades listing", () => {
    assert.equal(PRESSURE_WASHING_TITLE, "Pressure Washing Website Design + 24/7 AI Receptionist | JDD");
    assert.equal(
        PRESSURE_WASHING_DESCRIPTION,
        `We write, build and host your pressure washing website, and an AI receptionist answers the calls you miss, 24/7, from driveways to roof soft washes. From $${SCHEDULES.starter.monthlyPrice} a month, no contract.`,
    );
    assert.match(page, /pageMetadata\("\/pressure-washing", PRESSURE_WASHING_TITLE, PRESSURE_WASHING_DESCRIPTION\)/);
    assert.ok(PUBLIC_PATHS.includes("/pressure-washing"));
    assert.equal(sitemap().filter((e) => e.url === `${SITE_URL}/pressure-washing`).length, 1);
    assert.deepEqual(TRADE_PAGES.find((t) => t.href === "/pressure-washing"), { label: "Pressure Washing", href: "/pressure-washing" });
    assert.match(read("app/components/home/homepageclient.tsx"), /<Link href="\/pressure-washing" className="home-trade-link">pressure washing<\/Link>/);
    assert.match(page, /<PageAsk className="pw-ask" \/>/);
    says(page, ["Call it. <span className=\"pw-coral\">See who picks up.</span>", "Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract."], "the close");
});

test("the structured data says only what the page says", () => {
    const [webpage, service] = pressureWashingJsonLd()["@graph"];
    assert.equal(webpage.url, `${SITE_URL}/pressure-washing`);
    assert.equal(webpage.name, PRESSURE_WASHING_TITLE);
    assert.equal(service.audience.name, "Pressure washing companies");
    assert.equal(service.offers.price, SCHEDULES.starter.monthlyPrice);
    assert.equal(service.description, PRESSURE_WASHING_DESCRIPTION);
    assert.ok(!("areaServed" in service), "a trade page must not claim an area served");
});

test("the page is its own design, not one of the other trade pages with the trade swapped", () => {
    const shipped = code("app/pressure-washing/page.tsx");
    assert.doesNotMatch(shipped, /lawn-|plumb-|hvac|detail-/i);
    for (const borrowed of ["While your hands", "While the mower", "whole season", "mid-detail", "vehicle check-in", "tree air"]) {
        assert.ok(!shipped.toLowerCase().includes(borrowed.toLowerCase()), `/pressure-washing borrowed: ${borrowed}`);
    }
    // Its own devices: a washed driveway, the call as a thread, nozzle tips, phone screens, search
    // bars, door hangers, the sum on a gauge.
    for (const own of ["pw-job", "pw-oncall", "pw-nozzles", "pw-phones", "pw-stencils", "pw-hangers", "pw-gauge"]) {
        assert.ok(css.includes(`.${own}`), `the stylesheet lost ${own}`);
    }
    // No region is named in the page's own copy: that is settled site-wide, and never Maine, Utah or
    // California. (The example-site screenshots are image files, not the page's text.)
    assert.doesNotMatch(page + driveway + gauge + phone, /Florida|Georgia|Alabama|Orlando|Maine|Utah|California/);
});
