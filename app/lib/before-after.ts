// Which trades' sites show a job's before photo beside it (@jdd/schema v1.41.0; Xander, 2026-11-18).
// Only pressure washing's Before and After section draws the pair today, so only that trade is
// offered a before photo: on any other trade it would be collected and never shown. The console's
// intake keeps the same list (jdd-ops console/src/lib/beforeAfter.ts).
export const BEFORE_AFTER_TRADES: ReadonlySet<string> = new Set(["pressure-washing"]);

export function showsBeforeAfter(trade: string | null | undefined): boolean {
    return !!trade && BEFORE_AFTER_TRADES.has(trade);
}
