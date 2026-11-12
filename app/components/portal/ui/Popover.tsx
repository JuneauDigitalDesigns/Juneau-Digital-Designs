"use client";

import { useEffect, useRef } from "react";

/**
 * A small window that opens right below the thing that opened it.
 *
 * Built for "Request a review", which used to slide a whole drawer in from the right for a
 * three-line message (Xander, 2026-11-12: "a window pop up right below the button"). Kept generic
 * so the calendar and the tour rebuild can use the same one.
 *
 * **Placement is the caller's wrapper.** It renders `absolute top-full`, so it sits under
 * whatever `relative` element holds both it and its trigger. No measuring, no portal: it paints
 * in the right place on the first frame, scrolls with the record, and stays inside the record's
 * own focus trap (the desktop panel and the phone sheet each trap Tab).
 *
 * **Non-modal.** No `aria-modal`, no scrim. The record behind it stays readable; a click
 * anywhere outside closes it, and so does Esc.
 *
 * **Esc is taken in the capture phase.** The record panel and the phone sheet both close on Esc
 * from a `keydown` listener on `document`. A listener on the popover itself only hears the key
 * when focus is inside it, and the panel's would still fire. Capture on `document` runs before
 * any bubbling listener there, so the popover can close itself and stop the key reaching the
 * record.
 */
export default function Popover({
    open,
    onClose,
    label,
    triggerRef,
    align = "end",
    width = 400,
    children,
}: {
    open: boolean;
    onClose: () => void;
    /** The accessible name of the window. */
    label: string;
    /** The button that opened it: focus goes back here on close, and clicks on it don't count as outside. */
    triggerRef: React.RefObject<HTMLElement | null>;
    /** `end` lines the right edges up (a button at the end of a row); `stretch` fills the wrapper (a phone). */
    align?: "end" | "stretch";
    width?: number;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    useEffect(() => {
        if (!open) return;
        const trigger = triggerRef.current;
        const el = ref.current;
        el?.focus({ preventScroll: true });
        // Below the fold on a phone sheet, where the button sits low: bring the window into view.
        el?.scrollIntoView({ block: "nearest" });

        function onKey(e: KeyboardEvent) {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onCloseRef.current();
        }
        // A click elsewhere is going somewhere: it keeps the focus it is about to give.
        let clickedAway = false;
        function onPointer(e: PointerEvent) {
            const t = e.target as Node | null;
            if (!t || el?.contains(t) || trigger?.contains(t)) return;
            clickedAway = true;
            onCloseRef.current();
        }
        document.addEventListener("keydown", onKey, true);
        document.addEventListener("pointerdown", onPointer, true);
        return () => {
            document.removeEventListener("keydown", onKey, true);
            document.removeEventListener("pointerdown", onPointer, true);
            if (clickedAway) return;
            // Esc, Send or the close button: back to the button that opened it.
            const active = document.activeElement;
            if (!active || active === document.body || el?.contains(active)) {
                trigger?.focus({ preventScroll: true });
            }
        };
    }, [open, triggerRef]);

    if (!open) return null;

    return (
        <div
            ref={ref}
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            className={`absolute top-full mt-2.5 z-30 outline-none ${align === "end" ? "right-0" : "left-0 right-0"}`}
            style={{
                width: align === "end" ? `min(${width}px, calc(100vw - 32px))` : undefined,
                background: "var(--elev-1)",
                border: "1px solid var(--rule-strong)",
                borderRadius: 12,
                boxShadow: "var(--shadow-2)",
            }}
        >
            {/* The caret points at the button. Under the right third of it for `end`, where the
                button is; centred-ish for a full-width phone button. */}
            <span
                aria-hidden="true"
                className="absolute w-3 h-3"
                style={{
                    top: -7,
                    right: align === "end" ? 40 : "50%",
                    transform: "rotate(45deg)",
                    background: "var(--elev-1)",
                    borderLeft: "1px solid var(--rule-strong)",
                    borderTop: "1px solid var(--rule-strong)",
                }}
            />
            <div className="relative p-4">{children}</div>
        </div>
    );
}
