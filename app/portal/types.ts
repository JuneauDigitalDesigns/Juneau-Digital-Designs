import type {
    FeatureAvailability,
    PortalFeature,
    PortalPlan,
    PortalSiteStatus,
} from "@jdd/schema";

/**
 * One site as the dashboard needs it.
 *
 * `features` replaced a pair of booleans (`hasCallData` / `hasTraffic`). The booleans could
 * only say "no", never why, so the UI rendered every "no" with the same tooltip — telling
 * Growth clients whose sites were still being built that their plan didn't include a
 * feature they were paying for. Availability now carries its reason all the way to the
 * panel that explains it.
 */
export interface PortalSiteProps {
    slug: string;
    name: string;
    /** The client's own live URL. Stored on the KV record but previously never exposed,
     *  so the portal had no way to link a client to the site it reports on. */
    canonical: string | null;
    plan: PortalPlan;
    status: PortalSiteStatus;
    /**
     * Whether a subscription pointer exists on the record — the *derived* result of
     * `hasBillingLink`, never the identifiers themselves, which stay server-side.
     *
     * False on a live site is an anomaly rather than a plan state, and the UI treats it as
     * one: it replaces the upgrade CTA with a contact-us panel instead of letting a client
     * sign an agreement for a change that cannot complete.
     */
    billingLinked: boolean;
    features: Record<PortalFeature, FeatureAvailability>;
    featured: { optedInAt: number; quote?: string; showName: boolean; showLink: boolean } | null;
    cancelRequestedAt: number | null;
    cancelEffectiveAt: number | null;
}

export interface PortalClientProps {
    sites: PortalSiteProps[];
    accountEmail: string;
    accountProfile: { contactName?: string; contactPhone?: string } | null;
}

/**
 * The dashboard's tabs, in nav order.
 *
 * `shortLabel` exists for the mobile tab bar, where a fifth of a 375px screen is about 70px
 * and "Performance" does not fit. It is the same word wherever it can be.
 */
export const PORTAL_TABS = [
    { id: "overview", label: "Overview", shortLabel: "Overview", href: "", feature: null },
    { id: "calls", label: "Call Log", shortLabel: "Calls", href: "calls", feature: "calls" },
    { id: "traffic", label: "Traffic", shortLabel: "Traffic", href: "traffic", feature: "traffic" },
    { id: "performance", label: "Performance", shortLabel: "Speed", href: "performance", feature: "performance" },
    { id: "billing", label: "Billing", shortLabel: "Billing", href: "billing", feature: null },
    { id: "settings", label: "Settings", shortLabel: "Settings", href: "settings", feature: null },
] as const satisfies ReadonlyArray<{
    id: string;
    label: string;
    shortLabel: string;
    href: string;
    feature: PortalFeature | null;
}>;

export type PortalTabId = (typeof PORTAL_TABS)[number]["id"];

/**
 * How the six tabs split across the mobile bottom bar.
 *
 * Five slots is the most a 375px screen holds at a comfortable touch size, so four tabs sit
 * in the bar and the rest go behind More. The four were picked by what a client opens the
 * portal to do: check leads, check the site is working, check what they are paying.
 * Performance and Settings are things you visit deliberately, not things you monitor.
 *
 * Locked tabs keep their slot rather than being filtered out. A Starter client seeing Call
 * Log with a padlock is the upsell; hiding it means they never learn the feature exists.
 * See the note in `PortalChrome` about tabs always navigating.
 */
export const MOBILE_BAR_TABS = ["overview", "calls", "traffic", "billing"] as const satisfies
    ReadonlyArray<PortalTabId>;

export const MOBILE_MORE_TABS = ["performance", "settings"] as const satisfies
    ReadonlyArray<PortalTabId>;

/**
 * Pick the site a request is scoped to.
 *
 * Prefers a live site over an unbuilt one when nothing is specified. The old code took
 * `sites[0]` unconditionally, which meant a client whose first site was still building
 * landed on a holding screen with no navigation — even when their other site was live.
 *
 * `pending-onboarding` is the last resort, below even `building`. Landing on a pending site
 * sends the client straight into that site's wizard, so defaulting to one would ambush a
 * client who came to check on a build with a form for a different site they bought later.
 * They still reach it — the site selector lists it, and the Overview redirects once it *is*
 * selected — but only when they choose it.
 */
export function selectSite<T extends { slug: string; status: PortalSiteStatus }>(
    sites: T[],
    requested?: string | null,
): T | undefined {
    if (requested) {
        const match = sites.find((s) => s.slug === requested);
        if (match) return match;
    }
    return (
        sites.find((s) => s.status === "live") ??
        sites.find((s) => s.status !== "pending-onboarding") ??
        sites[0]
    );
}

/** Preserve the selected site across navigation. */
export function tabHref(href: string, slug: string): string {
    const base = href ? `/portal/${href}` : "/portal";
    return `${base}?site=${encodeURIComponent(slug)}`;
}

/**
 * Where the Call Log upsell sends a Starter client.
 *
 * The upgrade starts at the agreement rather than at checkout on purpose: Growth is a
 * materially different schedule (a voice agent, 350 call minutes, overage at $0.20/min), so
 * the terms are re-signed before the subscription changes. `/agreement` already renders the
 * right schedule from `?plan=`; `?upgrade=` tells it to finish at the upgrade endpoint
 * instead of the first-purchase checkout.
 */
export function upgradeHref(slug: string): string {
    return `/agreement?plan=growth&upgrade=${encodeURIComponent(slug)}`;
}
