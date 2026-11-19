import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import PlumbingIcon, { PlayIcon, Voice } from "@/app/components/plumbing/PlumbingIcon";
import PlumbingWorkOrder from "@/app/components/plumbing/PlumbingWorkOrder";
import { PLUMBING_SEARCHES, PLUMBING_SEARCH_SOURCE } from "@/app/data/plumbing-searches";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { PLUMBING_DESCRIPTION, PLUMBING_TITLE, pageMetadata, plumbingJsonLd } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/plumbing", PLUMBING_TITLE, PLUMBING_DESCRIPTION);

/**
 * /plumbing — "Websites and an AI receptionist for plumbers."
 *
 * The second trade page. Every word was approved by Xander on 19 Nov 2026, from the third round
 * of a mockup (https://claude.ai/artifact/X1xhXjsibSdGYPjqubWoUV), with the instruction that the
 * build match that mockup exactly, desktop and phone. Nothing here may be reworded or restyled
 * without a fresh approval; `test/plumbing-page.test.mjs` pins the sentences.
 *
 * NOT A COPY OF /hvac. Xander's direction was that the HVAC page sets the bar for the KIND of
 * device each section uses, and that every device here be its own variation. So: a phone taking
 * three calls (not three ringing rows), one call down a central timeline with timestamps (not a
 * zigzag of exchanges), emergencies set as big type (not an icon grid), the portal inbox as the
 * phone row (not the desktop row), a 2×2 rules grid (not a two-column ledger), six slices of the
 * real design (not one scrolling frame), a search box with suggestions and a call log (not pills
 * and quotes), and a work-order docket (not an equation). Google treats six near-identical trade
 * pages as doorway pages, so the content differs as much as the furniture.
 *
 * NOTHING INVENTED. No plumbing client exists yet, so there is no plumbing receptionist script to
 * quote: the three receptionist lines are the standard ones every client's script is written from
 * (it can't transfer, it won't quote, it confirms the service area), two of them in Xander's own
 * wording. The urgent list is the plumbing site design's own emergency words. The caller's lines,
 * the two inbox leads and their summaries are examples. The searches are real and sourced
 * (`app/data/plumbing-searches.ts`). No region is named: that is settled site-wide.
 *
 * Styles are `.plumb-*` at the end of globals.css. `.plumb-m-cut` marks what a phone leaves out.
 * The closing pair is the shared `PageAsk`, the same component /hvac, /about and /faq close on.
 */

/** The hero's phone: three calls the plumber can't take, each answered. */
const CALLS: { where: string }[] = [
    { where: "Under a sink" },
    { where: "On a job across town" },
    { where: "Sunday night" },
];

/**
 * One call, down the timeline. The receptionist's three answers are the standard script's: it
 * can't transfer, it won't price the job, and it confirms the area. The second and third are
 * Xander's own wording (19 Nov 2026). The caller's lines are an example written so the answers
 * have something to answer.
 */
const CALL_TURNS: { at: string; who: "caller" | "rec"; said: string }[] = [
    { at: "0:04", who: "caller", said: "Water's coming through the kitchen ceiling. Can I talk to a plumber right now?" },
    {
        at: "0:09",
        who: "rec",
        said: "I can't transfer directly from here, but if I grab your details right now, someone from the team will get back to you as fast as possible.",
    },
    { at: "0:51", who: "caller", said: "Roughly what does it cost to fix a burst pipe?" },
    {
        at: "0:55",
        who: "rec",
        said: "We're not able to discuss pricing until we know exactly what the job entails. Usually we'll come out and make an estimate while on site.",
    },
    { at: "1:20", who: "caller", said: "We're out past the county line. Do you come out this far?" },
    {
        at: "1:24",
        who: "rec",
        said: "Yes, we will be able to get out to you, and when a team member calls back, they'll confirm the details with you.",
    },
];

/**
 * What a plumber's receptionist treats as urgent. From the plumbing site design's own words: its
 * emergency service covers "burst pipes, sewer backups, and flooding", and its FAQ names no hot
 * water as a true emergency. Each real client's list is written when their script is set up.
 */
const EMERGENCIES: { what: string; aside: string }[] = [
    { what: "Burst pipes", aside: "Water where it shouldn't be" },
    { what: "Sewer backups", aside: "Coming up, not going down" },
    { what: "Flooding", aside: "On the floor, through the ceiling" },
    { what: "No hot water", aside: "The heater's out" },
];

