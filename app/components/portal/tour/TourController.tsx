"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { driver, type Driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour-theme.css";
import type { PortalSiteStatus } from "@jdd/schema";
import { buildTour, tourForPath, ELEMENT_TOURS, type TourId, type TourTier } from "./tours";
import { shouldAutoLaunchTour, streamedRedirectPending } from "./auto-launch";

/**
 * The portal's tours, v2 (Xander, 2026-11-12). The steps and words are in `tours.ts`.
 *
 * - **Welcome** auto-launches once per person (`!tourCompleted`), resuming where they left off,
 *   gated by `shouldAutoLaunchTour` (see `auto-launch.ts` for the crash that rule prevents).
 * - **Tab tours** each play once per person, the first time they open that tab, and only once
 *   the welcome tour is done. The customer file and its tabs start theirs when they appear.
 * - **Help** replays the page's tour (`launchTour("page")`) or every tour (`launchTour("all")`,
 *   which also forgets the seen list so each tab teaches again).
 * - **No dimming** (Xander): driver.js runs with an invisible overlay that lets clicks through,
 *   and the target gets an outline (`tour-theme.css`). The page stays usable while a card is up.
 *
 * Progress persists to Clerk `publicMetadata.tour` so it survives devices. Leaving a tour by any
 * route (Done, close, Esc, leaving the page) counts as seen.
 */

const TOUR_EVENT = "jdd:start-tour";

/** A tour waits this long for its first anchor before it runs with centred cards instead. */
const ANCHOR_WAIT_TRIES = 30;

