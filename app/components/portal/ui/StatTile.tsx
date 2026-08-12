"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { Card, CardLabel } from "./Card";
import { Sparkline } from "./Sparkline";
import { useCountUp } from "./Motion";

/**
 * A headline number.
 *
 * `value` is deliberately `ReactNode | null` rather than `number`: a null renders an
 * em-dash, because the portal must never print a `0` it cannot stand behind. A zero and a
 * missing measurement look identical to a client and mean opposite things.
 *
 * Pass `count` alongside a formatted `value` when the metric is numeric and should animate —
 * the tile renders `count` while animating and hands off to `value` at rest, so a duration
 * still reads "3m 12s" at the end rather than "192".
 *
 * `href` turns the whole tile into a link to the tab that explains it, with the same
 * interactive surface and trailing arrow the plan card on the Overview already uses. Optional,
 * so the dozen existing call sites are unaffected — a tile only becomes clickable when there
 * is somewhere worth going.
 */
export function StatTile({
    label,
    value,
    count,
    unit,
    delta,
    hint,
    tone = "default",
    series,
    href,
}: {
    label: string;
    value: ReactNode | null;
    /** Numeric target for the count-up. Omit for non-numeric metrics. */
    count?: number | null;
    unit?: string;
    /** Percent change vs the previous period. Omit when there's no comparable window. */
    delta?: number | null;
    hint?: string;
    tone?: "default" | "positive" | "negative" | "warn";
    /** Trend behind the number. Needs at least two points to mean anything. */
    series?: number[];
    /** Where this metric is explained in full. Makes the tile a link. */
    href?: string;
}) {
    const toneColor = {
        default: "var(--fg)",
        positive: "var(--chart-pos)",
        negative: "var(--chart-neg)",
        warn: "var(--chart-warn)",
    }[tone];

    const animated = useCountUp(count ?? null);
    const settled = count === undefined || animated === null || animated === count;
    const shown = settled ? (value ?? "—") : animated;

    const sparkColor = tone === "default" ? "var(--accent)" : toneColor;

    const body = (
        <>
            <div className="flex items-center justify-between gap-3">
                <CardLabel>{label}</CardLabel>
                {href && (
                    <ArrowRight
                        size={14}
                        weight="bold"
                        style={{ color: "var(--fg-3)" }}
                        className="shrink-0"
                    />
                )}
            </div>

            <div className="flex items-baseline gap-2 flex-wrap relative z-10">
                <span
                    className="portal-numeral"
                    style={{
                        color: value === null ? "var(--fg-3)" : toneColor,
                        fontSize: "clamp(34px, 3.6vw, 46px)",
                        fontWeight: 700,
                    }}
                >
                    {shown}
                </span>
                {unit && value !== null && (
                    <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                        {unit}
                    </span>
                )}
                {typeof delta === "number" && <Delta value={delta} />}
            </div>

            {hint && (
                <span className="text-xs relative z-10" style={{ color: "var(--fg-3)" }}>
                    {hint}
                </span>
            )}

            {/* Bleeds off the tile's lower edge — the trend is context for the number, not a
                chart in its own right, so it sits behind the type rather than beside it. */}
            {series && series.length > 1 && (
                <div className="absolute inset-x-0 bottom-0 pointer-events-none" aria-hidden="true">
                    <Sparkline data={series} color={sparkColor} height={46} />
                </div>
            )}
        </>
    );

    return (
        <Card
            className="relative flex flex-col gap-1.5 overflow-hidden"
            interactive={Boolean(href)}
        >
            {href ? (
                // The link wraps the contents rather than the Card, so the hover surface stays
                // on the Card itself — same arrangement as the plan tile on the Overview.
                <Link href={href} className="flex flex-col gap-1.5">
                    {body}
                </Link>
            ) : (
                body
            )}
        </Card>
    );
}

function Delta({ value }: { value: number }) {
    const flat = Math.round(value) === 0;
    const up = value > 0;
    const color = flat ? "var(--fg-3)" : up ? "var(--chart-pos)" : "var(--chart-neg)";

    return (
        <span
            className="text-xs font-medium px-1.5 py-0.5 rounded-full"
            style={{
                color,
                background: `color-mix(in srgb, ${color} 14%, transparent)`,
                fontFamily: "var(--font-mono)",
            }}
        >
            {flat ? "±0%" : `${up ? "↑" : "↓"}${Math.abs(Math.round(value))}%`}
        </span>
    );
}
