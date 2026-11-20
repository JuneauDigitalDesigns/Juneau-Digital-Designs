import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import LawnIcon, { Voice } from "@/app/components/lawn-care/LawnIcon";
import LawnRoute from "@/app/components/lawn-care/LawnRoute";
import LawnSeason from "@/app/components/lawn-care/LawnSeason";
import LawnSigns from "@/app/components/lawn-care/LawnSigns";
import LawnTour from "@/app/components/lawn-care/LawnTour";
import { LAWN_SEARCHES, LAWN_SEARCH_SOURCE } from "@/app/data/lawn-searches";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { LAWN_CARE_DESCRIPTION, LAWN_CARE_TITLE, lawnCareJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/lawn-care", LAWN_CARE_TITLE, LAWN_CARE_DESCRIPTION);

/**
 * /lawn-care — "Websites and an AI receptionist for lawn care."
 *
 * The third trade page. Every word was approved by Xander on 19 Nov 2026, over eight rounds of a
 * mockup (https://claude.ai/artifact/1qwJGQuyTGL13qfjLvUPXA), with the instruction that the build
 * match that mockup exactly, desktop and phone. Nothing here may be reworded or restyled without a
 * fresh approval; `test/lawn-care-page.test.mjs` pins the sentences.
 *
 * NOT A COPY OF /hvac OR /plumbing. Google treats near-identical trade pages as doorway pages, so
 * the content differs as much as the furniture, and three things about lawn care drive it:
 *
 *   1. There is no emergency. Nobody calls a lawn company with water on the floor, so where
 *      /plumbing has "what it treats as urgent", this page has "three things it leaves to you".
 *   2. A customer is a season, not a job. Whoever answers gets every visit after that, which is
 *      what the sum counts and what the lawn in it draws.
 *   3. The owner is on a mower and cannot hear the phone, which is the hero.
 *
 * So: a mowing route with the calls that landed during it (not three ringing rows, not a phone of
 * calls); the call written down field by field beside the lead it fills (not a zigzag, not a
 * centre-spine timeline); one picture of the design that moves as you pick a part (not a scrolling
 * frame, not six crops); searches as mowing passes drawn to scale (not pills, not a search box);
 * questions on yard signs standing in grass; and the sum as a lawn, mown.
 *
 * NOTHING INVENTED. No lawn care client exists yet, so there is no lawn care receptionist script
 * to quote: the call is the standard script's answers, with the pricing answer adapted from the
 * wording Xander wrote for /plumbing. The caller, the inbox rows and the streets are examples; the
 * yard-size and grubs questions come from the lawn care sample lead in the portal tour. The
 * searches are real and sourced (`app/data/lawn-searches.ts`, read from the site's one keyword
 * list). The page covers lawn care only, not landscaping. No region is named: that is settled
 * site-wide.
 *
 * Styles are `.lawn-*` at the end of globals.css. `.lawn-m-cut` marks what a phone leaves out.
 * The closing pair is the shared `PageAsk`, as /hvac, /plumbing, /about and /faq close on.
 */

/** The call, turn by turn, and what the receptionist writes on the lead as it goes. */
const CALL = [
    {
        turns: [
            { who: "rec" as const, at: "0:03", says: "Thanks for calling. How can I help?" },
            { who: "caller" as const, at: "0:08", says: "I need someone to mow every week. The last company stopped showing up." },
        ],
        field: { label: "Wants", value: "Weekly mowing" },
    },
    {
        turns: [
            { who: "rec" as const, at: "0:24", says: "Roughly how big is the yard, front and back?" },
            { who: "caller" as const, at: "0:29", says: "About a quarter acre." },
        ],
        field: { label: "Yard", value: "Quarter acre, front and back" },
    },
    {
        turns: [
            { who: "caller" as const, at: "0:41", says: "What would that run me a visit?" },
            {
                who: "rec" as const,
                at: "0:45",
                says: "We're not able to give a price until we've seen the yard. Someone from the team will call you back with a quote.",
            },
        ],
        // The one field the receptionist deliberately leaves blank: the price is the owner's.
        field: { label: "Price", value: "Yours to quote", yours: true },
    },
    {
        turns: [
            { who: "rec" as const, at: "1:08", says: "Can I get your name, your address and the best number to reach you?" },
            { who: "caller" as const, at: "1:14", says: "Erin Castillo, 2210 Wren Hollow Road. Call me on this number." },
        ],
        field: { label: "Who and where", value: "Erin Castillo · 2210 Wren Hollow Rd" },
        /* Phones stop after the price: the point is made, and the name and address are the one
           exchange a reader can guess. */
        phoneCut: true,
    },
];

/** What the receptionist will not do, and what it does instead. No emergency list: lawn care has none. */
const LEAVES = [
    { head: "The price", copy: "It never quotes. It tells the caller the team will call back with one." },
    {
        head: "The schedule",
        copy: "It never books a time or promises a day. It takes their details and says someone from the team will call to schedule.",
    },
    {
        head: "Anything it isn't sure of",
        copy: "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
    },
];

/** The portal inbox, with the call above as its newest row. The older two are the portal tour's samples. */
const INBOX = [
    {
        day: "TODAY",
        name: "Erin Castillo",
        chip: "Wants a callback",
        at: "10:49 AM",
        preview: "Wants weekly mowing. About a quarter acre, front and back, at 2210 Wren Hollow Rd. Asked what it costs a visit.",
        from: "Call",
    },
    {
        day: "YESTERDAY",
        name: "Carol Ostrander",
        at: "4:12 PM",
        preview: "We'd like a quote on spring cleanup and fresh mulch for a corner lot. Mornings are best.",
        from: "Web form",
        read: true,
    },
    {
        name: "Tammy Reynolds",
        at: "9:20 AM",
        preview: "Brown patches spreading across the front lawn. Asked if it's grubs.",
        from: "Call",
        read: true,
        phoneCut: true,
    },
];

export default function LawnCarePage() {
    return (
        <main className="lawn-page">
            <JsonLd data={lawnCareJsonLd()} />

            {/* 1 · Hero: the claim left, a morning's mowing route with its calls, right. */}
            <div className="lawn-shell lawn-shell-hero">
                <div className="lawn-hero">
                    <div className="lawn-hero-copy">
                        <p className="kicker">For lawn care companies</p>
                        <h1 className="lawn-h1">
                            Websites and an AI receptionist for <span className="lawn-coral">lawn care.</span>
                        </h1>
                        <p className="lawn-intro">
                            We write, build and host your lawn care website. Then every call you can&apos;t take gets
                            answered.
                        </p>
                        <p className="lawn-lede lawn-m-cut">
                            Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in
                            Spanish. It finds out what they want done, how big the yard is and where, and puts the lead
                            straight into your portal.
                        </p>
                        <div className="lawn-acts">
                            <Link href="/contact" className="btn primary lg">
                                Get started
                            </Link>
                            <Link href="/pricing" className="btn ghost lg">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>
                    <div className="lawn-onroute">
                        <h2 className="lawn-onroute-h">
                            While the mower&apos;s <span className="lawn-coral">running.</span>
                        </h2>
                        <LawnRoute />
                        <p className="lawn-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on a lawn call, then where the lead lands. */}
            <section className="wash">
                <div className="lawn-shell">
                    <div className="lawn-split-head">
                        <div>
                            <p className="lawn-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="lawn-h2">
                                On a lawn call, it asks what <span className="lawn-coral">you&apos;d ask.</span>
                            </h2>
                        </div>
                        <p className="lawn-lede">
                            Your AI receptionist is set up for your lawn care business before it takes a single call. It
                            lets the caller explain, then asks one question at a time: what they want done, how big the
                            yard is, and where.
                        </p>
                    </div>

                    {/* Heard on the left, written down on the right, joined row by row. On a phone each
                        exchange and its field become one card. */}
                    <div className="lawn-hw">
                        <div className="lawn-talk lawn-talk-head">
                            <span className="lawn-bar">
                                <span className="lawn-bar-dot" aria-hidden="true" />
                                Example call &middot; in progress
                            </span>
                            <Voice bars={7} live />
                        </div>
                        <div className="lawn-arrow lawn-arrow-head" aria-hidden="true" />
                        <div className="lawn-field lawn-field-head">
                            <b>New lead</b>
                            <span className="lawn-eg">Written down as they talk</span>
                        </div>

                        {CALL.map(({ turns, field, phoneCut }, i) => {
                            const last = i === CALL.length - 1;
                            const cut = phoneCut ? " lawn-m-cut" : "";
                            return (
                                <Fragment key={field.label}>
                                    <div className={`lawn-talk${last ? " lawn-talk-last" : ""}${cut}`}>
                                        {turns.map((t) => (
                                            <div className={`lawn-turn lawn-turn-${t.who}`} key={t.at}>
                                                <span className="lawn-av" aria-hidden="true">
                                                    {t.who === "rec" ? <Voice live /> : <LawnIcon name="phone" />}
                                                </span>
                                                <p className="lawn-who">
                                                    <span>{t.who === "rec" ? "Receptionist" : "Caller"}</span>
                                                    <time>{t.at}</time>
                                                </p>
                                                <p className="lawn-says">&ldquo;{t.says}&rdquo;</p>
                                            </div>
                                        ))}
                                    </div>
                                    <div className={`lawn-arrow${cut}`} aria-hidden="true">
                                        <span className="lawn-go">
                                            <LawnIcon name="arrowRight" />
                                        </span>
                                    </div>
                                    <div
                                        className={`lawn-field${last ? " lawn-field-last" : ""}${"yours" in field && field.yours ? " lawn-field-yours" : ""}${cut}`}
                                    >
                                        <span className="lawn-field-lbl">{field.label}</span>
                                        <span className="lawn-field-val">
                                            {"yours" in field && field.yours ? <span>{field.value}</span> : field.value}
                                        </span>
                                    </div>
                                </Fragment>
                            );
                        })}
                    </div>

                    <div className="lawn-ended">
                        <span className="lawn-end-pill">Call ended &middot; 1:38</span>
                        <span className="lawn-end-line" aria-hidden="true" />
                        <LawnIcon name="arrowDown" className="lawn-end-arrow" />
                    </div>

                    <div className="lawn-lands">
                        <div>
                            <h3 className="lawn-lands-h">
                                The call ends. The lead lands <span className="lawn-coral">in your portal.</span>
                            </h3>
                            <p className="lawn-lands-sub">This is that call, in your portal inbox.</p>
                        </div>
                        {/* The portal inbox's own rows: unread dot, name, status, time, the summary, the source. */}
                        <div
                            className="lawn-inbox"
                            role="img"
                            aria-label="Example: the portal inbox, with the lead from this call as the newest row"
                        >
                            <div className="lawn-inbox-top">
                                <b>Inbox</b>
                                <span>Needs you</span>
                            </div>
                            {INBOX.map((row) => (
                                <Fragment key={row.name}>
                                    {row.day ? <div className="lawn-inbox-day">{row.day}</div> : null}
                                    <div className={`lawn-irow${row.read ? " is-read" : ""}${row.phoneCut ? " lawn-m-cut" : ""}`}>
                                        <span className="lawn-irow-dot" />
                                        <div>
                                            <div className="lawn-irow-r1">
                                                <strong>{row.name}</strong>
                                                {row.chip ? <span className="lawn-irow-chip">{row.chip}</span> : null}
                                                <time>{row.at}</time>
                                            </div>
                                            <p className="lawn-irow-pv">{row.preview}</p>
                                            <span className="lawn-irow-mini">{row.from}</span>
                                        </div>
                                    </div>
                                </Fragment>
                            ))}
                        </div>
                        <p className="lawn-under-line">Then you get a text saying it&apos;s there.</p>
                    </div>

                    <div className="lawn-left">
                        <h3 className="lawn-left-h">
                            Three things it leaves <span className="lawn-coral">to you.</span>
                        </h3>
                        <div className="lawn-left-grid">
                            {LEAVES.map((l) => (
                                <div key={l.head}>
                                    <h4>{l.head}</h4>
                                    <p>{l.copy}</p>
                                </div>
                            ))}
                        </div>
                        <p className="lawn-left-foot">And whenever it&apos;s asked, it says it&apos;s a virtual assistant.</p>
                    </div>
                </div>
            </section>

            {/* 3 · The lawn care website: one picture of the real design, four points under it. */}
            <section>
                <div className="lawn-shell">
                    <div className="lawn-split-head">
                        <h2 className="lawn-h2">
                            What&apos;s on your <span className="lawn-coral">lawn care website.</span>
                        </h2>
                        <p className="lawn-lede">
                            You answer a few questions. We write it, build it and host it. This is the lawn care design.
                            Yours carries your name, your colours, your photos, your services and your neighbourhoods.
                        </p>
                    </div>
                    <LawnTour />
                    <div className="lawn-shotcap">
                        <span className="lawn-eg">The lawn care design, with a sample business and sample details.</span>
                        <span className="lawn-eg lawn-m-cut">
                            Under all of it: titles, a sitemap, structured data, fast pages.
                        </span>
                    </div>
                </div>
            </section>

            {/* 4 · What they search, beside what they ask on the phone. */}
            <section className="wash">
                <div className="lawn-shell">
                    <div className="lawn-centre lawn-find">
                        <h2 className="lawn-h2">
                            What your customers are trying to <span className="lawn-coral">find out.</span>
                        </h2>
                        <p className="lawn-lede">
                            The grass keeps growing while they look. They search, they call, and they hire whoever
                            answers.
                        </p>
                    </div>
                    <div className="lawn-qa">
                        <div>
                            <h3 className="lawn-qa-h">
                                <LawnIcon name="search" />
                                What they search
                            </h3>
                            {/* Each bar is drawn against the most-searched of the four, which is why the
                                last two are short. The figures are the source's own. */}
                            <ul
                                className="lawn-passes"
                                aria-label="Four lawn care searches and how many times a month each is searched, drawn to scale"
                            >
                                {LAWN_SEARCHES.map((s, i) => (
                                    <li key={s.search} className={i === 3 ? "lawn-m-cut" : undefined}>
                                        <p className="lawn-pass-row">
                                            <span className="lawn-pass-q">{s.search}</span>
                                            <span className="lawn-pass-n">{s.perMonth} a month</span>
                                        </p>
                                        <div className="lawn-pass" style={{ width: s.share }} aria-hidden="true" />
                                    </li>
                                ))}
                            </ul>
                            <p className="lawn-eg lawn-src">{LAWN_SEARCH_SOURCE}</p>
                            <div className="lawn-answers">
                                <p className="lawn-answers-lead">Your site is built to be found for searches like these.</p>
                                <p className="lawn-m-cut">
                                    Your services and your towns get their own pages, written from what you tell us.
                                </p>
                            </div>
                        </div>

                        <div>
                            <h3 className="lawn-qa-h">
                                <Voice live />
                                What they ask on calls
                            </h3>
                            <LawnSigns />
                            <div className="lawn-answers">
                                <p className="lawn-answers-lead">
                                    Your receptionist answers the questions you&apos;d normally answer yourself.
                                </p>
                                <p className="lawn-m-cut">
                                    Then it takes their details and leaves the job and the price to you.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, as a season, drawn as a lawn. */}
            <section>
                <div className="lawn-shell">
                    <div className="lawn-centre">
                        <h2 className="lawn-h2 lawn-season-h">
                            A missed call is a <span className="lawn-coral">whole season.</span>
                        </h2>
                        <p className="lawn-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on
                            the list. In lawn care, whoever answers gets every visit after that.
                        </p>
                    </div>
                    <LawnSeason />
                    <p className="lawn-eg lawn-sum-src">
                        Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo;
                        is our own estimate: half.
                    </p>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="lawn-shell lawn-close">
                    <div className="lawn-centre">
                        <h2 className="lawn-h2 lawn-close-h">
                            Call it. <span className="lawn-coral">See who picks up.</span>
                        </h2>
                        <p className="lawn-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="lawn-ask" />
                </div>
            </section>
        </main>
    );
}
