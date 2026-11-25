import type { Metadata } from "next";
import Link from "next/link";
import JsonLd from "@/app/components/JsonLd";
import ServiceClose from "@/app/components/services/ServiceClose";
import ServiceRail from "@/app/components/services/ServiceRail";
import SvcIcon, { Wave } from "@/app/components/services/SvcIcon";
import { DEMO_TEL, DEMO_TEL_DISPLAY } from "@/app/data/demo-line";
import { RECEPTIONIST_PLAN } from "@/app/lib/service-prices";
import { AI_RECEPTIONIST_DESCRIPTION, AI_RECEPTIONIST_TITLE, aiReceptionistJsonLd, pageMetadata } from "@/app/lib/site-seo";

export const metadata: Metadata = pageMetadata("/ai-receptionist", AI_RECEPTIONIST_TITLE, AI_RECEPTIONIST_DESCRIPTION);

/**
 * /ai-receptionist: "A 24/7 AI receptionist for local service businesses."
 *
 * Built to the round-3 mockup Xander approved word for word on 24 Nov 2026
 * (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM#ai-receptionist). `test/service-pages.test.mjs`
 * pins it.
 *
 * The hero is the route a call takes, and it gives the owner the first chance: their phone rings,
 * "No answer", and only then does the receptionist pick up (Xander, round 2). No line names one
 * trade (round 3): the calls are labelled by what the caller wants. The receptionist's answers and
 * the never/instead rules are its real script's, as on the homepage. The price is the cheapest plan
 * with the receptionist, never the website-only plan's.
 */
