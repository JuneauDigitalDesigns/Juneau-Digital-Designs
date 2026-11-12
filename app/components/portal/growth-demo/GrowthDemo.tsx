"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useReducedMotion } from "framer-motion";
import { ArrowCounterClockwise, Pause, Play, X } from "@phosphor-icons/react";
import {
    COPY,
    DURATION,
    SCENE_COUNT,
    SEGMENTS,
    announcementFor,
    clampIndex,
    isScrim,
    sceneOf,
    sceneView,
    stepOf,
    tick,
    type ScrimCopy,
    type Segment,
} from "./script";
import DesktopReplica from "./DesktopReplica";
import PhoneReplica from "./PhoneReplica";
import DemoCursor from "./DemoCursor";
import { demoNow } from "./sample";
import s from "./GrowthDemo.module.css";

/**
 * The Starter → Growth demo: a full-screen takeover that plays a minute of Growth working on
 * sample data, over the client's own portal. Replaces the driver.js popover walkthrough
 * (`tour/showcase.ts`), which could only narrate over a ghost board with no numerals on it;
 * this shows the loop actually happening, in the portal's own look.
 *
 * Modelled on the homepage's portal demo (`app/components/home/PortalDemo.tsx`), with the same
 * sample shop and the same four steps: Promote, Pipeline, Message, Review. Its scene components
 * are private to that file and built for its camera and 1160 × 1060 canvas, so this draws its
 * own focused replica (`DesktopReplica`, `PhoneReplica`) after the GrowthDemo mockups, and
 * shares the homepage's sample data and captions instead.
 *
 * How it plays (Xander, Q7: auto-play with pause, back and skip):
 *   intro → [title card → scene] × 4 → end card. Everything advances on its own; Back and
 *   Next move one part, Pause holds it. The end card waits for the client.
 *
 * Accessibility:
 *   - A real modal: `role="dialog"` + `aria-modal`, focus moves in and is trapped, Esc leaves,
 *     focus goes back where it came from, the page behind is `inert` and does not scroll.
 *   - The replica is decorative and hidden from assistive tech. A polite live region reads
 *     each title card and caption as it comes up, which is the whole narration.
 *   - Reduced motion: every scene is drawn as its finished frame and nothing inside it moves
 *     (no slide, pop, pulse, typing or fade). The parts still advance on their own, because
 *     the timing is reading time rather than animation, and Pause is always there.
 *
 * Rebuilt 2026-11-12 (Xander): five steps (Jobs and the calendar are new), a little slower, a
 * cursor that does every click (`DemoCursor`), and the portal's own components on sample data
 * (`DesktopReplica`, `PhoneReplica`, `sample.ts`), so what it shows is exactly the product. The
 * desktop replica needs the live components' desktop layouts, which follow the window, so it is
 * used from 1024px wide; below that the phone replica shows their phone layouts.
 *
 * Rendered into <body> through a portal, so no transformed ancestor in the dashboard can turn
 * `position: fixed` into something else, and wrapped in its own `.portal-scope` so every
 * `var()` inside still resolves to the portal's tokens (see the CSS module's header).
 */

/** Below this the desktop replica would scale past readable, so the phone layout takes over. */
const PHONE_QUERY = "(max-width: 1023px), (max-height: 539px)";
const FRAME = { w: 1160, h: 700 };
/** Clock resolution. Fine enough for the typing; coarse enough not to re-render every frame. */
const TICK_MS = 100;
/** The most one tick may advance: a throttled background tab plays slower, never skips. */
const MAX_DELTA = 250;

interface State {
    i: number;
    t: number;
    playing: boolean;
    /** Bumped on every jump, so a title card's progress line restarts with it. */
    run: number;
}

type Action = { type: "tick"; delta: number } | { type: "go"; i: number } | { type: "toggle" } | { type: "restart" };

function reducer(st: State, a: Action): State {
    switch (a.type) {
        case "tick": {
            const n = tick(st.i, st.t, a.delta);
            return n.i === st.i && n.t === st.t ? st : { ...st, ...n, run: n.i === st.i ? st.run : st.run + 1 };
        }
        case "go":
            return { ...st, i: clampIndex(a.i), t: 0, run: st.run + 1 };
        case "toggle":
            return { ...st, playing: !st.playing };
        case "restart":
            return { i: 0, t: 0, playing: true, run: st.run + 1 };
    }
}

function useMatch(query: string): boolean {
    // Only ever mounted after a click or an effect, never during SSR, so the first render can
    // read the real value and there is no desktop-first flash on a phone.
    const [m, setM] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const on = (e: MediaQueryListEvent) => setM(e.matches);
        mql.addEventListener("change", on);
        return () => mql.removeEventListener("change", on);
    }, [query]);
    return m;
}

