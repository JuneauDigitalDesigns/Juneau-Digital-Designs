/**
 * The homepage, as Xander approved it from three rounds of a mockup on 19 Nov 2026
 * (https://claude.ai/artifact/TuaQSED4zBHvbTof2RLM6T): "What we see here in the mockup is exactly
 * what should be on the homepage in the end." Every sentence is pinned, so a change of wording
 * fails here and goes back to him first.
 *
 * Also held here: every search on the page is a sourced one; the text shown on "Your phone" is the
 * real post-call text, cut where a phone cuts it; every Get Started on the site goes to /contact;
 * and the hero form sends to the thank-you page that counts the lead.
 *
 * Source-level, as there is no browser in this suite. Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

register("./server-only-hook.mjs", import.meta.url);

Object.assign(process.env, {
    KV_REST_API_URL: "https://kv.test.invalid",
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: "https://kv.test.invalid",
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { callBriefBodyV2 } = await import("../app/lib/call-brief.ts");
const { SEARCHES_FIRST, SEARCHES_NEXT, ASKED_FIRST, ASKED_NEXT } = await import("../app/data/home-find-out.ts");
const { TRADE_SEARCHES } = await import("../app/data/trade-searches.ts");
const { HVAC_SEARCHES } = await import("../app/data/hvac-searches.ts");

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), "utf8");
const home = read("app/components/home/homepageclient.tsx");
const findOut = read("app/components/home/FindOut.tsx");
const lands = read("app/components/home/LeadLands.tsx");
const calc = read("app/components/home/YearCalculator.tsx");
const hero = read("app/components/home/HeroForm.tsx");
const loop = read("app/components/home/TheLoop.tsx");
const css = read("app/globals.css");

/** Source text with JSX escapes resolved and whitespace collapsed, so a sentence matches as written. */
const prose = (src) =>
    src
        .replace(/&apos;/g, "'")
        .replace(/&ldquo;|&rdquo;/g, '"')
        .replace(/&rarr;/g, "→")
        .replace(/&larr;/g, "←")
        .replace(/’/g, "'")
        .replace(/\{" "\}/g, " ")
        .replace(/\s+/g, " ");

function says(src, sentences, where) {
    const text = prose(src);
    for (const s of sentences) assert.ok(text.includes(s), `${where} no longer says: ${s}`);
}

/** Every <h2>/<h3> heading in a file, tags stripped. */
function headings(src) {
    return [...src.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/g)].map((m) => prose(m[2].replace(/<[^>]+>/g, "")).trim());
}

test("the page runs in the approved order", () => {
    const order = ["<Hero />", "<TheLoop />", "<FindOut />", "<WebsiteSection />", "<ReceptionistSection />", "<LeadLands />", "<YearCalculator />", "<FeaturedSites", "<ClosingSection />"];
    const at = order.map((tag) => home.indexOf(tag, home.indexOf("export default function HomePageClient")));
    for (const [i, n] of at.entries()) assert.ok(n > 0, `${order[i]} is missing`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, "sections out of order");
});

test("every section heading keeps its exact words and its coral close", () => {
    const all = [...headings(home), ...headings(loop), ...headings(findOut), ...headings(lands), ...headings(calc)];
    for (const h of [
        "A website that makes the phone ring.",
        "Then someone picks up.",
        "What it will never do.",
        "What it does instead.",
        "Every plan starts here.",
        "Every piece feeds the next.",
        "What your customers are trying to find out.",
        "What they're searching for",
        "What they're asking on calls",
        "And nothing slips.",
        "How much are your missed calls worth?",
    ])
        assert.ok(all.includes(h), `heading missing: ${h}`);
    for (const [src, em] of [
        [home, "phone ring."],
        [home, "picks up."],
        [home, "never do."],
        [home, "starts here."],
        [home, "Run like a team."],
        [loop, "feeds the next."],
        [findOut, "find out."],
        [lands, "nothing slips."],
        [calc, "missed calls"],
    ])
        assert.ok(src.includes(`<span className="home-em">${em}</span>`), `coral close missing: ${em}`);
});