/** The receptionist's four hard rules, each beside what it does in their place. */
const RULES: { never: string; instead: string }[] = [
    { never: "Quote a price", instead: "Tells the caller the team goes over the cost before any work starts." },
    {
        never: "Book a time or promise an arrival",
        instead: "Takes their details and says someone from the team will call to schedule. That holds in an emergency too.",
    },
    { never: "Say it's a person", instead: "Says it's a virtual assistant, straight away, whenever it's asked." },
    {
        never: "Guess about your business",
        instead: "Says the team will follow up with the right answer, and passes the question to you.",
    },
];

/**
 * Six points, each with its own picture of that part of the plumbing design.
 *
 * `shot` is the class that scrolls `public/plumbing-site.webp` (the approved plumbing design,
 * captured whole at 1280×5390) to that section. Xander's round-3 note was that a point with no
 * section of its own has no business here, so each of these is a real part of the page.
 */
const SLICES: { alt: string; heading: string; body: string }[] = [
    {
        alt: "The top of the plumbing design: the headline on the left and the callback form beside it",
        heading: "A callback form up top",
        body: "Name and phone number on the first screen, beside your number. On Growth, the receptionist calls them back within about a minute.",
    },
    {
        alt: "The services section of the plumbing design: six service cards",
        heading: "Six services, from leaks to remodels",
        body: "Leaks, drains, water heaters, pipe installation, emergencies and remodels. A service gets its own page when you've told us enough to fill one.",
    },
    {
        alt: "The coverage section of the plumbing design: answered every hour, and the towns served",
        heading: "Your towns, one by one",
        body: "So people can see you come to them, with a page for a town when there's something real to say about it.",
    },
    {
        alt: "The reviews section of the plumbing design",
        heading: "Proof that's yours",
        body: "Your reviews and your licence. We don't write reviews, and a section with nothing real in it stays off your site.",
    },
    {
        alt: "The questions section of the plumbing design",
        heading: "Your customers' questions",
        body: "Answered in your words, from what you tell us.",
    },
    {
        alt: "The bottom of the plumbing design: a second callback form",
        heading: "A second form at the bottom",
        body: "The callback form again, with your number, for anyone who reads all the way down.",
    },
];

/** What callers ask, taken from the plumbing site design's own FAQ. */
const ASKED = [
    "Can you really come the same day?",
    "Do you charge extra for emergency calls?",
    "Can you find the leak without tearing up the walls?",
];

