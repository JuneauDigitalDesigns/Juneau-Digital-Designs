"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import type { InboxFilter } from "@/app/lib/crm-contacts";
import { Kbd } from "./ShortcutHelp";

/**
 * Heading, search, and the filter chips — or, while rows are ticked, the bulk bar in their
 * place, as the mockup has it. One strip either way, so ticking a box never moves the list.
 *
 * Phone keeps four chips and folds the rest into "More ▾" (Reminders, Promoted, Done); a
 * 390px screen holds four comfortably at a 44px touch height and no more.
 */

export interface InboxCounts {
    needs: number;
    reminders: number;
    promoted: number;
    done: number;
}

const LABEL: Record<InboxFilter, string> = {
    needs: "Needs you",
    all: "All",
    calls: "Calls",
    forms: "Forms",
    reminders: "Reminders",
    promoted: "Promoted",
    done: "Done",
};

export default function InboxToolbar({
    filter,
    counts,
    remindSupported,
    search,
    onSearch,
    onFilter,
    selected,
    onBulkDone,
    onBulkRemind,
    onBulkClear,
    searchRef,
    isDesktop,
}: {
    filter: InboxFilter;
    counts: InboxCounts;
    remindSupported: boolean;
    search: string;
    onSearch: (q: string) => void;
    onFilter: (f: InboxFilter) => void;
    selected: number;
    onBulkDone: () => void;
    onBulkRemind: () => void;
    onBulkClear: () => void;
    searchRef: RefObject<HTMLInputElement | null>;
    isDesktop: boolean;
}) {
    /**
     * The views beyond the four everyday ones. Reminders only once the backend is live, and
     * Promoted and Done only once there is something in them — on a new account they are
     * words the client has no use for yet (the rule the old tabs followed). The view you are
     * on always stays, so a link to an empty Done view still shows where you are.
     */
    const extras: InboxFilter[] = [];
    if (remindSupported) extras.push("reminders");
    if (counts.promoted > 0 || filter === "promoted") extras.push("promoted");
    if (counts.done > 0 || filter === "done") extras.push("done");

    /** All, Calls and Forms carry no number: a count of everything is not a to-do. */
    const count = (f: InboxFilter): number | null =>
        f === "all" || f === "calls" || f === "forms" ? null : counts[f];

    return (
        // The tour's "Find anything fast" stop spotlights search and chips together.
        <div data-tour="inbox-filters" className="flex flex-col gap-2.5 lg:gap-3">
            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:gap-4">
                <h1
                    className="font-bold"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--text-3xl)",
                        letterSpacing: "var(--tracking-tight)",
                    }}
                >
                    Inbox
                </h1>
                <label
                    className="flex items-center gap-2 rounded-[10px] lg:rounded-lg border px-3 h-11 lg:h-[38px] w-full lg:ml-auto lg:max-w-[340px]"
                    style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)" }}
                >
                    <MagnifyingGlass size={15} aria-hidden="true" style={{ color: "var(--fg-3)" }} />
                    <span className="sr-only">Search</span>
                    <input
                        ref={searchRef}
                        type="search"
                        value={search}
                        onChange={(e) => onSearch(e.target.value)}
                        onKeyDown={(e) => {
                            // Esc hands the keyboard back to the list, where j/k live.
                            if (e.key === "Escape") e.currentTarget.blur();
                        }}
                        placeholder={isDesktop ? "Search names, numbers, what they said" : "Search"}
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm"
                        style={{ color: "var(--fg)" }}
                    />
                    {isDesktop && <Kbd>/</Kbd>}
                </label>
            </div>

            {selected > 0 && isDesktop ? (
                <div className="flex items-center min-h-9">
                    <div
                        role="group"
                        aria-label={`${selected} selected`}
                        className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-3.5 text-[13px]"
                        style={{ background: "var(--fg)", color: "var(--elev-1)" }}
                    >
                        <span>{selected} selected</span>
                        <BulkButton onClick={onBulkDone}>Mark done</BulkButton>
                        {remindSupported && (
                            <BulkButton onClick={onBulkRemind}>Remind me tomorrow</BulkButton>
                        )}
                        <BulkButton onClick={onBulkClear} quiet>
                            Clear
                        </BulkButton>
                    </div>
                </div>
            ) : (
                // One line that scrolls sideways on a narrow phone rather than wrapping More
                // onto a second row; `-mx/px` lets the chips run to the screen edge.
                <div
                    role="group"
                    aria-label="Filter"
                    className="flex items-center gap-1.5 min-h-11 lg:min-h-9 overflow-x-auto lg:overflow-visible -mx-3.5 px-3.5 lg:mx-0 lg:px-0 [scrollbar-width:none]"
                >
                    {(["needs", "all", "calls", "forms"] as const).map((f) => (
                        <FilterChip
                            key={f}
                            active={filter === f}
                            onClick={() => onFilter(f)}
                            label={LABEL[f]}
                            count={count(f)}
                            phoneJoin={f === "needs"}
                        />
                    ))}
                    {/* Desktop: the rest as chips. */}
                    <span className="hidden lg:contents">
                        {extras.map((f) => (
                            <FilterChip
                                key={f}
                                active={filter === f}
                                onClick={() => onFilter(f)}
                                label={LABEL[f]}
                                count={count(f)}
                            />
                        ))}
                    </span>
                    {/* Phone: the rest behind More. */}
                    {extras.length > 0 && (
                        <span className="lg:hidden">
                            <MoreMenu
                                options={extras.map((f) => ({ f, label: LABEL[f], count: count(f) }))}
                                active={extras.includes(filter) ? filter : null}
                                activeLabel={extras.includes(filter) ? LABEL[filter] : null}
                                onPick={onFilter}
                            />
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

function chipStyle(active: boolean): React.CSSProperties {
    // Active: white on --fg, 18.9:1. Inactive: --fg-2 on --elev-1, 8.14:1.
    return active
        ? { background: "var(--fg)", borderColor: "var(--fg)", color: "var(--elev-1)", fontWeight: 600 }
        : { background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" };
}

function FilterChip({
    active,
    onClick,
    label,
    count,
    phoneJoin,
}: {
    active: boolean;
    onClick: () => void;
    label: string;
    count: number | null;
    /** Phone writes the count as "Needs you · 3", desktop as a mono figure beside it. */
    phoneJoin?: boolean;
}) {
    return (
        <button
            type="button"
            aria-pressed={active}
            onClick={onClick}
            className="portal-hit shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 h-9 lg:h-8 px-3 rounded-full border text-[13px] cursor-pointer"
            style={chipStyle(active)}
        >
            {label}
            {count !== null && (
                <>
                    {phoneJoin && <span className="lg:hidden">· {count}</span>}
                    <span
                        className={phoneJoin ? "hidden lg:inline text-[11px]" : "text-[11px]"}
                        style={{ fontFamily: "var(--font-mono)", color: active ? "inherit" : "var(--fg-3)" }}
                    >
                        {count}
                    </span>
                </>
            )}
        </button>
    );
}

function BulkButton({
    onClick,
    quiet,
    children,
}: {
    onClick: () => void;
    quiet?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="rounded-md px-2.5 py-1.5 cursor-pointer hover:bg-white/10"
            style={{ fontWeight: quiet ? 400 : 600, color: "inherit" }}
        >
            {children}
        </button>
    );
}

function MoreMenu({
    options,
    active,
    activeLabel,
    onPick,
}: {
    options: { f: InboxFilter; label: string; count: number | null }[];
    active: InboxFilter | null;
    activeLabel: string | null;
    onPick: (f: InboxFilter) => void;
}) {
    /**
     * Where the menu opens, measured from the button. Fixed rather than absolute because the
     * chip row scrolls sideways, and an absolutely placed menu inside a scroller is clipped.
     */
    const [at, setAt] = useState<{ top: number; right: number } | null>(null);
    const open = at !== null;
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = () => setAt(null);
        const onDown = (e: PointerEvent) => {
            if (!ref.current?.contains(e.target as Node)) close();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [open]);

    return (
        <div ref={ref}>
            <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={(e) => {
                    if (open) return setAt(null);
                    const r = e.currentTarget.getBoundingClientRect();
                    setAt({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) });
                }}
                className="portal-hit shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 h-9 px-3 rounded-full border text-[13px] cursor-pointer"
                style={chipStyle(active !== null)}
            >
                {activeLabel ?? "More"} ▾
            </button>
            {at && (
                <div
                    role="menu"
                    className="fixed z-40 min-w-[200px] rounded-[10px] border p-1.5"
                    style={{
                        top: at.top,
                        right: at.right,
                        background: "var(--elev-1)",
                        borderColor: "var(--rule)",
                        boxShadow: "var(--glass-shadow)",
                    }}
                >
                    {options.map((o) => (
                        <button
                            key={o.f}
                            type="button"
                            role="menuitemradio"
                            aria-checked={active === o.f}
                            onClick={() => {
                                setAt(null);
                                onPick(o.f);
                            }}
                            className="w-full flex items-center justify-between min-h-11 px-3 rounded-md text-[15px] cursor-pointer"
                            style={{
                                color: "var(--fg)",
                                fontWeight: active === o.f ? 600 : 400,
                                background: active === o.f ? "var(--surface)" : "transparent",
                            }}
                        >
                            <span>{o.label}</span>
                            {o.count !== null && (
                                <span className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                    {o.count}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
