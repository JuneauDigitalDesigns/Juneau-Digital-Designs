"use client";

import { Check, CheckCircle, Clock, Phone } from "@phosphor-icons/react";
import { duration } from "@/app/lib/duration";
import type { InboxItem } from "@/app/lib/crm-contacts";
import { Chip, Mini, StatusChip, kindLabel, recordingLength } from "./chips";
import { rowIsUnread, rowWhen, rowWhenWide, type InboxRow, type InboxSectionGroup } from "./model";
import SwipeRow from "./SwipeRow";
import { KeysBar } from "./ShortcutHelp";

/**
 * The list half: date sections, rows, and the empty states.
 *
 * Rows render twice, once per layout, and CSS picks one (`lg:` is the split view's 1024px).
 * A desktop row has a checkbox and hover actions; a phone row is a bigger, swipeable target
 * with neither. Branching in CSS rather than on `useMediaQuery` keeps the server HTML right.
 *
 * A desktop row has two shapes (Xander, 2026-11-12, "more like an email inbox"). With no record
 * open the list has the full width and each row is one line, as Gmail's are: name, status, the
 * message, the call details and the time. With a record open the list narrows and the row goes
 * back to the stacked shape the split view has always had.
 *
 * Bold and the blue dot mean unread: not yet opened. Needs you is carried by the status chip and
 * the view, as before; the two are different questions (`isNeedsYou` ignores read state).
 */

export function dialNumber(item: InboxItem): string | null {
    // The number they asked to be reached at wins; it is what the receptionist read back.
    return item.callbackPhone ?? item.phone;
}

export default function InboxList({
    sections,
    selectedRowId,
    cursorRowId,
    wide,
    checked,
    onToggleCheck,
    onOpen,
    onDone,
    onRemind,
    remindSupported,
    now,
    empty,
}: {
    sections: InboxSectionGroup[];
    selectedRowId: string | null;
    /** The keyboard marker (↑ ↓ with no record open). Shown only when it is not the open row. */
    cursorRowId: string | null;
    /** No record open: the list has the full width and rows are one line. */
    wide: boolean;
    checked: Set<string>;
    onToggleCheck: (rowId: string) => void;
    onOpen: (row: InboxRow) => void;
    onDone: (row: InboxRow) => void;
    onRemind: (row: InboxRow) => void;
    remindSupported: boolean;
    now: Date;
    empty: React.ReactNode | null;
}) {
    const anyRows = sections.length > 0;
    return (
        <div className="flex flex-col min-h-0 lg:h-full">
            <div className="flex-1 min-h-0 lg:overflow-y-auto">
                {!anyRows && empty}
                {sections.map((s) => (
                    <section key={s.key} aria-label={s.label}>
                        <h2
                            className="px-4 pt-3 pb-1.5 text-[10.5px] tracking-[0.1em] lg:border-b"
                            style={{
                                fontFamily: "var(--font-mono)",
                                color: "var(--fg-3)",
                                // --fg-3 on --bg: 5.02:1.
                                background: "var(--bg)",
                                borderColor: "var(--rule-weak)",
                            }}
                        >
                            {s.label}
                        </h2>
                        <ul className="lg:divide-y" style={{ borderColor: "var(--rule-weak)" }}>
                            {s.rows.map((row) => (
                                <li key={row.id} className="border-t lg:border-t-0" style={{ borderColor: "var(--rule-weak)" }}>
                                    <DesktopRow
                                        row={row}
                                        selected={row.id === selectedRowId}
                                        cursor={row.id === cursorRowId && row.id !== selectedRowId}
                                        wide={wide}
                                        checked={checked.has(row.id)}
                                        onToggleCheck={() => onToggleCheck(row.id)}
                                        onOpen={() => onOpen(row)}
                                        onDone={() => onDone(row)}
                                        onRemind={() => onRemind(row)}
                                        remindSupported={remindSupported}
                                        now={now}
                                    />
                                    <PhoneRow row={row} onOpen={() => onOpen(row)} onDone={() => onDone(row)} now={now} />
                                </li>
                            ))}
                        </ul>
                    </section>
                ))}
                {anyRows && (
                    <p className="lg:hidden text-center text-[11.5px] px-4 py-2.5" style={{ color: "var(--fg-3)" }}>
                        Swipe right to call · swipe left to mark done
                    </p>
                )}
            </div>
            <KeysBar />
        </div>
    );
}

function displayName(item: InboxItem): string {
    return item.name ?? item.phoneDisplay;
}

/** Kind, recording, run size and callback: the mono chips under a row, or inline when wide. */
function Minis({ row, inline = false }: { row: InboxRow; inline?: boolean }) {
    const item = row.lead;
    const rec = recordingLength(item);
    return (
        <span className={`flex gap-1.5 items-center ${inline ? "flex-nowrap" : "flex-wrap mt-0.5"}`}>
            <Mini>{kindLabel(item)}</Mini>
            {row.count > 1 && <Mini>{row.count} calls</Mini>}
            {rec && <Mini>▶ {rec}</Mini>}
            {item.callback && <Mini>☎ {duration(item.callback.durationSeconds) ?? "—"}</Mini>}
        </span>
    );
}

