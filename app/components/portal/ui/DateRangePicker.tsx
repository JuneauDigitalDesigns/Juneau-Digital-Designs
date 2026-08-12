"use client";

import { useMemo, useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

/**
 * Start/end range picker: two typed inputs plus a month grid.
 *
 * Hand-rolled rather than adding a dependency. No date library is installed, this is the only
 * picker in the product, and the codebase already builds its own Sparkline, Drawer and
 * progress bar. Native `Date` only.
 *
 * Dates are handled as `YYYY-MM-DD` **local** day strings throughout, never `Date` objects in
 * state. A client picking "the 3rd" means the 3rd where they are; round-tripping through UTC
 * instants is how pickers end up one day off.
 *
 * Click behaviour, as specified: first click sets the start, second sets the end, and clicks
 * then loop back to start, end, start. A second click landing before the start swaps the pair
 * rather than rejecting it, since dragging backwards through a month is a normal way to pick.
 */

export interface DayRange {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** `YYYY-MM-DD` for a local calendar day, avoiding toISOString's UTC shift. */
export function toDayString(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

/** Local midnight at the start of a `YYYY-MM-DD` day. */
export function dayStartMs(day: string): number {
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0, 0).getTime();
}

/** Local midnight at the *end* of a day, i.e. the start of the next one. */
export function dayEndMs(day: string): number {
    return dayStartMs(day) + 86_400_000;
}

function isValidDay(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const ms = dayStartMs(s);
    return !Number.isNaN(ms) && toDayString(new Date(ms)) === s;
}

export default function DateRangePicker({
    value,
    onChange,
    maxDay,
}: {
    value: DayRange;
    onChange: (next: DayRange) => void;
    /** Latest selectable day, normally today. Future days have no calls in them. */
    maxDay: string;
}) {
    // Which end the next click sets. Resets to "start" after an end is chosen, giving the
    // start / end / start / end loop.
    const [next, setNext] = useState<"start" | "end">("start");
    const [cursor, setCursor] = useState(() => {
        const base = isValidDay(value.from) ? dayStartMs(value.from) : Date.now();
        const d = new Date(base);
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    const maxMs = dayStartMs(maxDay);

    const grid = useMemo(() => {
        const first = new Date(cursor.year, cursor.month, 1);
        const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
        const lead = first.getDay();
        const cells: (string | null)[] = Array(lead).fill(null);
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push(toDayString(new Date(cursor.year, cursor.month, d)));
        }
        return cells;
    }, [cursor]);

    function pick(day: string) {
        if (next === "start") {
            // Starting a fresh range: collapse to a single day until the end is chosen, so the
            // highlight never shows a stale range from the previous selection.
            onChange({ from: day, to: day });
            setNext("end");
            return;
        }
        // Second click. Swap when it lands before the start.
        const from = dayStartMs(day) < dayStartMs(value.from) ? day : value.from;
        const to = dayStartMs(day) < dayStartMs(value.from) ? value.from : day;
        onChange({ from, to });
        setNext("start");
    }

    function shiftMonth(delta: number) {
        setCursor((c) => {
            const d = new Date(c.year, c.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });
    }

    const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
    });

    return (
        <div className="space-y-3">
            <div className="flex items-end gap-2 flex-wrap">
                <DayInput
                    label="From"
                    value={value.from}
                    max={maxDay}
                    onCommit={(v) => onChange({ from: v, to: dayStartMs(v) > dayStartMs(value.to) ? v : value.to })}
                />
                <DayInput
                    label="To"
                    value={value.to}
                    max={maxDay}
                    onCommit={(v) => onChange({ from: dayStartMs(v) < dayStartMs(value.from) ? v : value.from, to: v })}
                />
            </div>

            <div
                className="rounded-md border p-3"
                style={{ borderColor: "var(--rule)", background: "var(--bg)" }}
            >
                <div className="flex items-center justify-between mb-2">
                    <button
                        type="button"
                        onClick={() => shiftMonth(-1)}
                        aria-label="Previous month"
                        className="p-1 rounded cursor-pointer"
                        style={{ color: "var(--fg-2)" }}
                    >
                        <CaretLeft size={14} weight="bold" />
                    </button>
                    <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
                        {monthLabel}
                    </span>
                    <button
                        type="button"
                        onClick={() => shiftMonth(1)}
                        aria-label="Next month"
                        className="p-1 rounded cursor-pointer"
                        style={{ color: "var(--fg-2)" }}
                    >
                        <CaretRight size={14} weight="bold" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-0.5" role="grid">
                    {WEEKDAYS.map((w, i) => (
                        <span
                            key={`${w}${i}`}
                            className="text-center text-xs py-1"
                            style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                            aria-hidden="true"
                        >
                            {w}
                        </span>
                    ))}

                    {grid.map((day, i) => {
                        if (!day) return <span key={`pad${i}`} />;

                        const ms = dayStartMs(day);
                        const disabled = ms > maxMs;
                        const inRange = ms >= dayStartMs(value.from) && ms <= dayStartMs(value.to);
                        const isEdge = day === value.from || day === value.to;

                        return (
                            <button
                                key={day}
                                type="button"
                                disabled={disabled}
                                onClick={() => pick(day)}
                                aria-pressed={isEdge}
                                aria-label={day}
                                className="text-xs rounded py-1.5 cursor-pointer disabled:cursor-not-allowed"
                                style={{
                                    background: isEdge
                                        ? "var(--accent)"
                                        : inRange
                                          ? "color-mix(in srgb, var(--accent) 16%, transparent)"
                                          : "transparent",
                                    color: isEdge
                                        ? "var(--on-accent)"
                                        : disabled
                                          ? "var(--fg-3)"
                                          : "var(--fg)",
                                    opacity: disabled ? 0.4 : 1,
                                    fontFamily: "var(--font-mono)",
                                }}
                            >
                                {Number(day.slice(-2))}
                            </button>
                        );
                    })}
                </div>

                <p className="text-xs mt-2" style={{ color: "var(--fg-3)" }}>
                    {next === "start" ? "Click to set a start date" : "Click to set an end date"}
                </p>
            </div>
        </div>
    );
}

/**
 * Typed date entry. Commits only a well-formed, in-range day, so a half-typed "2026-0" never
 * reaches the filter and blanks the table mid-keystroke.
 */
function DayInput({
    label,
    value,
    max,
    onCommit,
}: {
    label: string;
    value: string;
    max: string;
    onCommit: (v: string) => void;
}) {
    const [draft, setDraft] = useState(value);

    return (
        <label className="flex flex-col gap-1">
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            <input
                type="date"
                value={draft || value}
                max={max}
                onChange={(e) => {
                    const v = e.target.value;
                    setDraft(v);
                    if (isValidDay(v) && dayStartMs(v) <= dayStartMs(max)) onCommit(v);
                }}
                className="text-sm px-2 py-1.5 rounded border outline-none"
                style={{
                    background: "var(--bg)",
                    borderColor: "var(--rule-strong)",
                    color: "var(--fg)",
                }}
            />
        </label>
    );
}
