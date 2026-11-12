"use client";

import { useEffect, useRef } from "react";

/**
 * Desktop keyboard hints: the one-line bar under the list, and the full list on "?".
 *
 * Shortcuts are a second way in, never the only one — every one of them is a visible button
 * as well (the research note's "don't copy: a keyboard-first interface").
 */

export function Kbd({ children }: { children: React.ReactNode }) {
    return (
        <kbd
            className="inline-block rounded border px-[5px] py-px text-[10.5px] leading-none"
            style={{
                fontFamily: "var(--font-mono)",
                color: "var(--fg-3)",
                borderColor: "var(--rule-strong)",
                background: "var(--elev-1)",
            }}
        >
            {children}
        </kbd>
    );
}

/**
 * Approved copy (Xander, 2026-11-12): "↑ ↓ move · c call · e done · h remind · u unread ·
 * esc close · ? all". It was "j k move · …"; j and k still work, and the ? list says so. No
 * "t text": texting was taken out of the Inbox (Xander, 2026-11-09).
 */
export function KeysBar() {
    return (
        <div
            className="hidden lg:flex flex-wrap gap-x-3.5 gap-y-1 px-4 py-2 border-t text-[11.5px] mt-auto"
            style={{ borderColor: "var(--rule-weak)", color: "var(--fg-3)", background: "var(--bg)" }}
        >
            <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> move
            </span>
            <span>
                <Kbd>c</Kbd> call
            </span>
            <span>
                <Kbd>e</Kbd> done
            </span>
            <span>
                <Kbd>h</Kbd> remind
            </span>
            <span>
                <Kbd>u</Kbd> unread
            </span>
            <span>
                <Kbd>esc</Kbd> close
            </span>
            <span>
                <Kbd>?</Kbd> all
            </span>
        </div>
    );
}

/** Every shortcut, on "?". "mark unread" approved by Xander, 2026-11-12. */
const ALL: [string[], string][] = [
    [["↑", "↓", "j", "k"], "move"],
    [["Enter"], "open"],
    [["c"], "call"],
    [["e"], "done"],
    [["h"], "remind"],
    [["u"], "mark unread"],
    [["/"], "search"],
    [["Esc"], "close"],
];

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        ref.current?.focus();
    }, []);
    return (
        <>
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="fixed inset-0 z-40 cursor-default"
                style={{ background: "rgba(13,17,23,0.25)" }}
            />
            <div
                ref={ref}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label="Keyboard shortcuts"
                onKeyDown={(e) => {
                    if (e.key === "Escape" || e.key === "?") {
                        e.stopPropagation();
                        onClose();
                    }
                }}
                className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] rounded-[10px] border p-4 outline-none"
                style={{ background: "var(--elev-1)", borderColor: "var(--rule)", boxShadow: "var(--glass-shadow)" }}
            >
                <ul className="space-y-2 text-[13.5px]" style={{ color: "var(--fg)" }}>
                    {ALL.map(([keys, label]) => (
                        <li key={label} className="flex items-center justify-between gap-4">
                            <span>{label}</span>
                            <span className="flex gap-1">
                                {keys.map((k) => (
                                    <Kbd key={k}>{k}</Kbd>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </>
    );
}