/** The unread dot. "Unread" is spoken; the dot alone would say nothing to a screen reader. */
function Dot({ on, className = "mt-1.5" }: { on: boolean; className?: string }) {
    return (
        <span
            className={`relative shrink-0 w-2 h-2 rounded-full ${className}`}
            style={{ background: on ? "var(--accent)" : "transparent" }}
        >
            {on && <span className="sr-only">Unread</span>}
        </span>
    );
}

/**
 * Ink for a row's text by read state. Unread lifts the message to `--fg` and the time to `--fg`
 * at 500, the way a mail client does; read sits at `--fg-2` / `--fg-3`. Every pair clears AA on
 * the white row, the hover wash and the selected tint (`--fg-3` is the floor: 5.38 / 4.62+).
 */
function ink(unread: boolean) {
    return {
        name: { color: "var(--fg)", fontWeight: unread ? 700 : 500 },
        preview: { color: unread ? "var(--fg)" : "var(--fg-2)" },
        time: {
            fontFamily: "var(--font-mono)",
            color: unread ? "var(--fg)" : "var(--fg-3)",
            fontWeight: unread ? 500 : 400,
        },
    };
}

/**
 * The selected row: an 8% accent tint, a 3px accent edge and the name in accent, stronger than
 * the old 6% so the open record's row is unmistakable. 8% is the ceiling for the accent name:
 * `--accent` on the opaque 8% mix is 4.65:1 (the chips measure the same pair); at 10% it would
 * fall to about 4.50. The keyboard marker on its own is the edge alone, in `--fg-3`.
 */
const SELECTED = {
    background: "color-mix(in srgb, var(--accent) 8%, var(--elev-1))",
    boxShadow: "inset 3px 0 0 var(--accent)",
};
const CURSOR = { boxShadow: "inset 3px 0 0 var(--fg-3)" };

function DesktopRow({
    row,
    selected,
    cursor,
    wide,
    checked,
    onToggleCheck,
    onOpen,
    onDone,
    onRemind,
    remindSupported,
    now,
}: {
    row: InboxRow;
    selected: boolean;
    cursor: boolean;
    wide: boolean;
    checked: boolean;
    onToggleCheck: () => void;
    onOpen: () => void;
    onDone: () => void;
    onRemind: () => void;
    remindSupported: boolean;
    now: Date;
}) {
    const item = row.lead;
    const name = displayName(item);
    const dial = dialNumber(item);
    const unread = rowIsUnread(row);
    const t = ink(unread);
    const nameStyle = selected ? { ...t.name, color: "var(--accent)" } : t.name;
    const hideOnHover = "group-hover:invisible group-focus-within:invisible";

    const checkbox = (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`Select ${name}`}
            onClick={onToggleCheck}
            className={`shrink-0 w-4 h-4 rounded flex items-center justify-center border-[1.5px] cursor-pointer ${wide ? "" : "mt-0.5"}`}
            style={
                checked
                    ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--on-accent)" }
                    : { background: "var(--elev-1)", borderColor: "rgba(13,17,23,0.45)" }
            }
        >
            {checked && <Check size={10} weight="bold" />}
        </button>
    );

    // Clicking the open row again closes it (the parent decides, from `rowClick`).
    const openProps = {
        type: "button" as const,
        onClick: onOpen,
        "aria-current": selected ? ("true" as const) : undefined,
        "aria-expanded": selected,
    };

    return (
        <div
            data-row-id={row.id}
            className={`group hidden lg:flex relative gap-2.5 pr-3.5 pl-2.5 transition-colors hover:bg-[var(--surface)] ${
                wide ? "items-center py-2.5" : "items-start py-[11px]"
            }`}
            style={selected ? SELECTED : cursor ? CURSOR : undefined}
        >
            {checkbox}
            <Dot on={unread} className={wide ? "" : "mt-1.5"} />
            {wide ? (
                /* One line. Fixed columns, so names, chips and messages line up down the list
                   the way a mail client's do; the call details join at xl, where there is room. */
                <button
                    {...openProps}
                    className="flex-1 min-w-0 grid items-center gap-3.5 text-left cursor-pointer text-[13.5px] lg:grid-cols-[150px_150px_minmax(0,1fr)_96px] xl:grid-cols-[190px_160px_minmax(0,1fr)_auto_112px]"
                >
                    <strong className="truncate" style={nameStyle}>
                        {name}
                    </strong>
                    <span className="min-w-0 flex">
                        <StatusChip row={row} item={item} now={now} />
                    </span>
                    <span className="truncate text-[13px]" style={t.preview}>
                        {item.preview ?? "No message"}
                    </span>
                    <span className="hidden xl:flex">
                        <Minis row={row} inline />
                    </span>
                    <span className={`text-right text-[11.5px] whitespace-nowrap ${hideOnHover}`} style={t.time}>
                        {rowWhenWide(row.at, now)}
                    </span>
                </button>
            ) : (
                <button {...openProps} className="flex-1 min-w-0 flex flex-col gap-[3px] text-left cursor-pointer">
                    <span className="flex items-center gap-2 text-[13.5px] min-w-0">
                        <strong className="truncate" style={nameStyle}>
                            {name}
                        </strong>
                        <StatusChip row={row} item={item} now={now} />
                        <span className={`ml-auto shrink-0 text-[11px] ${hideOnHover}`} style={t.time}>
                            {rowWhen(row.at, now)}
                        </span>
                    </span>
                    <span className="truncate text-[12.5px]" style={t.preview}>
                        {item.preview ?? "No message"}
                    </span>
                    <Minis row={row} />
                </button>
            )}
            {/* Hover actions sit where the time was; the row's own button still opens it. */}
            <span
                className={`absolute right-2.5 hidden group-hover:flex group-focus-within:flex gap-1 ${
                    wide ? "top-1/2 -translate-y-1/2" : "top-2"
                }`}
            >
                {dial && (
                    <RowAction label="Call back" href={`tel:${dial}`}>
                        <Phone size={14} />
                    </RowAction>
                )}
                {remindSupported && row.status !== "done" && (
                    <RowAction label="Remind me" onClick={onRemind}>
                        <Clock size={14} />
                    </RowAction>
                )}
                {row.status !== "done" && (
                    <RowAction label="Done" onClick={onDone}>
                        <CheckCircle size={14} />
                    </RowAction>
                )}
            </span>
        </div>
    );
}

