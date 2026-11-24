"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { X } from "@phosphor-icons/react";
import "./tour-theme.css";
import type { PortalSiteStatus } from "@jdd/schema";
import type { SampleTrade } from "@/app/data/trade-samples";
import { tourDeviceFor, type TourDevice, type TourState } from "@/app/lib/portal-tour-seen";
import { useClearPortalCache } from "../PortalDataProvider";
import {
    SAMPLE_DATA_LABEL,
    boldParts,
    hrefFor,
    sectionForPath,
    sectionWalk,
    walkFor,
    wordsFor,
    type TourSection,
    type TourStep,
    type TourTier,
} from "./steps";
import { startSampleMode, stopSampleMode } from "./sample-mode";
import { shouldAutoLaunchTour, streamedRedirectPending } from "./auto-launch";
import { placeCard, type Box } from "./placement";

/**
 * The portal tour, v3 (Xander, 19 Nov 2026). The steps and words are in `steps.ts`.
 *
 * - **One walk through the whole portal**, starting by itself the first time a person lands on
 *   the portal, once on a computer and once on a phone (`portal-tour-seen.ts`), picking up where
 *   it stopped if it was interrupted on that device. It moves from screen to screen by itself:
 *   switching tabs, opening the newest lead and a customer's file and its tabs, and going into
 *   the pages under More.
 * - **Sample data from the client's trade** while it runs (`sample-mode.ts`), so there is
 *   something to look at, and nothing the owner taps during it is saved.
 * - **Afterwards** it runs only from Help & tour on the rail, or More on a phone: "Tour this page"
 *   (that section) or "Replay all tours" (the whole walk). Neither re-arms the first-visit start.
 * - **No dimming** (Xander, 2026-11-12): the page stays at full brightness and usable; the part
 *   being explained gets an outline and the card sits beside it, below it whenever there is room.
 *   The page scrolls only when the part is off screen or the card cannot sit below it.
 * - **Leaving early counts as seen**: the close button, Esc, or tapping elsewhere in the app.
 *
 * Built on its own rather than on driver.js (v2), whose single "scroll into view" and fixed
 * placement could not keep the card below the outline, nor animate its height between steps.
 */

const TOUR_EVENT = "jdd:start-tour";
const PHONE_QUERY = "(max-width: 1023px)";
/** A step waits this long for its part to appear before it shows as a centred card. */
const ANCHOR_WAIT_MS = 4000;
/** The class on <body> while the tour runs (`CustomerPanel` leaves the keyboard to the tour). */
export const TOURING_CLASS = "portal-touring";

interface Run {
    steps: TourStep[];
    i: number;
    device: TourDevice;
    /** The whole walk (the first visit, or Replay all), rather than one page's section. */
    whole: boolean;
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

function reducedMotion(): boolean {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The element a selector names, if it is actually on screen (a hidden twin has no box). */
function visibleEl(selector: string | undefined): HTMLElement | null {
    if (!selector) return null;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) return el;
    }
    return null;
}

async function waitForEl(selector: string | undefined, ms: number, alive: () => boolean): Promise<HTMLElement | null> {
    if (!selector) return null;
    const until = Date.now() + ms;
    while (alive()) {
        const el = visibleEl(selector);
        if (el || Date.now() > until) return el;
        await wait(100);
    }
    return null;
}

