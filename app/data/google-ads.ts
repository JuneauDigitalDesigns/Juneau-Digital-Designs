/**
 * Google Ads, for the /contact → /contact/thank-you conversion.
 *
 * The /contact page is the landing page for Xander's Google Ads campaigns; a lead counts when the
 * form on it is sent and the visitor reaches /contact/thank-you. Google Ads needs two values from
 * Xander's own account to record that: the account's tag id (`AW-…`) and the conversion's label.
 *
 * Both are null until he supplies them. While they are null the site loads no Google tag and
 * fires no conversion — the pages work exactly the same, they just don't report to Google yet.
 * Fill both in (here, or hand them over and I will) and tracking turns on with no other change.
 *
 * These are not secrets: a Google Ads tag id and conversion label are visible in the page source
 * of any site that runs them. They live in code, not an env var, so the value is reviewable.
 */
export const GOOGLE_ADS_TAG_ID: string | null = null; // e.g. "AW-1234567890"
export const LEAD_CONVERSION_LABEL: string | null = null; // e.g. "abcDEfghIJ123"

/** The `send_to` a conversion event needs, or null when the tag isn't configured yet. */
export function leadConversionTarget(): string | null {
    if (!GOOGLE_ADS_TAG_ID || !LEAD_CONVERSION_LABEL) return null;
    return `${GOOGLE_ADS_TAG_ID}/${LEAD_CONVERSION_LABEL}`;
}
