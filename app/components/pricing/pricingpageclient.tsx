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
        price: 147,
        tagline: "Everything you need to keep your site running smoothly.",
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
        tagline: "Grow your search presence and get more detailed insights.",
        features: [
            "Custom 5-page website",
            "24/7 AI voice receptionist",
            "Everything in Starter",
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
            "Quarterly strategy sessions with our founder"
        ],
        highlighted: false,
    },
];

export default function PricingPageClient() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-16 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="mb-14 text-center"
                >
                    <span className="inline-flex rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-700">
                        Pricing
                    </span>
                    <h1 className="mt-4 text-4xl font-black leading-tight text-slate-900 sm:text-5xl">
                        Simple, transparent plans.
                    </h1>
                    <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 leading-relaxed">
                        Pick the plan that fits where you are now. Every plan includes personal support — no tickets, no bots.
                    </p>
                </motion.div>

                {/* Pricing Cards */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {TIERS.map((tier, index) => (
                        <motion.div
                            key={tier.slug}
                            initial={{ opacity: 0, y: 24 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.1 }}
                            className={`relative flex flex-col rounded-3xl border p-8 shadow-xl backdrop-blur transition ${
                                tier.slug === "premium"
                                    ? "overflow-hidden border-[#0E1A2B] bg-gradient-to-b from-[#132745] via-[#102033] to-[#0B1624] text-white shadow-[0_24px_60px_rgba(14,26,43,0.28)]"
                                    : tier.highlighted || tier.slug === "starter"
                                      ? "border-t-4 border-t-[#D4672A] border-slate-200 bg-white/95"
                                      : "border-slate-200 bg-white/95"
                            }`}
                        >
                            {tier.slug === "premium" && (
                                <>
                                    <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_top,rgba(212,103,42,0.24),transparent_68%)]" />
                                    <span className="absolute right-4 top-4 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#F4E4DA] shadow-sm backdrop-blur-sm">
                                        Premium Support
                                    </span>
                                </>
                            )}

                            {tier.slug === "starter" && (
                                <span className="absolute right-4 top-2 rounded-full border border-[#D4672A]/20 bg-[#F4E4DA] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#A34D1C] shadow-sm">
                                    New Client Offer!
                                </span>
                            )}

                            {tier.highlighted && (
                                <span className="absolute -top-px right-6 rounded-b-xl bg-[#D4672A] px-3 py-1 text-xs font-bold uppercase tracking-wider text-white shadow">
                                    Most Popular
                                </span>
                            )}

                            <div className="mb-6">
                                <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                                        tier.slug === "premium"
                                            ? "border border-white/15 bg-white/10 text-[#F4E4DA]"
                                            : "border border-zinc-200 bg-zinc-50 text-zinc-600"
                                    }`}
                                >
                                    {tier.name}
                                </span>
                                <div className="mt-4 flex items-end gap-1">
                                    <span className={`text-5xl font-black ${tier.slug === "premium" ? "text-white" : "text-slate-900"}`}>
                                        ${tier.price}
                                    </span>
                                    <span className={`mb-1 text-sm ${tier.slug === "premium" ? "text-slate-300" : "text-slate-500"}`}>
                                        /month
                                    </span>
                                </div>
                                <p className={`mt-3 text-sm leading-relaxed ${tier.slug === "premium" ? "text-slate-200" : "text-slate-600"}`}>
                                    {tier.tagline}
                                </p>
                            </div>

                            <ul className="mb-8 flex flex-col gap-3">
                                {tier.features.map((feature) => (
                                    <li
                                        key={feature}
                                        className={`flex items-start gap-2.5 text-sm ${tier.slug === "premium" ? "text-slate-100" : "text-slate-700"}`}
                                    >
                                        <FontAwesomeIcon
                                            icon={faCheck}
                                            className={`mt-0.5 h-4 w-4 shrink-0 ${tier.slug === "premium" ? "text-[#F0A06A]" : "text-[#D4672A]"}`}
                                        />
                                        <span>{feature}</span>
                                    </li>
                                ))}
                            </ul>

                            <div className="mt-auto">
                                <Link
                                    href={`/onboarding?plan=${tier.slug}`}
                                    className={`inline-flex w-full items-center justify-center rounded-xl px-6 py-3 text-sm font-semibold transition ${
                                        tier.slug === "premium"
                                            ? "bg-[#D4672A] text-white hover:bg-[#E0793F]"
                                            : tier.highlighted
                                            ? "bg-[#0E1A2B] text-white hover:bg-[#132745]"
                                            : "border border-[#0E1A2B] bg-white text-[#0E1A2B] hover:bg-[#0E1A2B] hover:text-white"
                                    }`}
                                >
                                    Get started with {tier.name}
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Footer note */}
                <motion.p
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: "easeOut", delay: 0.4 }}
                    className="mt-12 text-center text-sm text-slate-500"
                >
                    Questions? Reach out via the contact form on our{" "}
                    <Link href="/" className="font-semibold text-slate-700 underline underline-offset-4 hover:text-slate-900">
                        home page
                    </Link>
                    .
                </motion.p>
            </div>
        </main>
    );
}