export default function TourController({
    tour,
    tier,
    siteStatus,
    siteSlug,
    trade,
}: {
    tour: TourState;
    tier: TourTier;
    /** The selected site's status. */
    siteStatus: PortalSiteStatus;
    siteSlug: string;
    /** Which trade's sample data the tour shows. */
    trade: SampleTrade;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const clearCache = useClearPortalCache();

    const [run, setRun] = useState<Run | null>(null);
    const [shown, setShown] = useState<{ anchor: HTMLElement | null; key: number } | null>(null);
    const runRef = useRef<Run | null>(null);
    runRef.current = run;
    const token = useRef(0);
    const startedRef = useRef(false);
    /** The page the tour is taking the person to, so their own navigation can be told apart. */
    const expectedPath = useRef<string | null>(null);
    /** The last page before More, for More › Tour this page. */
    const cameFrom = useRef<string | null>(null);
    const seen = useRef(tour);

    /**
     * Writes go out one at a time, in order: the route reads the metadata, merges and writes it
     * back, so two in flight could land out of order and undo each other.
     */
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    const postTour = useCallback((payload: { device: TourDevice; completed?: boolean; step?: number }) => {
        queue.current = queue.current.then(() =>
            fetch("/api/portal/tour", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }).catch(() => {}),
        );
    }, []);

    /** Leave the tour, by any route: back to the person's own data, and remembered as seen. */
    const end = useCallback(() => {
        const r = runRef.current;
        if (!r) return;
        token.current++;
        runRef.current = null;
        setRun(null);
        setShown(null);
        stopSampleMode();
        clearCache();
        document.body.classList.remove(TOURING_CLASS);
        if (r.whole && !seen.current[r.device].completed) {
            seen.current = { ...seen.current, [r.device]: { ...seen.current[r.device], completed: true } };
            postTour({ device: r.device, completed: true, step: r.i });
        }
        // Off the sample screens: drop the tour's own parameters, and re-read Home's real cards.
        const next = new URLSearchParams(window.location.search);
        next.delete("tour");
        if (next.get("open")?.startsWith("tour-")) next.delete("open");
        const q = next.toString();
        expectedPath.current = null;
        router.replace(`${window.location.pathname}${q ? `?${q}` : ""}`, { scroll: false });
        router.refresh();
    }, [clearCache, postTour, router]);

    const begin = useCallback(
        (steps: TourStep[], device: TourDevice, whole: boolean, from = 0) => {
            if (!steps.length) return;
            clearCache();
            startSampleMode({ trade, growth: tier === "growth", webOnly: tier === "website" });
            document.body.classList.add(TOURING_CLASS);
            const r = { steps, i: Math.min(Math.max(from, 0), steps.length - 1), device, whole };
            runRef.current = r;
            setRun(r);
        },
        [clearCache, tier, trade],
    );

    const go = useCallback(
        (i: number) => {
            const r = runRef.current;
            if (!r || i < 0) return;
            if (i >= r.steps.length) return end();
            const next = { ...r, i };
            runRef.current = next;
            setRun(next);
        },
        [end],
    );

    // Each step: take the person to its screen, open what it needs, then show the card.
    useEffect(() => {
        if (!run) return;
        const my = ++token.current;
        const alive = () => token.current === my;
        const step = run.steps[run.i];
        const view = step[run.device];
        if (!view) return;
        if (run.whole && !seen.current[run.device].completed) postTour({ device: run.device, step: run.i });

        (async () => {
            setShown((s) => (s ? { ...s, anchor: null } : s));
            const here = new URLSearchParams(window.location.search);
            const wantOpen = view.at.open ?? null;
            const open = here.get("open");
            const onPage =
                window.location.pathname.replace(/\/+$/, "") === view.at.path &&
                here.get("tour") === "1" &&
                (wantOpen ? open?.startsWith("tour-") : !open);
            expectedPath.current = view.at.path;
            if (!onPage) router.push(hrefFor(view.at, siteSlug), { scroll: false });
            let el = await waitForEl(view.anchor, ANCHOR_WAIT_MS, alive);
            if (!alive()) return;
            // The customer file's tabs are local state: the tour taps the one it needs.
            if (view.at.tab) {
                const tabBtn = visibleEl(`#crm-tab-${view.at.tab}`);
                if (tabBtn && tabBtn.getAttribute("aria-selected") !== "true") {
                    tabBtn.click();
                    await wait(250);
                    el = await waitForEl(view.anchor, 1500, alive);
                    if (!alive()) return;
                }
            }
            setShown({ anchor: el, key: my });
        })();
    }, [run, router, siteSlug, postTour]);

    // Leaving the tour's screens by your own hand ends it (and counts as seen).
    useEffect(() => {
        const r = runRef.current;
        if (!r) {
            if (!pathname.startsWith("/portal/more")) cameFrom.current = pathname;
            return;
        }
        if (expectedPath.current && pathname.replace(/\/+$/, "") !== expectedPath.current) end();
    }, [pathname, end]);

    // Start by itself on the first visit on this kind of device, on a page that is staying put.
    useEffect(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        const device = tourDeviceFor(window.matchMedia(PHONE_QUERY).matches);
        const mine = tour[device];
        const launch = shouldAutoLaunchTour({
            tourCompleted: mine.completed,
            siteStatus,
            redirectPending: streamedRedirectPending(document),
        });
        if (!launch) return;
        const t = window.setTimeout(() => begin(walkFor(tier, device), device, true, mine.step), 600);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Help & tour, and More: this page's section, or the whole walk again.
    useEffect(() => {
        const onStart = (e: Event) => {
            const which = (e as CustomEvent<"page" | "all">).detail ?? "page";
            if (runRef.current) end();
            const device = tourDeviceFor(window.matchMedia(PHONE_QUERY).matches);
            if (which === "all") return begin(walkFor(tier, device), device, true, 0);
            // On More, "this page" is the screen the person came from.
            const path = window.location.pathname.startsWith("/portal/more") && cameFrom.current ? cameFrom.current : window.location.pathname;
            const section: TourSection = sectionForPath(path) ?? "Home";
            begin(sectionWalk(section, tier, device), device, false, 0);
        };
        window.addEventListener(TOUR_EVENT, onStart);
        return () => window.removeEventListener(TOUR_EVENT, onStart);
    }, [begin, end, tier]);

    // Esc leaves.
    useEffect(() => {
        if (!run) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") end();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [run, end]);

    // A sample screen must never outlive the tour, even if the shell unmounts mid-walk.
    useEffect(() => () => stopSampleMode(), []);

    if (!run || !shown) return null;
    const step = run.steps[run.i];
    return (
        <TourCard
            key="tour-card"
            step={step}
            device={run.device}
            tier={tier}
            index={run.i}
            total={run.steps.length}
            anchor={shown.anchor}
            showKey={shown.key}
            nudge={Boolean(step[run.device]?.nudge)}
            onBack={() => go(run.i - 1)}
            onNext={() => go(run.i + 1)}
            onClose={end}
        />
    );
}

/** Fire from anywhere (Help & tour, More) to tour this page, or to replay the whole walk. */
export function launchTour(which: "page" | "all" = "page") {
    window.dispatchEvent(new CustomEvent(TOUR_EVENT, { detail: which }));
}

/* ── the card and the outline ─────────────────────────────────────────────── */

function TourCard({
    step,
    device,
    tier,
    index,
    total,
    anchor,
    showKey,
    nudge,
    onBack,
    onNext,
    onClose,
}: {
    step: TourStep;
    device: TourDevice;
    tier: TourTier;
    index: number;
    total: number;
    anchor: HTMLElement | null;
    showKey: number;
    nudge: boolean;
    onBack: () => void;
    onNext: () => void;
    onClose: () => void;
}) {
    const cardRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const nextRef = useRef<HTMLButtonElement>(null);
    const lastHeight = useRef(0);
    const [ring, setRing] = useState<Box | null>(null);
    const [pos, setPos] = useState<{ top: number; left: number; width: number; arrow: { side: "up" | "down" | "left"; offset: number } | null } | null>(null);
    const { title, body } = wordsFor(step, device, tier);
    const last = index === total - 1;

    const measure = useCallback(() => {
        const card = cardRef.current;
        if (!card) return;
        const phone = device === "mobile";
        const r = anchor?.isConnected ? anchor.getBoundingClientRect() : null;
        const top = phone ? (document.querySelector(".portal-topbar")?.getBoundingClientRect().bottom ?? 0) + 8 : 12;
        const tabbar = phone ? document.querySelector(".portal-tabbar")?.getBoundingClientRect() : null;
        const bottom = (tabbar && tabbar.height > 0 ? tabbar.top : window.innerHeight) - 8;
        const placed = placeCard({
            anchor: r && r.width > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null,
            fixed: Boolean(anchor && isFixed(anchor)),
            card: { w: phone ? Math.min(window.innerWidth - 24, 440) : 340, h: card.offsetHeight },
            viewport: { w: window.innerWidth, h: window.innerHeight, top, bottom },
            phone,
        });
        setRing(placed.ring);
        setPos({ top: placed.top, left: placed.left, width: placed.width, arrow: placed.arrow });
    }, [anchor, device]);

    // New step: words in, height eased from the last card's, the part scrolled to only if needed.
    useLayoutEffect(() => {
        const inner = innerRef.current;
        if (!inner) return;
        const reduce = reducedMotion();
        inner.style.height = "";
        const h = inner.offsetHeight;
        if (lastHeight.current && !reduce && Math.abs(lastHeight.current - h) > 2) {
            inner.style.height = `${lastHeight.current}px`;
            void inner.offsetHeight;
            inner.style.height = `${h}px`;
            const t = window.setTimeout(() => (inner.style.height = ""), 320);
            lastHeight.current = h;
            return () => window.clearTimeout(t);
        }
        lastHeight.current = h;
    }, [showKey, title, body]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const card = cardRef.current;
            if (anchor && card && !isFixed(anchor)) {
                const phone = device === "mobile";
                const top = phone ? (document.querySelector(".portal-topbar")?.getBoundingClientRect().bottom ?? 0) + 8 : 12;
                const tabbar = phone ? document.querySelector(".portal-tabbar")?.getBoundingClientRect() : null;
                const bottom = (tabbar && tabbar.height > 0 ? tabbar.top : window.innerHeight) - 8;
                const r = anchor.getBoundingClientRect();
                const visible = r.top >= top && r.bottom <= bottom;
                const fitsBelow = bottom - (r.bottom + 14) >= card.offsetHeight;
                // Scroll only when it must: the part is off screen, or the card can't sit below it.
                if (!visible || !fitsBelow) await scrollToTop(anchor, top + 16);
            }
            if (cancelled) return;
            measure();
            if (nudge && anchor && !reducedMotion()) nudgeRow(anchor);
        })();
        return () => {
            cancelled = true;
        };
    }, [anchor, showKey, device, measure, nudge]);

    // Keep the outline on its part as the page scrolls or resizes.
    useEffect(() => {
        let raf = 0;
        const on = () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };
        window.addEventListener("scroll", on, { passive: true, capture: true });
        window.addEventListener("resize", on);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("scroll", on, { capture: true });
            window.removeEventListener("resize", on);
        };
    }, [measure]);

    // Keyboard: Next takes focus with each card, without scrolling the page to it.
    useEffect(() => {
        nextRef.current?.focus({ preventScroll: true });
    }, [showKey, index]);

    return createPortal(
        <div className="portal-scope jdd-tour-root">
            {ring && <div className="jdd-tour-ring" style={{ left: ring.x, top: ring.y, width: ring.w, height: ring.h }} aria-hidden="true" />}
            <div
                ref={cardRef}
                className={`jdd-tour-card${step.handoff ? " is-handoff" : ""}`}
                role="dialog"
                aria-modal="false"
                aria-labelledby="jdd-tour-title"
                style={{ top: pos?.top ?? -9999, left: pos?.left ?? 12, width: pos?.width ?? 340, visibility: pos ? "visible" : "hidden" }}
            >
                <div ref={innerRef} className="jdd-tour-inner">
                    <div className="jdd-tour-eyebrow">
                        <span>{step.label ? `${step.section} · ${step.label}` : step.section}</span>
                        <span className="jdd-tour-sample">{SAMPLE_DATA_LABEL}</span>
                    </div>
                    <h2 id="jdd-tour-title" className="jdd-tour-title">
                        {title}
                    </h2>
                    {!step.handoff && (
                        <p className="jdd-tour-body">
                            {boldParts(body).map((p, k) => (p.bold ? <b key={k}>{p.text}</b> : <span key={k}>{p.text}</span>))}
                        </p>
                    )}
                    <div className="jdd-tour-foot">
                        <span className="jdd-tour-progress">
                            {index + 1} of {total}
                        </span>
                        {index > 0 && (
                            <button type="button" className="jdd-tour-back" onClick={onBack}>
                                Back
                            </button>
                        )}
                        <button ref={nextRef} type="button" className="jdd-tour-next" onClick={onNext}>
                            {last ? "Done" : "Next"}
                        </button>
                    </div>
                    <button type="button" className="jdd-tour-close" onClick={onClose} aria-label="Close the tour">
                        <X size={18} weight="bold" />
                    </button>
                </div>
                {pos?.arrow && <span className={`jdd-tour-arrow is-${pos.arrow.side}`} style={pos.arrow.side === "left" ? { top: pos.arrow.offset } : { left: pos.arrow.offset }} aria-hidden="true" />}
            </div>
        </div>,
        document.body,
    );
}

