/**
 * Shared recharts styling for the portal.
 *
 * Every value is a CSS custom property rather than a hex. Recharts writes tick/fill props
 * to SVG presentation attributes and tooltip props to inline styles, and `var()` resolves
 * natively in both — so charts follow the theme with no `useTheme()`, no re-render on
 * toggle, and no flash of the wrong palette on first paint.
 *
 * The values these replaced (`#0d1b2e` tooltips, `rgba(244,246,251,0.48)` ticks) were
 * picked for a dark navy dashboard. Against the cream default theme the axis labels were
 * near-white on near-white — technically rendered, effectively invisible.
 */

/** Axis tick label styling. */
export const axisTick = { fontSize: 10, fill: "var(--chart-axis)" } as const;

/** Axis props shared by every chart: no line, no tick marks, just labels. */
export const axisProps = {
    tick: axisTick,
    tickLine: false,
    axisLine: false,
} as const;

/** Tooltip surface. */
export const tooltipProps = {
    contentStyle: {
        background: "var(--chart-tooltip-bg)",
        border: "1px solid var(--chart-tooltip-border)",
        borderRadius: 6,
        fontSize: 12,
        color: "var(--fg)",
    },
    labelStyle: { color: "var(--fg-3)" },
    itemStyle: { color: "var(--fg)" },
    cursor: { fill: "var(--chart-track)" },
} as const;

/** Ordered categorical series colours. */
export const SERIES = [
    "var(--chart-series-1)",
    "var(--chart-series-2)",
    "var(--chart-series-3)",
    "var(--chart-series-4)",
] as const;

export function seriesColor(index: number): string {
    return SERIES[index % SERIES.length];
}

/**
 * Semantic colour for a call outcome.
 *
 * Falls back to a neutral rather than inventing a colour, so an unrecognised outcome from
 * a client base that doesn't follow the canonical single-select reads as "uncategorised"
 * instead of silently borrowing another outcome's meaning.
 */
const OUTCOME_TONE: Record<string, string> = {
    qualified: "var(--chart-pos)",
    "not qualified": "var(--chart-neg)",
    "follow-up needed": "var(--chart-warn)",
    "no answer": "var(--chart-neutral)",
    voicemail: "var(--chart-series-4)",
};

export function outcomeColor(outcome: string | null | undefined): string {
    if (!outcome) return "var(--chart-neutral)";
    return OUTCOME_TONE[outcome.trim().toLowerCase()] ?? "var(--chart-neutral)";
}

/** Legend text styling, applied via the `formatter` render prop. */
export const legendStyle = { color: "var(--fg-2)", fontSize: 11 } as const;
