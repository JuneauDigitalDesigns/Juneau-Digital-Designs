/**
 * What people type into Google about plumbing, as /plumbing prints it.
 *
 * Every entry is a real search with a published monthly figure, from Marketkeep's "SEO Keywords
 * for Plumbers" (https://marketkeep.com/seo-keywords-for-plumbers/, updated 28 Sep 2026), whose
 * counts come from Google Keyword Planner. The counts are theirs, copied as printed; nothing here
 * is estimated or invented.
 *
 * `typed` is the part already in the search box ("plumb"), so the page can draw the rest as the
 * bolded completion the way a search box suggests it. The last entry is not a completion of that
 * prefix, which is why its own `typed` is longer.
 *
 * Approved by Xander with the page (19 Nov 2026). The homepage shows a different set from the same
 * study, so the two pages don't print the same list.
 */
export const PLUMBING_SEARCH_SOURCE = "Searches a month: Marketkeep, SEO keywords for plumbers, September 2026";

export type PlumbingSearch = { typed: string; rest: string; perMonth: string };

export const PLUMBING_SEARCHES: PlumbingSearch[] = [
    { typed: "plumb", rest: "ers near me", perMonth: "823,000" },
    { typed: "plumb", rest: "ing companies near me", perMonth: "49,500" },
    { typed: "plumb", rest: "ing services near me", perMonth: "40,500" },
    { typed: "water heater install", rest: "ation near me", perMonth: "22,200" },
];