test("1 · the hero: the live words, and the form on the page", () => {
    says(
        home,
        [
            '<span>Get found.</span> <span>Get called.</span> <span className="home-em">Run like a team.</span>',
            'Website design and AI receptionist for <span className="hp-h1-em">local service businesses.</span>',
            'Built for <Link href="/hvac" className="home-trade-link">HVAC</Link>, <Link href="/plumbing" className="home-trade-link">plumbing</Link>, <Link href="/roofing" className="home-trade-link">roofing</Link>, <Link href="/lawn-care" className="home-trade-link">lawn care</Link>, <Link href="/pressure-washing" className="home-trade-link">pressure washing</Link> and <Link href="/auto-detailing" className="home-trade-link">auto detailing</Link> businesses.',
            "<HeroForm />",
        ],
        "the hero",
    );
    // Xander, 26 Nov 2026: the paragraph leaves the hero, so the headline and the trades line fit on a
    // phone. Its job is now the loop, straight after.
    assert.doesNotMatch(home, /replace your voicemail with a 24\/7 receptionist/, "the paragraph is out of the hero");
    assert.doesNotMatch(css, /\.hp-hero-p\b/);
    says(
        hero,
        [
            "Tell us about you",
            "Let's talk.",
            "A few details and we'll come back to you with what this would look like for your business. No obligation, no pressure.",
            "Five quick questions. About 30 seconds.",
            'look="slip"',
        ],
        "the hero form",
    );
    // Xander: the homepage form sends people to /contact/thank-you, so the lead is counted.
    assert.match(hero, /markLeadSent\(business\)/);
    assert.match(hero, /router\.push\("\/contact\/thank-you"\)/);
    assert.doesNotMatch(hero, /autoFocus/, "a form on a page must not steal the cursor");
});