function RowAction({
    label,
    onClick,
    href,
    children,
}: {
    label: string;
    onClick?: () => void;
    href?: string;
    children: React.ReactNode;
}) {
    const cls =
        "w-7 h-7 rounded-md inline-flex items-center justify-center border cursor-pointer hover:border-[var(--fg-3)]";
    const style = { background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" };
    return href ? (
        <a href={href} title={label} aria-label={label} className={cls} style={style}>
            {children}
        </a>
    ) : (
        <button type="button" onClick={onClick} title={label} aria-label={label} className={cls} style={style}>
            {children}
        </button>
    );
}

function PhoneRow({
    row,
    onOpen,
    onDone,
    now,
}: {
    row: InboxRow;
    onOpen: () => void;
    onDone: () => void;
    now: Date;
}) {
    const item = row.lead;
    const dial = dialNumber(item);
    const unread = rowIsUnread(row);
    const t = ink(unread);
    return (
        <div className="lg:hidden">
            <SwipeRow
                canCall={Boolean(dial)}
                canDone={row.status !== "done" && row.status !== "promoted"}
                onCall={() => {
                    if (dial) window.location.href = `tel:${dial}`;
                }}
                onDone={onDone}
            >
                <button
                    type="button"
                    onClick={onOpen}
                    className="w-full min-h-[72px] flex gap-2.5 px-4 py-3 text-left cursor-pointer"
                >
                    <Dot on={unread} />
                    <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                        <span className="flex items-center gap-2 min-w-0">
                            <strong className="truncate text-sm" style={t.name}>
                                {displayName(item)}
                            </strong>
                            {row.count > 1 && <Chip tone="pos">{row.count} calls</Chip>}
                            <span className="ml-auto shrink-0 text-[11px]" style={t.time}>
                                {rowWhen(row.at, now)}
                            </span>
                        </span>
                        <span>
                            <StatusChip row={row} item={item} now={now} />
                        </span>
                        <span className="text-[12.5px] leading-snug line-clamp-2" style={t.preview}>
                            {item.preview ?? "No message"}
                        </span>
                    </span>
                </button>
            </SwipeRow>
        </div>
    );
}

/** The Needs-you view with nothing in it. */
export function CaughtUp({ handled, onShowAll }: { handled: number; onShowAll: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center gap-2.5 text-center px-6 py-14 lg:h-full">
            <CheckCircle size={44} weight="light" aria-hidden="true" style={{ color: "var(--chart-pos)" }} />
            <span
                className="font-bold"
                style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", color: "var(--fg)" }}
            >
                All caught up
            </span>
            <span className="text-[13.5px]" style={{ color: "var(--fg-3)" }}>
                {handled > 0 && `${handled} ${handled === 1 ? "lead" : "leads"} handled this week. `}
                New ones will show up here.
            </span>
            <button
                type="button"
                onClick={onShowAll}
                className="mt-1 h-11 lg:h-[38px] px-3.5 rounded-[7px] border text-[13px] font-semibold cursor-pointer"
                style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
            >
                See everything
            </button>
        </div>
    );
}

export function NothingMatches() {
    return (
        <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--fg-3)" }}>
            Nothing matches that.
        </div>
    );
}
