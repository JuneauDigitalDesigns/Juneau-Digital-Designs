"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { useInView, useReducedMotion } from "framer-motion";
import {
    Archive,
    ArrowCounterClockwise,
    ArrowLeft,
    ArrowSquareOut,
    CaretDown,
    CaretRight,
    ChartPieSlice,
    ChatCircle,
    CreditCard,
    Envelope,
    Gauge,
    Gear,
    Lifebuoy,
    MagnifyingGlass,
    Pause,
    PhoneCall,
    Play,
    Plus,
    Question,
    Star,
    Tray,
    TrendUp,
    Users,
} from "@phosphor-icons/react";
import {
    CARRIER_LINE,
    DEMO_ARCHIVED_COUNT,
    DEMO_BOARD,
    DEMO_BUSINESS,
    DEMO_COLLAPSED,
    DEMO_INBOX,
    DEMO_LEAD,
    DEMO_REVIEW,
    DEMO_SMS,
    DEMO_STEPS,
    DEMO_TIMES,
    type DemoCard,
    type WorkingStage,
} from "@/app/data/portal-demo";
import s from "./PortalDemo.module.css";

/**
 * The portal section's visual: a short film of the real client portal.
 *
 * A lead lands in the Inbox and is opened, promoted to a customer, moved down the pipeline,
 * texted, and asked for a review. It sits under the phone film (`SiteToCallPanel`) and picks up
 * its story: same business, same 2 AM call.
 *
 * One-to-one with the product, not nicer than it:
 *   - The markup is copied from the live components (InboxSection as merged in #52 with grouped
 *     repeat callers and Archive, CustomersSection, CustomerRecord's page variant, the review
 *     composer) and sits inside the real `.portal-scope`, so it wears the portal's own tokens and
 *     fonts and stays light on the dark page, as the portal does. It imports none of them: they
 *     need Clerk and account data.
 *   - What happens is what the product does. Promote opens the customer record, with the call
 *     pinned open at the top. Stage moves write "Moved to …" into the timeline. Sending a review
 *     request changes the button and adds no timeline row, because the product adds none.
 *   - The two customer-facing features carry the carrier line under their captions.
 *
 * How it plays:
 *   - The canvas is a fixed 1160 × 820 desktop portal. A camera (one CSS transform) frames
 *     whatever is being done, so a 390px frame zooms tighter rather than shrinking the portal
 *     to unreadable. Framing is measured from the elements themselves (`data-f`), never from
 *     hard-coded coordinates.
 *   - Plays once when half of it is in view. Each step can be picked, and replays from its own
 *     starting state, which every step can rebuild (`STEP_START`).
 *   - Reduced motion never autoplays: each step shows its finished frame, and the camera cuts.
 */

/* ── the world the film draws ───────────────────────────────────────────── */

type Stage = WorkingStage | "won" | "lost";

interface Ev {
    id: string;
    kind: "call" | "sms" | "stage";
    summary: string;
    detail?: string;
    time: string;
}

interface World {
    tab: "calls" | "customers";
    view: "inbox" | "board" | "record";
    leadIn: boolean;
    leadRead: boolean;
    hoverRow: string | null;
    drawer: null | "lead" | "review";
    promoting: boolean;
    stage: Stage;
    timeline: Ev[];
    /** The newest timeline row, which gets the entrance animation when it mounts. */
    enterEv: string | null;
    composer: string;
    focus: boolean;
    sending: boolean;
    reviewSending: boolean;
    reviewSent: boolean;
    lift: boolean;
    overCol: WorkingStage | null;
}

const BASE: World = {
    tab: "calls",
    view: "inbox",
    leadIn: false,
    leadRead: false,
    hoverRow: null,
    drawer: null,
    promoting: false,
    stage: "lead",
    timeline: [],
    enterEv: null,
    composer: "",
    focus: false,
    sending: false,
    reviewSending: false,
    reviewSent: false,
    lift: false,
    overCol: null,
};

const STAGES: { key: Stage; label: string; color: string }[] = [
    { key: "lead", label: "Lead", color: "var(--chart-neutral)" },
    { key: "contacted", label: "Contacted", color: "var(--accent)" },
    { key: "quoted", label: "Quoted", color: "var(--chart-series-2)" },
    { key: "scheduled", label: "Scheduled", color: "var(--chart-warn)" },
    { key: "won", label: "Won", color: "var(--chart-pos)" },
    { key: "lost", label: "Lost", color: "var(--chart-neg)" },
];
type Move = "contacted" | "quoted" | "scheduled";
const MOVES: Move[] = ["contacted", "quoted", "scheduled"];
const label = (k: Stage) => STAGES.find((x) => x.key === k)!.label;

const EV_ADDED: Ev = { id: "added", kind: "call", summary: "Added to your customers from your inbox", time: DEMO_TIMES.added };
const evMove = (k: Move): Ev => ({ id: `m-${k}`, kind: "stage", summary: `Moved to ${label(k)}`, time: DEMO_TIMES[k] });
const EV_SMS: Ev = { id: "sms", kind: "sms", summary: "You texted them", detail: DEMO_SMS, time: DEMO_TIMES.texted };

/* Where each step begins, and where it ends. Built from one another so they cannot drift. */
const AFTER_INBOX: World = { ...BASE, leadIn: true, leadRead: true, drawer: "lead" };
const AFTER_PROMOTE: World = { ...AFTER_INBOX, drawer: null, tab: "customers", view: "record", timeline: [EV_ADDED] };
const AFTER_PIPELINE: World = {
    ...AFTER_PROMOTE,
    stage: "scheduled",
    timeline: [...MOVES.map(evMove).reverse(), EV_ADDED],
};
const AFTER_MESSAGE: World = { ...AFTER_PIPELINE, timeline: [EV_SMS, ...AFTER_PIPELINE.timeline] };
const AFTER_REVIEW: World = { ...AFTER_MESSAGE, reviewSent: true };

const STEP_START: World[] = [BASE, AFTER_INBOX, { ...AFTER_PROMOTE, view: "board" }, AFTER_PIPELINE, AFTER_MESSAGE];
const STEP_END: World[] = [AFTER_INBOX, AFTER_PROMOTE, AFTER_PIPELINE, AFTER_MESSAGE, AFTER_REVIEW];

/* ── camera framing ─────────────────────────────────────────────────────── */

