/**
 * The trade pages that are live, in the order the nav and the footer list them.
 *
 * One list, two places: the nav's Trades menu and the footer's Trades column both read it, so a
 * new trade page is added here once and appears in both. Before this existed the footer named
 * HVAC in its own markup, which is the kind of list that quietly falls behind.
 *
 * A page belongs here only after Xander has approved its wording and it is live. Its `href` must
 * also be in `PUBLIC_PATHS` (app/lib/site-seo.ts), which is what puts it in the sitemap;
 * `test/trade-pages.test.mjs` fails if the two disagree.
 */
export interface TradePage {
    /** As the menu shows it. */
    label: string;
    href: string;
}

export const TRADE_PAGES: readonly TradePage[] = [
    { label: "HVAC", href: "/hvac" },
    { label: "Plumbing", href: "/plumbing" },
    { label: "Lawn Care", href: "/lawn-care" },
    { label: "Auto Detailing", href: "/auto-detailing" },
    { label: "Pressure Washing", href: "/pressure-washing" },
    { label: "Roofing", href: "/roofing" },
];
