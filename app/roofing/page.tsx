import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import RfIcon, { Voice } from "@/app/components/roofing/RfIcon";
import RfRoof from "@/app/components/roofing/RfRoof";
import RfOnView from "@/app/components/roofing/RfOnView";
import RfPhone from "@/app/components/roofing/RfPhone";
import RfRoofs from "@/app/components/roofing/RfRoofs";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { ROOFING_DESCRIPTION, ROOFING_TITLE, pageMetadata, roofingJsonLd } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/roofing", ROOFING_TITLE, ROOFING_DESCRIPTION);

/**
 * /roofing — "Websites and an AI receptionist for roofers."
 *
 * The sixth trade page. Every word was approved by Xander on 25 Nov 2026, over two rounds of a
 * mockup (https://claude.ai/artifact/BepUyeZ3FWUaXoAPR2LrKK), with the instruction that the build
 * match that mockup exactly, desktop and phone. Nothing here may be reworded or restyled without a
 * fresh approval; `test/roofing-page.test.mjs` pins the sentences.
 *
 * NOT A COPY OF THE OTHER FIVE TRADE PAGES. Google treats near-identical trade pages as doorway
 * pages, so the content and the devices differ from HVAC, plumbing, lawn care, detailing and
 * pressure washing as much as the trade does:
 *
 *   - The hero is a house roof shingled course by course, the nail gun working along each course,
 *     with the call that comes in mid-job. The gun is carried down the ladder and set down.
 *   - The receptionist's call is a triage fork: after a storm the question that matters is whether
 *     water is coming in right now, and the call splits into an urgent lane and a routine one.
 *   - The three things it leaves to the owner are on asphalt shingle tabs, nailed in a course.
 *   - The website section shows a real example site (Your Roofing Co., built from the vertical
 *     template) as three phone screens.
 *   - The searches lead with the phrase itself, each with its monthly volume as a row of shingles;
 *     the questions are on plates hung on a ladder.
 *   - The sum is two roofs on one scale, shingled up to the money.
 *
 * NOTHING INVENTED. No roofing client exists, so the call is the roofing sample in the portal tour:
 * the leak, the bucket and "Is water still coming in right now?" are its, and it marks the lead
 * urgent. One change from it, approved: the receptionist says it has marked the call urgent instead
 * of promising a callback time. The search phrases and counts are one dated Marketkeep table. Your
 * Roofing Co. is our own example site, named on the page as an example, not a client. No region is
 * named in the page's own copy: that is settled site-wide.
 *
 * Styles are `.rf-*` at the end of globals.css. `.rf-m-cut` marks what a phone leaves out. The
 * closing pair is the shared `PageAsk`, as every other page closes on.
 */

/** The portal inbox, with the call above as its newest row. The older row is the portal tour's sample. */
const INBOX = [
    {
        day: "TODAY",
        name: "Dave Kowalski",
        chip: "Urgent",
        at: "6:48 AM",
        preview: "Water coming through the bedroom ceiling since last night's storm. Still leaking a little, with a bucket under it.",
    },
    {
        day: "YESTERDAY",
        name: "Jim Petrakis",
        count: "2",
        at: "4:12 PM",
        preview: "Wind took a few shingles off the back slope. Any day but Friday works.",
        read: true,
        cut: true,
    },
];

/** What the receptionist leaves to the owner, each on an asphalt shingle tab. */
const TABS = [
    { head: "The price", copy: "It never quotes. It tells the caller the team will call back with one." },
    {
        head: "The booking",
        copy: "It never books a time or promises a day. It takes their details, flags the urgent ones, and says someone from the team will call to schedule.",
    },
    {
        head: "Anything it isn't sure of",
        copy: "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
    },
];

/** The three example-site screens, taken from the live Your Roofing Co. template site. */
const PHONES = [
    {
        src: "/roofing-site-1.webp",
        alt: "The top of the example roofing site on a phone: the headline, a call button, a get-a-roof-estimate button, and the start of the estimate form",
        t: "The first screen",
        h: "Your number, then a form",
        p: "A tap-to-call button under the headline and a short estimate form right after it. Every request lands in your portal inbox.",
    },
    {
        src: "/roofing-site-2.webp",
        alt: "The services section of the example roofing site on a phone, starting with Roof Repair and Roof Replacement",
        t: "Services",
        h: "A page for each service",
        p: "Roof repair, replacement, storm and leak repair, inspections and gutters. A service gets its own page when you've told us enough to fill one.",
    },
    {
        src: "/roofing-site-3.webp",
        alt: "The questions section of the example roofing site on a phone",
        t: "Questions",
        h: "Your customers' questions",
        p: "Answered in your words, from what you tell us.",
    },
];

