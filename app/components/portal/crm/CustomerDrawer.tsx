"use client";

import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CaretLeft } from "@phosphor-icons/react";
import CustomerRecord, { type ReviewContext } from "./CustomerRecord";

/**
 * The customer record on a phone.
 *
 * A full-screen push since 2026-11-19 (Xander, mobile app rework, Q10), sliding in from the
 * right over the list like the Inbox's lead, with the phone's back gesture closing it (the URL
 * carries the open record, so Back works). It was a bottom sheet before.
 *
 * Its way back still reads "All customers", the same words as the desktop panel's.
 *
 * Only mounted open below 768px (`useIsMobile`).
 */
export default function CustomerDrawer({
    open,
    onClose,
    customerId,
    siteSlug,
    onChanged,
    review,
    onNotFound,
}: {
    open: boolean;
    onClose: () => void;
    customerId: string | null;
    siteSlug: string;
    onChanged: () => void;
    review: ReviewContext;
    onNotFound?: () => void;
}) {
    const reduceMotion = useReducedMotion();

    // The page underneath must not scroll while the record covers it.
    useEffect(() => {
        if (!open) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    return (
        <AnimatePresence>
            {open && (
                <motion.section
                    key="customer"
                    aria-label="Customer"
                    initial={reduceMotion ? false : { x: "100%" }}
                    animate={{ x: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { x: "100%" }}
                    transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
                    className="fixed inset-0 z-50 flex flex-col"
                    style={{ background: "var(--bg)" }}
                >
                    <div
                        className="shrink-0 flex items-center px-1.5 border-b"
                        style={{
                            paddingTop: "env(safe-area-inset-top, 0px)",
                            minHeight: "calc(56px + env(safe-area-inset-top, 0px))",
                            background: "var(--elev-1)",
                            borderColor: "var(--rule)",
                        }}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="inline-flex items-center gap-1 h-11 px-2.5 text-[17px] font-semibold cursor-pointer"
                            style={{ color: "var(--accent)" }}
                        >
                            <CaretLeft size={20} weight="bold" /> All customers
                        </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ background: "var(--elev-1)" }}>
                        <CustomerRecord
                            customerId={customerId}
                            siteSlug={siteSlug}
                            variant="sheet"
                            onChanged={onChanged}
                            review={review}
                            onNotFound={onNotFound}
                        />
                    </div>
                </motion.section>
            )}
        </AnimatePresence>
    );
}
