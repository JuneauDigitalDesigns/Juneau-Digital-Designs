"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * The customer record on a desktop: a wide panel over a dimmed Customers board.
 *
 * It used to replace the board outright, which lost your place — the filters you had set, how
 * far along the board you had scrolled, which card you were on. Sliding over it keeps the board
 * mounted underneath and leaves a 132px strip of it showing, so it is plain where "All
 * customers" goes back to, and clicking that strip is one more way out. Xander picked this
 * over the full-page record on 2026-11-09 (Q4 in the portal UX rework).
 *
 * Only the content area dims. The rail stays lit and clickable, as in the mockup: picking
 * another tab is a reasonable way to leave, and it closes the record because the record is the
 * URL's `?open=`. The board itself is made `inert` by `CustomersSection` while this is open.
 *
 * Ways out: "All customers", Esc, the dimmed strip, and the browser's Back (the history entry
 * `openRecord` pushed). All four end at the caller's `onClose`, which decides whether that is a
 * `router.back()` or a replace.
 *
 * Why not `ui/Drawer`: that one dims the whole viewport, rail included, from a portal-wide
 * `fixed inset-0`, and its desktop branch tops out at 760px. Both are right for the inbox
 * detail and wrong here. The keyboard rules are the same ones, though, and kept in step with it.
 */

/**
 * The left edge of the content area. These mirror `.portal-shell`'s grid columns in
 * globals.css (232px rail, 64px collapsed, no rail below 1024px) and must change with them.
 * CSS rather than a measurement, so a deep-linked record paints in the right place on the
 * first frame instead of jumping across once an effect has measured the rail.
 */
const CONTENT_LEFT = "left-0 lg:left-[232px] lg:[[data-rail=collapsed]_&]:left-16";

/** Everything that can take focus inside the panel, for the Tab trap. */
const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], [tabindex]:not([tabindex="-1"])';

/** The mockup's slide: ~340ms on a fast-out curve, the scrim fading a little quicker. */
const SLIDE_EASE = [0.22, 0.8, 0.24, 1] as const;

/**
 * Is the first-run tour on screen?
 *
 * driver.js puts `driver-active` on `<body>` for as long as a tour runs. While it does, the tour
 * owns the keyboard: it traps Tab inside its own popover and closes on Esc, and this panel
 * trapping Tab too would leave the two fighting over focus.
 */
function tourRunning(): boolean {
    return typeof document !== "undefined" && document.body.classList.contains("driver-active");
}