/** An element by its `data-f`, optionally cropped to a width or height (from its top-left, or
 *  from its top-right with `right`). */
type Focus = { f: string; w?: number; h?: number; right?: boolean };
/** What to frame: one list for a normal frame, one for a narrow (<480px) frame. */
type Shot = "all" | { wide: Focus[]; narrow?: Focus[]; pad?: number };

const V = { w: 1160, h: 820 };
const NARROW = 480;

const SHOT = {
    inboxList: { wide: [{ f: "inbox-list" }], narrow: [{ f: "row-robert", w: 430 }, { f: "row-linda", w: 430 }], pad: 18 },
    leadBody: { wide: [{ f: "leadbody" }], narrow: [{ f: "leadbody", h: 360 }], pad: 10 },
    leadPromote: { wide: [{ f: "leadbody" }], narrow: [{ f: "said" }, { f: "promote-wrap" }], pad: 10 },
    recordTop: { wide: [{ f: "rhead" }, { f: "origin" }], narrow: [{ f: "rhead", w: 390 }, { f: "origin", w: 390 }], pad: 14 },
    board: { wide: [{ f: "board" }], narrow: [{ f: "col-lead" }, { f: "col-contacted" }], pad: 16 },
    recordStage: { wide: [{ f: "rhead" }, { f: "timeline" }], narrow: [{ f: "timeline", w: 400 }], pad: 14 },
    composer: { wide: [{ f: "timeline" }, { f: "composer" }], narrow: [{ f: "timeline", w: 410 }, { f: "composer", w: 410 }], pad: 12 },
    /* A narrow frame cannot hold the whole composer: pan right to Send before it is tapped. */
    composerSend: { wide: [{ f: "timeline" }, { f: "composer" }], narrow: [{ f: "timeline", w: 410, right: true }, { f: "composer", w: 410, right: true }], pad: 12 },
    recordHead: { wide: [{ f: "rhead" }], narrow: [{ f: "rhead", w: 400, right: true }], pad: 14 },
    review: { wide: [{ f: "reviewbody" }], narrow: [{ f: "reviewbody" }], pad: 12 },
} satisfies Record<string, Shot>;

const END_SHOT: Shot[] = [SHOT.leadBody, SHOT.recordTop, SHOT.recordStage, SHOT.composer, SHOT.recordHead];

/* ── component ──────────────────────────────────────────────────────────── */

type Run = "idle" | "playing" | "paused" | "done";

