"use client";

import { Analytics } from "@vercel/analytics/next";
import { usePathname } from "next/navigation";
import { filterAnalyticsEvent, isPrivatePath } from "@/app/lib/analytics-privacy";

/**
 * Vercel Web Analytics, for the marketing site only.
 *
 * A client component because `beforeSend` is a function, and a function prop cannot cross from
 * the server root layout into `<Analytics/>` (itself a client component).
 *
 * Not mounted on the portal or on private links, so landing on one never loads the script.
 * `filterAnalyticsEvent` covers moving into one after the script has loaded. See
 * `app/lib/analytics-privacy.ts` for which pages and why.
 */
export default function SiteAnalytics() {
    const pathname = usePathname();
    if (isPrivatePath(pathname)) return null;
    return <Analytics beforeSend={filterAnalyticsEvent} />;
}
