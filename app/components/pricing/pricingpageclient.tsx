"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";

type PlanSlug = "starter" | "growth" | "premium";

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
        price: 97,
        tagline: "Just need a Website that continues to work? We got you covered.",
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
        tagline: "For businesses ready to grow with a powerful online presence and AI-driven capture.",
        features: [
            "Everything in Starter",
            "24/7 AI voice receptionist",
            "Ongoing SEO optimization",
            "Bi-monthly performance reports",
        ],
        highlighted: true,
    },
    {
        slug: "premium",
        name: "Premium",
        price: 397,
        tagline: "A dedicated partner invested in your long-term success.",
        features: [
            "Everything in Growth",
            "Multi-team call routing",
            "Deep CRM integration",
            "Custom branded voice",
            "Quarterly strategy sessions with our founder",
        ],
        highlighted: false,
    },
];

export default function PricingPageClient() {
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
            {/* Aurora blob background */}
            <div className="aurora-bg">
                <div
                    className="aurora-blob"
                    style={{
                        width: 700,
                        height: 700,
                        background: "radial-gradient(circle, rgba(182,168,255,0.45) 0%, transparent 70%)",
                        left: "15%",
                        top: "-10%",
                    }}
                />
                <div
                    className="aurora-blob"
                    style={{
                        width: 500,
                        height: 500,
                        background: "radial-gradient(circle, rgba(120,90,255,0.35) 0%, transparent 70%)",
                        right: "10%",
                        bottom: "10%",
                        animationDelay: "-10s",
                    }}
                />
            </div>
            <div className="aurora-grid" />

            <div style={{ maxWidth: 1240, margin: "0 auto", position: "relative", zIndex: 2 }}>

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, ease: "easeOut" }}
                    style={{ marginBottom: 60, textAlign: "center" }}
                >
                    <span className="eyebrow" style={{ marginBottom: 20 }}>Pricing</span>
                    <h1
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "clamp(36px, 5vw, 64px)",
                            fontWeight: 400,
                            letterSpacing: "-0.03em",
                            color: "var(--fg)",
                            marginTop: 16,
                            marginBottom: 16,
                            lineHeight: 1.05,
                        }}
                    >
                        Simple, <em style={{ color: "var(--accent)", fontStyle: "italic" }}>transparent</em> plans.
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
                                /* Featured card gets accent ring */
                                ...(tier.highlighted
                                    ? { boxShadow: "0 0 0 1px var(--accent) inset, inset 0 1px 0 rgba(255,255,255,0.10), 0 30px 80px -30px rgba(0,0,0,0.6)" }
                                    : {}),
                            }}
                        >
                            {/* Badges */}
                            {tier.slug === "starter" && (
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
                                        color: "var(--accent)",
                                        border: "1px solid var(--accent-glow)",
                                        background: "rgba(182,168,255,0.1)",
                                        borderRadius: 999,
                                        padding: "3px 10px",
                                    }}
                                >
                                    New Client Offer!
                                </span>
                            )}
                            {tier.highlighted && (
                                <span
                                    style={{
                                        position: "absolute",
                                        top: -1,
                                        right: 24,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 10,
                                        fontWeight: 500,
                                        letterSpacing: "0.12em",
                                        textTransform: "uppercase",
                                        background: "var(--accent)",
                                        color: "#06121a",
                                        borderRadius: "0 0 10px 10px",
                                        padding: "4px 12px",
                                    }}
                                >
                                    Most Popular
                                </span>
                            )}
                            {tier.slug === "premium" && (
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
                                    Premium Support
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
                                            fontWeight: 300,
                                            color: "var(--fg)",
                                            letterSpacing: "-0.03em",
                                            lineHeight: 1,
                                        }}
                                    >
                                        ${tier.price}
                                    </span>
                                    <span style={{ fontSize: 13, color: "var(--fg-3)", marginBottom: 6 }}>/month</span>
                                </div>
                                <p style={{ marginTop: 12, fontSize: 14, color: "var(--fg-2)", lineHeight: 1.5 }}>
                                    {tier.tagline}
                                </p>
                            </div>

                            {/* Feature list */}
                            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                                {tier.features.map((feature) => (
                                    <li
                                        key={feature}
                                        style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "var(--fg-2)" }}
                                    >
                                        <FontAwesomeIcon
                                            icon={faCheck}
                                            style={{ color: "var(--accent)", marginTop: 2, flexShrink: 0, width: 14 }}
                                        />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            {/* CTA */}
                            <div style={{ marginTop: 28 }}>
                                <Link
                                    href={`/onboarding?plan=${tier.slug}`}
                                    className={tier.highlighted ? "btn primary" : "btn ghost"}
                                    style={{ width: "100%", justifyContent: "center" }}
                                >
                                    Get started with {tier.name}
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer note */}
                <motion.p
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.4 }}
                    style={{
                        marginTop: 40,
                        textAlign: "center",
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--fg-3)",
                    }}
                >
                    Questions? Reach out via the contact form on our{" "}
                    <Link href="/" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                        home page
                    </Link>
                    .
                </motion.p>
            </div>
        </main>
    );
}
