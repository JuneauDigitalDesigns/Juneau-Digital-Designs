"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type Driver } from "driver.js";
import "driver.js/dist/driver.css";
import "./tour-theme.css";
import { buildTourPlan, type TourTier } from "./steps";

/**
 * First-run spotlight tour.
 *
 * Auto-launches once per user (`!tourCompleted`), resuming where they left off, and replays
 * from the rail's Help button via the `jdd:start-tour` event.
 *
 * Two things make this more than a list of popovers:
 *
 *  1. **It is tier-aware.** Growth gets the full loop; Starter learns the Inbox and is pointed
 *     at the Growth showcase, because the rest would teach a feature they do not have.
 *  2. **One step opens the drawer.** The customer record is where the work happens, so the tour
 *     has to drive the UI, not just annotate it — the anchors for the back half of the tour do
 *     not exist until a customer is open.
 *
 * Progress persists to Clerk `publicMetadata` so it survives devices. Leaving the tour by any
 * route — Done, close, Esc — marks it seen, so it never auto-launches again. A visit that ends
 * with the tab closed mid-tour saved its step but not "seen", and the next visit resumes there.
 */

const TOUR_EVENT = "jdd:start-tour";

export default function TourController({
    tourCompleted,
    initialStep,
    tier,
}: {
    tourCompleted: boolean;
    initialStep: number;
    tier: TourTier;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const driverRef = useRef<Driver | null>(null);
    const startedRef = useRef(false);

    /**
     * Writes go out one at a time, in order.
     *
     * The route reads the user's metadata, merges, and writes it back. Fired in parallel, a
     * step-progress write that read the old metadata could land after the "seen" write and put
     * `completed: false` back — which is exactly the tour-every-visit bug, by a second route.
     */
    const queueRef = useRef<Promise<unknown>>(Promise.resolve());
    const postTour = useCallback((payload: { completed?: boolean; lastStepIndex?: number }) => {
        queueRef.current = queueRef.current.then(() =>
            fetch("/api/portal/tour", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }).catch(() => {}),
        );
    }, []);

    /** Poll for an anchor rather than assuming it exists on the next tick. */
    const waitFor = useCallback((selector: string, tries = 40): Promise<boolean> => {
        return new Promise((resolve) => {
            const tick = (left: number) => {
                if (document.querySelector(selector)) return resolve(true);
                if (left <= 0) return resolve(false);
                window.setTimeout(() => tick(left - 1), 100);
            };
            tick(tries);
        });
    }, []);

    const start = useCallback(
        async (fromStep: number) => {
            const isMobile = window.matchMedia("(max-width: 1023px)").matches;
            const plan = buildTourPlan(tier, isMobile);
            const site = params.get("site");
            const qs = (extra?: Record<string, string>) => {
                const p = new URLSearchParams();
                if (site) p.set("site", site);
                p.set("tour", "1");
                for (const [k, v] of Object.entries(extra ?? {})) p.set(k, v);
                return p.toString();
            };

            // The tour starts on the Inbox; later steps move to Customers.
            router.push(`/portal/calls?${qs()}`);
            const ok = await waitFor('[data-tour="inbox-list"]');
            if (!ok) return;

            driverRef.current?.destroy();

            const d = driver({
                showProgress: true,
                popoverClass: "jdd-tour",
                nextBtnText: "Next",
                prevBtnText: "Back",
                doneBtnText: "Done",
                steps: plan.steps,
                onHighlighted: (_el, _step, opts) => {
                    const i = opts.state.activeIndex;
                    if (typeof i === "number") postTour({ lastStepIndex: i });
                },
                onDestroyed: (_el, _step, opts) => {
                    // Read the index from the hook's snapshot, never from the driver: driver.js
                    // resets its state *before* calling onDestroyed, so `getActiveIndex()` is
                    // always undefined here. It used to be read that way, fell back to 0, and so
                    // "completed" was never saved — the tour auto-launched on every visit.
                    //
                    // Any way out counts as seen: Done, the close button, Esc, or navigating
                    // away. Someone who closed it has seen it; the Help button replays it.
                    const i = opts.state.activeIndex ?? 0;
                    postTour({ completed: true, lastStepIndex: i });
                    // Drop the tour flag so the demo content disappears.
                    const next = new URLSearchParams(window.location.search);
                    next.delete("tour");
                    next.delete("open");
                    const q = next.toString();
                    router.replace(`${window.location.pathname}${q ? `?${q}` : ""}`, { scroll: false });
                },
                onNextClick: async (_el, _step, opts) => {
                    const i = opts.state.activeIndex ?? 0;

                    // Leaving the Inbox for the board.
                    if (tier === "growth" && i === 1) {
                        router.push(`/portal/customers?${qs()}`);
                        const anchor = isMobile
                            ? '[data-tour="crm-list"]'
                            : '[data-tour="crm-board"]';
                        await waitFor(anchor);
                    }

                    // The step that drives the UI: open the first customer so the record
                    // anchors exist for the back half of the tour.
                    if (tier === "growth" && plan.opensDrawerAfter === i) {
                        const first = document.querySelector<HTMLElement>('[data-tour="crm-card"]');
                        first?.click();
                        const opened = await waitFor('[data-tour="crm-drawer-stage"]');
                        if (!opened) {
                            // No customers yet, so there is no record to teach. Jump to the end
                            // rather than spotlighting elements that will never appear.
                            d.moveTo(plan.steps.length - 1);
                            return;
                        }
                    }

                    d.moveNext();
                },
            });

            driverRef.current = d;
            d.drive(Math.min(Math.max(fromStep, 0), plan.steps.length - 1));
        },
        [params, router, postTour, tier, waitFor],
    );

    // Auto-launch once, on first login only.
    useEffect(() => {
        if (tourCompleted || startedRef.current) return;
        startedRef.current = true;
        void start(initialStep);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Replay from the Help button. Never re-arms auto-launch.
    useEffect(() => {
        const onStart = () => void start(0);
        window.addEventListener(TOUR_EVENT, onStart);
        return () => window.removeEventListener(TOUR_EVENT, onStart);
    }, [start]);

    // Tear down if the user navigates somewhere the tour doesn't cover.
    useEffect(() => {
        const covered =
            pathname.startsWith("/portal/calls") || pathname.startsWith("/portal/customers");
        if (!covered && driverRef.current?.isActive()) driverRef.current.destroy();
    }, [pathname]);

    return null;
}

/** Fire from anywhere (e.g. the Help button) to (re)launch the tour. */
export function launchTour() {
    window.dispatchEvent(new Event(TOUR_EVENT));
}
