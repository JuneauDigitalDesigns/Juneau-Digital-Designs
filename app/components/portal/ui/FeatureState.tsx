"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { FeatureAvailability, PortalFeature } from "@jdd/schema";
import { SCHEDULES } from "@/app/lib/legal/schedules";

/**
 * Explains why a panel has nothing to show.
 *
 * The portal used to render one greyed tab whose tooltip read "Not available on this
 * site's plan" for three unrelated situations. For a Growth client whose site was still
 * being built, that message was simply false. Each state now gets its own words, and the
 * copy never names infrastructure — a client has no idea what Airtable or Vercel is, and
 * naming them turns our plumbing into their problem.
 */

type FeatureCopy = {
    noun: string;
    whatItDoes: string;
    whenLive: string;
    emptyTitle: string;
    emptyBody: string;
    /**
     * Only for features a plan can actually exclude. `calls` is the only one today — traffic
     * and performance ship on every tier, so if their `not-on-plan` branch is ever reached it
     * is a bug, and the generic panel is the honest thing to render rather than an invented
     * pitch for a plan that would not fix it.
     */
    upsell?: { title: string; body: string; cta: string };
};

const COPY: Record<PortalFeature, FeatureCopy> = {
    calls: {
        noun: "Call tracking",
        whatItDoes:
            "Your AI receptionist logs every call it answers — who rang, what they wanted, and how it was handled.",
        whenLive: "Every call your receptionist answers will be listed here, newest first.",
        emptyTitle: "No calls yet",
        emptyBody:
            "Your receptionist is live and listening. The first call it answers will appear here within a few minutes.",
        upsell: {
            title: "Call tracking comes with Growth",
            // Price and allowance come from Schedule A so this upsell can never quote
            // a client a number the agreement they'd sign contradicts.
            body: `Growth adds an AI receptionist on its own business number — it answers the phone when you can't, and every call lands here with who rang, what they wanted, and how it was handled. $${SCHEDULES.growth.monthlyPrice} a month, including ${SCHEDULES.growth.callMinutes?.toLocaleString("en-US")} call minutes.`,
            cta: "Upgrade to Growth",
        },
    },
    traffic: {
        noun: "Traffic analytics",
        whatItDoes: "See how many people visit your site, where they come from, and which pages they read.",
        whenLive: "Visitor counts, traffic sources, and your most-read pages will appear here.",
        emptyTitle: "No visits recorded yet",
        emptyBody: "Once people start finding your site, their visits will show up here.",
    },
    performance: {
        noun: "Performance scores",
        whatItDoes: "A daily health check on how fast your site loads for real visitors on a phone.",
        whenLive: "A daily speed score and loading breakdown will appear here.",
        emptyTitle: "No score yet",
        emptyBody: "We run the first check within a day of your site going live.",
    },
};

export function FeatureState({
    feature,
    availability,
    ghost,
    upgradeHref,
    billingLinked = true,
}: {
    feature: PortalFeature;
    availability: FeatureAvailability;
    /** Ghost preview to show under the message, when one fits the panel. */
    ghost?: ReactNode;
    /**
     * Where the upsell's primary action goes. Optional so the panel degrades to a plain
     * "compare plans" link anywhere the caller has no site slug to upgrade.
     */
    upgradeHref?: string;
    /**
     * False when the site has no subscription on file, which makes a self-serve upgrade
     * impossible. Defaults true so a caller that doesn't know (and therefore isn't offering
     * an upgrade) is unaffected.
     */
    billingLinked?: boolean;
}) {
    const copy = COPY[feature];

    if (availability.state === "not-on-plan") {
        const upsell = copy.upsell;

        // A live client should always have a subscription on file. When one doesn't, the
        // upgrade cannot complete — and it used to fail only after they had signed a Growth
        // agreement and been emailed a copy. Say something is wrong and point at us, rather
        // than selling a change we can't deliver. No mention of Stripe or subscriptions:
        // it's our plumbing, and the client can't act on it.
        if (upsell && upgradeHref && !billingLinked) {
            return (
                <div className="space-y-6">
                    <Panel
                        title="We need to sort something out first"
                        body="There's a problem with your account setup that we need to fix before you can upgrade. Get in touch and we'll take care of it — it won't take long."
                        action={
                            <a
                                href="mailto:hello@juneaudigitaldesigns.com?subject=Upgrade%20to%20Growth"
                                className="text-sm font-medium px-4 py-2.5 rounded-md transition-opacity hover:opacity-90"
                                style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                            >
                                Get in touch
                            </a>
                        }
                    />
                    {ghost}
                </div>
            );
        }
        return (
            <div className="space-y-6">
                <Panel
                    title={upsell?.title ?? `${copy.noun} isn't part of your plan`}
                    body={upsell?.body ?? copy.whatItDoes}
                    action={
                        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
                            {upsell && upgradeHref && (
                                // Not `.portal-interactive`: its hover repaints the surface
                                // with `--elev-2`, which is written for neutral cards and
                                // would fight an accent fill.
                                <Link
                                    href={upgradeHref}
                                    className="text-sm font-medium px-4 py-2.5 rounded-md transition-opacity hover:opacity-90"
                                    style={{
                                        background: "var(--accent)",
                                        color: "var(--on-accent)",
                                    }}
                                >
                                    {upsell.cta}
                                </Link>
                            )}
                            <Link
                                href="/pricing"
                                className="text-sm underline underline-offset-4"
                                style={{ color: "var(--fg-2)" }}
                            >
                                Compare plans
                            </Link>
                        </div>
                    }
                />
                {ghost}
            </div>
        );
    }

    if (availability.state === "pending-build") {
        return (
            <div className="space-y-6">
                <Panel
                    title="This unlocks when your site goes live"
                    body={`${copy.whenLive} We'll email you the moment it's ready.`}
                />
                {ghost}
            </div>
        );
    }

    if (availability.state === "connecting") {
        // Deliberately phrased as our outstanding work. The client cannot act on this, and
        // implying they can — or that it's broken — would be worse than saying nothing.
        return (
            <Panel
                title="We're finishing your setup"
                body={`Your site is live, and we're still connecting ${copy.noun.toLowerCase()}. Nothing is needed from you — this usually takes a day or two.`}
                action={
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com"
                        className="inline-block text-sm underline underline-offset-4"
                        style={{ color: "var(--accent)" }}
                    >
                        Ask us about it
                    </a>
                }
            />
        );
    }

    // "ready" but the upstream returned nothing — a genuinely empty log, not a fault.
    return <Panel title={copy.emptyTitle} body={copy.emptyBody} />;
}

/** Wired up, but the request failed. Distinct from every lifecycle state above. */
export function FeatureError({
    message,
    onRetry,
}: {
    message?: string;
    onRetry?: () => void;
}) {
    return (
        <Panel
            title="We couldn't load this"
            body={
                message ??
                "Something went wrong on our end. Your data is safe — this is only a problem displaying it."
            }
            action={
                onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="portal-elev portal-interactive text-sm px-3.5 py-2 cursor-pointer"
                        style={{ color: "var(--fg)" }}
                    >
                        Try again
                    </button>
                )
            }
        />
    );
}

function Panel({
    title,
    body,
    action,
}: {
    title: string;
    body: string;
    action?: ReactNode;
}) {
    return (
        <div className="portal-elev px-6 py-10 flex flex-col items-center text-center gap-3">
            <h2
                className="font-bold"
                style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-xl)" }}
            >
                {title}
            </h2>
            <p
                className="text-sm max-w-md"
                style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
            >
                {body}
            </p>
            {action}
        </div>
    );
}
