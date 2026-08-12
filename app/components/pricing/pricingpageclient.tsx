"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Microphone } from "@phosphor-icons/react";
import { SCHEDULES } from "@/app/lib/legal/schedules";

type PlanSlug = "starter" | "growth" | "enterprise";

/* Every number on this page comes from Schedule A (app/lib/legal/schedules.ts) —
   the same source the signed agreement renders from. The prose is hand-written;
   the figures are not, so the price card cannot quote a client something the
   contract contradicts. */
const minutes = (slug: PlanSlug) =>
    SCHEDULES[slug].callMinutes?.toLocaleString("en-US") ?? "0";
const overageRate = (slug: PlanSlug) =>
    `$${(SCHEDULES[slug].overagePerMinute ?? 0.2).toFixed(2)}`;

type PricingTier = {
    slug: PlanSlug;
    name: string;
    price: number;
    tagline: string;
    features: string[];
    highlighted: boolean;
};

const TIERS: PricingTier[] = [
    {
        slug: "starter",
        name: "Starter",
        price: SCHEDULES.starter.monthlyPrice,
        tagline: "Everything starts here — the site itself. Built, hosted, and pointed at getting you called. Add the receptionist whenever you're ready.",
        features: [
            "A complete website, built and launched for you",
            "Contact form — leads go straight to your inbox",
            "Hosting, backups, and security included",
            "2 content edits per month",
            "Client portal to check your site anytime",
        ],
        highlighted: false,
    },
    {
        slug: "growth",
        name: "Growth",
        price: SCHEDULES.growth.monthlyPrice,
        tagline: "Everything in Starter, plus the part that actually answers the phone.",
        features: [
            "Everything in Starter",
            "AI receptionist on a dedicated business number",
            `${minutes("growth")} call minutes per month`,
            "2 content edits per month",
            "Ongoing SEO so you show up on Google",
            "Portal with every call logged — transcript and summary",
        ],
        highlighted: true,
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        price: SCHEDULES.enterprise.monthlyPrice,
        tagline: "For people running more than one shop. Three sites, one bill, minutes shared across all of them.",
        features: [
            "Everything in Growth",
            "Up to 3 websites, each with its own receptionist and number",
            `${minutes("enterprise")} call minutes per month, pooled across your sites`,
            "Priority support with 1 business day response time",
        ],
        highlighted: false,
    },
];

/* Answers are sourced from the Master Services Agreement so the marketing copy and
   the contract can't drift apart. Section refs noted per answer. */
const FAQS: { q: string; a: string }[] = [
    {
        // Leads the section on purpose: a low price is itself an objection, so the
        // page should answer "why so cheap" before anything else. The figures are
        // evidence for the tooling argument, not a discount brag.
        q: "What's the catch?",
        a: "There isn't one. Piecing this together from an agency plus an answering service usually runs $600 or more a month — Growth is $297. The difference isn't corner-cutting, it's that we built the software that does the setup. Provisioning a site, standing up a number, configuring the agent, wiring your reporting — most agencies do all of that by hand and bill you for the hours. We only had to build it once.",
    },
    {
        q: "What happens if I go over my minutes?",
        a: `They're billed at ${overageRate("growth")} a minute on your next invoice, and we'll give you a heads-up as you get close.`, // MSA §5.2
    },
    {
        q: "Am I locked into a contract?",
        a: "No. Starter and Growth are month to month — cancel whenever. Enterprise runs on 60 days notice, because there's more to unwind.", // MSA §14.1–14.2
    },
    {
        q: "How fast can I be live?",
        a: "You'll have a preview site within 72 hours of sending your onboarding form back, and you're fully live within a week.", // MSA §2.2
    },
    {
        // Was "It's yours. If you ever leave, it goes with you." — which the MSA does not
        // support. The number sits on our master telephony account, and on termination the
        // default is release, not transfer. Porting is real, but it's opt-in, time-boxed
        // and paid, so all three conditions are stated rather than discovered later.
        q: "Do I get to keep my phone number?",
        a: "You get exclusive use of it for as long as you're a client — put it on your truck, your cards, your Google listing. It lives on our telephony account, so if you leave and want to keep it, tell us within 30 days and we'll port it to your carrier for a one-time $50 fee. Miss that window and it goes back into the pool.", // MSA §11
    },
    {
        q: "Do I own my website?",
        a: "Your content is yours — name, logo, photos, and copy, always. The site runs on our platform while you're a client. If you leave, ask within 30 days and we hand over a full static export of the site, your content as a file, and your call log. You'd need to arrange new hosting, but you leave with your site rather than a screenshot of it.", // MSA §14
    },
    {
        q: "What if I already have a website?",
        a: "We build you a new one and bring over the content worth keeping. You won't have to start from scratch.",
    },
    {
        q: "Is this replacing a receptionist?",
        a: "No — most of our clients never had one. When it's you and a truck, the phone rings while your hands are full. This picks it up. And if you do have someone answering, this is what catches the calls after they go home.",
    },
];

export default function PricingPageClient() {
    const [loadingPlan, setLoadingPlan] = useState<PlanSlug | null>(null);
    const [checkoutError] = useState<string | null>(null);

    function subscribe(slug: PlanSlug) {
        setLoadingPlan(slug);
        // Send users to the MSA signing page first; payment happens after signing.
        window.location.href = `/agreement?plan=${slug}`;
    }

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
                    style={{ marginBottom: 60, textAlign: "center" }}
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
                        Every plan is a real website. Growth adds the receptionist. Month to month, cancel when you want.
                    </p>
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
                    {TIERS.map((tier, index) => (
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
                                        ${tier.price}
                                    </span>
                                    <span style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 6 }}>/month</span>
                                </div>
                                {tier.slug === "starter" && (
                                    <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                                        + $100 one-time onboarding fee
                                    </p>
                                )}
                                {tier.slug === "growth" && (
                                    <p style={{ margin: "6px 0 0", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                                        Onboarding fee waived for new clients!
                                    </p>
                                )}
                                <p style={{ marginTop: 12, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                    {tier.tagline}
                                </p>
                            </div>

                            {/* AI Voice Receptionist callout – Growth only */}
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
                                            24/7 AI Voice Receptionist
                                        </p>
                                        <p style={{ margin: 0, marginTop: 2, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)", letterSpacing: "0.04em" }}>
                                            Never miss a call — even after hours
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

                            {/* CTA */}
                            <div style={{ marginTop: 28 }}>
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
                    ))}
                </div>

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
