import type { ReactNode } from "react";

/**
 * The placeholder shown to a client whose site isn't built yet.
 *
 * This is the only place in the portal that renders invented content, so the labelling has
 * to carry real weight. The rules, in priority order:
 *
 *  1. **No numerals, ever.** Every figure is an em-dash and every bar is a fixed neutral
 *     height. A plausible-looking number here would be indistinguishable from a real one
 *     in a screenshot, and a client showing their bookkeeper "42 calls this month" from a
 *     site that does not exist yet is a much worse failure than an empty screen.
 *  2. **A banner, not a chip.** Full width, accent-2, stated in plain language.
 *  3. **Visually unlike every real card** — dashed border and a diagonal hatch, which no
 *     other surface in the product uses.
 *  4. **Inert and hidden from assistive tech.** The ghost is decorative; screen readers get
 *     the `description` text instead of a tree of meaningless bars.
 */
export function GhostPreview({
    description,
    children,
}: {
    /** What the client will actually see here once the site is live. Read by screen readers. */
    description: string;
    children: ReactNode;
}) {
    return (
        <div className="space-y-3">
            <div
                className="flex items-start gap-2 rounded-md px-3 py-2.5 text-sm"
                style={{
                    background: "color-mix(in srgb, var(--accent-2) 14%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--accent-2) 40%, transparent)",
                    color: "var(--fg)",
                }}
            >
                <span aria-hidden="true" style={{ color: "var(--accent-2)" }}>
                    ▲
                </span>
                <span>
                    <strong style={{ color: "var(--accent-2)" }}>Example only.</strong>{" "}
                    This is a preview of what this page will look like once your site is live.{" "}
                    <strong>None of it is your data.</strong>
                </span>
            </div>

            <p className="sr-only">{description}</p>

            <div className="portal-ghost p-4" aria-hidden="true">
                {children}
            </div>
        </div>
    );
}

/** A dashed em-dash tile — the ghost stand-in for a StatTile. */
export function GhostStat({ label }: { label: string }) {
    return (
        <div
            className="rounded-lg border p-4 flex flex-col gap-2"
            style={{ borderColor: "var(--rule)" }}
        >
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            <span
                className="text-3xl font-bold leading-none"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-display)" }}
            >
                —
            </span>
        </div>
    );
}

/**
 * A bar chart shape with no data behind it.
 *
 * Heights come from a fixed pattern, not a random or plausible series, so the silhouette
 * reads as "a chart goes here" rather than as a trend worth interpreting.
 */
const GHOST_BARS = [38, 62, 45, 70, 52, 80, 48, 66, 41, 58, 73, 50];

export function GhostChart({ label, height = 160 }: { label: string; height?: number }) {
    return (
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--rule)" }}>
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            <div className="flex items-end gap-1.5 mt-4" style={{ height }}>
                {GHOST_BARS.map((h, i) => (
                    <div
                        key={i}
                        className="flex-1 rounded-t"
                        style={{ height: `${h}%`, background: "var(--chart-track)" }}
                    />
                ))}
            </div>
        </div>
    );
}

/** A table shape with em-dashes where the values would be. */
export function GhostTable({
    columns,
    rows = 5,
}: {
    columns: string[];
    rows?: number;
}) {
    return (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
            <table className="w-full text-sm">
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                        {columns.map((c) => (
                            <th
                                key={c}
                                className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium"
                                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                            >
                                {c}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {Array.from({ length: rows }, (_, r) => (
                        <tr key={r} style={{ borderBottom: "1px solid var(--rule)" }}>
                            {columns.map((c) => (
                                <td key={c} className="px-4 py-3" style={{ color: "var(--fg-3)" }}>
                                    —
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