/** Is the element (or what holds it) fixed or sticky to the screen? Scrolling won't move it. */
function isFixed(el: HTMLElement): boolean {
    for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        const p = getComputedStyle(n).position;
        if (p === "fixed" || p === "sticky") return true;
    }
    return false;
}

/** Scroll whatever holds the element so its top sits `topPx` from the top of the screen. */
async function scrollToTop(el: HTMLElement, topPx: number): Promise<void> {
    const reduce = reducedMotion();
    const before = el.getBoundingClientRect().top;
    el.style.scrollMarginTop = `${topPx}px`;
    el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
    await wait(140);
    // A smooth scroll that has not started (a background tab) is finished instantly instead.
    if (Math.abs(el.getBoundingClientRect().top - before) < 1) el.scrollIntoView({ block: "start", behavior: "auto" });
    let last = NaN;
    for (let k = 0, still = 0; k < 30 && still < 3; k++) {
        await wait(40);
        const now = el.getBoundingClientRect().top;
        still = Math.abs(now - last) < 0.5 ? still + 1 : 0;
        last = now;
    }
    el.style.scrollMarginTop = "";
}

/** The Inbox's swipe, shown: the row slides a little right, back, a little left, back. */
function nudgeRow(el: HTMLElement) {
    const row = el;
    const steps: [number, string][] = [
        [300, "translateX(64px)"],
        [1000, ""],
        [1500, "translateX(-72px)"],
        [2200, ""],
    ];
    row.style.transition = "transform .35s cubic-bezier(.2,.8,.2,1)";
    for (const [t, tf] of steps) window.setTimeout(() => (row.style.transform = tf), t);
    window.setTimeout(() => (row.style.transition = ""), 2700);
}
