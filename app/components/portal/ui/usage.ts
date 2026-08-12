import type { UsageSummary } from "@/app/lib/portal-usage";

/**
 * Thresholds, colour and wording for call-minute usage, in one place.
 *
 * `portal-usage.ts` is `server-only`, so runtime helpers cannot live beside the type (the type
 * itself is imported client-side via `import type`, which erases at build). This module is the
 * client-safe half.
 *
 * It exists because the Overview tile and the Call Log meter each carried their own copy of
 * the thresholds, and the copies had already diverged from the intended behaviour: both keyed
 * "red" off `overageMinutes > 0`, which is `used > cap`. A client sitting at exactly their cap
 * has zero overage, so they fell through to the 80% branch and saw yellow while being, in
 * fact, out of minutes. `usageLevel` is now the only definition.
 *
 * That mirrors the rule `portal-usage.ts` already states for the numbers themselves: there is
 * exactly one definition of "how many minutes did they use", because a client shown one figure
 * and invoiced another is a refund and a lost account. The colour and the sentence that quote
 * that figure deserve the same treatment.
 */

export const WARN_AT = 80;
export const OVER_AT = 100;

export type UsageLevel = "normal" | "warn" | "over";

export function usageLevel(pct: number | null | undefined): UsageLevel {
    if (typeof pct !== "number") return "normal";
    if (pct >= OVER_AT) return "over";
    if (pct >= WARN_AT) return "warn";
    return "normal";
}

/** CSS custom property for charts and numerals. */
export function usageToneVar(level: UsageLevel): string {
    if (level === "over") return "var(--chart-neg)";
    if (level === "warn") return "var(--chart-warn)";
    return "var(--accent)";
}

/** The same tone in `StatTile`'s prop vocabulary. */
export function usageStatTone(level: UsageLevel): "default" | "warn" | "negative" {
    if (level === "over") return "negative";
    if (level === "warn") return "warn";
    return "default";
}

/** `$0.20`, or null when the plan has no rate on record. */
function formatRate(rate: number | null | undefined): string | null {
    return typeof rate === "number" ? `$${rate.toFixed(2)}` : null;
}

/**
 * The sentence shown on the Call Log meter. Null below the warn threshold, where there is
 * nothing to say that the numbers do not already say.
 *
 * The two `over` cases are genuinely different messages. Past the cap, the client wants the
 * damage so far. Exactly at the cap, nothing has been charged yet and the useful information
 * is what the *next* call costs, which is the one moment quoting the rate actually changes a
 * decision.
 */
export function usageNotice(usage: UsageSummary): string | null {
    const level = usageLevel(usage.pct);
    if (level === "normal") return null;

    if (level === "warn") return "You're approaching your monthly allowance.";

    if (usage.overageMinutes > 0) {
        const cost = usage.overageCost.toFixed(2);
        return `${usage.overageMinutes.toLocaleString()} min over, about $${cost} in overage on your next invoice.`;
    }

    const cap = usage.minutesCap?.toLocaleString() ?? "your";
    const rate = formatRate(usage.overageRate);
    // Without a rate on record, say the true part and stop rather than quote a placeholder.
    return rate
        ? `You've used all ${cap} included minutes. Any further calls are billed at ${rate} per minute and added to your next invoice.`
        : `You've used all ${cap} included minutes. Any further calls are added to your next invoice.`;
}

/**
 * The short form for the Overview tile, which has one line of hint and is a glance rather
 * than an explanation. The full sentence lives one click away on the Call Log.
 */
export function usageHint(usage: UsageSummary): string | undefined {
    const level = usageLevel(usage.pct);
    if (level === "warn") return "approaching your allowance";
    if (level === "over") {
        const rate = formatRate(usage.overageRate);
        return rate ? `overage billed at ${rate}/min` : "over your allowance";
    }
    return undefined;
}
