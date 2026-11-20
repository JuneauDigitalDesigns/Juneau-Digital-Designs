/**
 * What people type into Google about plumbing, as /plumbing prints it.
 *
 * The searches and their monthly counts are NOT written here. They are read from
 * `trade-searches.ts`, which is the one place the site keeps published keyword figures, so a
 * corrected count or a new source reaches this page without anyone remembering to copy it across.
 * Before 19 Nov 2026 this file held its own copy of four of those rows; the figures agreed, but
 * two lists of the same sourced facts can drift apart silently, which is the whole reason this
 * file no longer holds any.
 *
 * What stays here is presentation, not fact: which four of the eight plumbing searches the page
 * shows, in what order, and where each one breaks so the box can draw the rest of the phrase as
 * the bolded completion a search box suggests. The fourth is not a completion of what's typed
 * ("plumb"), which is why it breaks somewhere else.
 *
 * The four, their order and the printed source line were approved by Xander with the page
 * (19 Nov 2026), so none of them changes without him. The homepage shows a different set from the
 * same study, and without counts, so the two pages don't print the same list.
 */
import { TRADE_SEARCHES } from "./trade-searches";

export type PlumbingSearch = { typed: string; rest: string; perMonth: string };

/** Each approved search, with the point it breaks at. Order is the order the box suggests them. */
const SHOWN: ReadonlyArray<readonly [search: string, typed: string]> = [
    ["plumbers near me", "plumb"],
    ["plumbing companies near me", "plumb"],
    ["plumbing services near me", "plumb"],
    ["water heater installation near me", "water heater install"],
];

const COUNTS = new Map(TRADE_SEARCHES.plumbing.searches.map((s) => [s.search, s.perMonth]));

export const PLUMBING_SEARCHES: PlumbingSearch[] = SHOWN.map(([search, typed]) => {
    // A phrase or figure that has gone from the shared list stops the build instead of quietly
    // printing nothing, or printing a number this page no longer has a source for.
    if (!COUNTS.has(search)) {
        throw new Error(
            `plumbing-searches: "${search}" is no longer in TRADE_SEARCHES.plumbing. ` +
                `Pick a search the source still lists, and have Xander approve it before it ships.`,
        );
    }
    const perMonth = COUNTS.get(search);
    if (!perMonth) {
        throw new Error(`plumbing-searches: the source gives no monthly figure for "${search}".`);
    }
    if (!search.startsWith(typed)) {
        throw new Error(`plumbing-searches: "${search}" does not start with "${typed}", so it cannot break there.`);
    }
    return { typed, rest: search.slice(typed.length), perMonth };
});

/**
 * The line printed under the box. Approved wording, so it is written out rather than built from
 * the source's own fields; `TRADE_SEARCHES.plumbing` carries the full citation and the URL.
 */
export const PLUMBING_SEARCH_SOURCE = "Searches a month: Marketkeep, SEO keywords for plumbers, September 2026";
