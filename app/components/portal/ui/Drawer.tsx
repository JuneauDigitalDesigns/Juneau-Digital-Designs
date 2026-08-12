"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Right-side detail drawer.
 *
 * Replaces an expanding table row, which could only ever hold one line of text and pushed
 * every row below it down the page. A drawer has room for the full summary, the caller's
 * details, and a recording — and leaves the list you were scanning where it was.
 */
export default function Drawer({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreFocusTo = useRef<HTMLElement | null>(null);
    const reduceMotion = useReducedMotion();

    // Esc to close, and trap Tab inside the panel while it's open.
    useEffect(() => {
        if (!open) return;

        restoreFocusTo.current = document.activeElement as HTMLElement | null;
        panelRef.current?.focus();

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.stopPropagation();
                onClose();
                return;
            }
            if (e.key !== "Tab") return;

            const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
                'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
            );
            if (!focusables || focusables.length === 0) return;

            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            restoreFocusTo.current?.focus?.();
        };
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        className="fixed inset-0 z-40"
                        style={{ background: "rgba(0,0,0,0.45)" }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.18 }}
                        onClick={onClose}
                        aria-hidden="true"
                    />
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        tabIndex={-1}
                        className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[26rem] overflow-y-auto outline-none"
                        style={{
                            background: "var(--bg)",
                            borderLeft: "1px solid var(--rule)",
                            boxShadow: "var(--glass-shadow)",
                        }}
                        initial={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                        animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div
                            className="flex items-center justify-between gap-4 px-5 py-4 border-b sticky top-0"
                            style={{ borderColor: "var(--rule)", background: "var(--bg)" }}
                        >
                            <h2
                                className="text-base font-semibold truncate"
                                style={{ fontFamily: "var(--font-display)" }}
                            >
                                {title}
                            </h2>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="shrink-0 w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors"
                                style={{ color: "var(--fg-2)", background: "var(--surface)" }}
                            >
                                ✕
                            </button>
                        </div>
                        <div className="px-5 py-5">{children}</div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
