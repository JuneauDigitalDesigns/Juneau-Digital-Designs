/**
 * The missed-calls sum, as /hvac's calculator runs it.
 *
 * The homepage calculator (`MissedCallsCalculator` in homepageclient.tsx) keeps its own copy of
 * these three rates inside the component. They are repeated here rather than moved, so this
 * change does not touch that calculator; `test/hvac-page.test.mjs` fails if the two copies ever
 * disagree.
 */

/** Invoca, Home Services Call Conversion Benchmarks 2025 (60M+ calls): share of calls that are new-business leads. */
export const LEAD_RATE = 0.37;
/** Invoca, same report: share of those leads that convert on the call. */
export const CLOSE_RATE = 0.46;
/** Our own estimate, and printed as one: the share a receptionist wins back. Not published research. */
export const AI_RECOVERY_RATE = 0.5;

/** A year of missed calls, in dollars: calls a week × 52 × lead rate × close rate × average job. */
export function lostPerYear(missedPerWeek: number, averageJob: number): number {
    return missedPerWeek * 52 * LEAD_RATE * CLOSE_RATE * averageJob;
}

/** "$70.8K", "$1.23M", "$640": the homepage calculator's own format. */
export function formatDollars(n: number): string {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`;
    return `$${Math.round(n).toLocaleString("en-US")}`;
}
