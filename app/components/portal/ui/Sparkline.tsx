"use client";

import { useId } from "react";

/**
 * A 30-ish point trend, sized to sit behind a headline number.
 *
 * Hand-rolled SVG rather than recharts: at this size there are no axes, ticks, tooltips or
 * legend to theme, and a `<ResponsiveContainer>` per stat tile would mount a resize
 * observer for a shape that is decoration-adjacent. `preserveAspectRatio="none"` lets one
 * viewBox stretch to any tile width without recomputing points.
 */
export function Sparkline({
    data,
    color = "var(--accent)",
    height = 44,
    className = "",
}: {
    data: number[];
    color?: string;
    height?: number;
    className?: string;
}) {
    const gradientId = useId();

    // Two points is the minimum that describes a direction; below that there is no trend
    // to draw and a flat line would imply one.
    if (!data || data.length < 2) return null;

    const W = 100;
    const H = 32;
    const max = Math.max(...data);
    const min = Math.min(...data);
    // A flat series must not divide by zero, and must render mid-height rather than
    // pinned to the floor — "no change" is not "zero".
    const span = max - min || 1;
    const flat = max === min;

    const points = data.map((v, i) => {
        const x = (i / (data.length - 1)) * W;
        const y = flat ? H / 2 : H - ((v - min) / span) * H;
        return [x, y] as const;
    });

    const line = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
    const area = `${line} L${W},${H} L0,${H} Z`;

    return (
        <svg
            aria-hidden="true"
            className={`portal-sparkline ${className}`}
            width="100%"
            height={height}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            style={{ display: "block", overflow: "visible" }}
        >
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                    <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
            </defs>
            <path d={area} fill={`url(#${gradientId})`} />
            <path
                className="portal-sparkline-stroke"
                d={line}
                // Normalises the stroke-dash maths in globals.css to 1 for every series,
                // whatever the path's real length works out to be.
                pathLength={1}
                fill="none"
                stroke={color}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}