test("2 · the loop: the flyer's four steps and the way back, approved word for word (Xander, 26 Nov 2026)", () => {
    says(
        loop,
        [
            'Every piece <span className="home-em">feeds the next.</span>',
            "We build your website",
            "Look the part. Easy to call.",
            "Our AI receptionist answers",
            "Picks up the calls you miss.",
            "You win more customers",
            "From calls you used to lose.",
            "More customers, more reviews",
            // Review requests are Growth and Enterprise only, so the step says so (approved).
            "On Growth, ask every happy customer for one in a tap.",
            "More people find you",
            "Keep scrolling to find out exactly how we make this happen.",
        ],
        "the loop",
    );
    // In this order: website, receptionist, customers, reviews.
    const at = ["We build your website", "Our AI receptionist answers", "You win more customers", "More customers, more reviews"].map((h) => loop.indexOf(h));
    assert.deepEqual([...at].sort((a, b) => a - b), at, "the steps are out of order");
    // The site speaks as "we"; the flyer's "I" and "My" never come over.
    assert.doesNotMatch(loop, /"I build|"My AI/);
    // Xander: on a row, the way back is a line BROKEN by its words, never a line drawn behind them,
    // so nothing paints a background behind the words and the line is two pieces either side.
    assert.match(loop, /hp-loop-seg-l[\s\S]*hp-loop-back-words[\s\S]*hp-loop-seg-r/);
    assert.doesNotMatch(css, /\.hp-loop-back-words \{[^}]*background/);
    // A phone gets the flyer's square loop ("the square loop is perfect").
    assert.match(css, /@media \(max-width: 980px\) \{[^@]*\.hp-loop-step3 \{ grid-row: 3; grid-column: 3; \}[^@]*\.hp-loop-step4 \{ grid-row: 3; grid-column: 1; \}/);
});

test("1 · a phone's hero breathes (Xander, 26 Nov 2026): clear of the navbar, room between the blocks", () => {
    assert.match(css, /@media \(max-width: 980px\) \{[^@]*\.hp-hero-wrap \{ padding-top: 56px; \}[^@]*\.hp-hero \{ row-gap: 56px; \}[^@]*\.hp-beats \{ margin-bottom: 32px;/);
});

test("1 · the h1 names the service, and is the page's only one (Xander, 24 Nov 2026, option C)", () => {
    const h1s = [...home.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => prose(m[1].replace(/<[^>]+>/g, "")).trim());
    assert.deepEqual(h1s, ["Website design and AI receptionist for local service businesses."]);
    for (const f of [findOut, lands, calc, hero]) assert.doesNotMatch(f, /<h1\b/, "the homepage has exactly one h1");
    // The three beats are the h1's eyebrow now, set above it, not a heading of their own.
    assert.ok(home.indexOf('className="hp-beats"') < home.indexOf('className="hp-h1"'), "the beats sit above the h1");
});

test("2 · what customers are trying to find out", () => {
    says(
        findOut,
        [
            "Someone who needs a job done isn't browsing. They have a short list of questions, and they call the company that answers them.",
            "Your site is built to be found for searches like these.",
            "Your services and your towns get their own pages, and your customers' questions get straight answers, all written from what you tell us.",
            "Your receptionist is built to answer the questions you'd normally answer yourself.",
            "Then it takes their details and leaves the money and the job to you.",
        ],
        "find out",
    );
    assert.deepEqual(
        ASKED_FIRST.map((q) => q.text),
        ["Can someone come today?", "Do you work in my town?", "Do you have a maintenance plan?"],
    );
    assert.deepEqual(
        ASKED_NEXT.slice(0, 6).map((q) => q.text),
        [
            "Is a soft wash safe for shingles?",
            "Would polishing take those scratches out?",
            "Could those brown patches be grubs?",
            "Why is my shower pressure so low?",
            "Is that a repair or a replacement?",
            "Can I get a quote this week?",
        ],
    );
    assert.equal(SEARCHES_FIRST.length, 6);
    assert.equal(ASKED_FIRST.length, 3);
});

test("every search on the homepage is a real, sourced one, and no count is printed", () => {
    const sourced = new Set([
        ...HVAC_SEARCHES.map((s) => s.search),
        ...Object.values(TRADE_SEARCHES).flatMap((t) => t.searches.map((s) => s.search)),
    ]);
    for (const s of [...SEARCHES_FIRST, ...SEARCHES_NEXT]) assert.ok(sourced.has(s.text), `not from a sourced list: ${s.text}`);
    for (const t of Object.values(TRADE_SEARCHES)) assert.match(t.url, /^https:\/\//, t.source);
    // Counts are for the trade pages (Xander, 19 Nov 2026).
    assert.doesNotMatch(findOut, /perMonth|a month/);
});

test("3 · the website, in /hvac's six points, the brands line cut", () => {
    says(
        home,
        [
            "You answer a few questions. We write it, build it and host it. After that, there's nothing for you to do.",
            "Below is what your site could look like",
            "A form on the first screen",
            "Name and phone number, nothing else to fill in. On Growth, the receptionist calls them back within about a minute.",
            "Your number, everywhere",
            "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
            "Your services, page by page",
            "A service gets its own page when you've told us enough to fill one.",
            "The towns you work in",
            "Listed on the site, with a page for a town when there's something real to say about it.",
            "Proof that's yours",
            "Photos from your real jobs and your business, your reviews, your certifications. We don't write reviews, and a section with nothing real in it stays off your site.",
            "Your customers' questions",
            "Answered in your words, from what you tell us.",
            "Swipe · six in all",
            "A demo site, with sample details.",
            "Visit site",
            "Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that work on phones.",
        ],
        "the website section",
    );
    assert.doesNotMatch(home, /the brands you install/, "cut by Xander for the homepage");
    for (const img of ["site-form", "site-number", "site-services", "site-towns", "site-proof", "site-questions"])
        assert.ok(existsSync(fileURLToPath(new URL(`../public/home/${img}.webp`, import.meta.url))), img);
});

test("4 · the receptionist: named first, three example calls, the surprise-charges clause cut", () => {
    const text = prose(home);
    assert.ok(text.indexOf("The AI receptionist") < text.indexOf("Then someone"), "named before the page calls it 'it'");
    says(
        home,
        [
            "It asks the questions you'd ask, in English or in Spanish. It captures the lead's name, number and what the job is. Then the lead goes straight into your portal, and you get a text saying it's there.",
            "Example calls",
            "A roofing call",
            "What would it cost to replace the roof on a ranch house?",
            "I don't have pricing in front of me. The team will go over everything with you before any work starts.",
            "A lawn care call",
            "We're hosting on Saturday. Can you get someone out tomorrow?",
            "I don't have the schedule in front of me, but someone from the team will reach out shortly and get that locked in for you.",
            "Any call",
            "Wait, am I talking to a real person?",
            "I'm actually a virtual assistant. I work with the team to make sure your request gets to the right person fast.",
            "Caller asks",
            "Receptionist answers",
            'What counts as urgent depends on the trade. <Link href="/hvac">See how it handles an HVAC call.</Link>',
        ],
        "the receptionist",
    );
    assert.doesNotMatch(home, /surprise charges/, "cut by Xander");
});

test("5 · never / instead, word for word as /hvac", () => {
    says(
        home,
        [
            'never: "Quote a price", instead: "Tells the caller the team goes over the cost before any work starts."',
            'never: "Book a time or promise an arrival"',
            'instead: "Takes their details and says someone from the team will call to schedule. That holds in an emergency too."',
            'never: "Say it\'s a person", instead: "Says it\'s a virtual assistant, straight away, whenever it\'s asked."',
            'never: "Guess about your business"',
            'instead: "Says the team will follow up with the right answer, and passes the question to you."',
        ],
        "never / instead",
    );
});

test("6 · where the lead lands, and the text on 'Your phone' is the real one", () => {
    says(
        lands,
        [
            "Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.",
            "Your phone",
            "Example leads. Example text.",
            "Every plan gets the inbox. <strong>Starter + AI adds the pipeline. Growth adds the calendar, the texting and the reviews: the part a team would do.</strong>",
            "Wants a callback",
            "Web inquiry",
            "Needs you",
        ],
        "where the lead lands",
    );
    for (const t of ["HVAC", "Plumbing", "Roofing", "Lawn care", "Pressure washing", "Detailing"]) assert.ok(lands.includes(`label: "${t}"`), t);
    // The phone shows the first two lines of the real post-call text, so it can never read nicer.
    const real = callBriefBodyV2({ callerName: "Dave Kowalski", priority: "emergency" }, null).split("\n");
    assert.equal(real[0], "New call lead in your portal");
    assert.match(lands, /title: "New call lead in your portal", line: `Name: \$\{DEMO_LEAD\.name\}`/);
    assert.equal(real[1], "Name: Dave Kowalski");
    assert.match(lands, /TRADE_SAMPLES/, "the inbox's leads are the portal tour's sample leads");
});

test("7 · the calculator is 'the year', with today's sum and words", () => {
    says(
        calc,
        [
            "I miss <b>{missedPerWeek}</b> calls a week",
            "My average job is worth <b>{avgJobValueFormatted}</b>",
            "I win back <b>{currentRecovery}%</b> of those leads",
            "Calculate",
            "← Recalculate",
            "Every month adds another {formatDollars(revenueOnTable / 12)}.",
            "Lost to Missed Calls",
            "Won Back With a Receptionist",
            "per year",
            "of that comes back when every call gets answered. You don't work any harder, you just stop missing them.",
            "Nothing on the table at 100%. Almost nobody is at 100%.",
            'Link href="/contact">Get started →</Link>',
            "How we calculate this",
            "← Back to results",
            "Illustrative estimates only. Actual results vary by market, business model, and execution.",
        ],
        "the calculator",
    );
    for (const m of ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]) assert.ok(calc.includes(`"${m}"`), m);
});

test("9 · the close: four plans, on cream, with Get Started going to /contact", () => {
    // The three points are /pricing's (app/data/every-plan.ts, row F9), and none promises the phone:
    // the $97 Starter has no receptionist and no lead texts.
    assert.match(home, /import \{ EVERY_PLAN \} from "@\/app\/data\/every-plan"/);
    assert.match(home, /EVERY_PLAN\.map/);
    assert.doesNotMatch(home, /It rings you first|One inbox for every lead/);
    says(
        home,
        [
            "One system. One monthly bill.",
            // F10–F12 of the website-plan copy batch (Xander, 24 Nov 2026).
            "Your website, written, built and hosted for you, with every web inquiry in your portal. <strong>Starter catches every web lead.</strong>",
            "Starter + AI Receptionist",
            "Everything in Starter, plus the AI receptionist. When you can't pick up, it answers, 24/7, and puts the lead in your portal, where you track it from Lead to Won. <strong>Starter + AI Receptionist answers every missed call.</strong>",
            "Everything in Starter + AI Receptionist, then it goes to work. Web leads get a call back within about a minute, your calendar keeps every job booked, and you text customers and ask for reviews from your business number. <strong>Growth works them like a team would.</strong>",
            "Two or three sites, each with its own receptionist and phone number, all feeding one portal. One monthly bill.",
            "Get started.",
            "Contact us now.",
            "Need to hear it first?",
            "Call the demo.",
            '<Link href="/contact" className="btn primary lg"> Get Started </Link>',
            "View plans + pricing",
        ],
        "the close",
    );
    // Prices come from Schedule A, never typed in.
    assert.match(home, /WEBSITE_PLAN\.monthlyPrice/);
    assert.match(home, /SCHEDULES\.starter\.monthlyPrice/);
    assert.match(home, /SCHEDULES\.growth\.monthlyPrice/);
    assert.match(home, /SCHEDULES\.enterprise\.monthlyPrice/);
});

test("every Get Started on the site goes to /contact, and the drawer is gone", () => {
    assert.ok(!existsSync(fileURLToPath(new URL("../app/components/home/LeadPanel.tsx", import.meta.url))), "the drawer is back");
    const files = (dir) =>
        readdirSync(fileURLToPath(new URL(`../${dir}`, import.meta.url)), { withFileTypes: true }).flatMap((e) =>
            e.isDirectory() ? files(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
        );
    for (const f of files("app")) assert.doesNotMatch(read(f), /LeadPanel|onOpenForm/, f);
    assert.match(read("app/components/home/ClosingAsk.tsx"), /<Link href="\/contact"[^>]*>\s*Get Started\s*<\/Link>/);
    assert.match(read("app/components/hvac/HvacStart.tsx"), /<Link href="\/contact"[^>]*>\s*Get started\s*<\/Link>/);
});

test("no state is named on the homepage (Xander, 19 Nov 2026)", () => {
    for (const src of [home, loop, findOut, lands, calc, hero, read("app/data/home-find-out.ts")])
        assert.doesNotMatch(src, /Florida|Georgia|Alabama/);
});

test("the homepage styles: centred heads, coral closes, and what a phone leaves out", () => {
    assert.match(css, /\.home-em \{[^}]*color: var\(--accent-2\);[^}]*white-space: nowrap;/);
    assert.match(css, /\.home-head \{[^}]*text-align: center;/);
    assert.match(css, /@media \(max-width: 800px\) \{[\s\S]*?\.hp-m-cut \{ display: none; \}/);
    // Everything that moves is behind reduced motion.
    for (const anim of ["hp-speak", "hp-lamp", "hp-buzz", "hp-ring", "hp-pulse", "hp-arrive", "hp-loop-lit", "hp-loop-bob"])
        assert.match(css, new RegExp(`prefers-reduced-motion: no-preference\\) \\{[^@]*animation: ${anim}`), anim);
});