export default function PlumbingPage() {
    return (
        <main className="plumb-page">
            <JsonLd data={plumbingJsonLd()} />

            {/* 1 · Hero: the claim left, a phone taking calls the plumber can't, right. */}
            <div className="plumb-shell plumb-shell-hero">
                <div className="plumb-hero">
                    <div className="plumb-hero-copy">
                        <p className="kicker">For plumbing companies</p>
                        <h1 className="plumb-h1">
                            Websites and an AI receptionist for <span className="plumb-coral">plumbers.</span>
                        </h1>
                        <p className="plumb-intro">
                            We write, build and host your plumbing website. Then every call you can&apos;t take gets
                            answered.
                        </p>
                        <p className="plumb-lede plumb-hero-lede plumb-m-cut">
                            Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in
                            Spanish. It finds out what&apos;s leaking, how bad it is and where, and puts the lead
                            straight into your portal.
                        </p>
                        {/* Every Get started on the site goes to /contact (Xander, 19 Nov 2026). */}
                        <div className="plumb-acts">
                            <Link href="/contact" className="btn primary lg">
                                Get started
                            </Link>
                            <Link href="/pricing" className="btn ghost lg">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>

                    <div className="plumb-handsfull">
                        <h2 className="plumb-handsfull-h">
                            While your hands <span className="plumb-coral">are full.</span>
                        </h2>
                        {/* The three calls ring and get answered in turn, on a 9s loop; at rest they are
                            answered, so a still frame reads correctly. */}
                        <div
                            className="plumb-phone"
                            role="img"
                            aria-label="A phone taking three calls the plumber can't answer, each one answered by the AI receptionist"
                        >
                            <div className="plumb-screen">
                                <p className="plumb-clock">9:41</p>
                                <p className="plumb-date">Sunday</p>
                                {CALLS.map((call) => (
                                    <div key={call.where} className="plumb-call-group">
                                        <p className="plumb-where">{call.where}</p>
                                        <div className="plumb-call">
                                            <span className="plumb-badge">
                                                <PlumbingIcon name="phone" />
                                            </span>
                                            <p className="plumb-call-top">
                                                Incoming call <span>now</span>
                                            </p>
                                            <p className="plumb-state">
                                                <span className="plumb-ringing">Ringing&hellip;</span>
                                                <span className="plumb-answered">
                                                    <Voice live />
                                                    Answered by your receptionist
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="plumb-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on a plumbing call, then where the lead lands. */}
            <section className="wash">
                <div className="plumb-shell">
                    <div className="plumb-split-head">
                        <div>
                            <p className="plumb-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="plumb-h2">
                                On a plumbing call, it hears the <span className="plumb-coral">emergency.</span>
                            </h2>
                        </div>
                        <p className="plumb-lede">
                            Your AI receptionist is set up for your plumbing business before it takes a single call. It
                            lets the caller explain, then asks one question at a time: what&apos;s wrong, how soon, and
                            where.
                        </p>
                    </div>

                    <div className="plumb-callbar">
                        <span className="plumb-callbar-dot" aria-hidden="true" />
                        Example call &middot; in progress
                        <Voice bars={7} live />
                    </div>

                    <div className="plumb-spine">
                        {CALL_TURNS.map((turn) => (
                            <div key={turn.at} className={`plumb-turn plumb-turn-${turn.who}`}>
                                <span className="plumb-t">{turn.at}</span>
                                <div className="plumb-say">
                                    <p className="plumb-who">
                                        {turn.who === "rec" && <Voice live />}
                                        {turn.who === "rec" ? "Receptionist" : "Caller"}
                                    </p>
                                    <blockquote>&ldquo;{turn.said}&rdquo;</blockquote>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* The call visibly ends and hands off, so "where it lands" has an antecedent. */}
                    <div className="plumb-ended">
                        <span className="plumb-end-pill">Call ended &middot; 1:52</span>
                        <span className="plumb-end-line" aria-hidden="true" />
                        <PlumbingIcon name="arrowDown" className="plumb-end-arrow" />
                    </div>

                    <div className="plumb-lands">
                        <div>
                            <h3 className="plumb-lands-h">
                                The call ends. The lead lands <span className="plumb-coral">in your portal.</span>
                            </h3>
                            <p className="plumb-lands-sub">
                                And you get a text saying it&apos;s there. This is that call, in the portal on your
                                phone.
                            </p>
                        </div>
                        {/* The portal inbox's phone row (portal/inbox/InboxList.tsx), in the portal's
                            own colours and face. Both leads are examples. */}
                        <div
                            className="plumb-mini-phone"
                            role="img"
                            aria-label="Example: the lead from this call in the portal inbox on a phone"
                        >
                            <div className="plumb-mini-screen">
                                <div className="plumb-mini-top">
                                    <b>Inbox</b>
                                    <span>Needs you</span>
                                </div>
                                <div className="plumb-mini-day">TODAY</div>
                                <div className="plumb-mrow">
                                    <span className="plumb-mrow-dot" />
                                    <div>
                                        <div className="plumb-mrow-r1">
                                            <strong>Marcus Bell</strong>
                                            <span className="plumb-mrow-time">11:58 PM</span>
                                        </div>
                                        <span className="plumb-mrow-chip">Wants a callback</span>
                                        <p className="plumb-mrow-pv">
                                            Water through the kitchen ceiling. Asked about cost. Lives past the county
                                            line.
                                        </p>
                                    </div>
                                </div>
                                <div className="plumb-mrow plumb-mrow-dim">
                                    <span className="plumb-mrow-dot" />
                                    <div>
                                        <div className="plumb-mrow-r1">
                                            <strong>Rita Gomez</strong>
                                            <span className="plumb-mrow-time">4:12 PM</span>
                                        </div>
                                        <p className="plumb-mrow-pv">Slow drain in the upstairs bath.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="plumb-urgent">
                        <div>
                            <h3 className="plumb-urgent-h">
                                What it treats as <span className="plumb-coral">urgent.</span>
                            </h3>
                            <p className="plumb-urgent-sub">
                                Set at setup from your trade and your services. For a plumber, it starts from these.
                            </p>
                        </div>
                        <ul className="plumb-em">
                            {EMERGENCIES.map((e) => (
                                <li key={e.what}>
                                    <PlumbingIcon name="drop" className="plumb-em-drop" />
                                    <b>{e.what}</b>
                                    <span>{e.aside}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="plumb-rules">
                        <h3 className="plumb-rules-h">
                            Four things it won&apos;t do, <span className="plumb-coral">and what it does instead.</span>
                        </h3>
                        <div className="plumb-rgrid">
                            {RULES.map((rule) => (
                                <div key={rule.never} className="plumb-rcell">
                                    <p className="plumb-rno">
                                        <span className="plumb-x">&#10005;</span>It won&apos;t
                                    </p>
                                    <h3>{rule.never}</h3>
                                    <p className="plumb-instead">
                                        <span className="plumb-ok">&#10003;</span>
                                        <span>
                                            <span className="plumb-instead-lbl">Instead</span>
                                            {rule.instead}
                                        </span>
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* 3 · The plumbing website: six slices of the real design, a point under each. */}
            <section>
                <div className="plumb-shell">
                    <div className="plumb-split-head">
                        <h2 className="plumb-h2">
                            What&apos;s on your <span className="plumb-coral">plumbing website.</span>
                        </h2>
                        <p className="plumb-lede">
                            You answer a few questions. We write it, build it and host it. This is the plumbing design,
                            top to bottom. Yours carries your name, your colours, your photos, your services and your
                            towns.
                        </p>
                    </div>
                    <div className="plumb-slices">
                        {SLICES.map((slice, i) => (
                            <div key={slice.heading} className="plumb-slice">
                                {/* One capture of the whole design, scrolled to a different section per
                                    slice by `background-position` — the mockup's own mechanism, so the
                                    six crops land exactly where they were approved. */}
                                <div className="plumb-shot" role="img" aria-label={slice.alt} />
                                <div className="plumb-pt">
                                    <span className="plumb-n" aria-hidden="true">
                                        {String(i + 1).padStart(2, "0")}
                                    </span>
                                    <h3>{slice.heading}</h3>
                                    <p>{slice.body}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="plumb-shotcap">
                        <span className="plumb-eg">The plumbing design, with a sample business and sample details.</span>
                        <span className="plumb-eg">Under all of it: titles, a sitemap, structured data, fast pages.</span>
                    </div>
                </div>
            </section>

            {/* 4 · What they search, beside what they ask on the phone. */}
            <section className="wash">
                <div className="plumb-shell">
                    <div className="plumb-centre plumb-find">
                        <h2 className="plumb-h2">
                            What your customers are trying to <span className="plumb-coral">find out.</span>
                        </h2>
                        <p className="plumb-lede">
                            Nobody with water on the floor is browsing. They search, they call, and they hire whoever
                            answers.
                        </p>
                    </div>

                    <div className="plumb-qa">
                        <div>
                            <h3 className="plumb-qa-h">
                                <PlumbingIcon name="search" />
                                What they search
                            </h3>
                            <div
                                className="plumb-gbox"
                                role="img"
                                aria-label="A search box with plumbing searches suggested, and how many times a month each is searched"
                            >
                                <div className="plumb-gq">
                                    <PlumbingIcon name="search" />
                                    plumb
                                    <span className="plumb-caret" aria-hidden="true" />
                                </div>
                                <ul className="plumb-gsug">
                                    {PLUMBING_SEARCHES.map((s, i) => (
                                        <li key={s.typed + s.rest} className={i === 3 ? "plumb-m-cut" : undefined}>
                                            <PlumbingIcon name="search" />
                                            <span className="plumb-gsug-q">
                                                {s.typed}
                                                <b>{s.rest}</b>
                                            </span>
                                            <span className="plumb-gsug-n">{s.perMonth} a month</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                            <p className="plumb-eg plumb-src">{PLUMBING_SEARCH_SOURCE}</p>
                            <div className="plumb-answers">
                                <p className="plumb-answers-lead">Your site is built to be found for searches like these.</p>
                                <p className="plumb-m-cut">
                                    Your services and your towns get their own pages, written from what you tell us.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="plumb-qa-h">
                                <Voice live />
                                What they ask on calls
                            </h3>
                            <ul className="plumb-calllog">
                                {ASKED.map((q) => (
                                    <li key={q}>
                                        <span className="plumb-play" aria-hidden="true">
                                            <PlayIcon />
                                        </span>
                                        <p className="plumb-meta">
                                            <Voice />
                                            Asked on a call
                                        </p>
                                        <q>{q}</q>
                                    </li>
                                ))}
                            </ul>
                            <div className="plumb-answers">
                                <p className="plumb-answers-lead">
                                    Your receptionist answers the questions you&apos;d normally answer yourself.
                                </p>
                                <p className="plumb-m-cut">
                                    Then it takes their details and leaves the job and the price to you.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, as a work order. */}
            <section>
                <div className="plumb-shell">
                    <div className="plumb-centre">
                        <h2 className="plumb-h2">
                            A burst pipe won&apos;t wait <span className="plumb-coral">for a callback.</span>
                        </h2>
                        <p className="plumb-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on
                            the list. With water on the floor, they won&apos;t wait for you to call back.
                        </p>
                    </div>
                    <PlumbingWorkOrder />
                    <p className="plumb-eg plumb-wo-src">
                        Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is our own
                        estimate: half.
                    </p>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="plumb-shell plumb-close">
                    <div className="plumb-centre">
                        <h2 className="plumb-h2 plumb-close-h">
                            Call it. <span className="plumb-coral">See who picks up.</span>
                        </h2>
                        <p className="plumb-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="plumb-ask" />
                </div>
            </section>
        </main>
    );
}
