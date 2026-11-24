"use client";

import Image from "next/image";
import Link from "next/link";
import FeaturedSites from "./FeaturedSites";
import FindOut from "./FindOut";
import HeroForm from "./HeroForm";
import HomeIcon, { RingArcs, Wave, type HomeIconName } from "./HomeIcon";
import LeadLands from "./LeadLands";
import YearCalculator from "./YearCalculator";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import { DEMO_SITE_URL } from "@/app/data/demo-site";
import { DEMO_TEL, DEMO_TEL_DISPLAY } from "@/app/data/demo-line";

/**
 * The homepage, redesigned in the /hvac page's voice and approved by Xander from three rounds of
 * a mockup on 19 Nov 2026: https://claude.ai/artifact/TuaQSED4zBHvbTof2RLM6T. Built to the mockup
 * exactly ("What we see here in the mockup is exactly what should be on the homepage"), so nothing
 * here may be reworded, reordered or restyled without a fresh approval. `test/homepage.test.mjs`
 * pins the sentences.
 *
 * Order is the argument. The claim, with the form beside it. What customers are trying to find
 * out, which frames both halves of the product: the searches lead into the website, the questions
 * into the receptionist. The website, in six points. The receptionist, then what it will never do.
 * Where the lead lands. What missed calls cost. Client sites. What every plan gets, and the ask.
 *
 * Gone in the redesign: the Get Started drawer (every Get Started now goes to /contact), the
 * scrolling laptop, the receptionist film and the portal demo (Xander: show the portal's outcome,
 * not a walkthrough).
 *
 * Sections carry their own devices, as /hvac's do, but drawn differently so the homepage does not
 * look like a trade page. No region is named anywhere (Xander, 19 Nov 2026). Styles are `.hp-*`
 * at the end of globals.css; `.hp-m-cut` is what a phone leaves out.
 */

/* Prices come from Schedule A, never typed in by hand: a number written into marketing copy is a
   number that can eventually contradict the signed agreement. */
const STARTER_PRICE = SCHEDULES.starter.monthlyPrice;
const GROWTH_PRICE = SCHEDULES.growth.monthlyPrice;
const ENTERPRISE_PRICE = SCHEDULES.enterprise.monthlyPrice;

/* ── 1 · Hero: the claim on the left, the form itself on the right ─────────── */
function Hero() {
    return (
        <div className="hp-wrap hp-hero-wrap">
            <div className="hp-hero">
                <div>
                    {/* The page's one h1 names what we sell, in the words people search (Xander, 24 Nov
                        2026, option C of the header mockup: https://claude.ai/artifact/HYDzyGNo9rYfy8HgAg4MAz).
                        The three beats that used to be the headline sit above it as its eyebrow, with the
                        third still the spine of the page: what the whole system adds up to. */}
                    <p className="hp-beats">
                        <span>Get found.</span> <span>Get called.</span> <span className="home-em">Run like a team.</span>
                    </p>
                    <h1 className="hp-h1">
                        Website design and AI receptionist for <span className="hp-h1-em">local service businesses.</span>
                    </h1>
                    {/* Xander's three beats, approved word for word on 19 Nov 2026 (draft A): the website,
                        the receptionist in voicemail's place, the one place leads land. */}
                    <p className="hp-hero-p">
                        We build you a website that gets you found and noticed. Then we go a step further and replace your voicemail with a 24/7 receptionist. Every lead lands in one place.
                    </p>
                    {/* Each trade becomes a link once its own page is live (HVAC, then plumbing, 19 Nov 2026;
                        lawn care, 20 Nov 2026). "auto detailing" is Xander's exact wording (19 Nov 2026). */}
                    <p className="hp-hero-trades">
                        Built for <Link href="/hvac" className="home-trade-link">HVAC</Link>, <Link href="/plumbing" className="home-trade-link">plumbing</Link>, roofing, <Link href="/lawn-care" className="home-trade-link">lawn care</Link>, pressure washing and auto detailing businesses.
                    </p>
                </div>
                <HeroForm />
            </div>
        </div>
    );
}

