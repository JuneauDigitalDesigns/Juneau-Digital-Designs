import type { Metadata } from "next";
import { Fragment } from "react";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import PageAsk from "@/app/components/PageAsk";
import DetailIcon, { Voice } from "@/app/components/auto-detailing/DetailIcon";
import DetailBay from "@/app/components/auto-detailing/DetailBay";
import DetailPhone from "@/app/components/auto-detailing/DetailPhone";
import DetailDash from "@/app/components/auto-detailing/DetailDash";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { AUTO_DETAILING_DESCRIPTION, AUTO_DETAILING_TITLE, autoDetailingJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/auto-detailing", AUTO_DETAILING_TITLE, AUTO_DETAILING_DESCRIPTION);

/**
 * /auto-detailing — "Websites and an AI receptionist for auto detailers."
 *
 * The fourth trade page. Every word was approved by Xander on 25 Nov 2026, over two rounds of a
 * mockup (https://claude.ai/artifact/7zV1jqzZ2TqT1C93dbfeU2), with the instruction that the build
 * match that mockup exactly, desktop and phone. Nothing here may be reworded or restyled without a
 * fresh approval; `test/auto-detailing-page.test.mjs` pins the sentences.
 *
 * NOT A COPY OF /hvac, /plumbing OR /lawn-care. Google treats near-identical trade pages as doorway
 * pages, so the content and the devices differ from the other three as much as the trade does:
 *
 *   - The hero is a car going through a detail — dull paint polished glossy — with the call that
 *     comes in mid-detail, not a phone of ringing calls or a mowing route.
 *   - The receptionist's call is drawn as a vehicle check-in sheet, a top-down car with the back
 *     seat marked, each field filled in beside the words that filled it.
 *   - The website section shows a real example site (Autobridge Car Detailing, built by us) as three
 *     phone screens, not one scrolling picture.
 *   - The searches are on license plates and the questions on windshield stickers.
 *   - The sum is on a dashboard, two odometers rolling to the cost.
 *
 * NOTHING INVENTED. No detailing client exists, so the call is the standard script's answers with
 * the pricing answer adapted from /plumbing's; the spill and the "cloth or leather" question come
 * from the detailing sample in the portal tour. Autobridge Car Detailing is our own example site,
 * named on the page as an example, not a client. The search phrases are the ones Ranktracker's
 * detailing guide names; detailing has no reliable monthly counts, so the plates carry none. No
 * region is named in the page's own copy: that is settled site-wide.
 *
 * Styles are `.detail-*` at the end of globals.css. `.detail-m-cut` marks what a phone leaves out.
 * The closing pair is the shared `PageAsk`, as every other page closes on.
 */

/** The call, written onto the vehicle check-in sheet field by field as it goes. */
const SHEET = [
    {
        lbl: "Needs",
        val: "Interior: a spill on the back seat",
        turns: [
            { who: "rec" as const, says: "Thanks for calling. How can I help?" },
            { who: "caller" as const, says: "I spilled coffee and a milkshake all over the back seat of my truck." },
        ],
    },
    {
        lbl: "Vehicle",
        val: "2019 F-150, cloth seats",
        turns: [
            { who: "rec" as const, says: "Sorry to hear that. Are the seats cloth or leather?" },
            { who: "caller" as const, says: "Cloth. It's a 2019 F-150." },
        ],
    },
    {
        lbl: "Where",
        val: "At home, in the driveway",
        cut: true,
        turns: [
            { who: "rec" as const, says: "And where's the truck right now?" },
            { who: "caller" as const, says: "It's in my driveway." },
        ],
    },
    {
        // The one field the receptionist deliberately leaves blank: the price is the owner's.
        lbl: "Price",
        val: "Yours to quote",
        yours: true,
        turns: [
            { who: "caller" as const, says: "What's that going to cost me?" },
            {
                who: "rec" as const,
                says: "We're not able to give a price until we've seen the truck. Someone from the team will call you back with a quote.",
            },
        ],
    },
];

/** The portal inbox, with the call above as its newest row. The older row is the portal tour's sample. */
const INBOX = [
    {
        day: "TODAY",
        name: "Noel Bautista",
        chip: "Wants a callback",
        at: "2:47 PM",
        preview: "Coffee and a milkshake spilled on the back seat of a 2019 F-150. Cloth seats. The truck is in his driveway. Asked what it costs.",
    },
    {
        day: "YESTERDAY",
        name: "Jim Petrakis",
        count: "2",
        at: "4:12 PM",
        preview: "Wants a full detail on two cars this month. Any day but Friday works.",
        read: true,
        cut: true,
    },
];

/** What the receptionist leaves to the owner, each on a tree air freshener. */
const TREES = [
    { tone: "t-green", head: "The price", copy: "It never quotes. It tells the caller the team will call back with one." },
    {
        tone: "t-coral",
        head: "The booking",
        copy: "It never books a time or promises a day. It takes their details and says someone from the team will call to schedule.",
    },
    {
        tone: "t-blue",
        head: "Anything it isn't sure of",
        copy: "It never guesses about your business. It says the team will follow up with the right answer, and passes the question to you.",
    },
];
/** The tree air-freshener outline. Our own drawing, not a copy of the branded shape. */
const TREE = "M165 8 L243 124 L227 118 L281 228 L265 222 L307 332 L293 326 L323 412 L209 412 L209 448 L121 448 L121 412 L7 412 L37 326 L23 332 L65 222 L49 228 L103 118 L87 124 Z";

/** The three example-site screens, taken from the live Autobridge Car Detailing site. */
const PHONES = [
    {
        src: "/auto-detailing-site-1.webp",
        alt: "The top of the example detailing site on a phone: the headline, a call button, and the start of the estimate form",
        t: "The first screen",
        h: "Your number, then a form",
        p: "A tap-to-call button under the headline and a short estimate form right after it. Every request lands in your portal inbox.",
    },
    {
        src: "/auto-detailing-site-2.webp",
        alt: "The services section of the example detailing site on a phone, starting with Exterior Hand Wash",
        t: "Services",
        h: "A page for each service",
        p: "Hand wash, interior, paint correction, ceramic coating and more. A service gets its own page when you've told us enough to fill one.",
    },
    {
        src: "/auto-detailing-site-3.webp",
        alt: "The questions section of the example detailing site on a phone",
        t: "Questions",
        h: "Your customers' questions",
        p: "Answered in your words, from what you tell us.",
    },
];

/** What people search, on license plates. The phrases are named in Ranktracker's detailing guide;
    no monthly count is published for detailing, so the plates carry none. */
const PLATES = [
    { tag: "Near me", num: "Car detailing" },
    { tag: "Your town", num: "Mobile detailing service" },
    { tag: "Your town", num: "Ceramic coating" },
    { tag: "Your town", num: "Paint correction specialist" },
];

/** What they ask on calls, on windshield stickers. The first two are from the example site and the
    portal tour's sample lead; the third is an example. */
const STICKERS = [
    { q: "Do you come to me, or do I bring it in?" },
    { q: "Would polishing take those scratches out?" },
    { q: "How long will you need the car?", cut: true },
];

export default function AutoDetailingPage() {
    return (
        <main className="detail-page">
            <JsonLd data={autoDetailingJsonLd()} />

            {/* 1 · Hero: the claim left, a car being polished with the call that came mid-detail, right. */}
            <div className="detail-shell detail-shell-hero">
                <div className="detail-hero">
                    <div className="detail-hero-copy">
                        <p className="kicker">For auto detailing businesses</p>
                        <h1 className="detail-h1">
                            Websites and an AI receptionist for <span className="detail-coral">auto detailers.</span>
                        </h1>
                        <p className="detail-intro">
                            We write, build and host your detailing website. Then every call you can&apos;t take gets
                            answered.
                        </p>
                        <p className="detail-lede detail-m-cut">
                            Your phone rings first. If nobody picks up, the AI receptionist does, 24/7, in English or in
                            Spanish. It finds out what car it is, what it needs and where it&apos;s parked, and puts the
                            lead straight into your portal.
                        </p>
                        {/* Every Get started on the site goes to /contact. */}
                        <div className="detail-acts">
                            <Link href="/contact" className="btn primary lg">
                                Get started
                            </Link>
                            <Link href="/pricing" className="btn ghost lg">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>
                    <div className="detail-inbay">
                        <h2 className="detail-inbay-h">
                            While you&apos;re <span className="detail-coral">mid-detail.</span>
                        </h2>
                        <DetailBay />
                        <p className="detail-then">
                            <b>Only then.</b> It never answers before you do.
                        </p>
                    </div>
                </div>
            </div>

            {/* 2 · The receptionist on a detailing call, then where the lead lands. */}
            <section className="wash">
                <div className="detail-shell">
                    <div className="detail-split-head">
                        <div>
                            <p className="detail-now">
                                <Voice live />
                                The AI receptionist
                            </p>
                            <h2 className="detail-h2">
                                On a detailing call, it asks <span className="detail-coral">about the car.</span>
                            </h2>
                        </div>
                        <p className="detail-lede">
                            Your AI receptionist is set up for your detailing business before it takes a single call. It
                            lets the caller explain, then asks one question at a time: what it needs, what car it is, and
                            where it&apos;s parked.
                        </p>
                    </div>

                    <div className="detail-sheet">
                        <div className="detail-sheet-car">
                            <div className="detail-sheet-title">
                                <b>Vehicle check-in</b>
                                <span className="detail-eg">Example call</span>
                            </div>
                            <svg className="detail-plan" viewBox="0 0 200 380" role="img" aria-label="A car seen from above, with the back seat marked">
                                <rect className="wheel" x="19" y="70" width="14" height="50" rx="6" />
                                <rect className="wheel" x="167" y="70" width="14" height="50" rx="6" />
                                <rect className="wheel" x="19" y="262" width="14" height="50" rx="6" />
                                <rect className="wheel" x="167" y="262" width="14" height="50" rx="6" />
                                <rect className="shell" x="30" y="10" width="140" height="360" rx="48" />
                                <path className="pane" d="M48 114 Q100 94 152 114 L144 148 Q100 136 56 148 Z" />
                                <path className="pane" d="M56 300 Q100 312 144 300 L150 328 Q100 342 50 328 Z" />
                                <rect className="seat" x="52" y="158" width="42" height="46" rx="8" />
                                <rect className="seat" x="106" y="158" width="42" height="46" rx="8" />
                                <circle className="ring" cx="100" cy="236" r="44" />
                                <rect className="seat hit" x="52" y="214" width="96" height="44" rx="8" />
                            </svg>
                            <p className="detail-plan-cap">
                                <span className="detail-eg">Marked on the sheet</span>
                                <b>Back seat</b>
                            </p>
                        </div>
                        <div className="detail-rows">
                            {SHEET.map((row) => (
                                <div key={row.lbl} className={`detail-row${row.yours ? " yours" : ""}${row.cut ? " detail-m-cut" : ""}`}>
                                    <div className="detail-field">
                                        <span className="detail-lbl">{row.lbl}</span>
                                        <span className="detail-val">{row.yours ? <span>{row.val}</span> : row.val}</span>
                                    </div>
                                    <div className="detail-heard">
                                        {row.turns.map((t, j) => (
                                            <div className={`detail-line ${t.who}`} key={j}>
                                                <span className="detail-mark" aria-hidden="true">
                                                    {t.who === "rec" ? <Voice live /> : <DetailIcon name="phone" />}
                                                </span>
                                                <p className="detail-who">{t.who === "rec" ? "Receptionist" : "Caller"}</p>
                                                <p className="detail-says">&ldquo;{t.says}&rdquo;</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="detail-ended">
                        <span className="detail-end-pill">Call ended &middot; 1:26</span>
                        <span className="detail-end-line" aria-hidden="true" />
                        <svg className="detail-ic detail-end-arrow" aria-hidden="true" viewBox="0 0 24 24">
                            <path d="M12 4v15M6 13l6 6 6-6" />
                        </svg>
                    </div>

                    <div className="detail-lands">
                        <div>
                            <h3 className="detail-lands-h">
                                The call ends. The lead lands <span className="detail-coral">in your portal.</span>
                            </h3>
                            <p className="detail-lands-sub">This is that call, in your portal inbox, and the text you get.</p>
                        </div>
                        <div className="detail-land">
                            <div
                                className="detail-inbox"
                                role="img"
                                aria-label="Example: the portal inbox, with the lead from this call as the newest row"
                            >
                                <div className="detail-inbox-top">
                                    <b>Inbox</b>
                                    <span>Needs you</span>
                                </div>
                                {INBOX.map((row) => (
                                    <Fragment key={row.name}>
                                        <div className="detail-inbox-day">{row.day}</div>
                                        <div className={`detail-irow${row.read ? " is-read" : ""}${row.cut ? " detail-m-cut" : ""}`}>
                                            <span className="detail-irow-dot" />
                                            <div>
                                                <div className="detail-irow-r1">
                                                    <strong>{row.name}</strong>
                                                    {row.chip ? <span className="detail-irow-chip">{row.chip}</span> : null}
                                                    {row.count ? <span className="detail-irow-count">{row.count}</span> : null}
                                                    <time>{row.at}</time>
                                                </div>
                                                <p className="detail-irow-pv">{row.preview}</p>
                                                <span className="detail-irow-mini">Call</span>
                                            </div>
                                        </div>
                                    </Fragment>
                                ))}
                            </div>
                            <DetailPhone />
                        </div>
                        <p className="detail-eg detail-land-cap">Example lead. Example text.</p>
                    </div>

                    <div className="detail-keys">
                        <h3 className="detail-keys-h">
                            Three things it hands back <span className="detail-coral">to you.</span>
                        </h3>
                        <div className="detail-trees">
                            {TREES.map((tree) => (
                                <div className="detail-tree-wrap" key={tree.head}>
                                    <div className={`detail-tree ${tree.tone}`}>
                                        <svg className="detail-tree-shape" viewBox="0 0 330 460" aria-hidden="true">
                                            <path className="leaf" d={TREE} />
                                            <path className="inset" d={TREE} />
                                            <circle className="hole" cx="165" cy="52" r="8" />
                                            <path className="cord" d="M165 52 Q160 6 167 -46" />
                                        </svg>
                                        <div className="detail-tree-txt">
                                            <p className="detail-tree-no">Yours</p>
                                            <h4>
                                                <span>{tree.head}</span>
                                            </h4>
                                            <p className="detail-tree-what">
                                                <span>{tree.copy}</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="detail-keys-foot">And whenever it&apos;s asked, it says it&apos;s a virtual assistant.</p>
                    </div>
                </div>
            </section>

            {/* 3 · The detailing website: an example site we built, as three phone screens. */}
            <section>
                <div className="detail-shell">
                    <div className="detail-split-head">
                        <h2 className="detail-h2">
                            What&apos;s on your <span className="detail-coral">detailing website.</span>
                        </h2>
                        <p className="detail-lede">
                            You answer a few questions. We write it, build it and host it. This is Autobridge Car
                            Detailing, an example site we built. Yours carries your name, your colours, your photos, your
                            services and your towns.
                        </p>
                    </div>
                    <div className="detail-phones">
                        {PHONES.map((ph) => (
                            <div className="detail-ph" key={ph.t}>
                                <div className="detail-handset">
                                    <span className="detail-scr" role="img" aria-label={ph.alt} style={{ backgroundImage: `url(${ph.src})` }} />
                                </div>
                                <div className="detail-ph-cap">
                                    <span className="detail-ph-t">{ph.t}</span>
                                    <h3>{ph.h}</h3>
                                    <p>{ph.p}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="detail-shotcap">
                        <span className="detail-eg">Autobridge Car Detailing is an example business, not a client.</span>
                        <span className="detail-eg detail-m-cut">Under all of it: titles, a sitemap, structured data, fast pages.</span>
                    </div>
                </div>
            </section>

            {/* 4 · What they search, beside what they ask on the phone. */}
            <section className="wash">
                <div className="detail-shell">
                    <div className="detail-centre detail-find">
                        <h2 className="detail-h2">
                            What your customers are trying to <span className="detail-coral">find out.</span>
                        </h2>
                        <p className="detail-lede">
                            Nobody waits long with a milkshake in the back seat. They search, they call, and they hire
                            whoever answers.
                        </p>
                    </div>
                    <div className="detail-qa">
                        <div>
                            <h3 className="detail-qa-h">
                                <DetailIcon name="search" />
                                What they search
                            </h3>
                            <div className="detail-plates" role="list" aria-label="Four searches people make for car detailing">
                                {PLATES.map((p, i) => (
                                    <div className={`detail-plate${i === 3 ? " detail-m-cut" : ""}`} role="listitem" key={p.num}>
                                        <span className="detail-plate-tag">{p.tag}</span>
                                        <span className="detail-plate-num">{p.num}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="detail-eg detail-src">Search phrases: Ranktracker, Car Detailing SEO</p>
                            <div className="detail-answers">
                                <p className="detail-answers-lead">Your site is built to be found for searches like these.</p>
                                <p className="detail-m-cut">Your services and your towns get their own pages, written from what you tell us.</p>
                            </div>
                        </div>
                        <div>
                            <h3 className="detail-qa-h">
                                <Voice live />
                                What they ask on calls
                            </h3>
                            <div className="detail-shield">
                                <div className="detail-stickers">
                                    {STICKERS.map((s) => (
                                        <div className={`detail-sticker${s.cut ? " detail-m-cut" : ""}`} key={s.q}>
                                            <p className="detail-band">
                                                <Voice />
                                                Asked on a call
                                            </p>
                                            <q>{s.q}</q>
                                        </div>
                                    ))}
                                </div>
                                <div className="detail-wipers" aria-hidden="true">
                                    <i />
                                    <i />
                                </div>
                            </div>
                            <div className="detail-answers">
                                <p className="detail-answers-lead">Your receptionist answers the questions you&apos;d normally answer yourself.</p>
                                <p className="detail-m-cut">Then it takes their details and leaves the job and the price to you.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5 · What a missed call costs, on the dashboard. */}
            <section>
                <div className="detail-shell">
                    <div className="detail-centre">
                        <h2 className="detail-h2">
                            A missed call drives <span className="detail-coral">to the next shop.</span>
                        </h2>
                        <p className="detail-lede">
                            Most people who call a business and reach a recording just hang up and call the next name on
                            the list.
                        </p>
                    </div>
                    <DetailDash />
                    <p className="detail-eg detail-wo-src">
                        Both percentages: Invoca, Home Services Call Conversion Benchmarks 2025. &ldquo;Won back&rdquo; is
                        our own estimate: half.
                    </p>
                </div>
            </section>

            {/* 6 · The same two asks every page closes on. */}
            <section className="wash">
                <div className="detail-shell detail-close">
                    <div className="detail-centre">
                        <h2 className="detail-h2 detail-close-h">
                            Call it. <span className="detail-coral">See who picks up.</span>
                        </h2>
                        <p className="detail-lede">
                            Plans start at ${SCHEDULES.starter.monthlyPrice} a month. Month to month, no contract.
                        </p>
                    </div>
                    <PageAsk className="detail-ask" />
                </div>
            </section>
        </main>
    );
}
