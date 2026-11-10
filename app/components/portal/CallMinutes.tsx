import type { UsageSummary } from "@/app/lib/portal-usage";
import { duration } from "@/app/lib/duration";
import { Card } from "./ui/Card";
import { shortDate } from "./ui/format";
import { usageLevel, usageNotice, usageToneVar } from "./ui/usage";

/**
 * Call minutes used this billing period, on Settings › Plan & billing.
 *
 * The meter the Overview carried, moved beside the plan it belongs to: how much of the
 * allowance is gone is a billing question, and the answer lands on the invoice listed below
 * it. The approved wording is shorter than the Overview card's, but the definitions are the
 * shared ones: thresholds, colour and the warning sentence all come from `ui/usage`, so this
 * and anything else quoting a usage figure cannot disagree about what counts as "over".
 *
 * The figure is exact (`4m 44s`), never rounded to whole minutes, for the reason `UsageMeter`
 * gives: the same seconds are what get billed.
 *
 * Renders nothing unless the summary is `ready`. A web-only site has no allowance, and a
 * pending or failed read has no number this could stand behind.
 */
export function CallMinutes({ usage }: { usage: UsageSummary }) {
    if (usage.state !== "ready" || usage.secondsUsed === null || usage.minutesCap === null) {
        return null;
    }

    const pct = usage.pct ?? 0;
    const tone = usageToneVar(usageLevel(pct));
    const notice = usageNotice(usage);
    const rate = typeof usage.overageRate === "number" ? `$${usage.overageRate.toFixed(2)}` : null;

    const resets = usage.periodEnd ? `Resets ${shortDate(usage.periodEnd)}.` : null;
    const extra = rate ? `Extra minutes are ${rate} each.` : null;
    const footnote = [resets, extra].filter(Boolean).join(" ");

    return (
        <Card className="space-y-2">
            <div className="flex items-baseline justify-between gap-4 text-sm">
                <span style={{ color: "var(--fg)" }}>Call minutes used</span>
                <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                    {duration(usage.secondsUsed)} of {usage.minutesCap.toLocaleString()}m
                </span>
            </div>

            {/* The fill clamps at 100% and the figure above does not: going over is the one
                state the client most needs to read accurately. */}
            <div
                className="h-2 w-full rounded-full overflow-hidden"
                style={{ background: "var(--chart-track)" }}
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Call minutes used"
            >
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: tone }} />
            </div>

            {footnote && (
                <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                    {footnote}
                </p>
            )}

            {/* Tinted rather than muted: at these thresholds the line is an alert. Same
                treatment, and the same sentence, as the Overview meter. */}
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
