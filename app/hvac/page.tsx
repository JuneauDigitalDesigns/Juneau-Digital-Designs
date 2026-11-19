import type { Metadata } from "next";
import Image from "next/image";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import HvacCalculator from "@/app/components/hvac/HvacCalculator";
import HvacIcon, { RingArcs, Voice, type HvacIconName } from "@/app/components/hvac/HvacIcon";
import HvacStart from "@/app/components/hvac/HvacStart";
import { DEMO_SITE_URL } from "@/app/data/demo-site";
import { HVAC_SEARCHES, MARKETKEEP_SOURCE } from "@/app/data/hvac-searches";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { HVAC_DESCRIPTION, HVAC_TITLE, hvacJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/hvac", HVAC_TITLE, HVAC_DESCRIPTION);

/**
 * /hvac — "A website and AI receptionist for HVAC companies."
 *
 * The first trade page. Every word here was approved by Xander word for word on 19 Nov 2026,
 * from the fourth round of a mockup (https://claude.ai/artifact/6GT15qDBaZTtFkeEEWCJzi). Nothing
 * may be edited, embellished or "tightened" without a fresh approval; `test/hvac-page.test.mjs`
 * pins the sentences.
 *
 * WHY IT EXISTS. The 19 Nov 2026 search check found the site never named a trade. Phrases like
 * "plumber website design" belong to big agencies with years of links; pairing a trade with the
 * receptionist is the opening. Six near-identical pages with the trade swapped would be doorway
 * pages under Google's spam policy, so this page carries what is only true of HVAC:
 *   - the receptionist's HVAC urgent list and its replies, taken from its real HVAC script
 *     (jdd-ops `clients/_e2e_test_growth/agent-prompt.txt` and the Starter one);
 *   - the HVAC site design, shown as the real demo (`DEMO_SITE_URL`) with its six HVAC services;
 *   - real HVAC searches with their monthly counts (`app/data/hvac-searches.ts`).
 * The next trade page gets its own versions of all three, never this page with words swapped.
 *
 * NOTHING INVENTED. No client names, reviews or job values exist for HVAC, so none appear. The
 * inbox preview's caller and the caller's lines in the example calls are examples, and are shown
 * as examples. The two percentages are the homepage calculator's (Invoca 2025); "won back" is
 * labelled as our own estimate.
 *
 * Each section carries its own device, as /about does (Xander: sections must not all look the
 * same): three ringing phones, a call drawn as voices, an inbox row, a never/instead ledger, a
 * framed site with a legend, searches and spoken questions, a sum you type into. Type, colour
 * and hairlines are the site's. Styles are `.hvac-*` at the end of globals.css; `.hvac-m-cut`
 * marks what a phone leaves out (Xander: cut some copy on a phone so it does not overload).
 *
 * No region named: whether trade pages name Florida, Georgia and Alabama is undecided (item C7).
 */

/** "When it picks up." The three moments a call goes unanswered, each ringing in turn. */
const BEATS: { icon: HvacIconName; when: string }[] = [
    { icon: "attic", when: "You're in an attic." },
    { icon: "onCall", when: "You're on another call." },
    { icon: "moon", when: "It's two in the morning." },
];

/**
 * The example calls. The receptionist's lines are its real HVAC script's; the caller's lines are
 * an example written so the answers have something to answer. A phone shows the first two.
 */
const EXCHANGES: { caller: string; receptionist: string }[] = [
    {
        caller: "Our AC quit this afternoon and the house is getting hot. My mother's staying with us and she's elderly.",
        receptionist:
            "Okay, I hear you. The team treats this as a priority and they'll be in touch as fast as possible. Let me grab a few quick details.",
    },
    {
        caller: "Can you get someone out tonight?",
        receptionist:
            "I don't have the schedule in front of me, but someone from the team will reach out shortly and get that locked in for you.",
    },
    {
        caller: "Wait, am I talking to a real person?",
        receptionist:
            "I'm actually a virtual assistant. I work with the team to make sure your request gets to the right person fast.",
    },
];

/** The script's urgent list for HVAC, in its order. `null` icon draws the "CO" badge. */
const SIGNALS: { icon: HvacIconName | null; what: string; detail: string }[] = [
    { icon: "temp", what: "No cooling or no heat", detail: "when the weather makes that dangerous" },
    { icon: "flame", what: "A burning smell", detail: "coming from the system" },
    { icon: "zap", what: "Sparking or smoke", detail: "or any electrical problem" },
    { icon: "drop", what: "A heavy water leak", detail: "or a refrigerant or gas smell" },
    { icon: "heart", what: "Someone vulnerable at home", detail: "a young child, an older adult, a medical condition" },
    { icon: null, what: "Carbon monoxide", detail: "Always urgent" },
];

/** The script's hard rules, each beside what it does in their place. */
const NEVER: { never: string; instead: string }[] = [
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

/** What the HVAC site design carries, read off the demo in the frame beside it. */
const LEGEND: { heading: string; body: string }[] = [
    {
        heading: "A form on the first screen",
        body: "Name and phone number, nothing else to fill in. On Growth, the receptionist calls them back within about a minute.",
    },
    {
        heading: "Your number, everywhere",
        body: "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
    },
    {
        heading: "Your services, page by page",
        body: "Heating, cooling, maintenance plans, air quality, heat pumps, emergency calls. A service gets its own page when you've told us enough to fill one.",
    },
    {
        heading: "The towns you work in",
        body: "Listed on the site, with a page for a town when there's something real to say about it.",
    },
    {
        heading: "Proof that's yours",
        body: "Photos from your real jobs and your business, your reviews, your certifications, the brands you install. We don't write reviews, and a section with nothing real in it stays off your site.",
    },
    { heading: "Your customers' questions", body: "Answered in your words, from what you tell us." },
];

/** Asked out loud. The questions the receptionist hears, as the HVAC script and site cover them. */
const ASKED = ["Can someone come today?", "Do you work in my town?", "Do you have a maintenance plan?"];

export default function HvacPage() {
    return (
        <main className="hvac-page">
            <JsonLd data={hvacJsonLd()} />

            {/* 1 · Hero. The claim on the left; on the right, the three moments it answers in. */}
            <div className="hvac-shell hvac-shell-hero">
                <div className="hvac-hero">
                    <div className="hvac-hero-copy">
                        <p className="kicker">For heating and cooling companies</p>
                        <h1 className="hvac-h1">
                            A website and AI receptionist for <span className="hvac-coral">HVAC companies.</span>
                        </h1>
                        <p className="hvac-intro">
                            We write, build and host your heating and cooling website. Then the calls you miss get answered.
                        </p>
                        <p className="hvac-lede hvac-hero-lede hvac-m-cut">
                            A caller rings your real phone first. If nobody picks up, the AI receptionist does, 24/7, in
                            English or in Spanish. It finds out what&apos;s wrong and how urgent it is, and the lead goes
                            straight into your portal.
                        </p>
                        <HvacStart />
                    </div>
                    <div className="hvac-when">
                        <h2 className="hvac-when-h">
                            When it <span className="hvac-coral">picks up.</span>
                        </h2>
                        <ul className="hvac-beats">
                            {BEATS.map((beat) => (
                                <li key={beat.when} className="hvac-beat">
                                    <HvacIcon name={beat.icon} className="hvac-scene" />
                                    <h3 className="hvac-beat-h">{beat.when}</h3>
                                    <div className="hvac-pickline">
                                        <span className="hvac-ringer" aria-hidden="true">
                                            <HvacIcon name="cell" />
                                            <RingArcs className="hvac-arcs" />
                                        </span>
                                        <span className="hvac-wire" aria-hidden="true" />
                                        <span className="hvac-picked">
                                            <HvacIcon name="phone" />
                                            <Voice live />
                                            Picked up
                                        </span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <p className="hvac-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on an HVAC call. Named before it is called "it". */}
            <section className="wash">
                <div className="hvac-shell">
                    <div className="hvac-split-head">
                        <div>
                            <p className="hvac-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="hvac-h2">
                                On an HVAC call, it knows what&apos;s <span className="hvac-coral">urgent.</span>
                            </h2>
                        </div>
                        <p className="hvac-lede">
                            Your AI receptionist is set up for heating and cooling before it takes a single call. It lets the
                            caller explain, then asks one question at a time: what&apos;s wrong, how soon, and where.
                        </p>
                    </div>

                    <div className="hvac-call">
                        {/* Drawn as voices, never as chat bubbles: it talks, it doesn't text. */}
                        <div className="hvac-calls-col">
                            <span className="hvac-onair">
                                <HvacIcon name="phone" />
                                Example calls
                                <Voice live />
                            </span>
                            <div className="hvac-talk">
                                {EXCHANGES.map((ex, i) => (
                                    <div key={ex.caller} className={`hvac-exchange${i === 2 ? " hvac-m-cut" : ""}`}>
                                        <figure className="hvac-said hvac-said-caller">
                                            <figcaption className="hvac-voice">
                                                <Voice bars={i === 0 ? 7 : 5} />
                                                <span className="hvac-who">Caller asks</span>
                                            </figcaption>
                                            <blockquote>&ldquo;{ex.caller}&rdquo;</blockquote>
                                        </figure>
                                        <figure className="hvac-said hvac-said-rec">
                                            <figcaption className="hvac-voice">
                                                <Voice bars={7} live />
                                                <span className="hvac-who">Receptionist answers</span>
                                            </figcaption>
                                            <blockquote>&ldquo;{ex.receptionist}&rdquo;</blockquote>
                                        </figure>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="hvac-side">
                            <h3 className="hvac-h3">What it treats as urgent</h3>
                            <ul className="hvac-signals">
                                {SIGNALS.map((s) => (
                                    <li key={s.what}>
                                        {s.icon ? (
                                            <HvacIcon name={s.icon} className="hvac-signal-ic" />
                                        ) : (
                                            <span className="hvac-co" aria-hidden="true">
                                                CO
                                            </span>
                                        )}
                                        <span>
                                            <b>{s.what}</b>
                                            <span className="hvac-m-cut">{s.detail}</span>
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <h3 className="hvac-h3 hvac-slip-h">What lands in your portal</h3>
                            {/* The portal inbox's own row (portal/inbox/InboxList.tsx): unread dot, name,
                                the "Wants a callback" status, the time, the call summary, the "Call" tag.
                                Static, in the portal's colours. The caller is an example. */}
                            <div className="hvac-inbox" role="img" aria-label="Example: the lead from this call as a row in the portal inbox">
                                <div className="hvac-inbox-top">
                                    <b>Inbox</b>
                                    <span>Needs you</span>
                                </div>
                                <div className="hvac-inbox-day">TODAY</div>
                                <div className="hvac-inbox-row">
                                    <span className="hvac-inbox-dot" />
                                    <div>
                                        <div className="hvac-inbox-r1">
                                            <strong>Dana Whitfield</strong>
                                            <span className="hvac-inbox-chip">Wants a callback</span>
                                            <span className="hvac-inbox-time">9:42 PM</span>
                                        </div>
                                        <p className="hvac-inbox-pv">
                                            AC stopped cooling this afternoon. Elderly mother staying in the home. Asked for someone
                                            today. Job is in Winter Park.
                                        </p>
                                        <span className="hvac-inbox-mini">Call</span>
                                    </div>
                                </div>
                                <div className="hvac-inbox-row hvac-inbox-skel hvac-m-cut" aria-hidden="true">
                                    <span />
                                    <div>
                                        <i />
                                        <i />
                                    </div>
                                </div>
                            </div>
                            <p className="hvac-under">Then you get a text saying it&apos;s there.</p>
                        </div>
                    </div>

                    <div className="hvac-vs">
                        <div className="hvac-vs-heads">
                            <h3 className="hvac-vs-h">
                                What it will <span className="hvac-coral">never do.</span>
                            </h3>
                            <h3 className="hvac-vs-h">What it does instead.</h3>
                        </div>
                        {NEVER.map((row) => (
                            <div key={row.never} className="hvac-vs-row">
                                <div className="hvac-vs-cell hvac-vs-no">
                                    <span className="hvac-mark">
                                        <HvacIcon name="x" />
                                    </span>
                                    <div>
                                        <p className="hvac-vs-lbl">Never</p>
                                        <p>{row.never}</p>
                                    </div>
                                </div>
                                <div className="hvac-vs-cell hvac-vs-yes">
                                    <span className="hvac-mark">
                                        <HvacIcon name="check" />
                                    </span>
                                    <div>
                                        <p className="hvac-vs-lbl">Instead</p>
                                        <p>{row.instead}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 3 · The HVAC website: the real demo in a frame you scroll, a legend beside it. */}
            <section>
                <div className="hvac-shell">
                    <div className="hvac-split-head">
                        <h2 className="hvac-h2">
                            What&apos;s on your <span className="hvac-coral">HVAC website.</span>
                        </h2>
                        <p className="hvac-lede">
                            You answer a few questions. We write it, build it and host it. This is the HVAC design. Yours
                            carries your name, your colours, your services and your towns.
                        </p>
                    </div>

                    <div className="hvac-site">
                        <div>
                            <div className="hvac-frame">
                                <div className="hvac-frame-bar" aria-hidden="true">
                                    <i />
                                    <i />
                                    <i />
                                    <span>{DEMO_SITE_URL.replace(/^https:\/\//, "")}</span>
                                </div>
                                {/* Scrolls on its own, so it takes keyboard focus. The label is the
                                    mockup's; the picture inside is described by it, so its own alt is empty. */}
                                <div className="hvac-frame-view" tabIndex={0} role="region" aria-label="The HVAC demo website, top to bottom. Scroll to see the whole page.">
                                    <Image
                                        src="/demo-site.webp"
                                        alt=""
                                        width={1280}
                                        height={5969}
                                        sizes="(max-width: 800px) 100vw, 560px"
                                    />
                                </div>
                            </div>
                            <div className="hvac-frame-cap">
                                <span className="hvac-eg">Scroll it. A demo site, with sample details.</span>
                                <a href={DEMO_SITE_URL} target="_blank" rel="noopener noreferrer">
                                    Visit site
                                </a>
                            </div>
                        </div>

                        <div>
                            <ol className="hvac-legend">
                                {LEGEND.map((item, i) => (
                                    <li key={item.heading}>
                                        <span className="hvac-legend-n" aria-hidden="true">
                                            {String(i + 1).padStart(2, "0")}
                                        </span>
                                        <div>
                                            <h3 className="hvac-legend-h">{item.heading}</h3>
                                            <p>{item.body}</p>
                                        </div>
                                    </li>
                                ))}
                            </ol>
                            <p className="hvac-under hvac-m-cut">
                                Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that
                                work on phones.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4 · What customers want to know: searched, then asked on a call, each beside the
                half of the product that answers it. */}
            <section className="wash">
                <div className="hvac-shell">
                    <div className="hvac-centre hvac-find">
                        <h2 className="hvac-h2 hvac-find-h">
                            What your customers are trying to <span className="hvac-coral">find out.</span>
                        </h2>
                        <p className="hvac-lede">
                            A homeowner with a dead system isn&apos;t browsing. They have a short list of questions, and they
                            call the company that answers them.
                        </p>
                    </div>

                    <div className="hvac-find-row">
                        <div>
                            <h3 className="hvac-group-h">
                                <HvacIcon name="search" />
                                What they&apos;re searching for
                            </h3>
                            <ul className="hvac-qs hvac-qs-typed">
                                {HVAC_SEARCHES.map((s) => (
                                    <li key={s.search}>
                                        <p className="hvac-q">
                                            <HvacIcon name="search" />
                                            {s.search}
                                            {s.perMonth && <span className="hvac-q-n">{s.perMonth} a month</span>}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                            <p className="hvac-eg hvac-find-src">{MARKETKEEP_SOURCE}</p>
                        </div>
                        <div className="hvac-beat-copy">
                            <p className="hvac-beat-lead">Your site is built to be found for searches like these.</p>
                            <p>
                                Your services and your towns get their own pages, and your customers&apos; questions get
                                straight answers, all written from what you tell us.
                            </p>
                        </div>
                    </div>

                    <div className="hvac-find-row">
                        <div>
                            <h3 className="hvac-group-h">
                                <Voice live />
                                What they&apos;re asking on calls
                            </h3>
                            <ul className="hvac-qs hvac-qs-spoken">
                                {ASKED.map((q) => (
                                    <li key={q}>
                                        <p className="hvac-q">&ldquo;{q}&rdquo;</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="hvac-beat-copy">
                            <p className="hvac-beat-lead">
                                Your receptionist is built to answer the questions you&apos;d normally answer yourself.
                            </p>
                            <p>Then it takes their details and leaves the money and the job to you.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, as a sum the owner fills in. */}
            <section>
                <div className="hvac-shell">
                    <div className="hvac-centre">
                        <h2 className="hvac-h2">
                            The call you miss <span className="hvac-coral">calls someone else.</span>
                        </h2>
                        <p className="hvac-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on the
                            list. For a home service business, that call is often a job.
                        </p>
                    </div>
                    <HvacCalculator />
                    <div className="hvac-centre">
                        <p className="hvac-eg hvac-src">
                            Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is our
                            own estimate: half.
                        </p>
                    </div>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="hvac-shell hvac-close">
                    <div className="hvac-centre">
                        <h2 className="hvac-h2 hvac-close-h">
                            Hear it take <span className="hvac-coral">a call.</span>
                        </h2>
                        <p className="hvac-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="hvac-ask" />
                </div>
            </section>
        </main>
    );
}