const CALLS: { of: string; caller: string; receptionist: string; bars: number; phoneCut?: boolean }[] = [
    {
        of: "A price question",
        caller: "Can you give me a rough idea what this would cost?",
        receptionist: "I don't have pricing in front of me. The team will go over everything with you before any work starts.",
        bars: 7,
    },
    {
        of: "A scheduling question",
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

/** The script's hard rules, each over what it does instead. Word for word as the homepage and /hvac. */
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

export default function AiReceptionistPage() {
    return (
        <main className="svc-page">
            <JsonLd data={aiReceptionistJsonLd()} />

            <div className="svc-gut">
                <div className="svc-inner">
                    <div className="svc-hero">
                        <div>
                            <p className="svc-kicker">AI receptionist</p>
                            <h1 className="svc-h1">
                                A 24/7 AI receptionist for <span className="svc-em">local service businesses.</span>
                            </h1>
                            <p className="svc-intro">
                                The AI never answers before you do. A caller rings your real phone first, and only if nobody picks up does the AI step in. It is replacing your voicemail, not replacing you.
                            </p>
                            <div className="svc-acts">
                                <Link href="/contact" className="btn primary">
                                    Get Started
                                </Link>
                                <a href={DEMO_TEL} className="btn ghost">
                                    Call the demo
                                </a>
                            </div>
                        </div>
                        <ol className="svc-route" aria-label="The route a call takes">
                            <li className="svc-stop">
                                <span className="svc-dot">
                                    <SvcIcon name="user" />
                                </span>
                                <p>
                                    <b>A customer calls</b>
                                    <span className="s">Your number, the one on your site.</span>
                                </p>
                            </li>
                            <li className="svc-stop svc-ringing">
                                <span className="svc-dot">
                                    <SvcIcon name="phone" />
                                </span>
                                <p>
                                    <b>Your phone rings first</b>
                                    <span className="s">Pick up and it&apos;s your call, the same as always.</span>
                                </p>
                            </li>
                            <li className="svc-gap">
                                <span className="svc-gap-pill">
                                    <SvcIcon name="x" />
                                    No answer
                                </span>
                                <span className="svc-gap-why">On another call, or asleep.</span>
                            </li>
                            <li className="svc-stop ai">
                                <span className="svc-dot">
                                    <Wave bars={5} live />
                                </span>
                                <p>
                                    <b>Only then, the AI receptionist answers</b>
                                    <span className="s">It never answers before you do. 24/7, in English or in Spanish.</span>
                                </p>
                            </li>
                            <li className="svc-stop">
                                <span className="svc-dot">
                                    <SvcIcon name="tray" />
                                </span>
                                <p>
                                    <b>The lead lands in your portal</b>
                                    <span className="s">And you get a text saying it&apos;s there.</span>
                                </p>
                            </li>
                        </ol>
                    </div>
                    <ServiceRail current="/ai-receptionist" />
                </div>
            </div>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head">
                        <h2 className="svc-h2">
                            It asks what <span className="svc-em">you&apos;d ask.</span>
                        </h2>
                        <p className="svc-lede">
                            It asks the questions you&apos;d ask, in English or in Spanish. It captures the lead&apos;s name, number and what the job is. Then the lead goes straight into your portal, and you get a text saying it&apos;s there.
                        </p>
                    </div>
                    {/* Drawn as voices, never as chat bubbles: it talks, it doesn't text. */}
                    <div className="svc-log">
                        {CALLS.map((c) => (
                            <div key={c.of} className={`svc-lg${c.phoneCut ? " svc-m-cut" : ""}`}>
                                <p className="svc-lg-of">
                                    {c.of}
                                    <span>Example caller</span>
                                </p>
                                <div className="svc-lg-said">
                                    <figure className="svc-said-c">
                                        <figcaption className="svc-voice">
                                            <Wave bars={c.bars} />
                                            Caller asks
                                        </figcaption>
                                        <blockquote>&ldquo;{c.caller}&rdquo;</blockquote>
                                    </figure>
                                    <figure className="svc-said-r">
                                        <figcaption className="svc-voice">
                                            <Wave bars={7} live />
                                            Receptionist answers
                                        </figcaption>
                                        <blockquote>&ldquo;{c.receptionist}&rdquo;</blockquote>
                                    </figure>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            What it will <span className="svc-em">never do.</span>
                        </h2>
                    </div>
                    <div className="svc-rules">
                        {NEVER.map((r) => (
                            <div key={r.never} className="svc-rule">
                                <p className="svc-rule-no">
                                    <span className="svc-m">
                                        <SvcIcon name="x" />
                                    </span>
                                    {r.never}
                                </p>
                                <p className="svc-rule-yes">
                                    <span className="svc-m">
                                        <SvcIcon name="check" />
                                    </span>
                                    <span>
                                        <small>Instead</small>
                                        {r.instead}
                                    </span>
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-wash svc-gut">
                <div className="svc-inner">
                    <div className="svc-head svc-head-c">
                        <h2 className="svc-h2">
                            Is this an <span className="svc-em">answering service?</span>
                        </h2>
                    </div>
                    <div className="svc-hear">
                        <div className="svc-faq2">
                            <div>
                                <h3>Yes, an AI one.</h3>
                                <p>
                                    It only picks up when you don&apos;t. It answers 24/7 in English or Spanish, takes the caller&apos;s name, number and what the job is, puts the lead in your portal and texts you that it&apos;s there.
                                </p>
                            </div>
                            <div>
                                <h3>Do I have to forward my phone?</h3>
                                <p>
                                    You pick one of two ways: forward your existing business line to the number we give you, so the AI only ever hears the calls you didn&apos;t pick up, or publish our number as your business number. Either works.{" "}
                                    <span className="svc-m-cut">
                                        We walk you through it, though your phone carrier has to make the change, so we can&apos;t do that part for you.
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="svc-dialbox">
                            <p className="svc-ask-h">
                                Hear it <span className="svc-em">for yourself.</span>
                            </p>
                            <a href={DEMO_TEL} className="svc-dial">
                                <SvcIcon name="cell" className="svc-ringer" />
                                <span className="svc-dial-n">{DEMO_TEL_DISPLAY}</span>
                            </a>
                            <p className="svc-lede" style={{ fontSize: 16.5 }}>
                                Call our demo line and decide for yourself. That&apos;s why it&apos;s there. We&apos;d rather you hear it than take our word for it.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="svc-sec svc-gut">
                <div className="svc-inner">
                    <ServiceClose
                        price={
                            <>
                                Plans with the AI receptionist start at ${RECEPTIONIST_PLAN.monthlyPrice} a month, website included. Month to month, no contract.
                            </>
                        }
                        next={{ lead: "Next in the system", href: "/crm", label: "Portal + CRM" }}
                    />
                </div>
            </section>
        </main>
    );
}
