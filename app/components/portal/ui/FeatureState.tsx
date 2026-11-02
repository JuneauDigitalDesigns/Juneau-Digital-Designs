"use client";

import type { ReactNode } from "react";
import type { FeatureAvailability, PortalFeature } from "@jdd/schema";

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
    leads: {
        noun: "Your inbox",
        whatItDoes:
            "Every call your receptionist answers and every enquiry from your website, in one place.",
        whenLive: "Calls and website enquiries will land here as they come in.",
        emptyTitle: "Nothing yet",
        emptyBody:
            "When someone calls or fills in your website form, they'll show up here straight away.",
    },
    crm: {
        noun: "Customers",
        whatItDoes:
            "Keep track of each customer from first enquiry to finished job, with notes, follow-ups and their full history.",
        whenLive: "Customers you add from your inbox will appear here.",
        emptyTitle: "No customers yet",
        emptyBody:
            "Open your inbox and tap “Promote to customer” on anyone you want to keep track of.",
    },
    messaging: {
        noun: "Texting your customers",
        whatItDoes:
            "Text your customers from your business number, and ask happy ones for a Google review.",
        whenLive: "You'll be able to message your customers from here.",
        emptyTitle: "No messages yet",
        emptyBody: "Your conversations with customers will appear here.",
    },
};

export function FeatureState({
    feature,
    availability,
    ghost,
}: {
    feature: PortalFeature;
    availability: FeatureAvailability;
    /** Ghost preview to show under the message, when one fits the panel. */
    ghost?: ReactNode;
}) {
    const copy = COPY[feature];

    if (availability.state === "not-on-plan") {
        // Only a web-only site reaches this today — a Starter client who declined the
        // receptionist at signing. Every plan has included the receptionist since the
        // 2026-10-12 reprice, so this is "switch on a feature you skipped", not a paid tier
        // upgrade: no plan name, no price, and a contact-us rather than the Starter→Growth
        // flow, which would sell them a pricier plan to get something their own already
        // includes. There is no self-serve toggle — enabling it is an ops action — so the
        // one honest action is to reach us. traffic/performance ship on every tier and must
        // never land here.
        if (feature === "calls") {
            return (
                <div className="space-y-6">
                    <Panel
                        title="Add your AI receptionist"
                        body="Your plan includes an AI receptionist on a dedicated business number — it answers when you can't, and every call is logged here with who rang and what they wanted. You started website-only; just say the word and we'll switch it on."
                        action={
                            <a
                                href="mailto:hello@juneaudigitaldesigns.com?subject=Add%20my%20AI%20receptionist"
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
        // Defensive: traffic/performance have no plan that excludes them, so reaching this is
        // a bug. Render the honest generic panel rather than an invented pitch.
        return (
            <div className="space-y-6">
                <Panel title={`${copy.noun} isn't part of your plan`} body={copy.whatItDoes} />
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

    // Messaging's `connecting` is a different wait from everyone else's. It is the client's own
    // A2P 10DLC registration sitting with the carriers — 13–20 business days, not "a day or two"
    // — so quoting the generic timescale would turn a normal wait into a support ticket on day
    // three. Calls, leads and the CRM are all unaffected, and saying so is the point.
    if (availability.state === "connecting" && feature === "messaging") {
        return (
            <Panel
                title="Texting turns on soon"
                body="Your business registration is with the phone carriers — it usually takes about two more weeks. Your calls, leads and customers are all unaffected, and we'll switch this on automatically."
            />
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