export default function PortalDemo() {
    const reduce = !!useReducedMotion();
    const rootRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const inView = useInView(rootRef, { once: true, amount: 0.5 });

    const [world, setWorld] = useState<World>(BASE);
    const [step, setStep] = useState(0);
    const [run, setRun] = useState<Run>("idle");
    /** Set once anyone has played, paused or picked a step, so autoplay never overrides them. */
    const touched = useRef(false);

    /** Cuts every camera and drawer move to zero for a frame, when a step is rebuilt or the
     *  frame resizes. A class on the root rather than state, so it needs no render. */
    const cut = useCallback((on: boolean) => {
        rootRef.current?.classList.toggle(s.instant, on);
    }, []);
    /** Bumped by every run, so a step's progress bar restarts when the step does. */
    const [runId, setRunId] = useState(0);

    const token = useRef(0);
    const lastShot = useRef<Shot>("all");

    /* Commit synchronously, so the very next line can measure what was just drawn. */
    const commit = useCallback((patch: Partial<World> | ((w: World) => Partial<World>)) => {
        flushSync(() => setWorld((w) => ({ ...w, ...(typeof patch === "function" ? patch(w) : patch) })));
    }, []);

    const rectOf = useCallback((focus: Focus) => {
        const canvas = canvasRef.current;
        const node = canvas?.querySelector<HTMLElement>(`[data-f="${focus.f}"]`);
        if (!canvas || !node) return null;
        const c = canvas.getBoundingClientRect();
        const r = node.getBoundingClientRect();
        // The scale actually on screen right now, which mid-transition is not the target, and
        // which includes any transform on the page around the demo (the section's reveal).
        const k = c.width / V.w || 1;
        const full = r.width / k;
        const w = focus.w ?? full;
        return {
            x: (r.left - c.left) / k + (focus.right ? full - w : 0),
            y: (r.top - c.top) / k,
            w,
            h: focus.h ?? r.height / k,
        };
    }, []);

    const look = useCallback(
        (shot: Shot) => {
            const vp = viewportRef.current;
            const canvas = canvasRef.current;
            if (!vp || !canvas) return;
            lastShot.current = shot;
            const F = { w: vp.clientWidth, h: vp.clientHeight };
            if (!F.w || !F.h) return;
            const fit = Math.min(F.w / V.w, F.h / V.h);

            let R = { x: 0, y: 0, w: V.w, h: V.h };
            let pad = 0;
            if (shot !== "all") {
                const list = F.w < NARROW && shot.narrow ? shot.narrow : shot.wide;
                const rs = list.map(rectOf).filter((r): r is NonNullable<typeof r> => r !== null);
                if (rs.length) {
                    const x = Math.min(...rs.map((r) => r.x));
                    const y = Math.min(...rs.map((r) => r.y));
                    R = { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
                }
                pad = shot.pad ?? 24;
            }
            const maxZoom = F.w < NARROW ? 0.92 : 1;
            const k = shot === "all" ? fit : Math.max(fit, Math.min(F.w / (R.w + pad * 2), F.h / (R.h + pad * 2), maxZoom));

            let x = F.w / 2 - (R.x + R.w / 2) * k;
            let y = F.h / 2 - (R.y + R.h / 2) * k;
            x = V.w * k < F.w ? (F.w - V.w * k) / 2 : Math.min(0, Math.max(F.w - V.w * k, x));
            y = V.h * k < F.h ? (F.h - V.h * k) / 2 : Math.min(0, Math.max(F.h - V.h * k, y));
            canvas.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
            // Hidden until it has been framed once, so no unframed first paint shows.
            canvas.dataset.ready = "true";

            // The cursor lives in the canvas, so it scales with the camera. Counter-scale it to
            // stay a readable size in a wide shot.
            const arrow = cursorRef.current?.firstElementChild as HTMLElement | null;
            if (arrow) {
                const px = `${22 / Math.max(k, 0.55)}px`;
                arrow.style.width = px;
                arrow.style.height = px;
            }
        },
        [rectOf],
    );

    const pointAt = useCallback(
        (f: string, ox = 0.5, oy = 0.5) => {
            const r = rectOf({ f });
            const cur = cursorRef.current;
            if (!r || !cur) return;
            cur.style.opacity = "1";
            cur.style.left = `${r.x + r.w * ox}px`;
            cur.style.top = `${r.y + r.h * oy}px`;
        },
        [rectOf],
    );
    const hideCursor = useCallback(() => {
        if (cursorRef.current) cursorRef.current.style.opacity = "0";
    }, []);

    /** Clears what a run cancelled mid-drag can leave behind: the card's FLIP transform and
     *  a pressed cursor. Both are set on the DOM directly, so no render clears them. */
    const settle = useCallback(() => {
        const card = canvasRef.current?.querySelector<HTMLElement>('[data-flip="me"]');
        if (card) {
            card.style.transition = "";
            card.style.transform = "";
        }
        cursorRef.current?.setAttribute("data-down", "false");
        cursorRef.current?.setAttribute("data-click", "false");
    }, []);

    /* ── the script ──────────────────────────────────────────────────────── */

    const play = useCallback(
        async (from: number) => {
            const my = ++token.current;
            /** Every pause in the script. Rejects once anything newer has started. */
            const wait = (ms: number) =>
                new Promise<void>((res, rej) =>
                    setTimeout(() => (my === token.current ? res() : rej(new Error("cancelled"))), ms),
                );
            /** A frame for layout and transitions to start from; timer-backed so a background tab cannot stall it. */
            const frame = () =>
                new Promise<void>((res, rej) => {
                    let done = false;
                    const go = () => {
                        if (done) return;
                        done = true;
                        if (my === token.current) res();
                        else rej(new Error("cancelled"));
                    };
                    requestAnimationFrame(() => requestAnimationFrame(go));
                    setTimeout(go, 60);
                });
            const click = async () => {
                const cur = cursorRef.current;
                cur?.setAttribute("data-down", "true");
                cur?.setAttribute("data-click", "true");
                await wait(160);
                cur?.setAttribute("data-down", "false");
                await wait(260);
                cur?.setAttribute("data-click", "false");
            };
            const moveCard = async (k: WorkingStage) => {
                const canvas = canvasRef.current!;
                const before = canvas.querySelector('[data-flip="me"]')?.getBoundingClientRect();
                commit({ stage: k, overCol: k });
                const node = canvas.querySelector<HTMLElement>('[data-flip="me"]');
                if (!before || !node) return;
                const after = node.getBoundingClientRect();
                const c = canvas.getBoundingClientRect();
                const scale = c.width / V.w || 1;
                // Aim the cursor at where the card lands, measured now: once the card is
                // animating, measuring it returns where it is mid-flight, not where it goes.
                const cur = cursorRef.current;
                if (cur) {
                    cur.style.left = `${(after.left - c.left + after.width * 0.5) / scale}px`;
                    cur.style.top = `${(after.top - c.top + after.height * 0.4) / scale}px`;
                }
                node.style.transition = "none";
                node.style.transform = `translate(${(before.left - after.left) / scale}px, ${(before.top - after.top) / scale}px) rotate(1.5deg)`;
                await frame();
                node.style.transition = "transform .7s cubic-bezier(.65,0,.35,1)";
                node.style.transform = "rotate(1.5deg)";
                await wait(720);
            };
            const narrow = () => (viewportRef.current?.clientWidth ?? 999) < NARROW;

            const SCRIPT: (() => Promise<void>)[] = [
                // 1 · a new lead lands, and is opened
                async () => {
                    look("all");
                    hideCursor();
                    await wait(900);
                    commit({ leadIn: true });
                    await wait(1100);
                    look(SHOT.inboxList);
                    await wait(1100);
                    pointAt("row-robert", 0.3);
                    await wait(800);
                    commit({ hoverRow: "robert" });
                    await click();
                    commit({ leadRead: true, drawer: "lead", hoverRow: null });
                    await wait(300);
                    look(SHOT.leadBody);
                    await wait(2400);
                },
                // 2 · promoted: the record opens with the call pinned, then back to the board
                async () => {
                    look(SHOT.leadPromote);
                    await wait(600);
                    pointAt("promote");
                    await wait(900);
                    await click();
                    commit({ promoting: true });
                    await wait(700);
                    commit({ promoting: false, drawer: null, tab: "customers", view: "record", timeline: [EV_ADDED], enterEv: EV_ADDED.id });
                    await frame();
                    look(SHOT.recordTop);
                    await wait(2600);
                    pointAt("back");
                    await wait(900);
                    await click();
                },
                // 3 · Lead → Contacted → Quoted → Scheduled on the board, then opened
                async () => {
                    look(SHOT.board);
                    await wait(1100);
                    pointAt("card-robert", 0.5, 0.4);
                    await wait(900);
                    cursorRef.current?.setAttribute("data-down", "true");
                    commit({ lift: true });
                    await wait(350);
                    let prev: WorkingStage = "lead";
                    for (const k of MOVES) {
                        if (narrow()) look({ wide: SHOT.board.wide, narrow: [{ f: `col-${prev}` }, { f: `col-${k}` }], pad: 16 });
                        await moveCard(k);
                        await wait(450);
                        commit((w) => ({ timeline: [evMove(k), ...w.timeline] }));
                        prev = k;
                    }
                    const card = canvasRef.current?.querySelector<HTMLElement>('[data-flip="me"]');
                    if (card) card.style.transform = "";
                    commit({ lift: false, overCol: null });
                    cursorRef.current?.setAttribute("data-down", "false");
                    await wait(700);
                    await click();
                    commit({ view: "record", enterEv: null });
                    await frame();
                    look(SHOT.recordStage);
                    await wait(1800);
                },
                // 4 · a text from the record
                async () => {
                    look(SHOT.composer);
                    await wait(900);
                    pointAt("textarea", 0.3);
                    await wait(900);
                    await click();
                    commit({ focus: true });
                    await wait(300);
                    for (let i = 1; i <= DEMO_SMS.length; i++) {
                        commit({ composer: DEMO_SMS.slice(0, i) });
                        await wait(24);
                    }
                    await wait(300);
                    look(SHOT.composerSend);
                    await wait(500);
                    pointAt("send");
                    await wait(800);
                    await click();
                    commit({ sending: true });
                    await wait(650);
                    commit((w) => ({ sending: false, composer: "", focus: false, timeline: [EV_SMS, ...w.timeline], enterEv: EV_SMS.id }));
                    await wait(2400);
                },
                // 5 · the review request
                async () => {
                    look(SHOT.recordHead);
                    await wait(900);
                    pointAt("reviewbtn");
                    await wait(900);
                    await click();
                    commit({ drawer: "review" });
                    await wait(300);
                    look(SHOT.review);
                    await wait(2200);
                    pointAt("sendreview");
                    await wait(900);
                    await click();
                    commit({ reviewSending: true });
                    await wait(700);
                    commit({ reviewSending: false, drawer: null, reviewSent: true });
                    await wait(250);
                    look(SHOT.recordHead);
                    pointAt("reviewbtn", 0.5, 1.7);
                    await wait(2600);
                },
            ];

            try {
                setRunId(my);
                setRun("playing");
                setStep(from);
                cut(true);
                commit({ ...STEP_START[from], enterEv: null });
                settle();
                look(from === 0 ? "all" : END_SHOT[from - 1]);
                await frame();
                cut(false);
                for (let i = from; i < SCRIPT.length; i++) {
                    setStep(i);
                    await SCRIPT[i]();
                }
                setRun("done");
            } catch {
                // Cancelled by a newer run, a pause or an unmount. Whoever cancelled owns the state.
            }
        },
        [commit, cut, hideCursor, look, pointAt, settle],
    );

    /** The finished frame of a step, with no motion. Reduced motion only ever shows these. */
    const show = useCallback(
        (i: number) => {
            token.current++;
            cut(true);
            setStep(i);
            setRun(i === DEMO_STEPS.length - 1 ? "done" : "paused");
            commit({ ...STEP_END[i], enterEv: null });
            settle();
            hideCursor();
            look(END_SHOT[i]);
            requestAnimationFrame(() => cut(false));
        },
        [commit, cut, hideCursor, look, settle],
    );

    // First framing, once the frame has a size. Nothing plays from here.
    useEffect(() => {
        const id = requestAnimationFrame(() => (reduce ? show(0) : look("all")));
        return () => cancelAnimationFrame(id);
    }, [reduce, look, show]);

    // Plays once, the first time it is mostly on screen. Reduced motion never autoplays.
    // Started from a task, not from the effect itself: the script commits with `flushSync`,
    // which React refuses while it is still committing this render.
    useEffect(() => {
        if (!inView || reduce) return;
        const id = setTimeout(() => {
            if (!touched.current) void play(0);
        }, 0);
        return () => clearTimeout(id);
    }, [inView, reduce, play]);

    // Anything still running stops with the component.
    useEffect(
        () => () => {
            token.current++;
        },
        [],
    );

    // Keep the framing right when the column changes width (rotation, window drag).
    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => {
            cut(true);
            look(lastShot.current);
            requestAnimationFrame(() => cut(false));
        });
        ro.observe(vp);
        return () => ro.disconnect();
    }, [cut, look]);

    function onPlayButton() {
        touched.current = true;
        if (reduce) return show(Math.min(step + 1, DEMO_STEPS.length - 1));
        if (run === "playing") {
            token.current++;
            setRun("paused");
            return;
        }
        void play(run === "done" ? 0 : step);
    }
    function onStep(i: number) {
        touched.current = true;
        if (reduce) show(i);
        else void play(i);
    }

    const current = DEMO_STEPS[step];
    const playLabel = reduce ? "Next step" : run === "playing" ? "Pause" : run === "done" ? "Replay" : "Play";

    return (
        <div ref={rootRef} className={`${s.demo} ${reduce ? s.reduced : ""}`}>
            {/* The film is decorative: the caption below says what each frame shows, and is
                what a screen reader gets. Nothing in the window is focusable. */}
            <div className={s.window} aria-hidden="true">
                <div className={s.chrome}>
                    <span className={s.dots}>
                        <i />
                        <i />
                        <i />
                    </span>
                    <span className={s.url}>juneaudigitaldesigns.com/portal</span>
                    <span className={s.chromeSpacer} />
                </div>
                <div ref={viewportRef} className={s.viewport}>
                    <div ref={canvasRef} className={s.canvas}>
                        {/* `minHeight: 0` undoes the scope's full-viewport rule; the inline style
                            is what beats the unlayered `.portal-scope` block. */}
                        <div className={`portal-scope ${s.portal}`} style={{ minHeight: 0 }}>
                            <Rail tab={world.tab} />
                            <main className={s.stage}>
                                {world.view === "inbox" ? (
                                    <InboxView w={world} />
                                ) : world.view === "board" ? (
                                    <BoardView w={world} />
                                ) : (
                                    <RecordView w={world} />
                                )}
                            </main>
                            <div className={s.backdrop} data-open={world.drawer !== null} />
                            <div className={s.drawer} data-open={world.drawer !== null} data-width={world.drawer === "review" ? "md" : "lg"}>
                                {world.drawer === "review" ? <ReviewDrawer w={world} /> : <LeadDrawer w={world} />}
                            </div>
                            <div ref={cursorRef} className={s.cursor}>
                                <svg className={s.arrow} viewBox="0 0 24 24">
                                    <path
                                        d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.5 L14.4 20.3 L11.5 13.7 L17.8 13.7 Z"
                                        fill="#0d1117"
                                        stroke="#fff"
                                        strokeWidth="1.4"
                                        strokeLinejoin="round"
                                    />
                                </svg>
                                <span className={s.ring} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className={s.caption} aria-live="polite">
                <div className={s.stepLabel}>
                    <span>
                        Step {step + 1} of {DEMO_STEPS.length} · {current.short}
                    </span>
                    <span className={s.plan} data-growth={current.plan === "Growth"}>
                        {current.plan}
                    </span>
                </div>
                <p className={s.line}>{current.caption}</p>
                {current.gated && <p className={s.gate}>{CARRIER_LINE}</p>}
            </div>

            <div className={s.controls}>
                <button type="button" className={s.play} onClick={onPlayButton} aria-label={playLabel} title={playLabel}>
                    {reduce ? (
                        <CaretRight size={16} weight="bold" />
                    ) : run === "playing" ? (
                        <Pause size={16} weight="fill" />
                    ) : run === "done" ? (
                        <ArrowCounterClockwise size={16} weight="bold" />
                    ) : (
                        <Play size={16} weight="fill" />
                    )}
                </button>
                <div className={s.steps} role="group" aria-label="Demo steps">
                    {DEMO_STEPS.map((st, i) => {
                        const state =
                            i < step ? "done" : i > step ? "empty" : run === "playing" ? "running" : run === "idle" ? "empty" : "full";
                        return (
                            <button
                                key={st.key}
                                type="button"
                                className={s.step}
                                aria-current={i === step ? "step" : undefined}
                                aria-label={`Step ${i + 1}: ${st.short}`}
                                onClick={() => onStep(i)}
                            >
                                <b>{i + 1}</b>
                                <span className={s.stepName}>{st.short}</span>
                                <i
                                    // Keyed on the run so the bar restarts with the step.
                                    key={`${i}-${state}-${runId}`}
                                    className={s.bar}
                                    data-state={state}
                                    style={state === "running" ? { animationDuration: `${st.ms}ms` } : undefined}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ── the replica ────────────────────────────────────────────────────────────
   Classes and inline styles are copied from the live components so the two read the same.
   The live ones switch layouts on viewport breakpoints (`md:`, `lg:`); the canvas is always a
   desktop, so only their desktop values appear here. */

function Rail({ tab }: { tab: World["tab"] }) {
    const tabs = [
        { id: "overview", label: "Overview", Icon: ChartPieSlice },
        { id: "calls", label: "Inbox", Icon: Tray },
        { id: "customers", label: "Customers", Icon: Users },
        { id: "traffic", label: "Traffic", Icon: TrendUp },
        { id: "performance", label: "Performance", Icon: Gauge },
        { id: "billing", label: "Billing", Icon: CreditCard },
        { id: "settings", label: "Settings", Icon: Gear },
        { id: "support", label: "Support", Icon: Lifebuoy },
    ];
    return (
        <aside className={s.rail}>
            <span className="portal-brand">
                <Image src="/jdd-lockup-portal.png" alt="" width={640} height={192} />
            </span>
            <div className="portal-brand-label">Client Portal</div>
            <div className="min-w-0">
                <span
                    className="block truncate font-bold"
                    style={{ fontFamily: "var(--font-display)", fontSize: "20px", lineHeight: 1.15, letterSpacing: "var(--tracking-tight)" }}
                >
                    {DEMO_BUSINESS.name}
                </span>
                <span
                    className="mt-0.5 inline-flex items-center gap-1 text-xs truncate max-w-full"
                    style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                >
                    <span className="truncate">{DEMO_BUSINESS.host}</span>
                    <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
                </span>
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <span
                        className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                    >
                        Growth
                    </span>
                </div>
            </div>
            <nav className="portal-rail-nav">
                {tabs.map(({ id, label: l, Icon }) => (
                    <span key={id} className={`portal-rail-link${tab === id ? " is-active" : ""}`} data-f={`nav-${id}`}>
                        <Icon size={17} weight={tab === id ? "fill" : "regular"} className="shrink-0" />
                        <span className="truncate">{l}</span>
                    </span>
                ))}
            </nav>
            <div className="portal-rail-foot" style={{ flexDirection: "column", gap: "10px", alignItems: "stretch" }}>
                <span className="portal-rail-link">
                    <Question size={17} className="shrink-0" />
                    <span className="truncate">Help &amp; tour</span>
                </span>
            </div>
        </aside>
    );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "pos" }) {
    return (
        <span
            className="text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
                fontFamily: "var(--font-mono)",
                background: tone === "pos" ? "rgba(22,163,74,0.1)" : "var(--surface)",
                color: tone === "pos" ? "var(--chart-pos)" : "var(--fg-2)",
            }}
        >
            {children}
        </span>
    );
}

function RowButton({ children }: { children: React.ReactNode }) {
    return (
        <span className="shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center" style={{ color: "var(--fg-3)" }}>
            {children}
        </span>
    );
}

function SectionTitle({ title, meta }: { title: string; meta: string }) {
    return (
        <div className="min-w-0">
            <h1 className="font-bold" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-3xl)", letterSpacing: "var(--tracking-tight)" }}>
                {title}
            </h1>
            <span className="text-xs block mt-1" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                {meta}
            </span>
        </div>
    );
}

function Segmented({ items, on }: { items: string[]; on: string }) {
    return (
        <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}>
            {items.map((f) => (
                <span
                    key={f}
                    className="px-3.5 py-1.5 text-xs uppercase tracking-wide"
                    style={{
                        fontFamily: "var(--font-mono)",
                        background: f === on ? "var(--accent)" : "transparent",
                        color: f === on ? "var(--on-accent)" : "var(--fg-3)",
                    }}
                >
                    {f}
                </span>
            ))}
        </div>
    );
}

