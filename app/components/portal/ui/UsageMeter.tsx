"use client";

import { Card, CardLabel } from "./Card";
import { shortDate } from "./format";
import type { UsageSummary } from "@/app/lib/portal-usage";

/**
 * Call-minutes used against the plan allowance, with the bar filled to match.
 *
 * The portal had no progress primitive, so this builds the minimum one: a tinted track with
 * a filled child. The fill is clamped at 100% while the *number* is not — going over is the
 * one state the client most needs to read accurately, and a bar that silently stops at full
 * would hide it.
 *
 * Renders nothing unless the summary is `ready`. Starter has no allowance to show, and a
 * pending or failed read has no number this component could stand behind.
 */
export function UsageMeter({ usage }: { usage: UsageSummary }) {
    if (usage.state !== "ready" || usage.minutesUsed === null || usage.minutesCap === null) {
        return null;
    }

    const { minutesUsed, minutesCap, overageMinutes, overageCost, periodEnd } = usage;
    const pct = usage.pct ?? 0;
    const over = overageMinutes > 0;

    const tone = over ? "var(--chart-neg)" : pct >= 80 ? "var(--chart-warn)" : "var(--accent)";
    const remaining = Math.max(0, minutesCap - minutesUsed);

    return (
        <Card className="space-y-3">
            <div className="flex items-center justify-between gap-4">
                <CardLabel>Call minutes this period</CardLabel>
                <span
                    className="text-xs"
                    style={{ color: tone, fontFamily: "var(--font-mono)" }}
                >
                    {Math.round(pct)}%
                </span>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
                <span
                    className="portal-numeral"
                    style={{ fontSize: "clamp(30px, 3.2vw, 40px)", fontWeight: 700, color: tone }}
                >
                    {minutesUsed.toLocaleString()}
                </span>
                <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                    of {minutesCap.toLocaleString()} included
                </span>
            </div>

            <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)` }}
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Call minutes used"
            >
                <div
                    className="h-full rounded-full"
                    style={{
                        width: `${Math.min(100, pct)}%`,
                        background: tone,
                        transition: "width 600ms cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                />
            </div>

            <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                {over ? (
                    <>
                        <span style={{ color: tone, fontWeight: 500 }}>
                            {overageMinutes.toLocaleString()} min over
                        </span>
                        {" · about "}
                        <span style={{ color: "var(--fg-2)" }}>${overageCost.toFixed(2)}</span>
                        {" in overage on your next invoice"}
                    </>
                ) : (
                    <>{remaining.toLocaleString()} minutes remaining</>
                )}
                {periodEnd ? ` · resets ${shortDate(periodEnd)}` : ""}
            </p>
        </Card>
    );
}