export default function GrowthDemo({
    upgradeUrl,
    onClose,
    returnFocusTo,
}: {
    upgradeUrl: string;
    onClose: () => void;
    /** Where focus goes on exit when it did not come from anywhere (the demo opened from a link). */
    returnFocusTo?: React.RefObject<HTMLElement | null>;
}) {
    const [st, dispatch] = useReducer(reducer, { i: 0, t: 0, playing: true, run: 0 });
    const still = !!useReducedMotion();
    const phone = useMatch(PHONE_QUERY);

    const rootRef = useRef<HTMLDivElement>(null);
    const playRef = useRef<HTMLButtonElement>(null);
    const endTitleRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const screenRef = useRef<HTMLDivElement>(null);
    const [k, setK] = useState(1);
    /** The sample account's clock: 7:42 AM today, so Dave's 2:13 AM call was this morning. */
    const now = useMemo(() => demoNow(), []);

    const seg: Segment = SEGMENTS[st.i];
    const atEnd = seg === "end";
    const scene = sceneOf(seg);
    const scrim = isScrim(seg);
    // A title card shows its scene's opening frame behind it; the scene itself plays from there.
    const view = scene ? sceneView(scene, scrim ? 0 : st.t, still && !scrim) : null;
    const step = stepOf(seg);

    /* ── the clock ── */
    useEffect(() => {
        if (!st.playing || atEnd) return;
        let last = performance.now();
        const id = window.setInterval(() => {
            const now = performance.now();
            dispatch({ type: "tick", delta: Math.min(MAX_DELTA, now - last) });
            last = now;
        }, TICK_MS);
        return () => window.clearInterval(id);
    }, [st.playing, atEnd]);

    /* ── modal plumbing: focus in, trap, Esc, scroll lock, inert page, focus back ── */
    // Read through a ref so a parent re-render with a new onClose never re-runs the modal
    // setup below, which would bounce focus out and back in.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);
    const close = useCallback(() => onCloseRef.current(), []);
    const returnRef = useRef(returnFocusTo);
    useEffect(() => {
        const root = rootRef.current;
        if (!root) return;
        const from = document.activeElement as HTMLElement | null;
        const fallback = returnRef.current;
        playRef.current?.focus();

        function onKeyDown(e: KeyboardEvent) {
            if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
                return;
            }
            if (e.key !== "Tab" || !root) return;
            const els = Array.from(
                root.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
            );
            if (els.length === 0) {
                e.preventDefault();
                return;
            }
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            if (!root.contains(active)) {
                e.preventDefault();
                first.focus();
            } else if (e.shiftKey && active === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", onKeyDown, true);

        const html = document.documentElement;
        const prev = { body: document.body.style.overflow, html: html.style.overflow };
        document.body.style.overflow = "hidden";
        html.style.overflow = "hidden";

        // Everything else in <body> leaves the accessibility tree and the tab order while the
        // demo is up; `aria-modal` alone is not honoured by every screen reader.
        const host = root.parentElement === document.body ? root : null;
        const inerted: Element[] = [];
        for (const el of Array.from(document.body.children)) {
            if (el === host || el.hasAttribute("inert") || el.tagName === "SCRIPT") continue;
            el.setAttribute("inert", "");
            inerted.push(el);
        }

        return () => {
            document.removeEventListener("keydown", onKeyDown, true);
            document.body.style.overflow = prev.body;
            html.style.overflow = prev.html;
            for (const el of inerted) el.removeAttribute("inert");
            const back = from && from !== document.body && from.isConnected ? from : fallback?.current;
            back?.focus?.();
        };
    }, [close]);

    /* Controls leave on the end card, so focus has to move with them, onto its heading; and
       back onto Pause when Watch again brings them back. */
    const wasEnd = useRef(false);
    useEffect(() => {
        if (atEnd) endTitleRef.current?.focus();
        else if (wasEnd.current) playRef.current?.focus();
        wasEnd.current = atEnd;
    }, [atEnd]);

    /* ── fit the desktop replica to the window ── */
    useLayoutEffect(() => {
        if (phone) return;
        const el = stageRef.current;
        if (!el) return;
        const fit = () => {
            const w = el.clientWidth - 48;
            const h = el.clientHeight - 16;
            setK(Math.max(0.3, Math.min(1, w / FRAME.w, h / FRAME.h)));
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        return () => ro.disconnect();
    }, [phone]);

    const announce = announcementFor(seg);
    const scrimCopy: ScrimCopy | null = scrim ? COPY.scrims[seg as keyof typeof COPY.scrims] : null;
    const scrimMs = scrim ? DURATION[seg as keyof typeof DURATION] : 0;

    const titleCard = scrimCopy && (
        <div className={s.shade} aria-hidden="true">
            <div className={s.scard} key={`scrim-${st.run}`}>
                <span className={s.slab}>{scrimCopy.label}</span>
                <span className={s.stitle}>{scrimCopy.title}</span>
                <span className={s.ssub}>{(phone && scrimCopy.subPhone) || scrimCopy.sub}</span>
                {!phone && (
                    <span className={s.sline}>
                        <span className={s.fill} style={{ animationDuration: `${scrimMs}ms` }} />
                    </span>
                )}
            </div>
        </div>
    );

    const endCard = atEnd && (
        <div className={s.endc}>
            <span className={s.endLabel}>{COPY.end.label}</span>
            <div ref={endTitleRef} className={s.endTitle} tabIndex={-1} role="heading" aria-level={2}>
                {COPY.end.title}
            </div>
            {!phone && (
                <div className={s.loop} aria-hidden="true">
                    {COPY.end.loop.map((l, n) => (
                        <span key={l} className="contents">
                            {n > 0 && <span>→</span>}
                            <span className={s.loopStep}>{l}</span>
                        </span>
                    ))}
                </div>
            )}
            <p className={s.endBody}>{COPY.end.body}</p>
            <div className={s.endActions}>
                {/* A plain anchor, as the old walkthrough's window.location did: the agreement
                    page is outside the dashboard, and a full load drops this takeover cleanly. */}
                <a className={s.cta} href={upgradeUrl}>
                    {COPY.end.upgrade}
                </a>
                <button type="button" className={s.ghost} onClick={() => dispatch({ type: "restart" })}>
                    <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
                    {COPY.end.replay}
                </button>
            </div>
            <button type="button" className={s.notNow} onClick={close}>
                {COPY.end.notNow}
            </button>
        </div>
    );

    const controls = !atEnd && (
        <div className={s.ctlRow}>
            <div className={s.ctl} role="group" aria-label="Demo controls">
                <button type="button" className={s.cb} onClick={() => dispatch({ type: "go", i: st.i - 1 })}>
                    <span aria-hidden="true">‹</span> {COPY.back}
                </button>
                <button ref={playRef} type="button" className={s.cb} onClick={() => dispatch({ type: "toggle" })}>
                    {st.playing ? <Pause size={14} weight="fill" aria-hidden="true" /> : <Play size={14} weight="fill" aria-hidden="true" />}
                    {st.playing ? COPY.pause : COPY.play}
                </button>
                <span className={s.dots} role="img" aria-label={`Step ${Math.min(step, SCENE_COUNT)} of ${SCENE_COUNT}`}>
                    {Array.from({ length: SCENE_COUNT }, (_, n) => n + 1).map((n) => (
                        <span key={n} className={s.dt} data-state={n === step ? "on" : n < step ? "past" : undefined} />
                    ))}
                </span>
                <button type="button" className={s.cb} onClick={() => dispatch({ type: "go", i: st.i + 1 })}>
                    {COPY.next} <span aria-hidden="true">›</span>
                </button>
            </div>
        </div>
    );

    return createPortal(
        <div
            ref={rootRef}
            className={`portal-scope ${s.root}`}
            // Inline, because the scope's own unlayered `background: var(--bg)` and `color`
            // would otherwise tie with the module class on specificity and win on load order.
            style={{ background: phone ? "#0b0f15" : "rgba(9, 12, 17, 0.92)", color: "#ffffff" }}
            role="dialog"
            aria-modal="true"
            aria-label="Growth demo"
            data-layout={phone ? "phone" : "desktop"}
            data-paused={!st.playing}
        >
            <div className={s.tbar}>
                <span className={s.tag}>{COPY.tag}</span>
                <button type="button" className={s.x} onClick={close}>
                    {COPY.exit}
                    <X size={14} weight="bold" aria-hidden="true" />
                </button>
            </div>

            <p className="sr-only" aria-live="polite" aria-atomic="true">
                {announce}
            </p>

            <div ref={stageRef} className={s.stage}>
                {phone ? (
                    atEnd ? (
                        endCard
                    ) : (
                        <>
                            <div ref={screenRef} className={s.screen} data-dim={scrim} aria-hidden="true" inert>
                                {scene && view && <PhoneReplica scene={scene} view={view} now={now} />}
                                {scene && !scrim && !still && <DemoCursor container={screenRef} scene={scene} t={st.t} tap />}
                            </div>
                            {titleCard}
                        </>
                    )
                ) : atEnd ? (
                    endCard
                ) : (
                    <>
                        <div className={s.sizer} style={{ width: FRAME.w * k, height: FRAME.h * k }} aria-hidden="true" inert>
                            <div ref={frameRef} className={s.frame} data-dim={scrim} style={{ transform: `scale(${k})` }}>
                                {scene && view && <DesktopReplica scene={scene} view={view} now={now} />}
                                {scene && !scrim && !still && <DemoCursor container={frameRef} scene={scene} t={st.t} k={k} />}
                            </div>
                        </div>
                        {titleCard}
                    </>
                )}
            </div>

            {controls}
        </div>,
        document.body,
    );
}