function InboxView({ w }: { w: World }) {
    const rows = [
        ...(w.leadIn
            ? [{ id: "robert", name: DEMO_LEAD.name, unread: !w.leadRead, preview: DEMO_LEAD.preview, tag: `Call · ${DEMO_LEAD.duration}`, time: "now", web: false, count: 1 }]
            : []),
        ...DEMO_INBOX,
    ];
    const unread = rows.filter((r) => r.unread).length;
    const toWork = rows.reduce((n, r) => n + (r.count ?? 1), 0);
    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <SectionTitle title="Inbox" meta={`${unread} new · ${toWork} to work`} />
                <Segmented items={["all", "unread", "calls", "forms", `archived · ${DEMO_ARCHIVED_COUNT}`]} on="all" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 max-w-md" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}>
                <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                    Search name, number, or message…
                </span>
            </div>
            <div className="portal-elev overflow-hidden" data-f="inbox-list">
                {rows.map((r, i) => {
                    const grouped = (r.count ?? 1) > 1;
                    return (
                        <div
                            key={r.id}
                            data-f={`row-${r.id}`}
                            className={r.id === "robert" && w.leadIn && !w.leadRead ? s.rowEnter : undefined}
                            style={{ borderTop: i === 0 ? undefined : "1px solid var(--rule)" }}
                        >
                            <div
                                className={`flex items-center transition-colors ${w.hoverRow === r.id ? s.hover : ""}`}
                                style={{ background: r.unread ? "rgba(37,99,235,0.025)" : undefined }}
                            >
                                <div className="flex-1 min-w-0 flex flex-nowrap items-center gap-x-3 px-4 py-3.5">
                                    <span className="shrink-0 rounded-full" style={{ width: 7, height: 7, background: r.unread ? "var(--accent)" : "transparent" }} />
                                    <span
                                        className="shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center"
                                        style={{ background: r.web ? "rgba(37,99,235,0.1)" : "var(--surface)", color: r.web ? "var(--accent)" : "var(--fg-3)" }}
                                    >
                                        {r.web ? <Envelope size={15} /> : <PhoneCall size={15} />}
                                    </span>
                                    <span className="shrink-0 max-w-[132px] truncate text-sm" style={{ color: "var(--fg)", fontWeight: r.unread ? 700 : 600 }}>
                                        {r.name}
                                    </span>
                                    {grouped && (
                                        <span
                                            className="shrink-0 text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
                                            style={{ fontFamily: "var(--font-mono)", background: "rgba(22,163,74,0.12)", color: "var(--chart-pos)" }}
                                        >
                                            {r.count} calls
                                        </span>
                                    )}
                                    <span className="flex-1 min-w-0 truncate text-[13px]" style={{ color: r.unread ? "var(--fg-2)" : "var(--fg-3)" }}>
                                        {r.preview}
                                    </span>
                                    {!grouped && r.tag && (
                                        <span className="shrink-0 flex gap-1.5">
                                            <Tag>{r.tag}</Tag>
                                        </span>
                                    )}
                                    <span className="shrink-0 w-[72px] text-right text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                        {r.time}
                                    </span>
                                </div>
                                <span className="shrink-0 flex items-center gap-1 pr-3 pl-1">
                                    <RowButton>
                                        <Archive size={14} />
                                    </RowButton>
                                    {grouped && (
                                        <RowButton>
                                            <CaretDown size={14} />
                                        </RowButton>
                                    )}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function DrawerHead({ title }: { title: string }) {
    return (
        <div className="flex items-center justify-between gap-4 px-5 border-b py-4" style={{ borderColor: "var(--rule)" }}>
            <h2 className="text-base font-semibold truncate" style={{ fontFamily: "var(--font-display)" }}>
                {title}
            </h2>
            <span className="shrink-0 w-8 h-8 rounded flex items-center justify-center" style={{ color: "var(--fg-2)", background: "var(--surface)" }}>
                ✕
            </span>
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-xs uppercase tracking-widest" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
            {children}
        </p>
    );
}

function Fact({ label: l, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                {l}
            </div>
            <div className="text-sm" style={{ color: "var(--fg)" }}>
                {children}
            </div>
        </div>
    );
}

function LeadDrawer({ w }: { w: World }) {
    return (
        <>
            <DrawerHead title={DEMO_LEAD.name} />
            <div className="px-5 py-5 space-y-6" data-f="leadbody">
                <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                    {DEMO_LEAD.receivedAt} · phone call
                </p>
                <section className="space-y-2.5" data-f="said">
                    <Label>What was said</Label>
                    <div className="rounded-xl border p-4 text-sm leading-relaxed" style={{ background: "var(--bg)", borderColor: "var(--rule)" }}>
                        {DEMO_LEAD.preview}
                    </div>
                </section>
                <section className="space-y-2.5">
                    <Label>Recording</Label>
                    <div className={s.audio}>{DEMO_LEAD.recording}</div>
                </section>
                <section className="space-y-2.5">
                    <Label>Contact details</Label>
                    <div className="grid grid-cols-2 gap-4">
                        <Fact label="Phone">
                            <span style={{ color: "var(--accent)" }}>{DEMO_LEAD.phone}</span>
                        </Fact>
                        <Fact label="Email">—</Fact>
                        <Fact label="Source">Phone call</Fact>
                        <Fact label="Received">{DEMO_LEAD.receivedAt}</Fact>
                    </div>
                </section>
                <div className="pt-1" data-f="promote-wrap">
                    <span
                        data-f="promote"
                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-opacity"
                        style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: w.promoting ? 0.6 : 1 }}
                    >
                        <Plus size={15} weight="bold" />
                        {w.promoting ? "Adding…" : "Promote to customer"}
                    </span>
                    <p className="mt-2 text-xs text-center leading-relaxed" style={{ color: "var(--fg-3)" }}>
                        Creates a customer record with this enquiry already attached.
                    </p>
                </div>
                <div className="pt-1">
                    <span
                        className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        <Archive size={15} /> Archive
                    </span>
                </div>
            </div>
        </>
    );
}

function Chip({ children, count }: { children: React.ReactNode; count?: number }) {
    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px]"
            style={{ background: "var(--elev-1)", color: "var(--fg-2)", borderColor: "var(--rule-strong)" }}
        >
            {children}
            {count !== undefined && count > 0 && (
                <span className="text-[10.5px] opacity-75" style={{ fontFamily: "var(--font-mono)" }}>
                    {count}
                </span>
            )}
        </span>
    );
}

function BoardCard({ c, me, lift }: { c: DemoCard; me?: boolean; lift?: boolean }) {
    return (
        <article
            data-f={`card-${c.id}`}
            data-flip={me ? "me" : undefined}
            className={`rounded-xl border p-3 ${lift ? s.lift : ""}`}
            style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
        >
            <div className="flex items-center gap-1.5 font-semibold text-[13.5px]" style={{ color: "var(--fg)" }}>
                {c.stale && <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: "var(--chart-warn)" }} />}
                <span className="truncate">{c.name}</span>
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                {c.phone}
            </div>
            {c.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {c.tags.map((t) => (
                        <span key={t} className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: "var(--font-mono)", background: "var(--surface)", color: "var(--fg-2)" }}>
                            {t}
                        </span>
                    ))}
                </div>
            )}
            {c.note && (
                <p className="mt-2 text-[12px] pl-2 border-l line-clamp-2" style={{ color: "var(--fg-3)", borderColor: "var(--rule)" }}>
                    {c.note}
                </p>
            )}
        </article>
    );
}

