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
 * `shortLabel` exists for the mobile tab bar, where a fifth of a 375px screen is about 70px.
 * It is the same word wherever it can be, which today is everywhere.
 *
 * `feature` is the gate the tab is marked by. A list means "available if any of these is":
 * Analytics replaced Traffic (gated on `traffic`) and Performance (gated on `performance`), and
 * a site with one but not the other still has an Analytics page worth opening. The page then
 * explains the missing half with that half's own panel. See `tabAvailability`.
 *
 * 2026-11-09 rework: Traffic and Performance became one Analytics tab, and Billing moved inside
 * Settings as "Plan & billing". Their old paths still resolve: each page under
 * `(dash)/{traffic,performance,billing}` is now only a redirect, so bookmarks, emails and links
 * in code that has not caught up keep working. See `legacyTabDestination`.
 */
export const PORTAL_TABS = [
    { id: "overview", label: "Overview", shortLabel: "Overview", href: "", feature: null },
    // Renamed from "Call Log": this is now the triage surface for calls *and* web-form
    // enquiries. The href stays `calls` so existing links and bookmarks keep working, and its
    // gate moved to `leads` — web-only sites have no call log but do receive form enquiries.
    { id: "calls", label: "Inbox", shortLabel: "Inbox", href: "calls", feature: "leads" },
    { id: "customers", label: "Customers", shortLabel: "Customers", href: "customers", feature: "crm" },
    // Scheduling and follow-ups (Xander, 2026-11-12), part of the CRM: same gate as Customers,
    // so Starter sees it with a padlock and a page that says what Growth adds.
    { id: "calendar", label: "Calendar", shortLabel: "Calendar", href: "calendar", feature: "crm" },
    {
        id: "analytics",
        label: "Analytics",
        shortLabel: "Analytics",
        href: "analytics",
        feature: ["traffic", "performance"],
    },
    { id: "settings", label: "Settings", shortLabel: "Settings", href: "settings", feature: null },
    { id: "support", label: "Support", shortLabel: "Support", href: "support", feature: null },
] as const satisfies ReadonlyArray<{
    id: string;
    label: string;
    shortLabel: string;
    href: string;
    feature: PortalFeature | readonly PortalFeature[] | null;
}>;

export type PortalTabId = (typeof PORTAL_TABS)[number]["id"];

/**
 * Settings' two parts, in order. `href` is a full tab path, ready for `tabHref`.
 *
 * Nested routes rather than `?tab=`. Each part is its own server page that loads only what it
 * shows (agreements and text-alert consent for Account, the call-minutes figure for Plan &
 * billing), the rail and the page's own tabs can mark the current part from the pathname
 * alone, and the old `/portal/billing` has a real path to redirect to.
 */
export const SETTINGS_TABS = [
    { id: "account", label: "Account", href: "settings" },
    { id: "billing", label: "Plan & billing", href: "settings/billing" },
] as const;

/** Which Settings part a pathname is, or null when it is not under Settings at all. */
export function settingsTabFor(pathname: string): (typeof SETTINGS_TABS)[number]["id"] | null {
    const rest = pathname.replace(/^\/portal\/?/, "").replace(/\/$/, "");
    if (rest === "settings") return "account";
    if (rest === "settings/billing") return "billing";
    return null;
}

/**
 * One availability for a tab, from however many features gate it.
 *
 * Null for an ungated tab. For a list: ready if any member is ready, because the page has
 * something real to show; locked only when every member is off the plan, because otherwise the
 * padlock would tell a client the whole tab is not theirs; otherwise the first member's own
 * not-yet state, which is the panel the page leads with.
 */
export function tabAvailability(
    feature: PortalFeature | readonly PortalFeature[] | null,
    features: Record<PortalFeature, FeatureAvailability>,
): FeatureAvailability | null {
    if (feature === null) return null;
    if (typeof feature === "string") return features[feature];

    const all = feature.map((f) => features[f]);
    const ready = all.find((a) => a.state === "ready");
    if (ready) return ready;
    return all.find((a) => a.state !== "not-on-plan") ?? all[0] ?? null;
}

/**
 * How the six tabs split across the mobile bottom bar.
 *
 * Five slots is the most a 375px screen holds at a comfortable touch size, so four tabs sit
 * in the bar and the rest go behind More. The bar is for what a client opens the portal *to
 * do*: work today's leads and customers, and check how the website is doing.
 *
 * Locked tabs keep their slot rather than being filtered out. A Starter client seeing
 * Customers with a padlock is the upsell; hiding it means they never learn the feature exists.
 * See the note in `PortalChrome` about tabs always navigating.
 *
 * Calendar (2026-11-12) went behind More, first in it: the bar was full, and the customer record's
 * own "Coming up" and "Add to calendar" cover the day-to-day on a phone.
 *
 * Analytics took the slot Billing held. Folding Traffic and Performance together made it the
 * one place a client checks their website, which is something they monitor. Settings (which
 * now holds Plan & billing) and Support are deliberate visits, so they sit behind More.
 */
export const MOBILE_BAR_TABS = ["overview", "calls", "customers", "analytics"] as const satisfies
    ReadonlyArray<PortalTabId>;

export const MOBILE_MORE_TABS = ["calendar", "settings", "support"] as const satisfies
    ReadonlyArray<PortalTabId>;

/**
 * Where each retired tab's path now lives.
 *
 * The fragment lands the reader on the section the old tab was: `/portal/performance` opens
 * Analytics at Speed rather than at the top of the page.
 */
export const LEGACY_TABS = {
    traffic: { path: "analytics", hash: "visitors" },
    performance: { path: "analytics", hash: "speed" },
    billing: { path: "settings/billing", hash: null },
} as const satisfies Record<string, { path: string; hash: string | null }>;

/**
 * The redirect target for a retired tab. Every query parameter is carried over, not just
 * `?site=`, so a link that carried something else as well arrives with it.
 */
export function legacyTabDestination(
    legacy: keyof typeof LEGACY_TABS,
    params: Record<string, string | string[] | undefined>,
): string {
    const { path, hash } = LEGACY_TABS[legacy];
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        for (const v of Array.isArray(value) ? value : [value]) qs.append(key, v);
    }
    const query = qs.toString();
    return `/portal/${path}${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

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

/**
 * Where a website-only client switches the AI receptionist on (D7, 2026-11-04).
 *
 * The receptionist is part of Starter; website-only is the same price with it declined, signed
 * against a different schedule. Switching it on is accepting the standard Starter terms with a
 * phone choice, at no charge (contract v5.3 §15.4, Starter: no onboarding fee). Xander then
 * provisions it with onboard.js.
 */
export function addReceptionistHref(slug: string): string {
    return `/agreement?plan=starter&receptionist=${encodeURIComponent(slug)}`;
}
