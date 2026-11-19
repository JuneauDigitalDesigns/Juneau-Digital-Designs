/**
 * Which page views Vercel Web Analytics may report, and what each one may say.
 *
 * Analytics is for marketing traffic: who reads the homepage, pricing, the trade pages. Some
 * pages on this domain are not that. They belong to a client, and several carry a private
 * code in the address:
 *
 *   - /portal/...        the signed-in client portal (and its sign-in / sign-up / onboarding)
 *   - /terms/<code>      a client's private Terms of Service link, and /terms/accept
 *   - /pay/<code>        a client's private payment link
 *   - /start             the signed-in purchase gate
 *   - /checkout/...      Stripe's return pages; /checkout/success carries `?session_id=cs_...`
 *
 * None of these are reported, and a code must never leave the browser as part of a URL. The
 * Vercel script sends the full `location.href`, query string and fragment included (read from
 * script.debug.js, v0.1.3), so the check has to happen here, before it is sent.
 *
 * Two layers use this:
 *   1. `SiteAnalytics` does not mount `<Analytics/>` on these paths, so landing on one directly
 *      never loads the script at all.
 *   2. `beforeSend` returns null for them, which covers a visitor who loads the homepage first
 *      and then moves into one of them without a full page load.
 *
 * Public pages are reported without their fragment, and with only campaign tags kept from the
 * query string. Click IDs (gclid, fbclid) and anything else are dropped.
 *
 * /terms itself (the public Terms of Service) and /sms-terms stay reported.
 */

/** Path prefixes that are never reported. Each matches the path itself and anything below it. */
const PRIVATE_PREFIXES = ["/portal", "/pay", "/start", "/checkout"] as const;

/** Query parameters a public page view may keep. Everything else is removed. */
const KEPT_QUERY_PARAMS = new Set([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "ref",
]);

/** True for a path that must never be reported. Takes a pathname, not a full URL. */
export function isPrivatePath(pathname: string): boolean {
    // Normalise so "/Portal", "/portal/" and "//portal" cannot slip past the prefix check.
    const path = ("/" + pathname.replace(/^\/+/, "")).toLowerCase();

    for (const prefix of PRIVATE_PREFIXES) {
        if (path === prefix || path.startsWith(prefix + "/")) return true;
    }
    // Anything below /terms is a private code or the signed-in signing flow. /terms is public.
    if (path.startsWith("/terms/")) return true;
    return false;
}

/**
 * The URL a page view may be reported with, or null if it must not be reported.
 *
 * Fails closed: anything that does not parse as a URL is dropped rather than passed on.
 */
export function analyticsUrl(url: string): string | null {
    let parsed: URL;
    try {
        // A base so a bare path parses too; the script sends absolute URLs.
        parsed = new URL(url, "https://www.juneaudigitaldesigns.com");
    } catch {
        return null;
    }

    let pathname = parsed.pathname;
    try {
        // A percent-encoded path ("/%70ortal") must not get past the prefix check.
        pathname = decodeURIComponent(pathname);
    } catch {
        return null;
    }
    if (isPrivatePath(pathname)) return null;

    for (const key of [...parsed.searchParams.keys()]) {
        if (!KEPT_QUERY_PARAMS.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    return parsed.toString();
}

/** The event shape `@vercel/analytics` hands to `beforeSend` (pageviews and custom events). */
export interface AnalyticsEvent {
    type: "pageview" | "event";
    url: string;
}

/** `beforeSend` for `<Analytics/>`: drops private pages and strips the rest. */
export function filterAnalyticsEvent<E extends AnalyticsEvent>(event: E): E | null {
    const url = analyticsUrl(event.url);
    return url === null ? null : { ...event, url };
}
