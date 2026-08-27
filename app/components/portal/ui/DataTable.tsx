import type { ReactNode } from "react";

/**
 * One tabular dataset, rendered as a table on a desktop and as cards on a phone.
 *
 * This existed twice before, in different states of repair. `CallsSection` hand-wrote a
 * `hidden md:block` table *and* a `md:hidden` card list over the same rows, so every column
 * change meant editing two blocks and hoping they stayed in step. `BillingSection` never got
 * the second half at all and shipped `overflow-x-auto`, which left a client dragging a
 * five-column table sideways to reach a PDF link.
 *
 * The swap is CSS (`hidden md:block` / `md:hidden`), not a viewport hook, so both variants
 * are server rendered and neither pops in after hydration. That is why this is a server
 * component and why `useIsMobile` is deliberately not used here.
 *
 * ## Deriving the card
 *
 * A card is not a table row turned sideways — stacking six labelled cells produces a wall of
 * text nobody reads. So each column declares the role it plays on a phone, and the card
 * layout falls out of that rather than being written a second time:
 *
 * ```
 *   ┌─────────────────────────────────┐
 *   │ primary            badge        │   title, plus a chip on the right
 *   │ secondary                       │   one supporting line
 *   │ meta · meta                     │   small mono facts
 *   └─────────────────────────────────┘
 * ```
 *
 * Columns with no role are table-only. That is a feature: `Type` earns a column on a wide
 * screen and earns nothing on a 375px card, and saying so is one flag rather than a second
 * layout.
 */
export interface Column<T> {
    /** Stable key. Also the React key for the header and cell. */
    key: string;
    header: string;
    cell: (row: T) => ReactNode;
    /** Card title. Exactly one column should claim this. */
    primary?: boolean;
    /** Card subtitle, directly under the title. */
    secondary?: boolean;
    /** Card footer. Several columns may claim this; they render in column order. */
    meta?: boolean;
    /** Card top-right chip, opposite the title. */
    badge?: boolean;
    /** Extra classes for the `<td>`, e.g. `whitespace-nowrap` or a mono treatment. */
    cellClassName?: string;
}

export function DataTable<T>({
    columns,
    rows,
    rowKey,
    onRowClick,
    empty,
    caption,
}: {
    columns: Column<T>[];
    rows: T[];
    rowKey: (row: T) => string;
    /** When set, rows become interactive in both variants. */
    onRowClick?: (row: T) => void;
    /** Shown in place of both variants when there is nothing to list. */
    empty?: ReactNode;
    /** Screen-reader description of the table. Rendered visually hidden. */
    caption?: string;
}) {
    if (rows.length === 0) return <>{empty}</>;

    const primary = columns.find((c) => c.primary);
    const secondary = columns.find((c) => c.secondary);
    const badge = columns.find((c) => c.badge);
    const meta = columns.filter((c) => c.meta);

    return (
        <>
            {/* ── Desktop: a real table ─────────────────────────────────────────── */}
            <div
                className="hidden md:block portal-elev overflow-hidden"
                style={{ borderRadius: 8 }}
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        {caption && <caption className="sr-only">{caption}</caption>}
                        <thead>
                            <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                                {columns.map((c) => (
                                    <th
                                        key={c.key}
                                        scope="col"
                                        className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium whitespace-nowrap"
                                        style={{
                                            color: "var(--fg-3)",
                                            fontFamily: "var(--font-mono)",
                                        }}
                                    >
                                        {c.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr
                                    key={rowKey(row)}
                                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                                    className={onRowClick ? "portal-row cursor-pointer" : undefined}
                                    style={{ borderBottom: "1px solid var(--rule)" }}
                                >
                                    {columns.map((c) => (
                                        <td
                                            key={c.key}
                                            className={`px-4 py-3 ${c.cellClassName ?? ""}`}
                                            style={{ color: "var(--fg-2)" }}
                                        >
                                            {c.cell(row)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* ── Mobile: cards ─────────────────────────────────────────────────── */}
            <div className="md:hidden space-y-3">
                {rows.map((row) => {
                    const body = (
                        <>
                            <div className="flex items-start justify-between gap-3">
                                {primary && (
                                    <span className="font-medium min-w-0" style={{ color: "var(--fg)" }}>
                                        {primary.cell(row)}
                                    </span>
                                )}
                                {badge && <span className="shrink-0">{badge.cell(row)}</span>}
                            </div>

                            {secondary && (
                                <div
                                    className="mt-1 text-sm"
                                    style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                                >
                                    {secondary.cell(row)}
                                </div>
                            )}

                            {meta.length > 0 && (
                                <div
                                    className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"
                                    style={{ color: "var(--fg-3)" }}
                                >
                                    {meta.map((c) => (
                                        <span key={c.key}>{c.cell(row)}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    );

                    // A button when it does something, a div when it does not. Wrapping inert
                    // rows in a button puts empty stops in the tab order and announces them as
                    // actionable to a screen reader.
                    return onRowClick ? (
                        <button
                            key={rowKey(row)}
                            type="button"
                            onClick={() => onRowClick(row)}
                            className="w-full text-left rounded-lg border p-4 cursor-pointer"
                            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                        >
                            {body}
                        </button>
                    ) : (
                        <div
                            key={rowKey(row)}
                            className="w-full rounded-lg border p-4"
                            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                        >
                            {body}
                        </div>
                    );
                })}
            </div>
        </>
    );
}
