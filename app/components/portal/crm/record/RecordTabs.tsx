"use client";

import { useRef } from "react";

/**
 * The customer record's tabs: Timeline (where it opens), Contact info, Jobs, Notes.
 *
 * Xander, 2026-11-12: "the customer card should be tabbed with the default tab that you land on
 * when you open the customer card as the timeline." Wording approved from the mockup.
 *
 * A real ARIA tablist: arrow keys move between tabs (and select, since every panel is cheap to
 * draw), Home and End jump to the ends, and only the selected tab is in the Tab order. Counts sit
 * beside Jobs and Notes so the client can see there is something there without opening it.
 */

export const RECORD_TABS = [
    { id: "timeline", label: "Timeline" },
    { id: "contact", label: "Contact info" },
    { id: "jobs", label: "Jobs" },
    { id: "notes", label: "Notes" },
] as const;

export type RecordTab = (typeof RECORD_TABS)[number]["id"];

export const tabId = (t: RecordTab) => `crm-tab-${t}`;
export const panelId = (t: RecordTab) => `crm-tabpanel-${t}`;

export default function RecordTabs({
    tab,
    onChange,
    counts,
    className,
}: {
    tab: RecordTab;
    onChange: (t: RecordTab) => void;
    counts: Partial<Record<RecordTab, number>>;
    className?: string;
}) {
    const refs = useRef<Partial<Record<RecordTab, HTMLButtonElement | null>>>({});

    function onKeyDown(e: React.KeyboardEvent) {
        const i = RECORD_TABS.findIndex((t) => t.id === tab);
        const last = RECORD_TABS.length - 1;
        const to =
            e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
            : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
            : e.key === "Home" ? 0
            : e.key === "End" ? last
            : null;
        if (to === null) return;
        e.preventDefault();
        const next = RECORD_TABS[to].id;
        onChange(next);
        refs.current[next]?.focus();
    }

    return (
        <div
            role="tablist"
            aria-label="Customer record"
            data-tour="crm-record-tabs"
            onKeyDown={onKeyDown}
            className={`flex border-b overflow-x-auto ${className ?? ""}`}
            style={{ borderColor: "var(--rule)", scrollbarWidth: "none" }}
        >
            {RECORD_TABS.map((t) => {
                const on = t.id === tab;
                const count = counts[t.id];
                return (
                    <button
                        key={t.id}
                        ref={(el) => {
                            refs.current[t.id] = el;
                        }}
                        id={tabId(t.id)}
                        type="button"
                        role="tab"
                        aria-selected={on}
                        aria-controls={panelId(t.id)}
                        tabIndex={on ? 0 : -1}
                        onClick={() => onChange(t.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3.5 text-[13.5px] whitespace-nowrap cursor-pointer -mb-px"
                        style={{
                            minHeight: 44,
                            fontWeight: on ? 600 : 500,
                            color: on ? "var(--fg)" : "var(--fg-2)",
                            borderBottom: `2px solid ${on ? "var(--accent)" : "transparent"}`,
                        }}
                    >
                        {t.label}
                        {count ? (
                            <span
                                className="text-[10.5px] px-1.5 rounded-full"
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    background: "var(--surface)",
                                    color: "var(--fg-2)",
                                }}
                            >
                                {count}
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}
