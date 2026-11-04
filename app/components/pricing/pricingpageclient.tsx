"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Browser,
    ChatCircleText,
    Check,
    Kanban,
    Phone,
    PhoneOutgoing,
    Star,
    Tray,
    type Icon,
} from "@phosphor-icons/react";
import { SCHEDULES, ANNUAL } from "@/app/lib/legal/schedules";

type PlanSlug = "starter" | "growth" | "enterprise";
type BillingPeriod = "monthly" | "annual";

/* Every number on this page comes from Schedule A (app/lib/legal/schedules.ts) —
   the same source the signed agreement renders from. The prose is hand-written;
   the figures are not, so the price card cannot quote a client something the
   contract contradicts. */
const minutes = (slug: PlanSlug) =>
    SCHEDULES[slug].callMinutes?.toLocaleString("en-US") ?? "0";
const overageRate = (slug: PlanSlug) =>
    `$${(SCHEDULES[slug].overagePerMinute ?? 0.2).toFixed(2)}`;
const dollars = (n: number) => `$${n.toLocaleString("en-US")}`;

type PricingTier = {
    slug: PlanSlug;
    name: string;
    tagline: string;
    /** "Everything in X, plus", set as a quiet label above the list rather than as a bullet. */
    leadIn?: string;
    /** Capability, in the order a buyer should read it. Minutes are appended separately.
     *  Growth's list is empty: its card renders GROWTH_SYSTEM instead. */
    features: string[];
    highlighted: boolean;
};

/**
 * Tier content.
 *
 * Two rules the 2026-10 reprice imposes on this list, both deliberate:
 *
 *  - **Minutes are never a headline.** They are appended last, as a footnote, because tiers
 *    are differentiated by capability now. Leading with minutes invites a buyer to pick the
 *    cheapest number that clears their call volume, which is the wrong question.
 *  - **Growth leads with the customer system**, not with its larger allowance. The pipeline,
 *    customer texts and review requests are the headline (GROWTH_SYSTEM); the 60-second
 *    callback is the secondary highlight under them. Starter reports a lead, Growth gives
 *    you the system to work it.
 */
const TIERS: PricingTier[] = [
    {
        slug: "starter",
        name: "Starter",
        /* The tier line, shared word for word with the homepage cards — change both or
           neither. Starter is the way in: the whole system, with the follow-up left to the
           owner. Its list is short because everything it shares with Growth now sits in
           EVERY_PLAN above the cards, not because it is a lesser product. */
        tagline: "Starter reports every lead. The way in: the whole system, with the follow-up left to you.",
        features: [
            "Web form leads go straight to your portal inbox",
            "Client portal to check your site, your calls, and your web leads",
            // Real, not a promise: StarterShowcase runs it from the locked Customers tab.
            "A guided walkthrough of Growth's pipeline, inside your portal",
        ],
        highlighted: false,
    },
    {
        slug: "growth",
        name: "Growth",
        /* The approved tier line on its own. Its old second sentence ("It calls web leads
           back for you, and gives you a pipeline to run the rest.") is what the card body
           now shows, so it was saying everything twice. */
        tagline: "Growth works them like a team would.",
        leadIn: "Everything in Starter, plus",
        features: [],
        highlighted: true,
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        tagline: "For people running more than one shop. Separate sites and receptionists, one portal, one bill.",
        leadIn: "Everything in Growth, plus",
        /* "One portal and call log", not "one pipeline": the contract promises a
           consolidated portal view across sites; a pipeline spanning sites is not verified. */
        features: [
            "2 to 3 websites, for example a service site and an e-commerce site",
            "A dedicated AI receptionist and phone number per site",
            "One portal and call log covering every site",
        ],
        highlighted: false,
    },
];

/**
 * What every plan gets, shown once above the cards.
 *
 * Starter and Growth run an identical stack front to back; they differ only in web-form
 * behaviour, the CRM, and minutes. Listed per card, the shared stack made Starter read as a
 * shorter, lesser list — the opposite of what is true. Stated once here, the cards carry
 * only the differences and Growth's additions read as additions.
 *
 * "Every call and web enquiry lands in your portal" replaced the old "Lead email" bullet:
 * no plan delivers leads by email any more.
 *
 * Set as a spec line in the page header (three facts between hairlines), not a box: the
 * boxed checklist read as something dropped onto the page. The seven facts the box listed
 * are all here, grouped by what they're about: the site, the phone, the leads.
 */
