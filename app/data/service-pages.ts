/**
 * The service pages, in the order the nav's Services menu and the footer's Services column list
 * them, with the one line the menu shows under each (Xander, 24 Nov 2026: "I like having the
 * one-line description underneath each of them").
 *
 * One list, three places: the Services menu, the footer column and the "system rail" under each
 * service page's hero all read it. Every `href` must also be in `PUBLIC_PATHS`
 * (app/lib/site-seo.ts); `test/service-pages.test.mjs` fails if they disagree.
 *
 * Approved word for word from the round-3 mockup (https://claude.ai/artifact/KqRJeYPSZdpVs4XdsWDWsM).
 */
export interface ServicePage {
    /** As the menu shows it. */
    label: string;
    href: string;
    /** The menu's line under the name. */
    blurb: string;
    /** The rail's short line under the name, on every page but this one's own. */
    rail: string;
}

export const SERVICE_PAGES: readonly ServicePage[] = [
    { label: "Website design", href: "/website-design", blurb: "Written, built and hosted for you", rail: "Built for you" },
    { label: "Hosting + maintenance", href: "/website-hosting", blurb: "Kept fast, secure and up to date", rail: "Kept running" },
    { label: "AI receptionist", href: "/ai-receptionist", blurb: "Answers the calls you miss, 24/7", rail: "Calls answered" },
    { label: "Portal + CRM", href: "/crm", blurb: "Every lead, worked to Won", rail: "Leads worked" },
];

/** The one location page. In the footer's Pages column only; one page doesn't earn a nav menu. */
export const ORLANDO_PAGE = { label: "Orlando", href: "/orlando" } as const;
