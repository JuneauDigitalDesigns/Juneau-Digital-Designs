import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import PwIcon, { Voice } from "@/app/components/pressure-washing/PwIcon";
import PwDriveway from "@/app/components/pressure-washing/PwDriveway";
import PwPhone from "@/app/components/pressure-washing/PwPhone";
import PwGauge from "@/app/components/pressure-washing/PwGauge";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { PRESSURE_WASHING_DESCRIPTION, PRESSURE_WASHING_TITLE, pressureWashingJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/pressure-washing", PRESSURE_WASHING_TITLE, PRESSURE_WASHING_DESCRIPTION);

/**
 * /pressure-washing — "Websites and an AI receptionist for pressure washing."
 *
 * The fifth trade page. Every word was approved by Xander on 25 Nov 2026, over several rounds of a
 * mockup (https://claude.ai/artifact/MD5DiZ3zQmnCR7QCNJ26EC), with the instruction that the build
 * match that mockup exactly, desktop and phone. Nothing here may be reworded or restyled without a
 * fresh approval; `test/pressure-washing-page.test.mjs` pins the sentences.
 *
 * NOT A COPY OF THE OTHER FOUR TRADE PAGES. Google treats near-identical trade pages as doorway
 * pages, so the content and the devices differ from HVAC, plumbing, lawn care and detailing as much
 * as the trade does:
 *
 *   - The hero is a grimy driveway washed clean in front of a garage, the machine parked beside it
 *     and the hose running to the wand, with the call that comes in mid-job. The wand is set down on
 *     the ground when the job is done.
 *   - The receptionist's call is drawn as the call itself — a thread, back and forth — with what the
 *     AI notes clipped under the line it heard it on, and the four captured facts handed off at the
 *     end. No card, no sheet.
 *   - The three things it leaves to the owner are on colour-coded pressure-washer nozzle tips.
 *   - The website section shows a real example site (Your Pressure Washing Co., built from the
 *     vertical template) as three phone screens.
 *   - The searches are search bars washed clean out of the grime; the questions are on door hangers.
 *   - The sum is on a pressure gauge, two needles on one scale.
 *
 * NOTHING INVENTED. No pressure washing client exists, so the call is the standard script's answers;
 * the mildew, the "wood or composite" question, the 300 square feet and the Saturday deadline come
 * from the pressure washing sample in the portal tour, which also marks the lead urgent. Your
 * Pressure Washing Co. is our own example site, named on the page as an example, not a client. The
 * search phrases are on Marketkeep's pressure washing list; the source's two tables disagree on the
 * counts, so the page prints none. No region is named in the page's own copy: that is settled
 * site-wide.
 *
 * Styles are `.pw-*` at the end of globals.css. `.pw-m-cut` marks what a phone leaves out. The
 * closing pair is the shared `PageAsk`, as every other page closes on.
 */

type Note = { k: string; v: React.ReactNode; kind?: "urgent" | "yours" };

/** The call, played out as a thread, with what the AI notes clipped to the line it heard it on. */
const THREAD: { who: "rec" | "caller"; says: string; note?: Note; cut?: boolean }[] = [
    { who: "rec", says: "Thanks for calling. How can I help?" },
    {
        who: "caller",
        says: "Our back deck is covered in green mildew and we're hosting on Saturday.",
        note: { k: "Noted · needs washing", v: "Back deck, green mildew" },
    },
    { who: "rec", says: "Happy to help. Is the deck wood or composite, and roughly how big is it?" },
    {
        who: "caller",
        says: "Wood, about 300 square feet.",
        note: { k: "Noted · size", v: <>Wood deck, &asymp; 300 sq ft</> },
    },
    {
        who: "rec",
        says: "Since you're hosting Saturday, I'll flag this as urgent for the team.",
        note: { k: "Flagged · when", v: <>Before Saturday &middot; <b>Urgent</b></>, kind: "urgent" },
        cut: true,
    },
    { who: "caller", says: "What's a deck wash like that going to run?", cut: true },
    {
        who: "rec",
        // The one field it never fills in: the price is the owner's.
        says: "We're not able to give a price until we've seen the deck. Someone from the team will call you back with a quote.",
        note: { k: "Left for you · price", v: "Yours to quote", kind: "yours" },
    },
];

/** The four captured facts, handed off at the end of the call. */
const HANDOFF: { k: string; v: React.ReactNode; yours?: boolean }[] = [
    { k: "Needs washing", v: "Back deck, green mildew" },
    { k: "Size", v: <>Wood, &asymp; 300 sq ft</> },
    { k: "When", v: <>Before Saturday <b className="pw-hflag">Urgent</b></> },
    { k: "Price", v: "Yours to quote", yours: true },
];

/** The portal inbox, with the call above as its newest row. The older row is the portal tour's sample. */
const INBOX = [
    {
        day: "TODAY",
        name: "Dave Kowalski",
        chip: "Urgent",
        at: "11:02 AM",
        preview: "Green mildew all over the back deck and he's hosting on Saturday. Wood, about 300 square feet. Asked what it costs.",
    },
    {
        day: "YESTERDAY",
        name: "Tammy Reynolds",
        at: "4:40 PM",
        preview: "Black streaks on the roof. Asked if a soft wash is safe for shingles.",
        read: true,
        cut: true,
    },
];

/** What the receptionist leaves to the owner, each on a colour-coded nozzle tip. */
const NOZZLES: { tone: string; deg: string; light: boolean; head: string; copy: string }[] = [
    { tone: "red", deg: "0°", light: true, head: "The price", copy: "It never quotes. It tells the caller the team will call back with one." },
    {
        tone: "green",
        deg: "25°",
        light: true,
        head: "The booking",
        copy: "It never books a time or promises a day. It takes their details, flags the deadline, and says someone from the team will call to schedule.",
    },
    {
        tone: "white",
        deg: "40°",
        light: false,
        head: "Anything it isn't sure of",
        copy: "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
    },
];

/** The three example-site screens, taken from the live Your Pressure Washing Co. template site. */
const PHONES = [
    {
        src: "/pressure-washing-site-1.webp",
        alt: "The top of the example pressure washing site on a phone: the headline, a request-a-quote button, a call button, and the start of the estimate form",
        t: "The first screen",
        h: "Your number, then a form",
        p: "A tap-to-call button under the headline and a short estimate form right after it. Every request lands in your portal inbox.",
    },
    {
        src: "/pressure-washing-site-2.webp",
        alt: "The services section of the example pressure washing site on a phone, starting with House Washing",
        t: "Services",
        h: "A page for each service",
        p: "House wash, roof soft wash, driveways, pavers, decks and fences. A service gets its own page when you've told us enough to fill one.",
    },
    {
        src: "/pressure-washing-site-3.webp",
        alt: "The questions section of the example pressure washing site on a phone",
        t: "Questions",
        h: "Your customers' questions",
        p: "Answered in your words, from what you tell us.",
    },
];

/** What people search, each a search bar washed clean out of the grime. The phrases are on
    Marketkeep's pressure washing list; its two tables disagree on counts, so none is printed. */
const SEARCHES = ["power washing near me", "pressure washing services", "house pressure washing", "soft wash roof cleaning"];

/** What they ask on calls, on door hangers. The first is the portal sample's; the others are examples. */
const HANGERS = [
    { q: "Is a soft wash safe for the shingles?" },
    { q: "Can you get the oil stains out of the driveway?" },
    { q: "Do I need to be home for it?", cut: true },
];

function NozzleTip({ tone, deg, light }: { tone: string; deg: string; light: boolean }) {
    return (
        <svg className={`pw-tipsvg ${tone}`} viewBox="0 0 86 142" aria-hidden="true">
            <path className="capb" d="M 15 8 H 71 Q 75 8 75 12 V 27 L 62 42 H 24 L 11 27 V 12 Q 11 8 15 8 Z" />
            <g className={light ? "ridge lite" : "ridge"}>
                <line x1="17" y1="11" x2="17" y2="25" />
                <line x1="23" y1="11" x2="23" y2="25" />
                <line x1="29" y1="11" x2="29" y2="25" />
                <line x1="57" y1="11" x2="57" y2="25" />
                <line x1="63" y1="11" x2="63" y2="25" />
                <line x1="69" y1="11" x2="69" y2="25" />
            </g>
            <text className={light ? "deg lite" : "deg"} x="43" y="23" textAnchor="middle">
                {deg}
            </text>
            <rect className="bodyc" x="24" y="42" width="38" height="52" rx="5" />
            <g className="knurl">
                <line x1="28" y1="54" x2="58" y2="54" />
                <line x1="28" y1="64" x2="58" y2="64" />
                <line x1="28" y1="74" x2="58" y2="74" />
            </g>
            <rect className="collar" x="20" y="94" width="46" height="16" rx="4" />
            <rect x="30" y="110" width="26" height="16" rx="3" className="nholder" />
            <rect x="40" y="119" width="6" height="4" className="nstem" />
        </svg>
    );
}

export default function PressureWashingPage() {
    return (
        <main className="pw-page">
            <JsonLd data={pressureWashingJsonLd()} />

            {/* 1 · Hero: the claim left, a driveway washed clean with the call that came mid-job, right. */}
            <div className="pw-shell pw-shell-hero">
                <div className="pw-hero">
                    <div className="pw-hero-copy">
                        <p className="kicker">For pressure washing companies</p>
                        <h1 className="pw-h1">
                            Websites and an AI receptionist for <span className="pw-coral">pressure washing.</span>
                        </h1>
                        <p className="pw-intro">
                            We write, build and host your pressure washing website. Then every call you can&apos;t take
                            gets answered.
                        </p>
                        <p className="pw-lede pw-m-cut">
                            Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in
                            Spanish. It finds out what needs washing, how big it is and when they need it done, and puts
                            the lead straight into your portal.
                        </p>
                        {/* Every Get started on the site goes to /contact. */}
                        <div className="pw-acts">
                            <Link href="/contact" className="btn primary lg">
                                Get started
                            </Link>
                            <Link href="/pricing" className="btn ghost lg">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>
                    <div className="pw-onjob">
                        <h2 className="pw-onjob-h">
                            While the water&apos;s <span className="pw-coral">running.</span>
                        </h2>
                        <PwDriveway />
                        <p className="pw-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on a wash call, then where the lead lands. */}
            <section className="wash">
                <div className="pw-shell">
                    <div className="pw-split-head">
                        <div>
                            <p className="pw-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="pw-h2">
                                On a wash call, it asks what <span className="pw-coral">needs washing.</span>
                            </h2>
                        </div>
                        <p className="pw-lede">
                            Your AI receptionist is set up for your pressure washing business before it takes a single
                            call. It lets the caller explain, then asks one question at a time: what needs washing, how
                            big it is, and when they need it done.
                        </p>
                    </div>

                    <div className="pw-oncall">
                        <div className="pw-oncall-bar">
                            <span className="pw-oncall-live">
                                <span className="pw-oncall-dot" aria-hidden="true" />
                                On a call
                            </span>
                            <Voice live />
                            <span className="pw-oncall-time">0:48</span>
                            <span className="pw-oncall-eg">Example call</span>
                        </div>
                        <ol className="pw-thread" aria-label="An example pressure washing call, with what the receptionist notes from it">
                            {THREAD.map((turn, i) => (
                                <li className={`pw-turn ${turn.who}${turn.cut ? " pw-m-cut" : ""}`} key={i}>
                                    <span className="pw-turn-av" aria-hidden="true">
                                        {turn.who === "rec" ? <Voice live /> : <PwIcon name="phone" />}
                                    </span>
                                    <div className="pw-bubble">
                                        <p className="pw-turn-who">{turn.who === "rec" ? "Receptionist" : "Caller"}</p>
                                        <p className="pw-turn-says">&ldquo;{turn.says}&rdquo;</p>
                                    </div>
                                    {turn.note ? (
                                        <p className={`pw-noted${turn.note.kind ? " " + turn.note.kind : ""}`}>
                                            <span className="pw-noted-k">{turn.note.k}</span>
                                            {turn.note.v}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ol>
                        <div className="pw-handoff">
                            <p className="pw-handoff-h">By the time it hangs up, you have the whole job.</p>
                            <div className="pw-handoff-chips">
                                {HANDOFF.map((c) => (
                                    <span className={`pw-hchip${c.yours ? " yours" : ""}`} key={c.k}>
                                        <span className="pw-hchip-k">{c.k}</span>
                                        <span className="pw-hchip-v">{c.v}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="pw-ended">
                        <span className="pw-end-pill">Call ended &middot; 1:12</span>
                        <span className="pw-end-line" aria-hidden="true" />
                        <svg className="pw-ic pw-end-arrow" aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 4v15M6 13l6 6 6-6" />
                        </svg>
                    </div>

                    <div className="pw-lands">
                        <div>
                            <h3 className="pw-lands-h">
                                The call ends. The lead lands <span className="pw-coral">in your portal.</span>
                            </h3>
                            <p className="pw-lands-sub">This is that call, in your portal inbox, and the text you get.</p>
                        </div>
                        <div className="pw-land">
                            <div
                                className="pw-inbox"
                                role="img"
                                aria-label="Example: the portal inbox, with the lead from this call as the newest row"
                            >
                                <div className="pw-inbox-top">
                                    <b>Inbox</b>
                                    <span>Needs you</span>
                                </div>
                                {INBOX.map((row) => (
                                    <Fragment key={row.name}>
                                        <div className="pw-inbox-day">{row.day}</div>
                                        <div className={`pw-irow${row.read ? " is-read" : ""}${row.cut ? " pw-m-cut" : ""}`}>
                                            <span className="pw-irow-dot" />
                                            <div>
                                                <div className="pw-irow-r1">
                                                    <strong>{row.name}</strong>
                                                    {row.chip ? <span className="pw-irow-chip">{row.chip}</span> : null}
                                                    <time>{row.at}</time>
                                                </div>
                                                <p className="pw-irow-pv">{row.preview}</p>
                                                <span className="pw-irow-mini">Call</span>
                                            </div>
                                        </div>
                                    </Fragment>
                                ))}
                            </div>
                            <PwPhone />
                        </div>
                        <p className="pw-eg pw-land-cap">Example lead. Example text.</p>
                    </div>

                    <div className="pw-keeps">
                        <h3 className="pw-keeps-h">
                            Three things it never <span className="pw-coral">touches.</span>
                        </h3>
                        <div className="pw-nozzles">
                            {NOZZLES.map((n) => (
                                <div className="pw-nozzle" key={n.head}>
                                    <NozzleTip tone={n.tone} deg={n.deg} light={n.light} />
                                    <p className="pw-no">Yours</p>
                                    <h4>{n.head}</h4>
                                    <p className="pw-what">{n.copy}</p>
                                </div>
                            ))}
                        </div>
                        <p className="pw-keeps-foot">And whenever it&apos;s asked, it says it&apos;s a virtual assistant.</p>
                    </div>
                </div>
            </section>

            {/* 3 · The pressure washing website: the example template site, as three phone screens. */}
            <section>
                <div className="pw-shell">
                    <div className="pw-split-head">
                        <h2 className="pw-h2">
                            What&apos;s on your <span className="pw-coral">pressure washing website.</span>
                        </h2>
                        <p className="pw-lede">
                            You answer a few questions. We write it, build it and host it. Yours carries your name, your
                            colours, your photos, your services and your towns.
                        </p>
                    </div>
                    <div className="pw-phones">
                        {PHONES.map((ph) => (
                            <div className="pw-ph" key={ph.t}>
                                <div className="pw-handset">
                                    <span className="pw-scr" role="img" aria-label={ph.alt} style={{ backgroundImage: `url(${ph.src})` }} />
                                </div>
                                <div className="pw-ph-cap">
                                    <span className="pw-ph-t">{ph.t}</span>
                                    <h3>{ph.h}</h3>
                                    <p>{ph.p}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pw-shotcap">
                        <span className="pw-eg">Your Pressure Washing Co. is an example business, not a client.</span>
                        <span className="pw-eg pw-m-cut">Under all of it: titles, a sitemap, structured data, fast pages.</span>
                    </div>
                </div>
            </section>

            {/* 4 · What they search, beside what they ask on the phone. */}
            <section className="wash">
                <div className="pw-shell">
                    <div className="pw-centre pw-find">
                        <h2 className="pw-h2">
                            What your customers are trying to <span className="pw-coral">find out.</span>
                        </h2>
                        <p className="pw-lede">
                            The grime isn&apos;t going anywhere, but the customer is. They search, they call, and they
                            hire whoever answers.
                        </p>
                    </div>
                    <div className="pw-qa">
                        <div>
                            <h3 className="pw-qa-h">
                                <PwIcon name="search" />
                                What they search
                            </h3>
                            <div className="pw-stencils" role="list" aria-label="Four searches people make for pressure washing, each drawn as a search bar washed clean out of the grime">
                                {SEARCHES.map((q, i) => (
                                    <div className={`pw-stencil${i === 3 ? " pw-m-cut" : ""}`} role="listitem" key={q}>
                                        <div className="pw-srch">
                                            <PwIcon name="search" />
                                            <span className="pw-srch-q">{q}</span>
                                            <span className="pw-cursorbar" aria-hidden="true" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <p className="pw-eg pw-src">Search phrases: Marketkeep, SEO keywords for pressure washing</p>
                            <div className="pw-answers">
                                <p className="pw-answers-lead">Your site is built to be found for searches like these.</p>
                                <p className="pw-m-cut">Your services and your towns get their own pages, written from what you tell us.</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="pw-qa-h">
                                <Voice live />
                                What they ask on calls
                            </h3>
                            <div className="pw-hangers">
                                {HANGERS.map((h) => (
                                    <div className={`pw-hanger${h.cut ? " pw-m-cut" : ""}`} key={h.q}>
                                        <p className="pw-band">
                                            <Voice />
                                            Asked on a call
                                        </p>
                                        <q>{h.q}</q>
                                    </div>
                                ))}
                            </div>
                            <div className="pw-answers">
                                <p className="pw-answers-lead">Your receptionist answers the questions you&apos;d normally answer yourself.</p>
                                <p className="pw-m-cut">Then it takes their details and leaves the job and the price to you.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, on a pressure gauge. */}
            <section>
                <div className="pw-shell">
                    <div className="pw-centre">
                        <h2 className="pw-h2">
                            A missed call is money <span className="pw-coral">down the drain.</span>
                        </h2>
                        <p className="pw-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on
                            the list.
                        </p>
                    </div>
                    <PwGauge />
                    <p className="pw-eg pw-wo-src">
                        Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is
                        our own estimate: half.
                    </p>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="pw-shell pw-close">
                    <div className="pw-centre">
                        <h2 className="pw-h2 pw-close-h">
                            Call it. <span className="pw-coral">See who picks up.</span>
                        </h2>
                        <p className="pw-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="pw-ask" />
                </div>
            </section>
        </main>
    );
}