const EVERY_PLAN: { Icon: Icon; title: string; detail: string }[] = [
    {
        Icon: Browser,
        title: "A custom four-page site",
        detail: "Home, Services, About and Contact. Hosting, SSL and maintenance included, plus 2 content edits a month.",
    },
    {
        Icon: Phone,
        title: "It rings you first",
        detail: "If you don't pick up, the AI receptionist answers, 24/7, in English or Spanish. You get a summary of every call.",
    },
    {
        // The new-lead text comes from JDD's own number, so it is live on every plan and
        // carries no carrier-approval tag.
        Icon: Tray,
        title: "One inbox for every lead",
        detail: "Every call and web enquiry lands in your portal, and you get a text the moment a new one arrives.",
    },
];

/**
 * Growth's headline: the customer system. The callback follows it as a secondary strip.
 *
 * `gated` items send from the client's own business number, so they wait on that client's
 * A2P brand and campaign approval. Their tag says what they wait on, never how long, and
 * links to the FAQ answer that explains it.
 */
const GROWTH_SYSTEM: { Icon: Icon; title: string; line: string; gated: boolean }[] = [
    { Icon: Kanban, title: "Customer pipeline", line: "Move every lead from Lead to Won, with notes, job value and tags.", gated: false },
    { Icon: ChatCircleText, title: "Customer texts", line: "Text customers back from your business number, right in your portal.", gated: true },
    { Icon: Star, title: "Google reviews", line: "Ask for a Google review in one tap when the job is done.", gated: true },
];
const GROWTH_ALSO = "AI lead qualification, searchable call transcripts, and urgency and caller names pulled from every call.";
const LIVE_FAQ_ID = "how-fast-live";

/** The minutes footnote, appended last so it reads as a line item rather than a selling point. */
function minutesLine(slug: PlanSlug): string {
    return slug === "enterprise"
        ? `${minutes(slug)} AI minutes per month, pooled across all your sites`
        : `${minutes(slug)} AI minutes per month included`;
}

/* Answers are sourced from the Master Services Agreement so the marketing copy and
   the contract can't drift apart. Section refs noted per answer. */
