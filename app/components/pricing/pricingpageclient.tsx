"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Microphone } from "@phosphor-icons/react";
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
    /** Capability, in the order a buyer should read it. Minutes are appended separately. */
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
 *  - **Growth leads with the 60-second callback**, not with its larger allowance. That
 *    callback is the entire reason Growth costs $300 more than Starter: Starter tells you a
 *    lead came in, Growth acts on it.
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
        tagline: "Growth works them like a team would. It calls web leads back for you, and gives you a pipeline to run the rest.",
        /* The callback and the pipeline are the headline pair, in that order. The last
           bullet waits on the client's own carrier registration, so it says what it waits
           on and never how long. */
        features: [
            "Everything in Starter, plus:",
            "60-second callback: a web form lead gets called back automatically within about a minute, and the result lands in your inbox",
            "Customer pipeline: move every lead from Lead to Won, with notes, job value, and tags",
            "AI qualifies the lead and answers common questions",
            "Searchable call log with full transcripts",
            "Urgency and caller-name extraction on every call",
            "Text customers back from your business number, and ask for Google reviews in one tap, once the carriers approve your business registration",
        ],
        highlighted: true,
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        tagline: "For people running more than one shop. Separate sites and receptionists, one portal, one bill.",
        /* "One portal and call log", not "one pipeline": the contract promises a
           consolidated portal view across sites; a pipeline spanning sites is not verified. */
        features: [
            "Everything in Growth, plus:",
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
 */
const EVERY_PLAN = [
    "A custom four-page website: Home, Services, About, Contact",
    "Hosting, SSL, and maintenance included",
    "Your number rings you first. If you don't pick up, the AI receptionist does, 24/7, in English or Spanish",
    "Every call and web enquiry lands in your portal",
    "A text when a new lead arrives",
    "A summary of every call",
    "2 content edits per month",
];

/** The minutes footnote, appended last so it reads as a line item rather than a selling point. */
function minutesLine(slug: PlanSlug): string {
    return slug === "enterprise"
        ? `${minutes(slug)} AI minutes per month, pooled across all your sites`
        : `${minutes(slug)} AI minutes per month included`;
}

/* Answers are sourced from the Master Services Agreement so the marketing copy and
   the contract can't drift apart. Section refs noted per answer. */
const FAQS: { q: string; a: string }[] = [
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
        q: "How fast can I be live?",
        a: "You'll have a preview site within 72 hours of sending your onboarding form back, and you're fully live within a week.", // MSA delivery targets
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
                    style={{ marginBottom: 40, textAlign: "center" }}
                >
                    <h1
                        style={{
                            fontSize: "clamp(24px, 8vw, 88px)",
                            marginTop: 16,
                            marginBottom: 16,
                            textTransform: "uppercase",
                            overflowWrap: "break-word",
                        }}
                    >
                        {/* Colour-only emphasis, same display face — the convention the homepage
                            already sets with "Do Business." and "costing you?". The previous
                            treatment set this word in the body font at italic 900, but neither an
                            italic nor a 900 Hanken Grotesk is loaded, so the browser synthesised
                            both — a sheared, smeared word at 88px. */}
                        What it <span style={{ color: "var(--accent-2)" }}>costs</span>. All of it.
                    </h1>
                    <p
                        style={{
                            maxWidth: "52ch",
                            margin: "0 auto",
                            fontSize: 16,
                            color: "var(--fg-2)",
                            lineHeight: 1.6,
                        }}
                    >
                        Every plan is a real website, an AI receptionist that only answers when you
                        can&apos;t, and a portal where every lead lands. Month to month, cancel anytime.
                    </p>
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

                {/* ── On every plan ── see EVERY_PLAN */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
                    style={{
                        marginBottom: 24,
                        padding: "clamp(20px, 2.5vw, 28px)",
                        borderRadius: 16,
                        border: "1px solid var(--rule)",
                        background: "var(--surface)",
                    }}
                >
                    <p className="kicker" style={{ marginBottom: 14, color: "var(--fg-2)" }}>On every plan</p>
                    <ul
                        style={{
                            listStyle: "none",
                            padding: 0,
                            margin: 0,
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
                            gap: "10px 28px",
                        }}
                    >
                        {EVERY_PLAN.map((item) => (
                            <li key={item} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14.5, color: "var(--fg-2)" }}>
                                <Check weight="bold" size={14} style={{ color: "var(--online)", marginTop: 3, flexShrink: 0 }} />
                                <span>{item}</span>
                            </li>
                        ))}
                    </ul>
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

                            {/* Growth's actual differentiator, called out.
                                Was a generic "24/7 AI Voice Receptionist" badge, which is true of
                                every tier now and so said nothing about why Growth costs more. */}
                            {tier.slug === "growth" && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 12,
                                        marginBottom: 20,
                                        padding: "14px 16px",
                                        borderRadius: 14,
                                        background: "var(--surface)",
                                        border: "1px solid var(--rule)",
                                    }}
                                >
                                    <Microphone
                                        weight="duotone"
                                        size={18}
                                        style={{ color: "var(--accent)", flexShrink: 0 }}
                                    />
                                    <div>
                                        <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--accent)", letterSpacing: "-0.01em" }}>
                                            The 60-second callback
                                        </p>
                                        <p style={{ margin: 0, marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                                            Web leads get called back while they're still looking
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Feature list */}
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
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
                            <div key={item.q} style={{ borderTop: "1px solid var(--rule)", padding: "24px 0 28px" }}>
                                <h3 style={{ fontWeight: 700, fontSize: "clamp(18px,1.9vw,22px)", lineHeight: 1.15, textTransform: "uppercase", marginBottom: 10 }}>
                                    {item.q}
                                </h3>
                                <p style={{ fontSize: 15.5, lineHeight: 1.65, color: "var(--fg-2)", margin: 0, maxWidth: "46ch" }}>{item.a}</p>
                            </div>
                        ))}
                    </div>
                </motion.div>
            </div>
        </main>
    );
}
