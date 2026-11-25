"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Browser,
    CalendarCheck,
    Check,
    PhoneOutgoing,
    Plus,
    ShieldCheck,
    type Icon,
} from "@phosphor-icons/react";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import type { PlanSchedule } from "@/app/lib/legal/types";
import { LIVE_FAQ_ID, PRICING_FAQS } from "@/app/data/faq";
import { EVERY_PLAN } from "@/app/data/every-plan";
import { WEBSITE_PLAN } from "@/app/data/website-plan";

/* Every number on this page comes from the plan summary (app/lib/legal/schedules.ts), the same
   source the signed agreement renders from. The prose is hand-written; the figures are not, so
   a card cannot quote a client something the contract contradicts. */
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;
const minutes = (s: PlanSchedule) => s.callMinutes?.toLocaleString("en-US") ?? "0";
const overageRate = (s: PlanSchedule) => `$${(s.overagePerMinute ?? 0.2).toFixed(2)}`;

/** Where a plan button goes. `null`: the plan has no sign-up flow yet, so its button is inactive. */
type Checkout = "starter" | "growth" | "enterprise" | null;

type CardItem = {
    text: string;
    /** A short bold lead-in, set before `text`. */
    strong?: string;
    /** Sent from the client's own number, so it waits on carrier approval. Links to the FAQ. */
    gated?: boolean;
    /** Growth's highlight: drawn as the coral strip rather than a check. */
    callback?: boolean;
};

type PlanCard = {
    key: "website" | "starter" | "growth";
    name: string;
    schedule: PlanSchedule;
    /** The tier line, bold, then an optional plain second sentence. */
    tierLine: string;
    tierRest?: string;
    leadIn: string;
    items: CardItem[];
    /** The mono footnote under a rule. Minutes on the receptionist plans. */
    foot: string[];
    checkout: Checkout;
    cta: string;
    /** The short label a phone shows on the plan pill. */
    pill: string;
    highlighted: boolean;
};

/**
 * The three main cards. Copy approved by Xander word for word (rows F4–F7 and F14 of the
 * website-plan copy batch, 24 Nov 2026). Do not edit without a fresh approval.
 *
 * Rules the four-plan lineup sets, both deliberate:
 *
 *  - **Starter claims nothing about the phone.** No receptionist, no call capture, no minutes,
 *    and no lead texts (website-only owners get none, D9). It is the website plan.
 *  - **Each card says what it adds over the one before**, in three lines under "Everything in X,
 *    plus". Minutes are a footnote, never a headline.
 *
 * The tier lines match the sales tool's plan cards (D2), so the page and the call say the same.
 */
function planCards(leadTextsLive: boolean): PlanCard[] {
    const starter = SCHEDULES.starter;
    const growth = SCHEDULES.growth;
    return [
        {
            key: "website",
            name: "Starter",
            schedule: WEBSITE_PLAN,
            tierLine: "Starter catches every web lead.",
            leadIn: "Your website, plus",
            items: [
                { text: "Web form leads go straight to your portal inbox" },
                { text: "A search-ready build: fast pages, titles, descriptions and a sitemap" },
                { text: "Client portal to check your site and your web leads" },
            ],
            foot: ["Website only. We leave your phone alone."],
            /* Xander, 24 Nov 2026: "wait until it has a flow it can connect to." The button stays
               inactive until the $97 sign-up flow exists, then it reads "Start with Starter". */
            checkout: null,
            cta: "Coming soon",
            pill: "Starter",
            highlighted: false,
        },
        {
            /* Today's Starter, renamed. It keeps the `starter` slug and its checkout. */
            key: "starter",
            name: "Starter + AI Receptionist",
            schedule: starter,
            tierLine: "Starter + AI Receptionist answers every missed call.",
            tierRest: "The whole system, with the follow-up left to you.",
            leadIn: "Everything in Starter, plus",
            items: [
                { text: "If you don't pick up, the AI receptionist answers, 24/7, in English or Spanish" },
                /* Row F5 follows the owner-text campaign. Under v2 owners get a text for every new
                   lead; under v1 (live today) only after a call, so the card says that until the
                   switch flips (Xander, 24 Nov 2026, both lines word for word). */
                {
                    text: leadTextsLive
                        ? "A summary of every call, and a text the moment a new lead arrives"
                        : "A summary of every call, and a text after every call",
                },
                { text: "A guided walkthrough of Growth's pipeline, inside your portal" },
            ],
            foot: [`${minutes(starter)} AI minutes per month included`, `Extra minutes ${overageRate(starter)} each`],
            checkout: "starter",
            cta: "Start with Starter + AI",
            pill: "+ AI",
            highlighted: false,
        },
        {
            /* Growth leads with the customer system; the 60-second callback is its highlight
               underneath. "Within about a minute" matches the contract's "typically within
               sixty (60) seconds". */
            key: "growth",
            name: "Growth",
            schedule: growth,
            tierLine: "Growth works them like a team would.",
            leadIn: "Everything in Starter + AI Receptionist, plus",
            items: [
                { strong: "Customer pipeline.", text: "Move every lead from Lead to Won, with notes, job value and tags." },
                {
                    strong: "Customer texts and Google reviews.",
                    text: "Text customers back and ask for a review in one tap, from your business number.",
                    gated: true,
                },
                { strong: "The 60-second callback.", text: "Web form leads get a call back automatically, within about a minute.", callback: true },
            ],
            foot: [`${minutes(growth)} AI minutes per month included`, `Extra minutes ${overageRate(growth)} each`],
            checkout: "growth",
            cta: "Start with Growth",
            pill: "Growth",
            highlighted: true,
        },
    ];
}

