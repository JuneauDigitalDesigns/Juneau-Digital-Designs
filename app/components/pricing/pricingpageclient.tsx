"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Microphone } from "@phosphor-icons/react";

type PlanSlug = "starter" | "growth" | "enterprise";

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
        price: 117,
        tagline: "Only need a website? This plan gets you a sleek one-pager. You can always upgrade later to add the AI receptionist.",
        features: [
            "Basic 1 page website setup",
            "Web hosting",
            "Bug fixes & maintenance",
            "Monthly performance report",
            "Google Business Profile optimization",
        ],
        highlighted: false,
    },
    {
        slug: "growth",
        name: "Growth",
        price: 297,
        tagline: "For businesses ready to grow with a powerful online presence and AI-driven lead capture.",
        features: [
            "Everything in Starter",
            "Ongoing SEO optimization",
            "Bi-monthly performance reports",
        ],
        highlighted: true,
    },
    {
        slug: "enterprise",
        name: "Enterprise",
        price: 697,
        tagline: "A plan for businesses that manage other businesses.",
        features: [
            "Everything in Growth",
            "Up to 3 one-page websites with fully integrated AI receptionist",
            "Weekly performance reports",
            "Priority support with 1 business day response time",
            "Quarterly strategy sessions with our founder",
        ],
        highlighted: false,
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
                            fontSize: "var(--text-4xl)",
                            marginTop: 16,
                            marginBottom: 16,
                            textTransform: "uppercase",
                        }}
                    >
                        Simple, <em style={{ color: "var(--accent-2)", fontStyle: "italic", fontFamily: "var(--font-body)" }}>transparent</em> plans.
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
                        Pick the plan that fits where you are now. Every plan includes personal support — no tickets, no bots.
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
                                    Enterprise level Support
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
                                    {loadingPlan === tier.slug ? "Redirecting…" : `Get started with ${tier.name}`}
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
            </div>
        </main>
    );
}