const FAQS: { q: string; a: string | string[]; id?: string }[] = [
    {
        /**
         * Leads the section on purpose, and replaced "What's the catch?".
         *
         * The old lead argued from price ("Growth is $297, agencies charge $600"), which no
         * longer holds at $497 and was the wrong objection anyway. Consumer resistance to AI
         * answering a phone is real and rising, so that is the first thing this page should
         * answer. It is also the argument the whole product rests on: human-first routing.
         */
        q: "Will my customers get an AI instead of me?",
        a: "No. The AI never answers before you do. A caller rings your real phone first, and only if nobody picks up does the AI step in. It is replacing your voicemail, not replacing you. Most people who call a business and reach a recording just hang up and call the next name on the list, so the comparison that matters isn't AI versus you, it's AI versus nobody.",
    },
    {
        /**
         * The web-only concession, acknowledged publicly for the first time.
         *
         * Deliberately an FAQ answer rather than a fourth card. Web-only is `plan: "starter"` with
         * `receptionistMode: "declined"`, priced identically to Starter precisely so it is never
         * the economically attractive choice (see `WEB_ONLY_SCHEDULE`). Putting it on the cards
         * with a price would invite people to choose it to save money, which is backwards — there
         * is no money to save, and the receptionist is where the value is. Answering it here means
         * the prospect who asks gets a straight answer without the option being advertised to
         * everyone who does not.
         */
        q: "Can I get the website without the AI receptionist?",
        a: "Yes, though we'll try to talk you out of it. The receptionist is where most of the value is — it's what turns a missed call into a lead. If you'd rather not have AI on your line, we'll build and host the same site at the same price and leave your phone alone. It's not a cheaper plan; it's the same plan with a piece switched off.",
    },
    {
        q: "What happens if I go over my minutes?",
        a: `They're billed at ${overageRate("growth")} a minute on your next invoice, and we'll give you a heads-up as you get close. On Starter especially, keep an eye on it: ${minutes("starter")} minutes is roughly twenty short calls, so a busy month can run past it.`, // MSA call volume section
    },
    {
        q: "Am I locked into a contract?",
        a: "No. There is no minimum term, no commitment period, and no cancellation fee on any plan. It's month to month. If you cancel, you keep everything through the end of the month you've already paid for, and then it stops.", // MSA term and termination
    },
    {
        q: "What if I'm not happy with the site?",
        a: "We iterate. You get two content edit requests per month, and if the first build misses the mark, we redo it. If it's still not working after a fair run, there is no commitment holding you here. Month to month means you can leave at the end of any month.",
    },
    {
        /* MSA delivery targets. The second paragraph is the carrier step for Growth's
           customer-facing texts: what it waits on, who handles it, and no timeframe, because
           approval is the carriers' to grant. The owner's own lead texts come from JDD's
           number and are live from the start, so the first paragraph says so. */
        id: LIVE_FAQ_ID,
        q: "How fast can I be live?",
        a: [
            "You'll have a preview site within 72 hours of sending your onboarding form back, and you're fully live within a week. That covers your site, your receptionist, your portal, and the texts we send you about new leads.",
            "On Growth, two features wait on one more step: texting your customers and asking for reviews. Those messages come from your own business number, so the carriers have to approve your business's text-messaging registration first. We file it for you, handle the back and forth, and switch both on as soon as it clears. The approval is the carriers' call, so we can't put a date on it. The callback and the pipeline work from day one.",
        ],
    },
    {
        q: "Do I have to forward my phone?",
        a: "You pick one of two ways: forward your existing business line to the number we give you, so the AI only ever hears the calls you didn't pick up, or publish our number as your business number. Either works. We walk you through it, though your phone carrier has to make the change, so we can't do that part for you.", // MSA activation
    },
    {
        // Was "It's yours. If you ever leave, it goes with you." — which the MSA does not
        // support. The number sits on our master telephony account, and on termination the
        // default is release, not transfer. Porting is real, but it's opt-in, time-boxed
        // and paid, so all three conditions are stated rather than discovered later.
        q: "Do I get to keep my phone number?",
        a: "You get exclusive use of it for as long as you're a client: put it on your truck, your cards, your Google listing. It lives on our telephony account, so if you leave and want to keep it, tell us within 30 days and we'll port it to your carrier for a one-time $50 fee. Miss that window and it goes back into the pool.", // MSA phone number ownership
    },
    {
        q: "Do I own my website?",
        a: "Your content is yours: name, logo, photos, and copy, always. The site runs on our platform while you're a client. If you leave, ask within 30 days and we hand over a full static export of the site, your content as a file, and your call log. You'd need to arrange new hosting, but you leave with your site rather than a screenshot of it.", // MSA intellectual property
    },
    {
        q: "What if I already have a website?",
        a: "We build you a new one and bring over the content worth keeping. You won't have to start from scratch.",
    },
    {
        q: "Is this replacing a receptionist?",
        a: "No, most of our clients never had one. When it's you and a truck, the phone rings while your hands are full. This picks it up. And if you do have someone answering, this is what catches the calls after they go home.",
    },
];

