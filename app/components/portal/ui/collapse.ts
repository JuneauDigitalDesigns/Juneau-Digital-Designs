import type { MotionProps } from "framer-motion";

/**
 * Height collapse for things that leave a list or a page (Xander, 2026-11-19: "if there's any
 * content that disappears, that the pages collapse nicely with a smooth animation rather than
 * just popping into the next size").
 *
 * Spread onto a `motion.*` element inside `<AnimatePresence initial={false}>`. With reduced
 * motion it is instant, as every other portal animation is.
 */
export function collapseProps(reduce: boolean | null): MotionProps {
    if (reduce) return { initial: false, exit: { opacity: 0, transition: { duration: 0 } } };
    return {
        initial: { height: 0, opacity: 0 },
        animate: { height: "auto", opacity: 1 },
        exit: { height: 0, opacity: 0 },
        transition: { duration: 0.24, ease: [0.22, 0.8, 0.24, 1] },
        style: { overflow: "hidden" },
    };
}
