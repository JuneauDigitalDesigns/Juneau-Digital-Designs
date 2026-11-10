"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { CaretLeft } from "@phosphor-icons/react";
import { useIsMobile } from "./useMediaQuery";

/**
 * Detail overlay: a right-side drawer on desktop, a bottom sheet on a phone.
 *
 * Replaces an expanding table row, which could only ever hold one line of text and pushed
 * every row below it down the page. This has room for the full summary, the caller's
 * details, and a recording — and leaves the list you were scanning where it was.
 *
 * The mobile branch is not cosmetic. The desktop drawer put its close button in the top
 * right, which on a phone is the one corner a thumb cannot reach, and slid in from an edge
 * no touch gesture is associated with. A sheet rises from the thumb, carries a grip, and
 * dismisses by flicking down — so the close button stops being the only way out.
 *
 * Everything below the presentation layer is shared: one focus trap, one Esc handler, one
 * scroll lock, one focus-restore. Forking those per viewport is how a keyboard user ends up
 * trapped in a variant nobody tested.
 */
/**
 * Desktop widths. The mobile branch is always a full-width sheet, so this is desktop-only.
 *
 * `md` is the original 26rem and stays the default, so every existing caller is unaffected.
 * The CRM needs more: `lg` for the inbox detail and `xl` for the two-column customer record,
 * which has a details panel beside a full activity timeline.
 */
const WIDTH = {
    md: "sm:w-[26rem]",   // 416px — the original
    lg: "sm:w-[32.5rem]", // 520px — inbox detail
    xl: "sm:w-[47.5rem]", // 760px — customer record, two columns
} as const;

export type DrawerWidth = keyof typeof WIDTH;

export default function Drawer({
    open,
    onClose,
    title,
    width = "md",
    padded = true,
    surface = "page",
    back,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Desktop width. Mobile is always a full-width sheet. */
    width?: DrawerWidth;
    /**
     * Whether to wrap children in the standard padding. Pass `false` for layouts that need to
     * reach the panel edges — the customer record's two columns have their own padding and a
     * full-height divider between them, which an outer gutter would break.
     */
    padded?: boolean;
    /**
     * Which surface the panel paints.
     *
     * `"page"` (default) is `--bg`, the page grey, so white `Card`s inside it lift — that is
     * what every existing caller is built against. `"raised"` is `--elev-1` white, for the CRM
     * panels whose own inner blocks are grey. Opt-in rather than a global flip: changing the
     * default would make the existing drawers' white content cards invisible against it.
     */
    surface?: "page" | "raised";
    /**
     * A back link in place of the title and the close button: "‹ All customers" on the phone
     * customer sheet. For a sheet that is a step into something, where "back to where I was"
     * is the plain reading and an ✕ in the far corner is the one place a thumb cannot reach.
     * The title still names the dialog for assistive tech; it just is not drawn.
     */
    back?: string;
    children: React.ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    const restoreFocusTo = useRef<HTMLElement | null>(null);
    const reduceMotion = useReducedMotion();
    const isMobile = useIsMobile();
    const panelBg = surface === "raised" ? "var(--elev-1)" : "var(--bg)";

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

    /**
     * Dismiss on a downward flick, or on a drag that got far enough to read as intent.
     * Velocity alone is not enough — a slow, deliberate pull to the bottom of the screen
     * should also close — and distance alone is not enough either, or a quick flick that
     * only travelled 40px would spring back and feel broken.
     */
    function onDragEnd(_: unknown, info: PanInfo) {
        if (info.velocity.y > 420 || info.offset.y > 110) onClose();
    }

    const motionProps = reduceMotion
        ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
        : isMobile
          ? { initial: { y: "100%" }, animate: { y: 0 }, exit: { y: "100%" } }
          : { initial: { x: "100%" }, animate: { x: 0 }, exit: { x: "100%" } };

    const dragProps =
        isMobile && !reduceMotion
            ? {
                  drag: "y" as const,
                  // Up is clamped to 0 so the sheet cannot be dragged off the top of its own
                  // container; down is unbounded so the exit follows the finger.
                  dragConstraints: { top: 0, bottom: 0 },
                  dragElastic: { top: 0, bottom: 0.9 },
                  onDragEnd,
              }
            : {};

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
                        className={
                            isMobile
                                ? "portal-sheet fixed inset-x-0 bottom-0 z-50 overflow-y-auto outline-none"
                                : `fixed right-0 top-0 bottom-0 z-50 w-full ${WIDTH[width]} max-w-full overflow-y-auto outline-none`
                        }
                        style={
                            isMobile
                                ? {
                                      background: panelBg,
                                      borderTop: "1px solid var(--rule)",
                                      boxShadow: "var(--glass-shadow)",
                                  }
                                : {
                                      background: panelBg,
                                      borderLeft: "1px solid var(--rule)",
                                      boxShadow: "var(--glass-shadow)",
                                  }
                        }
                        {...motionProps}
                        {...dragProps}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {/* Affordance and drag surface both. Hidden from AT because the sheet
                            is already dismissible by Esc and by the labelled close button. */}
                        {isMobile && !reduceMotion && (
                            <div className="portal-sheet-grip" aria-hidden="true" />
                        )}

                        <div
                            className={`flex items-center justify-between gap-4 px-5 border-b sticky top-0 ${
                                isMobile ? "pb-3 pt-1" : "py-4"
                            }`}
                            style={{ borderColor: "var(--rule)", background: panelBg }}
                        >
                            {back ? (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="portal-hit -ml-2.5 inline-flex items-center gap-1 h-11 px-2.5 rounded-lg text-[14px] font-semibold cursor-pointer"
                                    style={{ color: "var(--accent)" }}
                                >
                                    <CaretLeft size={16} weight="bold" aria-hidden="true" />
                                    {back}
                                </button>
                            ) : (
                                <>
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
                                        className="portal-hit shrink-0 w-8 h-8 rounded flex items-center justify-center cursor-pointer transition-colors"
                                        style={{ color: "var(--fg-2)", background: "var(--surface)" }}
                                    >
                                        ✕
                                    </button>
                                </>
                            )}
                        </div>
                        {padded ? <div className="px-5 py-5">{children}</div> : children}
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