const GROWTH_ALSO = "AI lead qualification, a searchable call log with recordings, and urgency and caller names pulled from every call.";

/* "One portal and call log", not "one pipeline": the contract promises a consolidated portal
   view across sites; a pipeline spanning sites is not verified. */
const ENTERPRISE_ITEMS = [
    "2 to 3 websites, for example a service site and an e-commerce site",
    "A dedicated AI receptionist and phone number per site",
    "One portal and call log covering every site",
];

const POINT_ICONS: Icon[] = [Browser, ShieldCheck, CalendarCheck];

export default function PricingPageClient({ leadTextsLive }: { leadTextsLive: boolean }) {
    const [loadingPlan, setLoadingPlan] = useState<Checkout>(null);
    /** The card a phone shows. Desktop shows all three and ignores it. Opens on the most popular. */
    const [activePlan, setActivePlan] = useState<PlanCard["key"]>("growth");
    const [enterpriseOpen, setEnterpriseOpen] = useState(false);
    const [openFaqs, setOpenFaqs] = useState<ReadonlySet<number>>(new Set());

    const cards = planCards(leadTextsLive);
    const enterprise = SCHEDULES.enterprise;
    const liveFaqIndex = PRICING_FAQS.findIndex((f) => f.id === LIVE_FAQ_ID);

    const toggleFaq = (i: number) =>
        setOpenFaqs((prev) => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i);
            else next.add(i);
            return next;
        });
    const openFaq = (i: number) => setOpenFaqs((prev) => (prev.has(i) ? prev : new Set(prev).add(i)));

    function subscribe(slug: Exclude<Checkout, null>) {
        setLoadingPlan(slug);
        /**
         * Everyone goes to `/start`, signed in or not. `/start` authenticates, resolves the
         * account, and only then decides whether this is a purchase, an addendum, or an upsell.
         * This page stays static and anonymous: it holds no entitlement logic, so there is
         * nothing here to disagree with the server. Every plan is month to month, so the plan
         * is all it sends.
         */
        window.location.assign(`/start?plan=${slug}`);
    }

    return (
        <main className="pricing-page">
            <div className="aurora-grid" />

            <div className="pricing-wrap">
                {/* ── Top section: full width, the copy on the left and the plans on the right
                    (Xander, 24 Nov 2026). Below 1180px the copy sits above the plans. ── */}
                <section className="pricing-top" aria-labelledby="pricing-h1">
                    <motion.div
                        className="pricing-copy"
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55, ease: "easeOut" }}
                    >
                        {/* Approved 2026-11-04. Colour-only emphasis, same display face: the
                            convention the homepage sets. */}
                        <h1 id="pricing-h1" className="pricing-h1">
                            Putting the system in your <span style={{ color: "var(--accent-2)" }}>hands</span>.
                        </h1>
                        <span className="pricing-rule" aria-hidden="true" />
                        <p className="kicker">On every plan</p>
                        {/* See EVERY_PLAN. On a phone the details are cut and the titles carry it. */}
                        <ul className="pricing-points">
                            {EVERY_PLAN.map(({ title, detail }, i) => {
                                const PointIcon = POINT_ICONS[i] ?? Check;
                                return (
                                    <li key={title} className="pricing-point">
                                        <span className="pricing-point-ico" aria-hidden="true">
                                            <PointIcon size={18} weight="regular" />
                                        </span>
                                        <div>
                                            <p className="pricing-point-title">{title}</p>
                                            <p className="pricing-point-detail">{detail}</p>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    </motion.div>

                    <div className="pricing-plans">
                        {/* On a phone one plan shows at a time, picked from this row of pills
                            (Xander, 24 Nov 2026). Hidden at 860px and up, where all three show. */}
                        <div className="pricing-pills" role="group" aria-label="Choose a plan">
                            {cards.map((c) => (
                                <button
                                    key={c.key}
                                    type="button"
                                    className="pricing-pill"
                                    aria-pressed={activePlan === c.key}
                                    onClick={() => setActivePlan(c.key)}
                                >
                                    <span className="pricing-pill-name">{c.pill}</span>
                                    <span className="pricing-pill-price">{dollars(c.schedule.monthlyPrice)}/mo</span>
                                </button>
                            ))}
                        </div>

                        <div className="pricing-cards" data-active={activePlan}>
                            {cards.map((card, index) => (
                                <motion.article
                                    key={card.key}
                                    data-plan={card.key}
                                    aria-label={`${card.name} plan`}
                                    className={`glass pricing-card${card.highlighted ? " pricing-card-feat" : ""}`}
                                    initial={{ opacity: 0, y: 24 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 + index * 0.08 }}
                                >
                                    {card.highlighted && <span className="pricing-badge">Most Popular</span>}
                                    <div>
                                        <span className="pricing-name">{card.name}</span>
                                    </div>
                                    <div className="pricing-price">
                                        <span className="pricing-amount">{dollars(card.schedule.monthlyPrice)}</span>
                                        <span className="pricing-per">/month</span>
                                    </div>
                                    <p className="pricing-setup">+ {dollars(card.schedule.onboardingFee)} one-time setup</p>
                                    <p className="pricing-tier">
                                        <strong>{card.tierLine}</strong>
                                        {card.tierRest && <> {card.tierRest}</>}
                                    </p>

                                    <p className="pricing-lead-in">{card.leadIn}</p>
                                    <ul className="pricing-list">
                                        {card.items.map((item) => (
                                            <li key={item.strong ?? item.text} className={item.callback ? "pricing-callback" : "pricing-item"}>
                                                {item.callback ? (
                                                    <PhoneOutgoing size={16} weight="bold" aria-hidden="true" className="pricing-callback-ico" />
                                                ) : (
                                                    <Check size={14} weight="bold" aria-hidden="true" className="pricing-check" />
                                                )}
                                                <span>
                                                    {item.strong && <strong>{item.strong}</strong>} {item.text}
                                                    {item.gated && (
                                                        <>
                                                            {" "}
                                                            <a
                                                                href={`#${LIVE_FAQ_ID}`}
                                                                className="pricing-gate-tag"
                                                                title="How that works"
                                                                onClick={() => liveFaqIndex >= 0 && openFaq(liveFaqIndex)}
                                                            >
                                                                After carrier approval
                                                            </a>
                                                        </>
                                                    )}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    {card.key === "growth" && (
                                        <p className="pricing-also">
                                            <strong>Also on Growth:</strong> {GROWTH_ALSO}
                                        </p>
                                    )}

                                    <p className="pricing-foot">
                                        {card.foot.map((line, i) => (
                                            <span key={line}>
                                                {i > 0 && <br />}
                                                {line}
                                            </span>
                                        ))}
                                    </p>

                                    {card.checkout ? (
                                        <button
                                            type="button"
                                            onClick={() => card.checkout && subscribe(card.checkout)}
                                            disabled={loadingPlan !== null}
                                            className={`${card.highlighted ? "btn primary" : "btn ghost"} pricing-cta`}
                                            style={{ cursor: loadingPlan ? "wait" : "pointer" }}
                                        >
                                            {loadingPlan === card.checkout ? "Redirecting…" : card.cta}
                                        </button>
                                    ) : (
                                        <button type="button" className="btn ghost pricing-cta pricing-cta-off" disabled>
                                            {card.cta}
                                        </button>
                                    )}
                                </motion.article>
                            ))}
                        </div>

                        {/* Enterprise: a slim row under the three, not a fourth card. Its lines
                            are unchanged, behind "What's included". */}
                        <motion.div
                            className="pricing-ent"
                            aria-label="Enterprise plan"
                            role="group"
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: "easeOut", delay: 0.4 }}
                        >
                            <div className="pricing-ent-row">
                                <span className="pricing-name">Enterprise</span>
                                <div>
                                    <p className="pricing-ent-price">
                                        <span className="pricing-ent-amount">{dollars(enterprise.monthlyPrice)}</span>
                                        <span>/month</span>
                                    </p>
                                    <p className="pricing-setup">+ {dollars(enterprise.onboardingFee)} one-time setup</p>
                                </div>
                                <p className="pricing-ent-tier">
                                    For people running more than one shop. Separate sites and receptionists, one portal, one bill.
                                </p>
                                <div className="pricing-ent-actions">
                                    <button
                                        type="button"
                                        className="pricing-ent-toggle"
                                        aria-expanded={enterpriseOpen}
                                        aria-controls="pricing-ent-more"
                                        onClick={() => setEnterpriseOpen((o) => !o)}
                                    >
                                        {enterpriseOpen ? "Hide details" : "What's included"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => subscribe("enterprise")}
                                        disabled={loadingPlan !== null}
                                        className="btn ghost pricing-ent-cta"
                                        style={{ cursor: loadingPlan ? "wait" : "pointer" }}
                                    >
                                        {loadingPlan === "enterprise" ? "Redirecting…" : "Start with Enterprise"}
                                    </button>
                                </div>
                            </div>
                            <div id="pricing-ent-more" className="pricing-ent-more" hidden={!enterpriseOpen}>
                                <p className="pricing-lead-in">
                                    Everything in Growth, plus <span className="pricing-priority">Priority Support</span>
                                </p>
                                <ul className="pricing-list pricing-ent-list">
                                    {ENTERPRISE_ITEMS.map((line) => (
                                        <li key={line} className="pricing-item">
                                            <Check size={14} weight="bold" aria-hidden="true" className="pricing-check" />
                                            <span>{line}</span>
                                        </li>
                                    ))}
                                </ul>
                                <p className="pricing-foot">
                                    {minutes(enterprise)} AI minutes per month, pooled across all your sites
                                    <br />
                                    Extra minutes {overageRate(enterprise)} each
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </section>

                {/* ── FAQ, as an accordion (Xander, 24 Nov 2026). Every answer starts closed and
                    stays in the page's HTML (`hidden`, not unmounted), so search engines and
                    find-in-page still see it. The carrier tags open "How fast can I be live?". ── */}
                <section className="pricing-faq" aria-labelledby="pricing-faq-h">
                    <h2 id="pricing-faq-h" className="pricing-faq-h">
                        How it <span style={{ color: "var(--accent-2)" }}>works.</span>
                    </h2>
                    <span className="pricing-rule pricing-rule-centre" aria-hidden="true" />
                    <div className="pricing-acc">
                        {PRICING_FAQS.map((item, i) => {
                            const open = openFaqs.has(i);
                            const panelId = `faq-a-${i}`;
                            return (
                                <div key={item.q} id={item.id} className={`pricing-qa${open ? " open" : ""}`}>
                                    <h3 className="pricing-q-h">
                                        <button
                                            type="button"
                                            className="pricing-q"
                                            aria-expanded={open}
                                            aria-controls={panelId}
                                            onClick={() => toggleFaq(i)}
                                        >
                                            <span>{item.q}</span>
                                            <span className="pricing-q-ico" aria-hidden="true">
                                                <Plus size={14} weight="bold" />
                                            </span>
                                        </button>
                                    </h3>
                                    <div id={panelId} className="pricing-a" hidden={!open}>
                                        {(Array.isArray(item.a) ? item.a : [item.a]).map((para, j) => (
                                            <p key={j}>{para}</p>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </main>
    );
}