/* ── 3 · The website, in six points, each beside the real piece of the demo site ── */
const SITE_POINTS: { img: string; alt: string; heading: string; body: string; rings?: { left: string; top: string; width?: string }[] }[] = [
    {
        img: "/home/site-form.webp",
        alt: "The demo site's first screen: a short form asking for a name and phone number.",
        heading: "A form on the first screen",
        body: "Name and phone number, nothing else to fill in. On Growth, the receptionist calls them back within about a minute.",
    },
    {
        img: "/home/site-number.webp",
        alt: "The demo site's first screen, with the phone number in the header, on a button and under the form.",
        heading: "Your number, everywhere",
        body: "In the header, on the first screen and in the footer. On a phone, one tap calls you.",
        /* The three places the number sits in this crop, marked in coral. */
        rings: [
            { left: "76.3%", top: "4.6%" },
            { left: "16.6%", top: "64.3%" },
            { left: "78.5%", top: "77.8%", width: "12%" },
        ],
    },
    {
        img: "/home/site-services.webp",
        alt: "The demo site's services section, one card per service.",
        heading: "Your services, page by page",
        body: "A service gets its own page when you've told us enough to fill one.",
    },
    {
        img: "/home/site-towns.webp",
        alt: "The demo site's service area, listing the towns the business works in.",
        heading: "The towns you work in",
        body: "Listed on the site, with a page for a town when there's something real to say about it.",
    },
    {
        img: "/home/site-proof.webp",
        alt: "The demo site's reviews section, with sample reviews.",
        heading: "Proof that's yours",
        body: "Photos from your real jobs and your business, your reviews, your certifications. We don't write reviews, and a section with nothing real in it stays off your site.",
    },
    {
        img: "/home/site-questions.webp",
        alt: "The demo site's questions section, with one answer open.",
        heading: "Your customers' questions",
        body: "Answered in your words, from what you tell us.",
    },
];

function WebsiteSection() {
    return (
        <section>
            <div className="hp-wrap">
                <div className="home-head">
                    <h2 className="home-display">
                        A website that makes the <span className="home-em">phone ring.</span>
                    </h2>
                    <div className="home-head-copy">
                        <p className="home-lede">
                            You answer a few questions. We write it, build it and host it. After that, there&apos;s nothing for you to do.
                        </p>
                        <p className="home-promise">Below is what your site could look like</p>
                    </div>
                </div>

                {/* On a phone the six become a row you swipe, one at a time. */}
                <ol className="hp-specs">
                    {SITE_POINTS.map((p, i) => (
                        <li key={p.heading} className="hp-spec">
                            <div className="hp-shot">
                                <div className="hp-shot-f">
                                    <Image src={p.img} alt={p.alt} width={780} height={520} sizes="(max-width: 800px) 84vw, 420px" />
                                    {p.rings?.map((r) => (
                                        <i key={r.left} className="hp-ring" style={{ left: r.left, top: r.top, ...(r.width ? { width: r.width } : {}) }} />
                                    ))}
                                </div>
                                <span className="hp-spec-n" aria-hidden="true">
                                    {String(i + 1).padStart(2, "0")}
                                </span>
                            </div>
                            <h3>{p.heading}</h3>
                            <p>{p.body}</p>
                        </li>
                    ))}
                </ol>
                <p className="hp-eg hp-swipe">Swipe · six in all</p>
                <div className="hp-specs-cap">
                    <span className="hp-eg">A demo site, with sample details.</span>
                    <a href={DEMO_SITE_URL} target="_blank" rel="noopener noreferrer">
                        Visit site <HomeIcon name="out" />
                    </a>
                </div>
                <p className="hp-under hp-m-cut">
                    Under all of it: page titles and descriptions, a sitemap, structured data, and fast pages that work on phones.
                </p>
            </div>
        </section>
    );
}

/* ── 4 + 5 · The receptionist: example calls, then what it will never do ──── */
/* The receptionist's lines are its real script's; the callers' lines are examples. Each call shows
   one of the rules in the ledger under it (price, booking, being a person). */
