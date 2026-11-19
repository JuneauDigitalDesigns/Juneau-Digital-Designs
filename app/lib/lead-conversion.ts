import { GOOGLE_ADS_TAG_ID, leadConversionTarget } from "@/app/data/google-ads";

/**
 * The one-time handoff from a sent form to the thank-you page.
 *
 * The /contact form, on a successful send, leaves a marker in `sessionStorage` and navigates to
 * /contact/thank-you, which reads the marker, fires the Google Ads conversion once, and clears
 * it. The marker, not the web address, carries the signal, for two reasons:
 *   - a refresh or a bookmark of /contact/thank-you has no marker, so the conversion never counts
 *     twice and a stray visit never counts at all;
 *   - the business name travels in the browser only, never in the URL, so it can't leak into an
 *     ad report or a referrer.
 * `sessionStorage` (not `localStorage`) so the marker dies with the tab, and every read is wrapped
 * because a private window or blocked storage can throw.
 */
const MARKER_KEY = "jdd:lead-sent";

export type LeadMarker = { businessName: string; at: number };

/** Called by the form on a successful send, just before it navigates to the thank-you page. */
export function markLeadSent(businessName: string): void {
    try {
        sessionStorage.setItem(MARKER_KEY, JSON.stringify({ businessName, at: Date.now() }));
    } catch {
        // No storage (private window, blocked). The thank-you page still shows; it just greets
        // "your business" and, without a marker, does not count a conversion.
    }
}

/** Read the marker and remove it in one go, so a conversion can fire at most once per send. */
export function takeLeadMarker(): LeadMarker | null {
    try {
        const raw = sessionStorage.getItem(MARKER_KEY);
        if (!raw) return null;
        sessionStorage.removeItem(MARKER_KEY);
        const parsed = JSON.parse(raw) as Partial<LeadMarker>;
        return { businessName: typeof parsed.businessName === "string" ? parsed.businessName : "", at: Number(parsed.at) || 0 };
    } catch {
        return null;
    }
}

/**
 * Fire the Google Ads lead conversion, if the tag is configured. A no-op until Xander supplies
 * the tag id and conversion label (see `app/data/google-ads.ts`): no tag loads, so `gtag` is not
 * on the page and this returns without doing anything.
 */
export function fireLeadConversion(): void {
    const sendTo = leadConversionTarget();
    if (!sendTo) return;
    const gtag = (window as unknown as { gtag?: (...args: unknown[]) => void }).gtag;
    if (typeof gtag !== "function") return;
    gtag("event", "conversion", { send_to: sendTo });
}

/** Whether the Google Ads tag should be loaded at all. */
export function googleAdsEnabled(): boolean {
    return Boolean(GOOGLE_ADS_TAG_ID);
}
