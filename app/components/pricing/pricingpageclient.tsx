"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Microphone, PhoneCall } from "@phosphor-icons/react";
import { SCHEDULES, GUARANTEE, ANNUAL } from "@/app/lib/legal/schedules";

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
        tagline: "Starter tells you. A real website, and a receptionist that catches the calls you would have missed and reports every one of them.",
        features: [
            "A four-page website: Home, Services, About, Contact",
            "Hosting, SSL, and maintenance included",
            "AI receptionist answers the calls you miss",
            "Post-call text brief sent to your phone after every call",
            "Lead email with the caller's name, number, and reason",
            "2 content edits per month",
            "Client portal to check your site and your calls",
        ],
        highlighted: false,
    },
    {
        slug: "growth",
        name: "Growth",
        tagline: "Growth acts for you. Everything in Starter, plus it works the lead instead of just handing it to you.",
        features: [
            "Everything in Starter, plus:",
            "60-second callback: a web form lead gets called back automatically within about a minute",
            "AI qualifies the lead and answers common questions",
            "Searchable call log with full transcripts",
            "Urgency and caller-name extraction on every call",
        ],
        highlighted: true,
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        tagline: "For people running more than one shop. Separate sites and receptionists, one call log, one bill.",
        features: [
            "Everything in Growth, plus:",
            "2 to 3 websites, for example a service site and an e-commerce site",
            "A dedicated AI receptionist and phone number per site",
            "One shared call log across all sites",
        ],
        highlighted: false,
    },
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
        q: "What happens if I go over my minutes?",
        a: `They're billed at ${overageRate("growth")} a minute on your next invoice, and we'll give you a heads-up as you get close. On Starter especially, keep an eye on it: ${minutes("starter")} minutes is roughly twenty short calls, so a busy month can run past it.`, // MSA call volume section
    },
    {
        q: "Am I locked into a contract?",
        a: "No. There is no minimum term, no commitment period, and no cancellation fee on any plan. It's month to month. If you cancel, you keep everything through the end of the month you've already paid for, and then it stops.", // MSA term and termination
    },
    {
        q: "What if it doesn't work for me?",
        a: `If the receptionist captures fewer than ${GUARANTEE.minQualifiedLeads} qualified leads in your first ${GUARANTEE.windowDays} days, we refund the onboarding fee. A qualified lead means a call it answered that got us a name, a number, and what they wanted. The clock starts when your receptionist goes live, not when you sign, so taking a week to forward your line doesn't cost you the window. The one condition: you have to actually forward it. A line that never pointed at us was never going to catch anything.`, // MSA first-month guarantee
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
                        Every plan is a real website and a receptionist that answers the calls you
                        miss. Month to month, no contract, cancel when you want.
                    </p>
                </motion.div>

                {/* ── The objection that blocks the sale, answered once and loudly ──
                    Placed above the cards rather than repeated on each of them: all three tiers
                    now carry the receptionist, so three copies of this would be three chances to
                    drift and no single prominent home for the one message that matters most. */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                    className="glass"
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 16,
                        maxWidth: 820,
                        margin: "0 auto 40px",
                        padding: "20px 24px",
                        borderRadius: 18,
                        borderTop: "2px solid var(--accent)",
                    }}
                >
                    <PhoneCall
                        weight="duotone"
                        size={26}
                        style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }}
                    />
                    <div>
                        <p
                            style={{
                                margin: 0,
                                fontFamily: "var(--font-display)",
                                fontSize: 18,
                                fontWeight: 600,
                                color: "var(--fg)",
                                letterSpacing: "-0.01em",
                            }}
                        >
                            The AI never answers before you do.
                        </p>
                        <p style={{ margin: "6px 0 0", fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.6 }}>
                            A caller rings your real phone first. Only if nobody picks up does the AI
                            step in, so it is replacing voicemail, not replacing you.
                        </p>
                    </div>
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
                                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginTop: 8 }}>
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
                                </div>
                                <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                                    {annual
                                        ? `${dollars(schedule.monthlyPrice)}/mo billed yearly, ${ANNUAL.monthsFree} months free`
                                        : `+ ${dollars(schedule.onboardingFee)} one-time onboarding fee`}
                                </p>
                                {annual && (
                                    <p style={{ margin: "2px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                                        + {dollars(schedule.onboardingFee)} one-time onboarding fee
                                    </p>
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

                {/* ── The guarantee ──
                    Stated with its conditions on the same screen as the promise. A bare "it pays
                    for itself or your money back" with the three qualifying conditions buried in
                    the contract is the mismatch this whole change exists to remove. */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.3 }}
                    className="glass"
                    style={{
                        maxWidth: 820,
                        margin: "40px auto 0",
                        padding: "24px 28px",
                        borderRadius: 18,
                        borderTop: "2px solid var(--online)",
                    }}
                >
                    <p
                        style={{
                            margin: 0,
                            fontFamily: "var(--font-display)",
                            fontSize: 19,
                            fontWeight: 600,
                            color: "var(--fg)",
                            letterSpacing: "-0.01em",
                        }}
                    >
                        If it doesn&apos;t pay for itself in month one, the onboarding fee is refunded.
                    </p>
                    <p style={{ margin: "8px 0 0", fontSize: 14.5, color: "var(--fg-2)", lineHeight: 1.65 }}>
                        Specifically: if your receptionist captures fewer than {GUARANTEE.minQualifiedLeads}{" "}
                        qualified leads in its first {GUARANTEE.windowDays} days, we refund the
                        onboarding fee. A qualified lead is a call it answered that got us a name, a
                        number, and what the caller wanted. The {GUARANTEE.windowDays} days start when
                        your receptionist goes live, not when you sign. The one condition is that you
                        forwarded your line, because a line that never pointed at us was never going
                        to catch anything.
                    </p>
                </motion.div>

                {/* FAQ — the objections that actually block a purchase */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.35 }}
                    style={{ marginTop: "clamp(64px,8vw,120px)" }}
                >
                    <h2 style={{ textAlign: "center", textTransform: "uppercase", marginBottom: "clamp(28px,3vw,44px)" }}>
                        Before you buy.
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
