"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

/**
 * A phone bottom sheet, for Remind me and Quick replies on the lead screen.
 *
 * Not `ui/Drawer`: that one turns into a sheet only below 768px and is a side drawer between
 * there and 1024, where this layout is still the phone one. It also belongs to another change
 * in flight. This is the small part of it the Inbox needs — a scrim, a grip, Esc, focus in and
 * back out — and it renders inside `.portal-scope`, so it reads the tokens directly.
 */
export default function Sheet({
    label,
    onClose,
    children,
}: {
    label: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();
    // Held in a ref so a parent's inline `onClose` does not re-run the focus effect each render.
    const close = useRef(onClose);
    useEffect(() => {
        close.current = onClose;
    }, [onClose]);

    useEffect(() => {
        const restore = document.activeElement as HTMLElement | null;
        ref.current?.focus();
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                close.current();
            }
        };
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("keydown", onKey);
            restore?.focus?.();
        };
    }, []);

    return (
        <>
            <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="fixed inset-0 z-[60] w-full cursor-pointer"
                style={{ background: "rgba(13,17,23,0.4)" }}
            />
            <motion.div
                ref={ref}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                initial={reduceMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
                className="fixed left-0 right-0 bottom-0 z-[61] flex flex-col gap-1 rounded-t-2xl px-4 pt-2 outline-none max-h-[85dvh] overflow-y-auto"
                style={{
                    background: "var(--elev-1)",
                    paddingBottom: "calc(22px + env(safe-area-inset-bottom, 0px))",
                }}
            >
                <span
                    aria-hidden="true"
                    className="block w-10 h-1 rounded-full mx-auto mb-2"
                    style={{ background: "var(--rule-strong)" }}
                />
                {children}
            </motion.div>
        </>
    );
}
