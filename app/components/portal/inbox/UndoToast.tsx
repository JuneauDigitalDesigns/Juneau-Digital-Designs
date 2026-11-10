"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The undo toast: fixed to the bottom of the screen, gone by itself after six seconds.
 *
 * The old one sat at the top of the list and never left, so it was either noise or, scrolled
 * out of sight, no use. The progress line shows how long Undo is still on offer. It is a width
 * transition rather than a keyframe so there is no global CSS to add; it is information, not
 * decoration, so it runs under reduced motion too (it moves nothing else on the page).
 *
 * Colours: white on `--fg` 18.9:1; the Undo blue (#9dc0ff, the value the old toast used) on
 * `--fg` 10.3:1.
 */

export const UNDO_MS = 6000;

export interface UndoState {
    /** Changes per toast, so a second action restarts the clock and the line. */
    key: number;
    label: string;
    undo: () => void;
}

export default function UndoToast({ toast, onDismiss }: { toast: UndoState | null; onDismiss: () => void }) {
    // Keyed, so each toast mounts fresh: full line, new six seconds.
    return toast ? <Toast key={toast.key} toast={toast} onDismiss={onDismiss} /> : null;
}

function Toast({ toast, onDismiss }: { toast: UndoState; onDismiss: () => void }) {
    const [running, setRunning] = useState(false);
    const dismiss = useRef(onDismiss);
    useEffect(() => {
        dismiss.current = onDismiss;
    }, [onDismiss]);

    useEffect(() => {
        // Next frame, so the line starts full and the transition has something to run from.
        const raf = requestAnimationFrame(() => setRunning(true));
        const t = window.setTimeout(() => dismiss.current(), UNDO_MS);
        return () => {
            cancelAnimationFrame(raf);
            window.clearTimeout(t);
        };
    }, []);

    return (
        <div
            role="status"
            className="fixed z-[70] left-3 right-3 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] lg:left-1/2 lg:right-auto lg:bottom-6 lg:-translate-x-1/2 flex items-center justify-between gap-3.5 rounded-[10px] py-2.5 pl-4 pr-2.5 text-sm overflow-hidden"
            style={{
                background: "var(--fg)",
                color: "var(--elev-1)",
                boxShadow: "0 14px 30px -10px rgba(0,0,0,0.5)",
            }}
        >
            <span className="min-w-0 truncate">{toast.label}</span>
            <button
                type="button"
                onClick={toast.undo}
                className="shrink-0 font-semibold px-2 min-h-11 lg:min-h-0 lg:py-1 rounded-md cursor-pointer"
                style={{ color: "#9dc0ff" }}
            >
                Undo
            </button>
            <span
                aria-hidden="true"
                className="absolute left-0 bottom-0 h-0.5"
                style={{
                    background: "#9dc0ff",
                    width: running ? "0%" : "100%",
                    transition: running ? `width ${UNDO_MS}ms linear` : "none",
                }}
            />
        </div>
    );
}
