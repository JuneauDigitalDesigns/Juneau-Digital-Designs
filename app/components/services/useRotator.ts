"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A set of tabs that moves on by itself every few seconds until someone picks one, as the
 * homepage's trade inbox does. Starts on the first and stays still for anyone who asked for
 * less motion.
 */
export function useRotator(count: number, ms: number) {
    const [index, setIndex] = useState(0);
    const auto = useRef(true);

    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) auto.current = false;
    }, []);

    useEffect(() => {
        if (!auto.current) return;
        const t = window.setTimeout(() => {
            if (auto.current) setIndex((i) => (i + 1) % count);
        }, ms);
        return () => window.clearTimeout(t);
    }, [index, count, ms]);

    const pick = (i: number) => {
        auto.current = false;
        setIndex(i);
    };
    return [index, pick] as const;
}