export default function PricingPageClient() {
    const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
    const [checkoutError] = useState<string | null>(null);
    const [period, setPeriod] = useState<BillingPeriod>("monthly");

    function subscribe(slug: PlanSlug) {
        setLoadingPlan(slug);
        /**
         * Everyone goes to `/start`, signed in or not.
         *
         * This used to jump straight to `/agreement`, which meant the funnel did not learn who
         * the buyer was until they typed an email into the signature form — after reading the
         * terms, and with no way to tell a returning client from a new one. `/start`
         * authenticates, resolves the account, and only then decides whether this is a
         * purchase, an addendum, or an upsell.
         *
         * This page stays static and anonymous: it renders identically for everyone and holds
         * no entitlement logic, so there is nothing here to disagree with the server. The
         * chosen billing period rides along as a query param and is re-validated server side;
         * nothing here is trusted.
         */
        window.location.href = `/start?plan=${slug}&period=${period}`;
    }

    const annual = period === "annual";

    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                position: "relative",
                overflow: "hidden",
                padding: "100px max(24px, 4vw)",
            }}
        >
            <div className="aurora-grid" />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{ marginBottom: 32, textAlign: "center" }}
                >
                    {/* Approved 2026-11-04. Was "What it costs. All of it." plus a sub-line: the page
                        opened by announcing the price. It now opens on what the owner gets, hands
                        straight to the "On every plan" spec line below, and lets the cards show the
                        cost a scroll later. Two beats, stacked: the first at full display size, the
                        second as a smaller display line (`.pricing-hero-beat`), so the longer
                        sentence doesn't run four lines deep at 88px.

                        Colour-only emphasis, same display face: the convention the homepage sets
                        with "Do Business." and "costing you?". Neither an italic nor a 900 Hanken
                        Grotesk is loaded, so a body-font emphasis would be synthesised. */}
                    <h1 className="pricing-hero-h1">
                        Putting the system in your <span style={{ color: "var(--accent-2)" }}>hands</span>.{" "}
                        <span className="pricing-hero-beat">The big shops have run on one for years. Now you do too.</span>
                    </h1>
                </motion.div>

                {/* ── On every plan ── see EVERY_PLAN. Part of the header, not a box: three
                    facts held by hairlines, with the kicker set into the top rule. Layout and
                    the phone stack are `.pricing-spec*` in globals.css. */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                    className="pricing-spec"
                >
                    <p className="kicker pricing-spec-legend">On every plan</p>
                    <ul className="pricing-spec-cols">
                        {EVERY_PLAN.map(({ Icon, title, detail }) => (
                            <li key={title} className="pricing-spec-col">
                                <span className="pricing-spec-ico" aria-hidden="true">
                                    <Icon size={18} weight="regular" />
                                </span>
                                <div>
                                    <p className="pricing-spec-title">{title}</p>
                                    <p className="pricing-spec-detail">{detail}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </motion.div>

                {/* ── Billing period ──
                    Annual is ten months of money for twelve months of service. Both figures come
                    from Schedule A's `annualPrice`, which is derived from the monthly price, so
                    "2 months free" cannot drift away from the discount actually offered. */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                    style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}
                >
                    <div
                        role="group"
                        aria-label="Billing period"
                        style={{
                            display: "inline-flex",
                            gap: 4,
                            padding: 4,
                            borderRadius: 999,
                            border: "1px solid var(--rule)",
                            background: "var(--surface)",
                        }}
                    >
                        {([
                            ["monthly", "Monthly"],
                            ["annual", `Annual (${ANNUAL.monthsFree} months free)`],
                        ] as const).map(([value, label]) => {
                            const active = period === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => setPeriod(value)}
                                    aria-pressed={active}
                                    style={{
                                        appearance: "none",
                                        border: "none",
                                        cursor: "pointer",
                                        borderRadius: 999,
                                        padding: "8px 18px",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11.5,
                                        letterSpacing: "0.06em",
                                        textTransform: "uppercase",
                                        background: active ? "var(--accent-2)" : "transparent",
                                        color: active ? "#fff" : "var(--fg-2)",
                                        transition: "background 160ms ease, color 160ms ease",
                                    }}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>

                {/* Pricing Cards */}
                <div
                    style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                        gap: 24,
                        alignItems: "stretch",
                    }}
                >
                    {TIERS.map((tier, index) => {
                        const schedule = SCHEDULES[tier.slug];
                        return (
                        <motion.div
                            key={tier.slug}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.1 }}
                            className="glass"
                            style={{
                                position: "relative",
                                display: "flex",
                                flexDirection: "column",
                                padding: "36px 30px 32px",
                                minHeight: 460,
                                borderRadius: 22,
                                ...(tier.highlighted
                                    ? {
                                        transform: "scale(1.04)",
                                        zIndex: 1,
                                        borderTop: "2px solid var(--accent-2)",
                                        boxShadow: "0 0 0 1px var(--accent-2) inset, 0 30px 80px -30px rgba(0,0,0,0.35), 0 0 60px -10px var(--accent-glow)",
                                    }
                                    : {}),
                            }}
                        >
                            {/* Badges */}
                            {tier.highlighted && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: 0,
                                        left: "50%",
                                        transform: "translateX(-50%)",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        fontWeight: 500,
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        background: "var(--accent-2)",
                                        color: "#fff",
                                        borderRadius: "0 0 12px 12px",
                                        padding: "5px 16px",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    Most Popular
                                </span>
                            )}
                            {tier.slug === "enterprise" && (
                                <span
                                    className="hide-on-mobile"
                                    style={{
                                        position: "absolute",
                                        top: 16,
                                        right: 20,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        fontWeight: 500,
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        color: "var(--fg-2)",
                                        border: "1px solid var(--rule-strong)",
                                        background: "var(--surface)",
                                        borderRadius: 999,
                                        padding: "3px 10px",
                                    }}
                                >
                                    Priority Support
                                </span>
                            )}

                            {/* Plan header */}
                            <div style={{ marginBottom: 24 }}>
                                <span
                                    style={{
                                        display: "inline-block",
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10.5,
                                        fontWeight: 500,
                                        letterSpacing: "0.1em",
                                        textTransform: "uppercase",
                                        color: "var(--fg-3)",
                                        border: "1px solid var(--rule)",
                                        background: "var(--surface)",
                                        borderRadius: 999,
                                        padding: "3px 10px",
                                        marginBottom: 16,
                                    }}
                                >
                                    {tier.name}
                                </span>
                                {annual && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut" }}
                                        style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 8, marginBottom: 2 }}
                                    >
                                        <span
                                            style={{
                                                fontFamily: "var(--font-display)",
                                                fontSize: 30,
                                                fontWeight: 600,
                                                color: "var(--fg-3)",
                                                letterSpacing: "var(--tracking-tightest)",
                                                lineHeight: 1,
                                                textDecoration: "line-through",
                                                textDecorationColor: "var(--fg-3)",
                                            }}
                                        >
                                            {dollars(schedule.monthlyPrice * 12)}
                                        </span>
                                        <span style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 4 }}>/year</span>
                                    </motion.div>
                                )}
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: annual ? 0 : 8 }}>
                                    <span
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontSize: 52,
                                            fontWeight: 600,
                                            color: "var(--fg)",
                                            letterSpacing: "var(--tracking-tightest)",
                                            lineHeight: 1,
                                        }}
                                    >
                                        {dollars(annual ? schedule.annualPrice : schedule.monthlyPrice)}
                                    </span>
                                    <span style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 6 }}>
                                        {annual ? "/year" : "/month"}
                                    </span>
                                    <span style={{ fontSize: 12, color: "var(--fg-3)", marginBottom: 6, marginLeft: 6 }}>
                                        + {dollars(schedule.onboardingFee)} one-time setup
                                    </span>
                                </div>
                                {annual && (
                                    <motion.p
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ duration: 0.3, ease: "easeOut", delay: 0.1 }}
                                        style={{
                                            margin: "4px 0 0",
                                            fontFamily: "var(--font-mono)",
                                            fontSize: 11,
                                            fontWeight: 600,
                                            color: "var(--online)",
                                            letterSpacing: "0.05em",
                                        }}
                                    >
                                        {ANNUAL.monthsFree} months free
                                    </motion.p>
                                )}
                                <p style={{ marginTop: 12, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                    {tier.tagline}
                                </p>
                            </div>

                            <div style={{ flex: 1 }}>
                                {tier.leadIn && <p className="pricing-lead-in">{tier.leadIn}</p>}

                                {tier.slug === "growth" ? (
                                    <>
                                        {/* The star of Growth: the customer system, as three tiles on
                                            a raised panel. See GROWTH_SYSTEM. */}
                                        <div className="pricing-system">
                                            <p className="pricing-system-h">Your customer system</p>
                                            {GROWTH_SYSTEM.map(({ Icon, title, line, gated }) => (
                                                <div key={title} className="pricing-system-row">
                                                    <span className="pricing-system-ico" aria-hidden="true">
                                                        <Icon size={20} weight="duotone" />
                                                    </span>
                                                    <div>
                                                        <p className="pricing-system-title">
                                                            {title}
                                                            {gated && (
                                                                <a href={`#${LIVE_FAQ_ID}`} className="pricing-gate-tag" title="How that works">
                                                                    After carrier approval
                                                                </a>
                                                            )}
                                                        </p>
                                                        <p className="pricing-system-line">{line}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* The highlight, under the star. "Within about a minute"
                                            matches the contract's "typically within sixty (60)
                                            seconds". */}
                                        <div className="pricing-callback">
                                            <PhoneOutgoing size={18} weight="bold" aria-hidden="true" style={{ color: "var(--accent-2)", flexShrink: 0, marginTop: 1 }} />
                                            <div>
                                                <p className="pricing-callback-title">The 60-second callback</p>
                                                <p className="pricing-callback-line">Web form leads get a call back automatically, within about a minute.</p>
                                            </div>
                                        </div>

                                        <p className="pricing-also">
                                            <strong>Also on Growth:</strong> {GROWTH_ALSO}
                                        </p>
                                    </>
                                ) : (
                                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                                        {tier.features.map((feature) => (
                                            <li
                                                key={feature}
                                                style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--fg-2)" }}
                                            >
                                                <Check
                                                    weight="bold"
                                                    size={14}
                                                    style={{ color: "var(--online)", marginTop: 2, flexShrink: 0 }}
                                                />
                                                <span>{feature}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            {/* Minutes, as a line item under a rule rather than a bullet among the
                                capabilities. Deliberately the least prominent thing on the card. */}
                            <p
                                style={{
                                    margin: "16px 0 0",
                                    paddingTop: 12,
                                    borderTop: "1px solid var(--rule)",
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 11,
                                    color: "var(--fg-3)",
                                    lineHeight: 1.5,
                                }}
                            >
                                {minutesLine(tier.slug)}
                                <br />
                                Extra minutes {overageRate(tier.slug)} each
                            </p>

                            {/* CTA */}
                            <div style={{ marginTop: 20 }}>
                                <button
                                    type="button"
                                    onClick={() => subscribe(tier.slug)}
                                    disabled={loadingPlan !== null}
                                    className={tier.highlighted ? "btn primary" : "btn ghost"}
                                    style={{ width: "100%", justifyContent: "center", cursor: loadingPlan ? "wait" : "pointer" }}
                                >
                                    {loadingPlan === tier.slug
                                        ? "Redirecting…"
                                        : tier.slug === "growth"
                                            ? "Start with Growth"
                                            : <><span className="show-desktop">Start with {tier.name}</span><span className="show-mobile">Start</span></>}
                                </button>
                                {checkoutError && loadingPlan === null && (
                                    <p style={{ marginTop: 10, fontSize: 12, color: "var(--accent-2)" }}>
                                        {checkoutError}
                                    </p>
                                )}
                            </div>
                        </motion.div>
                        );
                    })}
                </div>

                {/* FAQ */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.35 }}
                    style={{ marginTop: "clamp(64px,8vw,120px)" }}
                >
                    <h2 style={{ textAlign: "center", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
                        How it works.
                    </h2>
                    {/* Reference-document layout, not cards: ruled entries in two columns.
                        `min(100%, 400px)` is load-bearing — a bare minmax(400px, 1fr)
                        overflows at 375px. The 1040 cap holds it to two columns. */}
                    <div
                        style={{
                            maxWidth: 1040,
                            margin: "0 auto",
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))",
                            columnGap: 48,
                            rowGap: 0,
                        }}
                    >
                        {FAQS.map((item) => (
                            <div key={item.q} id={item.id} style={{ borderTop: "1px solid var(--rule)", padding: "24px 0 28px", scrollMarginTop: 96 }}>
                                <h3 style={{ fontWeight: 700, fontSize: "clamp(18px,1.9vw,22px)", lineHeight: 1.15, textTransform: "uppercase", marginBottom: 10 }}>
                                    {item.q}
                                </h3>
                                {(Array.isArray(item.a) ? item.a : [item.a]).map((para, i) => (
                                    <p key={i} style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--fg-2)", margin: i ? "12px 0 0" : 0, maxWidth: "46ch" }}>{para}</p>
                                ))}
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
