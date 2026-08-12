"use client";

import { Card, CardLabel } from "./Card";
import { shortDate } from "./format";
import { usageLevel, usageNotice, usageToneVar } from "./usage";
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

    const { minutesUsed, minutesCap, periodEnd } = usage;
    const pct = usage.pct ?? 0;

    // Thresholds and wording come from ./usage so this and the Overview tile cannot disagree
    // about what counts as "over".
    const level = usageLevel(pct);
    const tone = usageToneVar(level);
    const notice = usageNotice(usage);
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

            {/* Used, remaining and percent are always all three present. Remaining used to be
                replaced by the overage line once over, which removed a number the client had
                been reading all month at the exact moment it went to zero. */}
            <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                {remaining.toLocaleString()} minutes remaining
                {periodEnd ? ` · resets ${shortDate(periodEnd)}` : ""}
            </p>

            {/* Tinted rather than muted body text: at these thresholds the line is an alert,
                and --fg-3 reads as a footnote. Same tinting as the track above. */}
            {notice && (
                <p
                    className="text-xs rounded-md px-2.5 py-2"
                    style={{
                        color: tone,
                        background: `color-mix(in srgb, ${tone} 12%, transparent)`,
                        lineHeight: 1.5,
                    }}
                >
                    {notice}
                </p>
            )}
        </Card>
    );
}
