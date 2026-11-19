"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useId, useRef, useState } from "react";
import { TRADE_PAGES } from "@/app/data/trade-pages";

/**
 * The nav's Trades menu: a pill like About, with a chevron, that drops the trade pages.
 *
 * Opens on hover, as Xander asked, but hover alone would make it unreachable on a phone and for
 * anyone using a keyboard, so it also opens on click and on focus. Three details matter:
 *
 *  - **The close delay.** The panel sits below the button with a gap between them, so a pointer
 *    travelling to a link leaves both for a moment. Closing immediately on mouseleave makes the
 *    menu snatch itself away. 140ms is long enough to cross the gap and short enough not to feel
 *    stuck open.
 *  - **Focus, not just hover.** Tabbing to the button opens the menu; Escape closes it and puts
 *    focus back on the button; focus leaving the group closes it.
 *  - **Reduced motion.** The slide becomes a plain fade for anyone who asked for less movement.
 *
 * The list itself is `app/data/trade-pages.ts`, shared with the footer.
 */
export default function TradesMenu() {
    const [open, setOpen] = useState(false);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const groupRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const reduceMotion = useReducedMotion();
    const menuId = useId();

    /* A timer that outlives the component would call setState on an unmounted one. */
    useEffect(() => () => {
        if (closeTimer.current) clearTimeout(closeTimer.current);
    }, []);

    const cancelClose = () => {
        if (closeTimer.current) {
            clearTimeout(closeTimer.current);
            closeTimer.current = null;
        }
    };
    const openNow = () => {
        cancelClose();
        setOpen(true);
    };
    const closeSoon = () => {
        cancelClose();
        closeTimer.current = setTimeout(() => setOpen(false), 140);
    };

    return (
        <div
            ref={groupRef}
            className="nav-trades"
            onMouseEnter={openNow}
            onMouseLeave={closeSoon}
            onFocus={openNow}
            onBlur={(e) => {
                // Only when focus has actually left the button and its menu, not when it moves
                // between them.
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape" && open) {
                    setOpen(false);
                    buttonRef.current?.focus();
                }
            }}
        >
            <button
                ref={buttonRef}
                type="button"
                className="nav-link nav-trades-trigger"
                aria-expanded={open}
                aria-haspopup="true"
                aria-controls={menuId}
                onClick={() => (open ? setOpen(false) : openNow())}
            >
                Trades
                <Chevron open={open} />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        /* AnimatePresence needs a stable key to know the child left. Without it
                           the exit animation runs but the element is never unmounted, leaving an
                           invisible panel over the page that still takes clicks. */
                        key="trades-menu"
                        id={menuId}
                        className="nav-trades-menu"
                        /* `x: "-50%"` in every state, paired with `left: 50%` in the CSS, is what
                           centres the panel under its trigger: framer-motion owns this element's
                           `transform`, so the shift cannot live in the stylesheet. */
                        initial={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: -6, scale: 0.98 }}
                        animate={reduceMotion ? { opacity: 1, x: "-50%" } : { opacity: 1, x: "-50%", y: 0, scale: 1 }}
                        exit={reduceMotion ? { opacity: 0, x: "-50%" } : { opacity: 0, x: "-50%", y: -6, scale: 0.98 }}
                        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <ul>
                            {TRADE_PAGES.map((trade) => (
                                <li key={trade.href}>
                                    <Link href={trade.href} className="nav-trades-link" onClick={() => setOpen(false)}>
                                        {trade.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** The chevron, which turns over when the menu opens. */
export function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            className={`nav-chevron${open ? " nav-chevron-open" : ""}`}
            width="11"
            height="7"
            viewBox="0 0 11 7"
            fill="none"
            aria-hidden="true"
        >
            <path d="M1 1.25 5.5 5.75 10 1.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
    );
}
