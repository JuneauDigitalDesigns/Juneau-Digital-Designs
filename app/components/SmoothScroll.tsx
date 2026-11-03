"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

/**
 * Lenis smooth scrolling for the marketing pages.
 *
 * Mounted by MarketingChrome everywhere except `/portal`. The portal product and the
 * onboarding wizard both scroll inner containers — drawers, tables, a long form — and a
 * page-level smooth scroll intercepting the wheel over those is a bug report, not a feel.
 *
 * It replaced the homepage's pinned stage, which held three sections in one frame and
 * swapped them on scroll. The sections now travel with the document and arrive through
 * <JourneyReveal>; this gives that travel its weight.
 *
 * Off under `prefers-reduced-motion`: smoothing is motion, and someone who asked for less
 * of it gets the browser's own scroll. Checked once at mount, the same as Framer's
 * `useReducedMotion` reads it.
 *
 * Anything that scrolls on its own inside a marketing page (a modal, a long dropdown) needs
 * `data-lenis-prevent` on its scroll container, or the wheel scrolls the page behind it.
 * LeadPanel's sheet carries it.
 */
export default function SmoothScroll() {
    useEffect(() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

        const lenis = new Lenis({
            autoRaf: true,
            // A touch heavier than the default 0.1: long enough to read as weight on a
            // page this tall, short enough that a flick still lands where it was aimed.
            lerp: 0.09,
            // Same-page links (#cta, #pricing) glide through Lenis rather than jumping.
            anchors: true,
            // Pause whenever something locks the page by setting `overflow: hidden` on
            // <html> (LeadPanel does), and resume when it lets go, so a modal's scroll lock
            // holds without that modal needing a handle on this instance.
            autoToggle: true,
        });

        return () => lenis.destroy();
    }, []);

    return null;
}
