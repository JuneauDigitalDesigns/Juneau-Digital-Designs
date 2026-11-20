/**
 * What people type into Google about lawn care, as /lawn-care prints it.
 *
 * The searches and their monthly counts are NOT written here. They are read from
 * `trade-searches.ts`, which is the one place the site keeps published keyword figures, so a
 * corrected count or a new source reaches this page without anyone remembering to copy it across.
 *
 * What stays here is presentation, not fact: which four of the seven lawn care searches the page
 * shows, and in what order. The bar beside each one is drawn to scale against the biggest, which
 * is why the last two are short; that scale is computed, not typed, so it cannot drift from the
 * counts.
 *
 * The four, their order and the printed source line were approved by Xander with the page
 * (19 Nov 2026). The homepage shows three OTHER lawn searches from the same study ("lawn mowing
 * service", "lawn care services", "lawn maintenance"), so the two pages don't print the same list.
 */
import { TRADE_SEARCHES } from "./trade-searches";

export interface LawnSearch {
    search: string;
    /** As the source printed it. */
    perMonth: string;
    /** Width of the bar, against the most-searched of the four. */
    share: string;
}

/** The approved four, in the order the page lists them. */
const SHOWN = ["lawn mowing", "lawn care", "lawn care companies", "grass cutting service"] as const;

const COUNTS = new Map(TRADE_SEARCHES["lawn-care"].searches.map((s) => [s.search, s.perMonth]));

/** "301,000" as 301000. The source prints its figures with thousands separators. */
function toNumber(perMonth: string): number {
    const n = Number(perMonth.replace(/,/g, ""));
    if (!Number.isFinite(n) || n <= 0) throw new Error(`lawn-searches: "${perMonth}" is not a monthly figure.`);
    return n;
}

const FIGURES = SHOWN.map((search) => {
    // A phrase or figure that has gone from the shared list stops the build instead of quietly
    // printing nothing, or printing a number this page no longer has a source for.
    const perMonth = COUNTS.get(search);
    if (perMonth === undefined) {
        throw new Error(
            `lawn-searches: "${search}" is no longer in TRADE_SEARCHES["lawn-care"]. ` +
                `Pick a search the source still lists, and have Xander approve it before it ships.`,
        );
    }
    if (!perMonth) throw new Error(`lawn-searches: the source gives no monthly figure for "${search}".`);
    return { search, perMonth, count: toNumber(perMonth) };
});

const BIGGEST = Math.max(...FIGURES.map((f) => f.count));

export const LAWN_SEARCHES: LawnSearch[] = FIGURES.map((f) => ({
    search: f.search,
    perMonth: f.perMonth,
    share: `${((f.count / BIGGEST) * 100).toFixed(2)}%`,
}));

/**
 * The line printed under the bars. Approved wording, so it is written out rather than built from
 * the source's own fields; `TRADE_SEARCHES["lawn-care"]` carries the full citation and the URL.
 */
export const LAWN_SEARCH_SOURCE = "Searches a month: Marketkeep, SEO keywords for landscapers, August 2026";