export default function TourController({
    tourCompleted,
    initialStep,
    seen: seenInitial,
    tier,
    siteStatus,
}: {
    tourCompleted: boolean;
    initialStep: number;
    /** Tab tours this person has already had. */
    seen: string[];
    tier: TourTier;
    /** The selected site's status. */
    siteStatus: PortalSiteStatus;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const driverRef = useRef<Driver | null>(null);
    const activeRef = useRef<{ id: TourId; path: string } | null>(null);
    const startedRef = useRef(false);
    const welcomeDone = useRef(tourCompleted);
    const seen = useRef(new Set(seenInitial));
    const pathRef = useRef(pathname);
    pathRef.current = pathname;

    /**
     * Writes go out one at a time, in order.
     *
     * The route reads the user's metadata, merges, and writes it back. Fired in parallel, a
     * step-progress write that read the old metadata could land after the "seen" write and put
     * `completed: false` back, which is exactly the tour-every-visit bug, by a second route.
     */
    const queueRef = useRef<Promise<unknown>>(Promise.resolve());
    const postTour = useCallback((payload: { completed?: boolean; lastStepIndex?: number; seen?: string; resetSeen?: boolean }) => {
        queueRef.current = queueRef.current.then(() =>
            fetch("/api/portal/tour", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }).catch(() => {}),
        );
    }, []);

    /** Poll for an anchor rather than assuming it exists on the next tick. */
    const waitFor = useCallback((selector: string, tries = ANCHOR_WAIT_TRIES): Promise<boolean> => {
        return new Promise((resolve) => {
            const tick = (left: number) => {
                if (document.querySelector(selector)) return resolve(true);
                if (left <= 0) return resolve(false);
                window.setTimeout(() => tick(left - 1), 100);
            };
            tick(tries);
        });
    }, []);

    /**
     * Run one tour. Steps whose anchor is not on the page (an empty inbox, a building site, a
     * rail hidden on a phone) become centred cards rather than stalling the tour.
     */
    const runTour = useCallback(
        async (id: TourId, from = 0, then?: () => void) => {
            const isMobile = window.matchMedia("(max-width: 1023px)").matches;
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const raw = buildTour(id, tier, isMobile);
            const anchors = raw.map((s) => s.element).filter((e): e is string => typeof e === "string");
            // The first anchor gets the full wait (the page may still be loading); the rest a
            // moment more, for things that open just after it (the inbox's newest lead).
            if (anchors.length) await waitFor(anchors[0]);
            await Promise.all(anchors.slice(1).map((a) => waitFor(a, 12)));
            const steps: DriveStep[] = raw.map((s) =>
                typeof s.element === "string" && !document.querySelector(s.element) ? { ...s, element: undefined } : s,
            );

            driverRef.current?.destroy();
            const path = pathRef.current;
            activeRef.current = { id, path };

            const d = driver({
                showProgress: steps.length > 1,
                popoverClass: "jdd-tour",
                nextBtnText: "Next",
                prevBtnText: "Back",
                doneBtnText: "Done",
                // No dimming (Xander, 2026-11-12): the overlay is invisible and lets clicks
                // through; the target is outlined instead (tour-theme.css).
                overlayOpacity: 0,
                overlayClickBehavior: () => {},
                stagePadding: 6,
                stageRadius: 10,
                animate: !reduce,
                smoothScroll: !reduce,
                steps,
                onHighlighted: (_el, _step, opts) => {
                    const i = opts.state.activeIndex;
                    if (id === "welcome" && typeof i === "number") postTour({ lastStepIndex: i });
                },
                onDestroyed: (_el, _step, opts) => {
                    // Read the index from the hook's snapshot, never from the driver: driver.js
                    // resets its state before calling onDestroyed, so `getActiveIndex()` is always
                    // undefined here. It used to be read that way, fell back to 0, and so
                    // "completed" was never saved: the tour auto-launched on every visit.
                    //
                    // Any way out counts as seen: Done, the close button, Esc, or leaving the page.
                    const i = opts.state.activeIndex ?? 0;
                    if (activeRef.current?.id === id) activeRef.current = null;
                    if (id === "welcome") {
                        welcomeDone.current = true;
                        postTour({ completed: true, lastStepIndex: i });
                    } else if (!seen.current.has(id)) {
                        seen.current.add(id);
                        postTour({ seen: id });
                    }
                    if (id === "inbox") {
                        // The inbox tour opened the newest lead with `?tour=1`; put the page back.
                        const next = new URLSearchParams(window.location.search);
                        next.delete("tour");
                        const q = next.toString();
                        router.replace(`${window.location.pathname}${q ? `?${q}` : ""}`, { scroll: false });
                    }
                    then?.();
                },
            });

            driverRef.current = d;
            d.drive(Math.min(Math.max(from, 0), steps.length - 1));
        },
        [postTour, router, tier, waitFor],
    );

    /** The tour this page (or what is open on it) should start, if any. */
    const pageTour = useCallback((): TourId | null => {
        const path = pathRef.current;
        if (tier === "growth") {
            // The most specific thing on screen wins: a customer's tab, then the customer file.
            for (const t of [...ELEMENT_TOURS].reverse()) {
                if (path.startsWith(t.path) && document.querySelector(t.trigger)) return t.id;
            }
        }
        return tourForPath(path, tier);
    }, [tier]);

    /** Start this page's tour if this person hasn't had it yet and nothing else is running. */
    const maybeTabTour = useCallback(() => {
        if (!welcomeDone.current || driverRef.current?.isActive()) return;
        if (streamedRedirectPending(document)) return;
        const id = pageTour();
        if (!id || seen.current.has(id)) return;
        if (id === "inbox") {
            // On a computer `?tour=1` opens the newest lead, where two of the inbox steps point.
            const next = new URLSearchParams(window.location.search);
            if (next.get("tour") !== "1") {
                next.set("tour", "1");
                router.replace(`${window.location.pathname}?${next.toString()}`, { scroll: false });
            }
        }
        void runTour(id);
    }, [pageTour, router, runTour]);

    /** The welcome tour; when it ends, the tab the person is on starts its own. */
    const start = useCallback(
        (fromStep: number) => {
            void runTour("welcome", fromStep, () => window.setTimeout(maybeTabTour, 400));
        },
        [runTour, maybeTabTour],
    );

    // Auto-launch the welcome tour once, on first sign-in only, and only on a page staying put.
    useEffect(() => {
        if (startedRef.current) return;
        const launch = shouldAutoLaunchTour({
            tourCompleted,
            siteStatus,
            redirectPending: streamedRedirectPending(document),
        });
        if (!launch) return;
        startedRef.current = true;
        void start(initialStep);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // A tab tour the first time its page is opened. Leaving a page ends that page's tour.
    useEffect(() => {
        const active = activeRef.current;
        if (active && active.id !== "welcome" && active.path !== pathname && driverRef.current?.isActive()) {
            driverRef.current.destroy();
        }
        if (siteStatus === "pending-onboarding") return;
        const t = window.setTimeout(maybeTabTour, 600);
        return () => window.clearTimeout(t);
    }, [pathname, siteStatus, maybeTabTour]);

    // The customer file and its tabs start their tours when they appear (Growth only).
    useEffect(() => {
        if (tier !== "growth" || !pathname.startsWith("/portal/customers")) return;
        let t: number | undefined;
        const mo = new MutationObserver(() => {
            window.clearTimeout(t);
            t = window.setTimeout(maybeTabTour, 500);
        });
        mo.observe(document.body, { childList: true, subtree: true });
        return () => {
            mo.disconnect();
            window.clearTimeout(t);
        };
    }, [tier, pathname, maybeTabTour]);

    // Help: this page's tour, or every tour again.
    useEffect(() => {
        const onStart = (e: Event) => {
            const which = (e as CustomEvent<"page" | "all">).detail ?? "page";
            driverRef.current?.destroy();
            if (which === "all") {
                seen.current.clear();
                postTour({ resetSeen: true });
                start(0);
                return;
            }
            const id = pageTour();
            if (id) void runTour(id);
            else start(0);
        };
        window.addEventListener(TOUR_EVENT, onStart);
        return () => window.removeEventListener(TOUR_EVENT, onStart);
    }, [pageTour, postTour, runTour, start]);

    return null;
}

/** Fire from anywhere (the Help menu) to tour this page, or to replay every tour. */
export function launchTour(which: "page" | "all" = "page") {
    window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: which }));
}
