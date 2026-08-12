"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";

/**
 * Entrance motion for the portal.
 *
 * The portal had no motion at all while the marketing site has reveals, draw-on strokes and
 * tilts — the two halves of the product didn't feel related. This is deliberately quieter
 * than the marketing side: a dashboard that performs on every load gets tiring by the third
 * visit.
 *
 * Everything here no-ops under `prefers-reduced-motion`, and no-ops mean *rendered at final
 * value*, never hidden.
 */

const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

const item: Variants = {
    hidden: { opacity: 0, y: 10 },
    show: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
    },
};

export function Stagger({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const reduced = useReducedMotion();
    if (reduced) return <div className={className}>{children}</div>;

    return (
        <motion.div className={className} variants={container} initial="hidden" animate="show">
            {children}
        </motion.div>
    );
}

export function StaggerItem({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const reduced = useReducedMotion();
    if (reduced) return <div className={className}>{children}</div>;

    return (
        <motion.div className={className} variants={item}>
            {children}
        </motion.div>
    );
}

/**
 * Counts a metric up to its value on mount.
 *
 * Uses rAF rather than a framer-motion spring so the caller can format the intermediate
 * values (durations render as "3m 12s", not 192). Returns the target immediately when
 * motion is reduced, when the value isn't finite, or when it's small enough that counting
 * would be noise rather than emphasis.
 */
export function useCountUp(target: number | null, duration = 650): number | null {
    const reduced = useReducedMotion();

    // Decided during render, not inside the effect: a synchronous setState in an effect
    // body triggers a cascading render, and the eligibility test needs no state at all.
    const shouldAnimate =
        target !== null && Number.isFinite(target) && !reduced && Math.abs(target) >= 3;

    // `null` means "not mid-animation" — the hook then reports the target itself, so a
    // settled tile always shows the real number rather than a remembered one.
    const [progress, setProgress] = useState<number | null>(null);
    const frame = useRef<number | null>(null);

    useEffect(() => {
        if (!shouldAnimate) return;

        const start = performance.now();
        const tick = (now: number) => {
            const t = Math.min((now - start) / duration, 1);
            // easeOutCubic — decelerates into the final number instead of stopping dead.
            const eased = 1 - Math.pow(1 - t, 3);
            setProgress(t < 1 ? Math.round(target * eased) : null);
            if (t < 1) frame.current = requestAnimationFrame(tick);
        };
        frame.current = requestAnimationFrame(tick);

        return () => {
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        };
    }, [shouldAnimate, target, duration]);

    return progress ?? target;
}
