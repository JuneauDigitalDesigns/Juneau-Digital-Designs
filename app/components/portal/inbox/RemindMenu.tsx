"use client";

import { useEffect, useRef, useState } from "react";
import { parsePickedTime, remindPresets, toLocalInputValue, tomorrowMorning } from "./model";
import Sheet from "./Sheet";

/**
 * Remind me: a popover under the button on desktop, a bottom sheet on a phone.
 *
 * The preset times are computed in the browser, in the client's own time zone, and sent as an
 * instant — the server only stores `at` (see the API shape note). "Pick a date and time…"
 * opens the native picker inline rather than a calendar of our own: on a phone that is the
 * system wheel, which is the best date input a phone has.
 */

const EXPLAINER = "It goes back to Needs you then. If they call again first, it comes back straight away.";

function Options({ now, onPick, big }: { now: Date; onPick: (at: Date) => void; big: boolean }) {
    const [picking, setPicking] = useState(false);
    const [value, setValue] = useState(() => toLocalInputValue(tomorrowMorning(now)));
    const picked = parsePickedTime(value, now);

    const opt = big
        ? "w-full flex justify-between items-center min-h-[52px] border-b text-[15px] cursor-pointer"
        : "w-full flex justify-between px-3 py-2.5 rounded-md text-[13.5px] cursor-pointer hover:bg-[color-mix(in_srgb,var(--accent)_6%,var(--elev-1))]";
    const optStyle = { color: "var(--fg)", borderColor: "var(--rule-weak)" };
    const detail = big ? "text-[13.5px]" : "text-[12.5px]";

    return (
        <>
            {remindPresets(now).map((p) => (
                <button key={p.key} type="button" role="menuitem" onClick={() => onPick(p.at)} className={opt} style={optStyle}>
                    <span>{p.label}</span>
                    <span className={detail} style={{ color: "var(--fg-3)" }}>
                        {p.detail}
                    </span>
                </button>
            ))}
            <button
                type="button"
                role="menuitem"
                aria-expanded={picking}
                onClick={() => setPicking((v) => !v)}
                className={opt}
                style={{ ...optStyle, borderBottomWidth: big && !picking ? 0 : undefined }}
            >
                <span>Pick a date and time…</span>
                <span />
            </button>
            {picking && (
                <div className={`flex gap-2 items-center ${big ? "py-2" : "px-3 py-2"}`}>
                    <input
                        type="datetime-local"
                        value={value}
                        min={toLocalInputValue(now)}
                        onChange={(e) => setValue(e.target.value)}
                        aria-label="Pick a date and time…"
                        className="flex-1 min-w-0 rounded-md border px-2 text-sm h-11 lg:h-9"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    <button
                        type="button"
                        disabled={!picked}
                        onClick={() => picked && onPick(picked)}
                        className="shrink-0 rounded-md px-3 text-[13px] font-semibold h-11 lg:h-9 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        Remind me
                    </button>
                </div>
            )}
            <p
                className={`leading-snug ${big ? "text-[12.5px] pt-1" : "text-[12.5px] px-3 pt-2 pb-1.5 border-t"}`}
                style={{ color: "var(--fg-3)", borderColor: "var(--rule-weak)" }}
            >
                {EXPLAINER}
            </p>
        </>
    );
}

export function RemindPopover({
    now,
    onPick,
    onClose,
}: {
    now: Date;
    onPick: (at: Date) => void;
    onClose: () => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const close = useRef(onClose);
    useEffect(() => {
        close.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const onDown = (e: PointerEvent) => {
            const t = e.target as HTMLElement;
            // The toggle button closes it itself; counting it as "outside" would reopen it.
            if (t.closest?.("[data-remind-toggle]")) return;
            if (!ref.current?.contains(t)) close.current();
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                close.current();
            }
        };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        ref.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, []);

    return (
        <div
            ref={ref}
            role="menu"
            aria-label="Remind me"
            className="absolute left-0 top-11 z-30 w-[300px] flex flex-col rounded-[10px] border p-1.5"
            style={{
                background: "var(--elev-1)",
                borderColor: "var(--rule)",
                boxShadow: "0 18px 40px -12px rgba(13,17,23,0.3)",
            }}
        >
            <Options now={now} onPick={onPick} big={false} />
        </div>
    );
}

export function RemindSheet({
    now,
    onPick,
    onClose,
}: {
    now: Date;
    onPick: (at: Date) => void;
    onClose: () => void;
}) {
    return (
        <Sheet label="Remind me" onClose={onClose}>
            <strong className="text-base pt-1 pb-1.5" style={{ color: "var(--fg)" }}>
                Remind me
            </strong>
            <div role="menu" aria-label="Remind me" className="flex flex-col">
                <Options now={now} onPick={onPick} big />
            </div>
        </Sheet>
    );
}
