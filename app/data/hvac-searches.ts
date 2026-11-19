/**
 * What homeowners type into Google about heating and cooling, as /hvac prints it.
 *
 * Every entry is a real search, not one we wrote. The three with a monthly count are from
 * Marketkeep's HVAC keyword research (https://marketkeep.com/seo-keywords-for-hvac-contractors/,
 * last updated 7 Aug 2026), which publishes each search's monthly volume; the counts are theirs,
 * copied as printed. The two questions carry no count because no source we trust publishes one:
 * they are real searches that HVAC makers and home-service sites title whole pages after (Carrier
 * and Bryant for the first, Angi and Carrier for the second).
 *
 * Approved by Xander, word for word, with the page (19 Nov 2026). On a phone the page shows the
 * first three only.
 */
export const MARKETKEEP_SOURCE = "Searches a month: Marketkeep, HVAC keyword research, August 2026";

export const HVAC_SEARCHES: { search: string; perMonth: string | null }[] = [
    { search: "ac repairs near me", perMonth: "246,000" },
    { search: "why is my ac not blowing cold air", perMonth: null },
    { search: "hvac companies near me", perMonth: "110,000" },
    { search: "how long do ac units last", perMonth: null },
    { search: "air conditioner service near me", perMonth: "40,500" },
];