function BoardView({ w }: { w: World }) {
    const me: DemoCard = { id: "robert", name: DEMO_LEAD.name, phone: DEMO_LEAD.phone, tags: [DEMO_LEAD.tag] };
    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <SectionTitle title="Customers" meta="5 active · 0 need a reply · 1 going stale" />
                <div className="flex items-center gap-2.5">
                    <span
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        <Plus size={13} weight="bold" /> Add customer
                    </span>
                    <Segmented items={["board", "table"]} on="board" />
                </div>
            </div>
            <div className="portal-elev p-4 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 min-w-[240px]" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}>
                    <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                    <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                        Search customers…
                    </span>
                </div>
                <Chip>Needs reply</Chip>
                <Chip count={1}>Going stale</Chip>
                <Chip>★ Review-ready</Chip>
                <Chip>Show archived</Chip>
            </div>
            <div className="flex gap-3 items-start" data-f="board">
                {STAGES.slice(0, 4).map((st) => {
                    const k = st.key as WorkingStage;
                    const mine = w.stage === k;
                    const list = DEMO_BOARD[k];
                    return (
                        <section key={k} data-f={`col-${k}`} className={`flex-1 min-w-[160px] rounded-xl p-1.5 transition-colors ${w.overCol === k ? s.colOver : ""}`}>
                            <div className="flex items-center gap-2 px-1.5 pb-2.5">
                                <span className="rounded-full" style={{ width: 8, height: 8, background: st.color }} />
                                <span className="font-bold text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
                                    {st.label}
                                </span>
                                <span className="ml-auto text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                    {list.length + (mine ? 1 : 0)}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2 min-h-[40px]">
                                {mine && <BoardCard c={me} me lift={w.lift} />}
                                {list.map((c) => (
                                    <BoardCard key={c.id} c={c} />
                                ))}
                            </div>
                        </section>
                    );
                })}
                {(["won", "lost"] as const).map((k) => {
                    const st = STAGES.find((x) => x.key === k)!;
                    return (
                        <div
                            key={k}
                            className="shrink-0 w-[58px] rounded-xl border flex flex-col items-center gap-2 py-2.5"
                            style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
                        >
                            <span className="rounded-full" style={{ width: 8, height: 8, background: st.color }} />
                            <span
                                className="font-bold text-[13px]"
                                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "var(--font-display)", color: "var(--fg-2)" }}
                            >
                                {st.label}
                            </span>
                            <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                {DEMO_COLLAPSED[k]}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* CustomerRecord's own tints: messages blue, calls green, everything else neutral. */
const TINT = {
    sms: { bg: "rgba(37,99,235,0.1)", fg: "var(--accent)", Icon: ChatCircle },
    call: { bg: "rgba(22,163,74,0.1)", fg: "var(--chart-pos)", Icon: PhoneCall },
    stage: { bg: "var(--surface)", fg: "var(--fg-2)", Icon: CaretRight },
};

function SmallLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] uppercase tracking-wider m-0" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
            {children}
        </p>
    );
}

