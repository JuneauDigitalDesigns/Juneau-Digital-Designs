/**
 * What people type into Google about each trade, read off published keyword lists on 19 Nov 2026.
 *
 * Every entry is a real search, not one we wrote. Xander's rule (19 Nov 2026): the homepage shows
 * these WITHOUT counts; the monthly counts are kept here for each trade's own page, the way /hvac
 * prints HVAC's (`hvac-searches.ts`). A trade page that prints a count names its source.
 *
 * Four trades come from the publisher HVAC's do (Marketkeep), whose figures come from Google
 * Keyword Planner, so the counts are comparable across trades. Detailing has one search and no
 * count: Marketkeep's car-wash list, which carried detailing terms, now returns 404, and the one
 * phrase here is named (without a figure) in Ranktracker's detailing guide. Find a counted source
 * before a detailing page prints a number.
 */

export type SearchTrade = "plumbing" | "roofing" | "lawn-care" | "pressure-washing" | "car-detailing";

export interface TradeSearch {
    search: string;
    /** As the source printed it. `null` where the source gives no figure. */
    perMonth: string | null;
}

export interface TradeSearchList {
    source: string;
    url: string;
    searches: TradeSearch[];
}

export const TRADE_SEARCHES: Record<SearchTrade, TradeSearchList> = {
    plumbing: {
        source: "Marketkeep, SEO Keywords for Plumbers, updated 28 Sep 2026",
        url: "https://marketkeep.com/seo-keywords-for-plumbers/",
        searches: [
            { search: "plumbers near me", perMonth: "823,000" },
            { search: "water heater repairs", perMonth: "74,000" },
            { search: "plumbing companies near me", perMonth: "49,500" },
            { search: "water heater replacement cost", perMonth: "40,500" },
            { search: "plumbing services near me", perMonth: "40,500" },
            { search: "water heater installation near me", perMonth: "22,200" },
            { search: "plumbing repair near me", perMonth: "14,800" },
            { search: "plumber for gas leak", perMonth: "9,900" },
        ],
    },
    roofing: {
        source: "Marketkeep, SEO Keywords for Roofing Companies, updated 31 Aug 2026",
        url: "https://marketkeep.com/seo-keywords-for-roofers/",
        searches: [
            { search: "roof company near me", perMonth: "165,000" },
            { search: "roof repair near me", perMonth: "90,500" },
            { search: "roof inspection", perMonth: "40,500" },
            { search: "roof leak repair", perMonth: "33,100" },
            { search: "roof replacement", perMonth: "33,100" },
            { search: "roof replacement cost", perMonth: "18,100" },
            { search: "new roof cost", perMonth: "9,900" },
        ],
    },
    "lawn-care": {
        source: "Marketkeep, SEO Keywords for Landscapers, updated 28 Aug 2026",
        url: "https://marketkeep.com/seo-keywords-for-landscapers/",
        searches: [
            { search: "lawn mowing", perMonth: "301,000" },
            { search: "lawn care services", perMonth: "110,000" },
            { search: "lawn care", perMonth: "90,500" },
            { search: "lawn mowing service", perMonth: "27,100" },
            { search: "lawn care companies", perMonth: "12,100" },
            { search: "grass cutting service", perMonth: "8,100" },
            { search: "lawn maintenance", perMonth: "6,600" },
        ],
    },
    "pressure-washing": {
        /* The page carries two tables with different counts for some terms and no date. These are
           the first table's; settle which is current before a pressure washing page prints one. */
        source: "Marketkeep, 50 SEO Keywords for Pressure Washing Companies (first table)",
        url: "https://marketkeep.com/seo-keywords-for-pressure-washing/",
        searches: [
            { search: "power washing near me", perMonth: "165,000" },
            { search: "pressure washing services near me", perMonth: "165,000" },
            { search: "pressure washing companies near me", perMonth: "18,100" },
            { search: "house pressure washing near me", perMonth: "8,100" },
            { search: "soft wash roof cleaning", perMonth: "2,900" },
            { search: "driveway cleaning service", perMonth: "1,600" },
            { search: "cost of pressure washing driveway", perMonth: "1,600" },
        ],
    },
    "car-detailing": {
        source: "Ranktracker, Car Detailing SEO (keyword named, no figure)",
        url: "https://www.ranktracker.com/blog/car-detailing-seo/",
        searches: [{ search: "car detailing near me", perMonth: null }],
    },
};
