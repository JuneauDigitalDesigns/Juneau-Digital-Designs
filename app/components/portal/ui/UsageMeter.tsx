"use client";

import { Card, CardLabel } from "./Card";
import { shortDate } from "./format";
import { duration } from "@/app/lib/duration";
import { usageLevel, usageNotice, usageToneVar } from "./usage";
import type { UsageSummary } from "@/app/lib/portal-usage";

/**
 * Call time used against the plan allowance, with the bar filled to match.
 *
 * The portal had no progress primitive, so this builds the minimum one: a tinted track with a
 * filled child. The fill is clamped at 100% while the *number* is not — going over is the one
 * state the client most needs to read accurately, and a bar that silently stops at full would
 * hide it.
 *
 * Figures are exact, not rounded to whole minutes. The same seconds are what get billed, and a
 * tile reading "5 minutes" beside an invoice for 4m 44s is a support ticket.
 *
 * `periodLabel` names the window being shown. The Call Log can point this at the previous
 * billing period, and an allowance figure with no date range attached is ambiguous in exactly
 * the way that started this whole investigation.
 *
 * Renders nothing unless the summary is `ready`. Starter has no allowance to show, and a
 * pending or failed read has no number this component could stand behind.
 */
export function UsageMeter({
    usage,
    periodLabel,
}: {
    usage: UsageSummary;
    periodLabel?: string;
}) {
    if (usage.state !== "ready" || usage.secondsUsed === null || usage.minutesCap === null) {
        return null;
    }

    const { secondsUsed, minutesCap, periodStart, periodEnd } = usage;
    const pct = usage.pct ?? 0;
    const capSeconds = minutesCap * 60;

    // Thresholds and wording come from ./usage so this and the Overview tile cannot disagree
    // about what counts as "over".
    const level = usageLevel(pct);
    const tone = usageToneVar(level);
    const notice = usageNotice(usage);
    const remaining = Math.max(0, capSeconds - secondsUsed);

    const window =
        periodLabel ??
        (periodStart && periodEnd ? `${shortDate(periodStart)} to ${shortDate(periodEnd)}` : null);

    return (
        <Card className="space-y-3">
            <div className="flex items-center justify-between gap-4">
                <CardLabel>Call minutes this period</CardLabel>
                <span className="text-xs" style={{ color: tone, fontFamily: "var(--font-mono)" }}>
                    {Math.round(pct)}%
                </span>
            </div>

            <div className="flex items-baseline gap-2 flex-wrap">
                <span
                    className="portal-numeral"
                    style={{ fontSize: "clamp(30px, 3.2vw, 40px)", fontWeight: 700, color: tone }}
                >
                    {duration(secondsUsed)}
                </span>
                <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                    of {minutesCap.toLocaleString()}m included
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
                {duration(remaining)} remaining
                {window ? ` · ${window}` : ""}
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