function Field({ label: l, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[11px] mb-1" style={{ color: "var(--fg-2)" }}>
                {l}
            </div>
            <div className="w-full rounded-lg border px-2.5 py-1.5 text-[13.5px] min-h-[34px]" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}>
                {value}
            </div>
        </div>
    );
}

function Block({ children, first, last }: { children: React.ReactNode; first?: boolean; last?: boolean }) {
    return (
        <div className={`${first ? "pt-4" : "pt-5"} pb-5 min-w-0`} style={{ borderBottom: last ? undefined : "1px solid var(--rule-weak)" }}>
            {children}
        </div>
    );
}

function RecordView({ w }: { w: World }) {
    return (
        <div className="min-w-0 rounded-2xl border overflow-hidden" style={{ background: "var(--elev-1)", borderColor: "var(--rule)" }}>
            <header className="px-7 pt-5 border-b" style={{ borderColor: "var(--rule)" }} data-f="rhead">
                <span className="inline-flex items-center gap-1.5 text-[12.5px] mb-3.5" style={{ color: "var(--accent)" }} data-f="back">
                    <ArrowLeft size={13} weight="bold" />
                    All customers
                </span>
                <div className="flex flex-wrap items-start gap-4">
                    <span
                        className="shrink-0 w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[15px] font-semibold"
                        style={{ background: "var(--surface)", color: "var(--fg-2)" }}
                    >
                        {DEMO_LEAD.initials}
                    </span>
                    <div className="flex-1 min-w-0" style={{ flexBasis: "280px" }}>
                        <h1 className="text-[22px] font-bold leading-tight m-0 mb-1 truncate" style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}>
                            {DEMO_LEAD.name}
                        </h1>
                        <p className="m-0 text-[13px] flex flex-wrap gap-x-2.5 gap-y-1" style={{ color: "var(--fg-2)" }}>
                            <span style={{ color: "var(--accent)" }}>{DEMO_LEAD.phone}</span>
                            <span>Customer since Today</span>
                        </p>
                    </div>
                    <div className="shrink-0 flex flex-wrap gap-2" data-f="ract">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium" style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--fg)" }}>
                            <PhoneCall size={14} /> Call
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium" style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--fg)" }}>
                            <ChatCircle size={14} /> Text
                        </span>
                        <span
                            data-f="reviewbtn"
                            className="inline-flex items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold"
                            style={{ minHeight: 44, background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            <Star size={14} weight="fill" />
                            {w.reviewSent ? "Review requested" : "Request a review"}
                        </span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-4 pb-3.5" data-f="stagerow">
                    <span className="text-[10px] uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                        Stage
                    </span>
                    <div className="flex flex-wrap rounded-lg overflow-hidden border" style={{ borderColor: "var(--rule-strong)" }}>
                        {STAGES.map((st) => {
                            const on = st.key === w.stage;
                            return (
                                <span
                                    key={st.key}
                                    className="px-3 inline-flex items-center gap-1.5 border-r last:border-r-0 transition-colors"
                                    style={{
                                        minHeight: 34,
                                        fontFamily: "var(--font-mono)",
                                        fontSize: 11,
                                        fontWeight: on ? 600 : 400,
                                        borderColor: "var(--rule)",
                                        background: on ? "var(--accent)" : "var(--elev-1)",
                                        color: on ? "var(--on-accent)" : "var(--fg-2)",
                                    }}
                                >
                                    {!on && <span className="portal-dot" style={{ width: 6, height: 6, background: st.color }} />}
                                    {st.label}
                                </span>
                            );
                        })}
                    </div>
                </div>
            </header>

            <div className="grid min-h-0 min-w-0 grid-cols-[340px_minmax(0,1fr)]">
                <div className="min-w-0 px-7 py-1 border-r" style={{ borderColor: "var(--rule)" }}>
                    <Block first>
                        <SmallLabel>Contact</SmallLabel>
                        <p className="mt-1.5 mb-2 text-[12px] leading-snug" style={{ color: "var(--fg-2)" }}>
                            Click a field to correct it.
                        </p>
                        <div className="flex flex-col gap-2.5 min-w-0">
                            <Field label="Name" value={DEMO_LEAD.name} />
                            <Field label="Phone" value={DEMO_LEAD.phone} />
                            <Field label="Email" value="" />
                            <Field label="Address" value={DEMO_LEAD.address} />
                            <div className="flex justify-between gap-3 pt-0.5 text-[13px]">
                                <span style={{ color: "var(--fg-2)" }}>Came from</span>
                                <span className="text-right" style={{ color: "var(--fg)" }}>
                                    Phone call
                                </span>
                            </div>
                        </div>
                    </Block>
                    <Block>
                        <SmallLabel>Job value</SmallLabel>
                        <div className="mt-2.5 w-full rounded-lg border px-2.5 py-1.5 text-[18px]" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg-3)" }}>
                            $0
                        </div>
                    </Block>
                    <Block last>
                        <SmallLabel>Tags</SmallLabel>
                        <div className="flex flex-wrap gap-1 mt-2.5">
                            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ fontFamily: "var(--font-mono)", background: "var(--surface)", color: "var(--fg-2)" }}>
                                {DEMO_LEAD.tag}
                            </span>
                        </div>
                    </Block>
                </div>

                <div className="flex flex-col min-w-0 min-h-0">
                    <article className="px-7 py-6 border-b min-w-0" style={{ borderColor: "var(--rule)" }} data-f="origin">
                        <div className="flex flex-wrap items-center gap-2.5 mb-3">
                            <span className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center" style={{ background: TINT.call.bg, color: TINT.call.fg }}>
                                <PhoneCall size={13} />
                            </span>
                            <h2 className="m-0 text-[14px] font-semibold flex-1 min-w-0" style={{ color: "var(--fg)" }}>
                                The call that started this customer
                            </h2>
                            <span className="text-[10.5px] shrink-0" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                                Nov 4 · {DEMO_LEAD.duration}
                            </span>
                        </div>
                        <p className="m-0 mb-3.5 text-[13.5px] leading-relaxed" style={{ color: "var(--fg-2)", maxWidth: "68ch" }}>
                            {DEMO_LEAD.summary}
                        </p>
                        <div className={s.audio} style={{ maxWidth: 520 }}>
                            {DEMO_LEAD.recording}
                        </div>
                    </article>

                    <div className="flex items-center gap-1.5 px-7 py-3.5 border-b flex-wrap" style={{ borderColor: "var(--rule)" }}>
                        {["all", "messages", "calls", "notes"].map((f) => (
                            <span
                                key={f}
                                className="px-2.5 py-1 rounded-full text-[11px] border capitalize"
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    background: f === "all" ? "var(--fg)" : "var(--elev-1)",
                                    color: f === "all" ? "var(--elev-1)" : "var(--fg-2)",
                                    borderColor: f === "all" ? "var(--fg)" : "var(--rule-strong)",
                                }}
                            >
                                {f}
                            </span>
                        ))}
                        <span className="ml-auto text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                            {w.timeline.length + 1} events
                        </span>
                    </div>

                    <div className="px-7 pb-5 flex-1 min-w-0" data-f="timeline">
                        <div className="flex items-center gap-2.5 mt-5 mb-2.5 text-[10px] uppercase tracking-wider" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                            Today
                            <span className="flex-1 h-px" style={{ background: "var(--rule)" }} />
                        </div>
                        {w.timeline.map((ev) => {
                            const t = TINT[ev.kind];
                            return (
                                <div key={ev.id} className={`w-full flex gap-3 items-start py-2.5 min-w-0 ${w.enterEv === ev.id ? s.evEnter : ""}`}>
                                    <span className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center" style={{ background: t.bg, color: t.fg }}>
                                        <t.Icon size={13} />
                                    </span>
                                    <span className="flex-1 min-w-0 pt-0.5">
                                        <span className="block text-[13.5px]" style={{ color: "var(--fg)" }}>
                                            {ev.summary}
                                        </span>
                                        {ev.detail && (
                                            <span className="block text-[12.5px] mt-1 truncate" style={{ color: "var(--fg-2)" }}>
                                                {ev.detail}
                                            </span>
                                        )}
                                    </span>
                                    <span className="shrink-0 text-[10.5px] pt-1" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                                        {ev.time}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="px-7 py-4 border-t min-w-0" style={{ borderColor: "var(--rule)" }} data-f="composer">
                        <div className="flex gap-2 items-end p-3 rounded-xl border min-w-0" style={{ background: "var(--bg)", borderColor: "var(--rule)" }}>
                            <div
                                data-f="textarea"
                                className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm min-h-[58px] transition-shadow ${w.focus ? s.focusRing : ""}`}
                                style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            >
                                {w.composer ? w.composer : !w.focus && <span style={{ color: "var(--fg-3)" }}>Text {DEMO_LEAD.name}…</span>}
                                {w.focus && <span className={s.caret} />}
                            </div>
                            <span
                                data-f="send"
                                className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity"
                                style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: w.composer && !w.sending ? 1 : 0.5 }}
                            >
                                {w.sending ? "Sending…" : "Send"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ReviewDrawer({ w }: { w: World }) {
    return (
        <>
            <DrawerHead title="Request a Google review" />
            <div className="px-5 py-5 space-y-5" data-f="reviewbody">
                <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                    To {DEMO_LEAD.name} · {DEMO_LEAD.phone} · sent from your business number
                </p>
                <div>
                    <Label>Message</Label>
                    <div className="mt-2 w-full text-sm rounded-lg border p-3 min-h-[132px] leading-relaxed" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}>
                        {DEMO_REVIEW}
                    </div>
                    <p className="mt-2 text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Your Google review link and “Reply STOP to opt out” are added automatically.
                    </p>
                </div>
                <span
                    data-f="sendreview"
                    className="block w-full text-center rounded-lg px-4 py-3 text-sm font-semibold transition-opacity"
                    style={{ background: "var(--accent)", color: "var(--on-accent)", opacity: w.reviewSending ? 0.6 : 1 }}
                >
                    {w.reviewSending ? "Sending…" : "Send review request"}
                </span>
            </div>
        </>
    );
}