export default function CustomerPanel({
    open,
    onClose,
    customerId,
    children,
}: {
    open: boolean;
    onClose: () => void;
    /** The open record, so focus can find its card again on close. */
    customerId: string | null;
    children: React.ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const reduceMotion = useReducedMotion();

    // Read inside the effect below rather than listed as its dependencies: `onClose` changes
    // identity whenever the board's filters do, and re-running the effect would re-capture the
    // element to return focus to — by then, something inside the panel.
    const onCloseRef = useRef(onClose);
    const idRef = useRef(customerId);
    useEffect(() => {
        onCloseRef.current = onClose;
        idRef.current = customerId;
    }, [onClose, customerId]);

    useEffect(() => {
        if (!open) return;

        // The card that opened it. Clicking a board card focuses it (they take focus now), so
        // this is the card; a deep link leaves it on <body>, and there is nothing to return to.
        const opener = document.activeElement as HTMLElement | null;
        const openerCard = opener?.dataset.customerId ? opener.dataset.customerId : null;

        // Not while the tour runs: its popover holds focus, and its Next button is what the
        // keyboard user is on.
        if (!tourRunning()) panelRef.current?.focus({ preventScroll: true });

        function onKeyDown(e: KeyboardEvent) {
            const panel = panelRef.current;
            if (!panel || tourRunning()) return;
            // Another dialog on top — "Request a review" is a Drawer — has the keyboard. Both
            // listen on document and this one registered first, so it has to step aside rather
            // than rely on the other's stopPropagation, which cannot stop a sibling listener.
            const others = document.querySelectorAll('[aria-modal="true"]');
            for (const el of others) if (el !== panel) return;

            if (e.key === "Escape") {
                e.preventDefault();
                onCloseRef.current();
                return;
            }
            if (e.key !== "Tab") return;

            const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
                (el) => el.getClientRects().length > 0,
            );
            if (focusables.length === 0) {
                e.preventDefault();
                panel.focus();
                return;
            }
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            const active = document.activeElement;
            if (!panel.contains(active)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && (active === first || active === panel)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener("keydown", onKeyDown);
        // The panel scrolls; the board under it should not scroll along with a wheel that
        // strays onto the dimmed strip.
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = prevOverflow;
            // Runs on the commit that closes it, so the board's `inert` is already gone and
            // the card can take focus. Looked up again by id, not reused: changing the stage
            // from inside the record moves the card to another column, which is a new node.
            const card = openerCard
                ? document.querySelector<HTMLElement>(
                      `[data-customer-id="${CSS.escape(openerCard)}"]`,
                  )
                : null;
            const target = card ?? (opener && opener !== document.body && opener.isConnected ? opener : null);
            target?.focus({ preventScroll: true });
        };
    }, [open]);

    return (
        /* `inert` while closed covers the exit animation: the panel is still on screen for
           340ms after it has been dismissed, and must not take a click or a Tab in that time.
           z-[35]: over the phone/tablet bars (topbar z-20, tab bar z-30), under every `Drawer`
           (z-40/50) so "Request a review" opens on top of it, and far under driver.js (overlay
           10000, popover 1e9) so the tour's popovers are never behind it. */
        <div
            className={`fixed top-0 bottom-0 right-0 ${CONTENT_LEFT} z-[35] pointer-events-none`}
            inert={!open}
        >
            <AnimatePresence initial={false}>
                {open && (
                    <Sheet key="panel" panelRef={panelRef} onClose={onClose} reduceMotion={!!reduceMotion}>
                        {children}
                    </Sheet>
                )}
            </AnimatePresence>
        </div>
    );
}

function Sheet({
    panelRef,
    onClose,
    reduceMotion,
    children,
}: {
    panelRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    reduceMotion: boolean;
    children: React.ReactNode;
}) {
    // Decided once, as it opens. The tour opens a record and spotlights its header on the next
    // frame; driver.js measures that header once, halfway through its own transition, and
    // pins its popover there. Mid-slide the header is still travelling, so the popover would
    // land beside where it was going to be. Appearing in place under the tour avoids that
    // without touching the tour.
    const [instant] = useState(tourRunning);

    const slide = instant
        ? { duration: 0 }
        : reduceMotion
          ? { duration: 0.15, ease: "easeOut" as const }
          : { duration: 0.34, ease: SLIDE_EASE };
    const fade = instant ? { duration: 0 } : { duration: reduceMotion ? 0.15 : 0.28, ease: "easeOut" as const };

    return (
        <>
            {/* The dimmed board. A pointer target only: keyboard users have Esc and "All
                customers", and a focusable scrim is a Tab stop nobody can see. */}
            <motion.div
                aria-hidden="true"
                onClick={onClose}
                className="absolute inset-0 pointer-events-auto cursor-pointer"
                style={{ background: "rgba(13,17,23,0.32)" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={fade}
            />
            <motion.div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Customer record"
                tabIndex={-1}
                data-customer-panel=""
                className="@container absolute top-0 right-0 bottom-0 w-[calc(100%-132px)] overflow-y-auto overscroll-contain outline-none pointer-events-auto"
                style={{
                    background: "var(--elev-1)",
                    borderLeft: "1px solid var(--rule)",
                    boxShadow: "-18px 0 40px -12px rgba(13,17,23,0.28)",
                }}
                initial={reduceMotion ? { opacity: 0 } : { x: "104%" }}
                animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { x: "104%" }}
                transition={slide}
            >
                {children}
            </motion.div>
        </>
    );
}