const CALLS: { of: string; caller: string; receptionist: string; bars: number; phoneCut?: boolean }[] = [
    {
        of: "A roofing call",
        caller: "What would it cost to replace the roof on a ranch house?",
        receptionist: "I don't have pricing in front of me. The team will go over everything with you before any work starts.",
        bars: 7,
    },
    {
        of: "A lawn care call",
        caller: "We're hosting on Saturday. Can you get someone out tomorrow?",
        receptionist: "I don't have the schedule in front of me, but someone from the team will reach out shortly and get that locked in for you.",
        bars: 5,
        phoneCut: true,
    },
    {
        of: "Any call",
        caller: "Wait, am I talking to a real person?",
        receptionist: "I'm actually a virtual assistant. I work with the team to make sure your request gets to the right person fast.",
        bars: 5,
    },
];

/* The script's hard rules, each beside what it does in their place. Word for word as /hvac. */
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

function ReceptionistSection() {
    return (
        <section className="hp-wash">
            <div className="hp-wrap">
                <div className="home-head">
                    {/* Named before the page calls it "it" (Xander, on /hvac). */}
                    <p className="hp-now">
                        <Wave live />
                        The AI receptionist
                    </p>
                    <h2 className="home-display">
                        Then someone <span className="home-em">picks up.</span>
                    </h2>
                    <div className="home-head-copy">
                        <p className="home-lede">
                            It asks the questions you&apos;d ask, in English or in Spanish. It captures the lead&apos;s name, number and what the job is. Then the lead goes straight into your portal, and you get a text saying it&apos;s there.
                        </p>
                    </div>
                </div>

                <div className="hp-onair-row">
                    <span className="hp-onair">
                        <HomeIcon name="phone" />
                        Example calls
                        <Wave live />
                    </span>
                </div>
                {/* Drawn as voices, never as chat bubbles: it talks, it doesn't text. */}
                <div className="hp-calls">
                    {CALLS.map((c) => (
                        <div key={c.of} className={`hp-call${c.phoneCut ? " hp-m-cut" : ""}`}>
                            <p className="hp-call-of">{c.of}</p>
                            <figure className="hp-said-c">
                                <figcaption className="hp-voice">
                                    <Wave bars={c.bars} />
                                    <span className="hp-who">Caller asks</span>
                                </figcaption>
                                <blockquote>&ldquo;{c.caller}&rdquo;</blockquote>
                            </figure>
                            <figure className="hp-said-r">
                                <figcaption className="hp-voice">
                                    <Wave bars={7} live />
                                    <span className="hp-who">Receptionist answers</span>
                                </figcaption>
                                <blockquote>&ldquo;{c.receptionist}&rdquo;</blockquote>
                            </figure>
                        </div>
                    ))}
                </div>
                <p className="hp-urgent-link">
                    What counts as urgent depends on the trade. <Link href="/hvac">See how it handles an HVAC call.</Link>
                </p>

                <div className="hp-vs">
                    <div className="hp-vs-heads">
                        <h3>
                            What it will <span className="home-em">never do.</span>
                        </h3>
                        <h3>What it does instead.</h3>
                    </div>
                    {NEVER.map((row) => (
                        <div key={row.never} className="hp-vs-row">
                            <div className="hp-vs-cell hp-vs-no">
                                <div>
                                    <p className="hp-vs-lbl">Never</p>
                                    <p className="hp-say">{row.never}</p>
                                </div>
                                <span className="hp-m">
                                    <HomeIcon name="x" />
                                </span>
                            </div>
                            <div className="hp-vs-cell hp-vs-yes">
                                <span className="hp-m">
                                    <HomeIcon name="check" />
                                </span>
                                <div>
                                    <p className="hp-vs-lbl">Instead</p>
                                    <p className="hp-say">{row.instead}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ── 9 · Every plan starts here, the plans, the ask ────────────────────────── */
/* The two bolded lines are the tier line, and /pricing carries the same pair in its taglines.
   Change one, change both. */
const EVERY_PLAN: { icon: HomeIconName; label: string; title: string; detail: string }[] = [
    {
        icon: "browser",
        label: "Your website",
        title: "A custom 4+ page site",
        detail: "Home, Services, About and Contact, plus pages for your services and the towns you work in, built from the details you give us. Hosting, SSL, daily backups and uptime monitoring included, plus 2 content edits a month.",
    },
    {
        icon: "phone",
        label: "Your phone",
        title: "It rings you first",
        detail: "If you don’t pick up, the AI receptionist answers, 24/7, in English or Spanish. You get a summary of every call.",
    },
    {
        icon: "tray",
        label: "Your leads",
        title: "One inbox for every lead",
        detail: "Every call and web inquiry lands in your portal, and you get a text the moment a new one arrives.",
    },
];

function ClosingSection() {
    return (
        <section className="hp-wash">
            <div className="hp-wrap">
                <div className="home-head">
                    <h2 className="home-display">
                        Every plan <span className="home-em">starts here.</span>
                    </h2>
                </div>
                <div className="hp-closing">
                    <div>
                        {EVERY_PLAN.map((b) => (
                            <div key={b.label} className="hp-base-item">
                                <HomeIcon name={b.icon} className="hp-base-ic" />
                                <div>
                                    <p className="kicker">{b.label}</p>
                                    <h3>{b.title}</h3>
                                    <p>{b.detail}</p>
                                </div>
                            </div>
                        ))}
                        <p className="hp-bill">One system. One monthly bill.</p>
                    </div>

                    <div className="hp-plans-panel">
                        <div className="hp-cplan">
                            <p className="kicker">Starter</p>
                            <p className="hp-price">
                                ${STARTER_PRICE}
                                <span>/mo</span>
                            </p>
                            <p>
                                Everything every plan gets. This is where it starts. <strong>Starter reports every lead.</strong>
                            </p>
                        </div>
                        {/* "Within about a minute", matching /pricing and the contract's "typically within
                            sixty (60) seconds". */}
                        <div className="hp-cplan feat">
                            <p className="kicker">
                                <span className="hp-live-dot" aria-hidden="true" />
                                Growth
                            </p>
                            <p className="hp-price">
                                ${GROWTH_PRICE}
                                <span>/mo</span>
                            </p>
                            <p>
                                Everything in Starter, then it goes to work. Web leads get a call back within about a minute, and your portal becomes a pipeline you run from Lead to Won. <strong>Growth works them like a team would.</strong>
                            </p>
                        </div>
                        {/* "Two or three", not "up to three": Enterprise starts at two sites. */}
                        <div className="hp-cplan muted">
                            <p className="kicker">Enterprise</p>
                            <p className="hp-price">
                                ${ENTERPRISE_PRICE.toLocaleString("en-US")}
                                <span>/mo</span>
                            </p>
                            <p>
                                Two or three sites, each with its own receptionist and phone number, all feeding one portal. One monthly bill. <Link href="/pricing">See what&apos;s included &rarr;</Link>
                            </p>
                        </div>
                    </div>
                </div>

                {/* The two asks, set as headlines. Get Started goes to /contact, as on every page
                    (Xander, 19 Nov 2026). The demo number is the number itself, beside a phone that
                    rings every few seconds; the whole of it is the tap target. */}
                <div className="hp-ask">
                    <div className="hp-ask-half">
                        <p className="hp-ask-h">Get started.</p>
                        <p className="hp-ask-s">Contact us now.</p>
                        <div className="hp-ask-pair">
                            <Link href="/contact" className="btn primary lg">
                                Get Started
                            </Link>
                            <Link href="/pricing" className="btn ghost">
                                View plans + pricing
                            </Link>
                        </div>
                    </div>
                    <div className="hp-ask-vr" aria-hidden="true" />
                    <div className="hp-ask-half">
                        <p className="hp-ask-h">Need to hear it first?</p>
                        <p className="hp-ask-s">Call the demo.</p>
                        <a href={DEMO_TEL} className="hp-dial">
                            <span className="hp-ringer" aria-hidden="true">
                                <HomeIcon name="cell" />
                                <RingArcs className="hp-ringer-arcs" />
                            </span>
                            <span className="hp-dial-n">{DEMO_TEL_DISPLAY}</span>
                        </a>
                    </div>
                </div>
            </div>
        </section>
    );
}

/* ── Page (final section order) ─────────────────────────────────────────────── */
export default function HomePageClient({ featuredSites = [] }: { featuredSites?: import("@/app/page").PublishedFeaturedSite[] }) {
    return (
        <div className="hp-page">
            <Hero />
            <FindOut />
            <WebsiteSection />
            <ReceptionistSection />
            <LeadLands />
            <YearCalculator />
            <FeaturedSites sites={featuredSites} />
            <ClosingSection />
        </div>
    );
}