/** What people search, most-searched first: Marketkeep, SEO keywords for roofing companies, one
    table dated August 2026. Each is drawn as a row of shingles, one for every 10,000 a month. */
const SEARCHES = [
    { q: "roof company near me", n: 165000 },
    { q: "roof repair near me", n: 90500 },
    { q: "roof inspection", n: 40500 },
    { q: "roof leak repair", n: 33100 },
];
const PER_SHINGLE = 10000;

/** The shingles for a monthly count: whole ones, then the part one (if it shows at all). */
function shingles(n: number): { i: number; f?: number }[] {
    const units = n / PER_SHINGLE;
    const full = Math.floor(units);
    const frac = Number((units - full).toFixed(2));
    const out: { i: number; f?: number }[] = Array.from({ length: full }, (_, i) => ({ i }));
    if (frac >= 0.02) out.push({ i: full, f: frac });
    return out;
}

/** What they ask on calls, on plates hung on a ladder. The first is the portal sample's. */
const PLATES = [
    { q: "Is that a repair, or a whole new roof?" },
    { q: "Do you work with insurance claims?" },
    { q: "Can someone look at it before the next storm?", cut: true },
];

export default function RoofingPage() {
    return (
        <main className="rf-page">
            <JsonLd data={roofingJsonLd()} />

            {/* 1 · Hero: the claim left, a roof shingled course by course with the call that came mid-job, right. */}
            <div className="rf-shell rf-shell-hero">
                <div className="rf-hero">
                    <div className="rf-hero-copy">
                        <p className="kicker">For roofing companies</p>
                        <h1 className="rf-h1">
                            Websites and an AI receptionist for <span className="rf-coral">roofers.</span>
                        </h1>
                        <p className="rf-intro">
                            We write, build and host your roofing website. Then every call you can&apos;t take gets
                            answered.
                        </p>
                        <p className="rf-lede rf-m-cut">
                            Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in
                            Spanish. It finds out what&apos;s wrong with the roof, whether water&apos;s coming in and
                            where, and puts the lead straight into your portal.
                        </p>
                        {/* Every Get started on the site goes to /contact. */}
                        <div className="rf-acts">
                            <Link href="/contact" className="btn primary lg">
                                Get started
                            </Link>
                            <Link href="/pricing" className="btn ghost lg">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>
                    <div className="rf-onjob">
                        <h2 className="rf-onjob-h">
                            While you&apos;re up <span className="rf-coral">on the roof.</span>
                        </h2>
                        <RfRoof />
                        <p className="rf-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on a roofing call, then where the lead lands. */}
            <section className="wash">
                <div className="rf-shell">
                    <div className="rf-split-head">
                        <div>
                            <p className="rf-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="rf-h2">
                                On a roofing call, it checks <span className="rf-coral">for water first.</span>
                            </h2>
                        </div>
                        <p className="rf-lede">
                            Your AI receptionist is set up for your roofing business before it takes a single call. It
                            lets the caller explain, then asks the question that matters most after a storm: is water
                            coming in right now?
                        </p>
                    </div>

                    {/* The call forks on one question: the "Yes" lane lights up as it's scrolled to. */}
                    <RfOnView className="rf-triage" role="group" aria-label="An example roofing call, and how it forks on whether water is coming in">
                        <div className="rf-tri-in">
                            <p className="rf-tri-who">Caller</p>
                            <p className="rf-says">
                                &ldquo;We have water coming through the bedroom ceiling since the storm last night.&rdquo;
                            </p>
                            <span className="rf-tri-tag">Example call</span>
                        </div>
                        <span className="rf-tri-arrow" aria-hidden="true" />
                        <div className="rf-tri-q">
                            <svg className="rf-drop" viewBox="0 0 36 44" aria-hidden="true">
                                <path d="M18 3 C 26 16 33 23 33 30 A 15 15 0 0 1 3 30 C 3 23 10 16 18 3 Z" />
                            </svg>
                            <p className="rf-tri-who">
                                <Voice live />
                                Receptionist
                            </p>
                            <p className="rf-says">&ldquo;Sorry to hear that. Is water still coming in right now?&rdquo;</p>
                        </div>
                        <svg className="rf-tri-fork" viewBox="0 0 60 100" preserveAspectRatio="none" aria-hidden="true">
                            <path className="yes" d="M0 50 C 30 50 30 26 60 26" />
                            <path className="no" d="M0 50 C 30 50 30 76 60 76" />
                        </svg>
                        <div className="rf-tri-out">
                            <div className="rf-lane yes">
                                <p className="rf-lane-k">Yes &middot; water coming in</p>
                                <div className="rf-line">
                                    <p className="rf-tri-who">Caller</p>
                                    <p className="rf-says">&ldquo;A little. We&apos;ve got a bucket under it.&rdquo;</p>
                                </div>
                                <div className="rf-line rec">
                                    <p className="rf-tri-who">Receptionist</p>
                                    <p className="rf-says">&ldquo;Understood. I&apos;ve marked this urgent so the team sees it first.&rdquo;</p>
                                </div>
                                <p className="rf-out">
                                    <span className="rf-lane-chip">Urgent</span>Top of your inbox, flagged for a callback
                                </p>
                            </div>
                            <div className="rf-lane no">
                                <p className="rf-lane-k">No &middot; it can wait</p>
                                <div className="rf-line">
                                    <p className="rf-says">Quotes, inspections and replacements.</p>
                                </div>
                                <div className="rf-line rec">
                                    <p className="rf-tri-who">Receptionist</p>
                                    <p className="rf-says">&ldquo;Someone from the team will call you back with a quote.&rdquo;</p>
                                </div>
                                <p className="rf-out">
                                    <span className="rf-lane-chip">Routine</span>In your inbox for the team
                                </p>
                            </div>
                        </div>
                    </RfOnView>

                    <div className="rf-ended">
                        <span className="rf-end-pill">Call ended &middot; 0:52</span>
                        <span className="rf-end-line" aria-hidden="true" />
                        <svg className="rf-ic rf-end-arrow" aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 4v15M6 13l6 6 6-6" />
                        </svg>
                    </div>

                    <div className="rf-lands">
                        <div>
                            <h3 className="rf-lands-h">
                                The call ends. The lead lands <span className="rf-coral">in your portal.</span>
                            </h3>
                            <p className="rf-lands-sub">This is that call, in your portal inbox, and the text you get.</p>
                        </div>
                        <div className="rf-land">
                            <div
                                className="rf-inbox"
                                role="img"
                                aria-label="Example: the portal inbox, with the lead from this call as the newest row"
                            >
                                <div className="rf-inbox-top">
                                    <b>Inbox</b>
                                    <span>Needs you</span>
                                </div>
                                {INBOX.map((row) => (
                                    <div className={row.cut ? "rf-m-cut" : undefined} key={row.name}>
                                        <div className="rf-inbox-day">{row.day}</div>
                                        <div className={`rf-irow${row.read ? " is-read" : ""}`}>
                                            <span className="rf-irow-dot" />
                                            <div>
                                                <div className="rf-irow-r1">
                                                    <strong>{row.name}</strong>
                                                    {row.chip ? <span className="rf-irow-chip">{row.chip}</span> : null}
                                                    {row.count ? <span className="rf-irow-count">{row.count}</span> : null}
                                                    <time>{row.at}</time>
                                                </div>
                                                <p className="rf-irow-pv">{row.preview}</p>
                                                <span className="rf-irow-mini">Call</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <RfPhone />
                        </div>
                        <p className="rf-eg rf-land-cap">Example lead. Example text.</p>
                    </div>

                    <div className="rf-keeps">
                        <h3 className="rf-keeps-h">
                            Three things it never <span className="rf-coral">nails down.</span>
                        </h3>
                        <div className="rf-course">
                            {TABS.map((t) => (
                                <div className="rf-tab" key={t.head}>
                                    <p className="rf-no">Yours</p>
                                    <h4>{t.head}</h4>
                                    <p className="rf-what">{t.copy}</p>
                                </div>
                            ))}
                        </div>
                        <p className="rf-keeps-foot">And whenever it&apos;s asked, it says it&apos;s a virtual assistant.</p>
                    </div>
                </div>
            </section>

            {/* 3 · The roofing website: the example template site, as three phone screens. */}
            <section>
                <div className="rf-shell">
                    <div className="rf-split-head">
                        <h2 className="rf-h2">
                            What&apos;s on your <span className="rf-coral">roofing website.</span>
                        </h2>
                        <p className="rf-lede">
                            You answer a few questions. We write it, build it and host it. Yours carries your name, your
                            colours, your photos, your services and your towns.
                        </p>
                    </div>
                    <div className="rf-phones">
                        {PHONES.map((ph) => (
                            <div className="rf-ph" key={ph.t}>
                                <div className="rf-handset">
                                    <span className="rf-scr" role="img" aria-label={ph.alt} style={{ backgroundImage: `url(${ph.src})` }} />
                                </div>
                                <div className="rf-ph-cap">
                                    <span className="rf-ph-t">{ph.t}</span>
                                    <h3>{ph.h}</h3>
                                    <p>{ph.p}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="rf-shotcap">
                        <span className="rf-eg">Your Roofing Co. is an example business, not a client.</span>
                        <span className="rf-eg rf-m-cut">Under all of it: titles, a sitemap, structured data, fast pages.</span>
                    </div>
                </div>
            </section>

            {/* 4 · What they search, beside what they ask on the phone. */}
            <section className="wash">
                <div className="rf-shell">
                    <div className="rf-centre rf-find">
                        <h2 className="rf-h2">
                            What your customers are trying to <span className="rf-coral">find out.</span>
                        </h2>
                        <p className="rf-lede">
                            After a storm, everyone calls a roofer at once. They search, they call, and they hire whoever
                            answers.
                        </p>
                    </div>
                    <div className="rf-qa">
                        <div>
                            <h3 className="rf-qa-h">
                                <RfIcon name="search" />
                                What they search
                            </h3>
                            <RfOnView
                                className="rf-srows"
                                role="list"
                                aria-label="Four roofing searches. Under each, one shingle for every 10,000 searches a month"
                            >
                                {SEARCHES.map((s) => (
                                    <div className="rf-sr" role="listitem" key={s.q}>
                                        <p className="rf-sr-q">
                                            <RfIcon name="search" />
                                            {s.q}
                                        </p>
                                        <div className="rf-sr-scale">
                                            <span className="rf-sr-tabs" aria-hidden="true">
                                                {shingles(s.n).map((t) => (
                                                    <i
                                                        key={t.i}
                                                        className={t.f === undefined ? undefined : "part"}
                                                        style={{ ["--i" as string]: t.i, ...(t.f === undefined ? {} : { ["--f" as string]: t.f }) }}
                                                    />
                                                ))}
                                            </span>
                                            <span className="rf-sr-n">
                                                <b>{s.n.toLocaleString("en-US")}</b> searches a month
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </RfOnView>
                            <p className="rf-eg rf-src">
                                One shingle for every 10,000 searches a month. Marketkeep, SEO keywords for roofing
                                companies, August 2026
                            </p>
                            <div className="rf-answers">
                                <p className="rf-answers-lead">Your site is built to be found for searches like these.</p>
                                <p className="rf-m-cut">Your services and your towns get their own pages, written from what you tell us.</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="rf-qa-h">
                                <Voice live />
                                What they ask on calls
                            </h3>
                            <div className="rf-ladder">
                                <span className="rf-rungs" aria-hidden="true" />
                                {PLATES.map((p) => (
                                    <div className={`rf-plate${p.cut ? " rf-m-cut" : ""}`} key={p.q}>
                                        <p className="rf-band">
                                            <Voice />
                                            Asked on a call
                                        </p>
                                        <q>{p.q}</q>
                                    </div>
                                ))}
                            </div>
                            <div className="rf-answers">
                                <p className="rf-answers-lead">Your receptionist answers the questions you&apos;d normally answer yourself.</p>
                                <p className="rf-m-cut">Then it takes their details and leaves the job and the price to you.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, as two roofs shingled up to the money. */}
            <section>
                <div className="rf-shell">
                    <div className="rf-centre">
                        <h2 className="rf-h2">
                            A missed call is a roof <span className="rf-coral">someone else gets.</span>
                        </h2>
                        <p className="rf-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on
                            the list.
                        </p>
                    </div>
                    <RfRoofs />
                    <p className="rf-eg rf-wo-src">
                        Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is
                        our own estimate: half.
                    </p>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="rf-shell rf-close">
                    <div className="rf-centre">
                        <h2 className="rf-h2 rf-close-h">
                            Call it. <span className="rf-coral">See who picks up.</span>
                        </h2>
                        <p className="rf-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="rf-ask" />
                </div>
            </section>
        </main>
    );
}
