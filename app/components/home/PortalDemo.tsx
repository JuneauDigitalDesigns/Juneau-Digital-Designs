"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
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
    DEMO_CLOSING,
    DEMO_COLLAPSED,
    DEMO_INBOX,
    DEMO_LEAD,
    DEMO_REVIEW,
    DEMO_SMS,
    DEMO_STEPS,
    DEMO_TIMES,
    DEMO_TODAY,
    type DemoCard,
    type WorkingStage,
} from "@/app/data/portal-demo";
import s from "./PortalDemo.module.css";

/**
 * The portal section's visual: a short film of the real client portal.
 *
 * A lead lands in the Inbox and is opened, promoted to a customer, moved down the pipeline,
 * texted, and asked for a review. It sits under the phone film (`SiteToCallPanel`), whose 2 AM
 * no-heat call it echoes with its own sample shop (`app/data/portal-demo.ts`).
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
 *   - Nothing plays until the visitor presses Start demo (Xander's call: no autoplay). The
 *     steps sit above the window as its chapters; each can be picked, and replays from its own
 *     starting state, which every step can rebuild (`STEP_START`).
 *   - The narration is a tour card inside the window, like the portal's own first-run tour:
 *     each step stops once on its subject (`BEAT`), dims the rest, and explains it, then moves
 *     on after a reading pause or on Next. The camera keeps the card a band of its own, so the
 *     card never covers what it is explaining.
 *   - Reduced motion steps through finished frames instead of playing, each with its card
 *     waiting for Next, and the camera cuts.
 */

/* ── the world the film draws ───────────────────────────────────────────── */

type Stage = WorkingStage | "won" | "lost";

/**
 * One row of the customer timeline, already titled the way `app/lib/timeline.ts`
 * (`buildTimeline`, the redesign in agency #54) titles it: a sentence naming the actor, a
 * one-word type, and whether the customer did it (a filled marker) or the client did (outlined).
 * Every row the demo writes is the client's doing, so every marker is outlined.
 */
interface Ev {
    id: string;
    /** What the marker draws: #54's `markerKind`, decided with the title and chip, never apart. */
    kind: "call" | "sms" | "stage" | "record" | "review";
    title: string;
    chip: "Added" | "Texts" | "Stage" | "Review";
    /** A stage move's "From …" line: the raw stage key, as the record prints it. */
    from?: string;
    /** A text's body, shown as a bubble. */
    body?: string;
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

/* Promotion is stored with the source's kind ("call") but the client as its actor, so #54
   treats it as a record entry: its stored summary, an "Added" chip, and a neutral plus marker
   (`kindMatchesActor` and `markerKind` in app/lib/timeline.ts, 0653870 and 7971cdd). */
const EV_ADDED: Ev = { id: "added", kind: "record", title: "Added to your customers from your inbox", chip: "Added", time: DEMO_TIMES.added };
const PREV: Record<Move, Stage> = { contacted: "lead", quoted: "contacted", scheduled: "quoted" };
const evMove = (k: Move): Ev => ({
    id: `m-${k}`,
    kind: "stage",
    title: `You moved ${DEMO_LEAD.name} to ${label(k)}`,
    chip: "Stage",
    from: PREV[k],
    time: DEMO_TIMES[k],
});
const EV_SMS: Ev = { id: "sms", kind: "sms", title: `You texted ${DEMO_LEAD.name}`, chip: "Texts", body: DEMO_SMS, time: DEMO_TIMES.texted };
/* What the review route appends once the text has gone (`reviewRequestActivity`, #53). */
const EV_REVIEW: Ev = { id: "review", kind: "review", title: `You asked ${DEMO_LEAD.name} for a Google review`, chip: "Review", time: DEMO_TIMES.reviewed };

/* Where each step begins, and where it ends. Built from one another so they cannot drift. */
const AFTER_INBOX: World = { ...BASE, leadIn: true, leadRead: true, drawer: "lead" };
const AFTER_PROMOTE: World = { ...AFTER_INBOX, drawer: null, tab: "customers", view: "record", timeline: [EV_ADDED] };
const AFTER_PIPELINE: World = {
    ...AFTER_PROMOTE,
    stage: "scheduled",
    timeline: [...MOVES.map(evMove).reverse(), EV_ADDED],
};
const AFTER_MESSAGE: World = { ...AFTER_PIPELINE, timeline: [EV_SMS, ...AFTER_PIPELINE.timeline] };
const AFTER_REVIEW: World = { ...AFTER_MESSAGE, reviewSent: true, timeline: [EV_REVIEW, ...AFTER_MESSAGE.timeline] };

const STEP_START: World[] = [BASE, AFTER_INBOX, { ...AFTER_PROMOTE, view: "board" }, AFTER_PIPELINE, AFTER_MESSAGE];

/* ── camera framing ─────────────────────────────────────────────────────── */

/** An element by its `data-f`, optionally cropped to a width or height (from its top-left, or
 *  from its top-right with `right`). */
type Focus = { f: string; w?: number; h?: number; right?: boolean };
/**
 * What to frame: one list for a normal frame, one for a narrow (<480px) frame. `anchor` is the
 * edge kept in view when the shot is taller than the frame at the zoom floor: the camera never
 * pulls back to fit, it crops from the other end instead.
 */
type Shot = "all" | { wide: Focus[]; narrow?: Focus[]; pad?: number; anchor?: "top" | "bottom" };

/**
 * The least the camera zooms to once the film is running. Below this the portal reads as a
 * thumbnail, and every drop to it from a closer shot reads as the camera backing away for no
 * reason. Only the poster frame behind Start demo shows the whole canvas.
 */
const ZOOM_FLOOR = { wide: 0.9, narrow: 0.62 };

/* 1060 tall so the whole customer record fits, composer included: at 820 the text box sat
   past the canvas edge and the typing in step 4 happened out of sight. */
const V = { w: 1160, h: 1060 };
const NARROW = 480;

/* ── the tour card ──────────────────────────────────────────────────────────
   Each step stops once, on the thing it is about, and explains it the way the portal's own
   first-run tour does (driver.js, `tour/tour-theme.css`): the rest of the window dims, the
   element is cut out of the dim, and a white card beside it carries the step's caption. The
   camera keeps a band free for the card, so the card never sits on the element it explains. */

/** What the card points at on a step's finished frame (reduced motion, or a step picked). */
const STATIC_TARGET = ["said", "promote", "stagerow", "ev-sms", "reviewbtn"];
/** Room the camera leaves below a beat's subject for the card. */
const RESERVE = { wide: 190, narrow: 190 };
/** How long a card stays before the film moves on by itself: long enough to read twice. */
function readMs(i: number): number {
    const st = DEMO_STEPS[i];
    const words = (st.caption + (st.gated ? ` ${CARRIER_LINE}` : "")).split(/\s+/).length;
    return Math.min(7600, Math.max(4200, 1800 + words * 240));
}

const SHOT = {
    inboxList: { wide: [{ f: "inbox-list" }], narrow: [{ f: "row-robert", w: 430 }, { f: "row-linda", w: 430 }], pad: 18 },
    leadBody: { wide: [{ f: "leadbody" }], narrow: [{ f: "leadbody", h: 360 }], pad: 10 },
    leadPromote: { wide: [{ f: "leadbody" }], narrow: [{ f: "said" }, { f: "promote-wrap" }], pad: 10 },
    recordTop: { wide: [{ f: "rhead" }, { f: "origin" }], narrow: [{ f: "rhead", w: 390 }, { f: "origin", w: 390 }], pad: 14 },
    board: { wide: [{ f: "board" }], narrow: [{ f: "col-lead" }, { f: "col-contacted" }], pad: 16 },
    /* The stage picker and the top of the timeline, which is where a move or a new row shows. */
    recordStage: { wide: [{ f: "stagerow" }, { f: "timeline", h: 280 }], narrow: [{ f: "timeline", w: 400, h: 330 }], pad: 14, anchor: "top" },
    composer: { wide: [{ f: "timeline" }, { f: "composer" }], narrow: [{ f: "timeline", w: 410 }, { f: "composer", w: 410 }], pad: 12, anchor: "bottom" },
    /* Promote and what sits just above it, rather than the whole drawer. */
    promote: { wide: [{ f: "promote-wrap" }], narrow: [{ f: "promote-wrap" }], pad: 90, anchor: "bottom" },
    /* A narrow frame cannot hold the whole composer: pan right to Send before it is tapped. */
    composerSend: { wide: [{ f: "timeline" }, { f: "composer" }], narrow: [{ f: "timeline", w: 410, right: true }, { f: "composer", w: 410, right: true }], pad: 12, anchor: "bottom" },
    recordHead: { wide: [{ f: "rhead" }], narrow: [{ f: "rhead", w: 400, right: true }], pad: 14 },
    review: { wide: [{ f: "reviewbody" }], narrow: [{ f: "reviewbody" }], pad: 12 },
} satisfies Record<string, Shot>;

/** Where the camera is when a step is started on its own, so it never opens on a shot meant
 *  for another page (a record shot over the board is the whole canvas, zoomed right out). */
const START_SHOT: Shot[] = [SHOT.inboxList, SHOT.leadPromote, SHOT.board, SHOT.recordStage, SHOT.recordHead];

/**
 * A step's finished frame: what reduced motion shows, and what a card points at there. Step 2
 * shows the drawer with Promote, as its card is about the button, not about the record after.
 */
const STATIC_WORLD: World[] = [AFTER_INBOX, AFTER_INBOX, AFTER_PIPELINE, AFTER_MESSAGE, AFTER_REVIEW];
const STATIC_SHOT: Shot[] = [SHOT.leadBody, SHOT.promote, SHOT.recordStage, SHOT.composer, SHOT.recordStage];

/** Where each step stops while playing, and what the camera frames when it does. */
const BEAT: { f: string; shot: Shot }[] = [
    { f: "row-robert", shot: SHOT.inboxList },
    { f: "promote", shot: SHOT.promote },
    { f: "card-robert", shot: SHOT.board },
    { f: "composer", shot: SHOT.composer },
    { f: "reviewbtn", shot: SHOT.recordHead },
];

/** The card's state: which step, the subject's box and the window's box, in frame pixels. */
interface Tour {
    i: number;
    spot: { x: number; y: number; w: number; h: number };
    vp: { x: number; y: number; w: number; h: number };
    /** Auto-advance time for the card's timer bar; 0 on a finished frame, which waits for Next. */
    ms: number;
}

/** Run `fn` on the next frame, or after 60ms if no frame comes (a background tab draws none). */
function afterFrame(fn: () => void): () => void {
    let done = false;
    const go = () => {
        if (done) return;
        done = true;
        fn();
    };
    const raf = requestAnimationFrame(go);
    const t = setTimeout(go, 60);
    return () => {
        done = true;
        cancelAnimationFrame(raf);
        clearTimeout(t);
    };
}

/* ── component ──────────────────────────────────────────────────────────── */

type Run = "idle" | "playing" | "paused" | "done";

export default function PortalDemo() {
    const reduce = !!useReducedMotion();
    const rootRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);

    const [world, setWorld] = useState<World>(BASE);
    const [step, setStep] = useState(0);
    const [run, setRun] = useState<Run>("idle");

    /** Cuts every camera and drawer move to zero for a frame, when a step is rebuilt or the
     *  frame resizes. A class on the root rather than state, so it needs no render. */
    const cut = useCallback((on: boolean) => {
        rootRef.current?.classList.toggle(s.instant, on);
    }, []);
    /** Bumped by every run, so a step's progress bar restarts when the step does. */
    const [runId, setRunId] = useState(0);
    /** A card is up mid-film: the running step bar waits with it. */
    const [held, setHeld] = useState(false);
    /** The closing screen, once the last step has finished. */
    const [closing, setClosing] = useState(false);

    const token = useRef(0);
    const lastShot = useRef<Shot>("all");
    const lastReserve = useRef(0);
    /** Where the camera is going, which mid-transition is not where it is. */
    const cam = useRef({ x: 0, y: 0, k: 1 });

    const frameRef = useRef<HTMLDivElement>(null);
    const popRef = useRef<HTMLDivElement>(null);
    const [tour, setTour] = useState<Tour | null>(null);
    /** What the card is showing, so a resize can put it back in the right place. */
    const tourAt = useRef<{ i: number; f: string; ms: number } | null>(null);
    /** Continues a playing film from its current card; null when nothing is waiting on one. */
    const tourNext = useRef<(() => void) | null>(null);

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

    /**
     * Frame a shot. `reserve` keeps that many pixels free at the bottom of the window, for the
     * tour card: the subject is fitted and centred in what is left, and the canvas may run past
     * its own bottom edge into the band (the window's ground is the portal's page colour, so
     * that reads as more page, not as a gap).
     */
    const look = useCallback(
        (shot: Shot, reserve = 0) => {
            const vp = viewportRef.current;
            const canvas = canvasRef.current;
            if (!vp || !canvas) return;
            lastShot.current = shot;
            lastReserve.current = reserve;
            const F = { w: vp.clientWidth, h: vp.clientHeight };
            if (!F.w || !F.h) return;
            const H = Math.max(F.h * 0.4, F.h - reserve);
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
            const isNarrow = F.w < NARROW;
            const maxZoom = isNarrow ? 0.92 : 1;
            const floor = Math.min(maxZoom, isNarrow ? ZOOM_FLOOR.narrow : ZOOM_FLOOR.wide);
            const k = shot === "all" ? fit : Math.max(floor, Math.min(F.w / (R.w + pad * 2), H / (R.h + pad * 2), maxZoom));

            let x = F.w / 2 - (R.x + R.w / 2) * k;
            let y = H / 2 - (R.y + R.h / 2) * k;
            // Too big for the frame at this zoom: keep the anchored edge, crop the other.
            if (shot !== "all") {
                // Across: centre whatever fits; only a subject wider than the frame itself is
                // pinned to its left edge, where a row starts and a name is.
                if (R.w * k > F.w - 16) x = 12 - R.x * k;
                if ((R.h + pad * 2) * k > H) {
                    y = shot.anchor === "bottom" ? H - pad * k - (R.y + R.h) * k : pad * k - R.y * k;
                }
            }
            x = V.w * k < F.w ? (F.w - V.w * k) / 2 : Math.min(0, Math.max(F.w - V.w * k, x));
            y = V.h * k < F.h ? (F.h - V.h * k) / 2 : Math.min(0, Math.max(F.h - V.h * k - reserve, y));
            canvas.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
            cam.current = { x, y, k };
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

    /**
     * Show the tour card for step `i`, pointed at `f`, and position it.
     *
     * Positioned by hand after a synchronous commit rather than from an effect: it needs the
     * card's own rendered height to choose between below and above the subject.
     */
    const showTour = useCallback((i: number, f: string, ms: number) => {
        const vpEl = viewportRef.current;
        const frameEl = frameRef.current;
        const box = rectOf({ f });
        if (!vpEl || !frameEl || !box) return;
        tourAt.current = { i, f, ms };
        const v = vpEl.getBoundingClientRect();
        const fr = frameEl.getBoundingClientRect();
        // From the camera's destination, not the live layout: measured mid-zoom (a slow
        // device, a background tab) the live box is wherever the transition has got to.
        const { x: cx, y: cy, k } = cam.current;
        const spot = { x: cx + box.x * k, y: cy + box.y * k, w: box.w * k, h: box.h * k };
        const vp = { x: v.left - fr.left, y: v.top - fr.top, w: v.width, h: v.height };
        flushSync(() => setTour({ i, spot, vp, ms }));

        const pop = popRef.current;
        if (!pop) return;
        const gap = 14;
        const w = Math.min(340, vp.w - 24);
        pop.style.width = `${w}px`;
        const h = pop.offsetHeight;
        const left = Math.min(Math.max(12, spot.x), vp.w - w - 12);
        const below = spot.y + spot.h + gap;
        const above = spot.y - gap - h;
        let side: "below" | "above" | "over" = "below";
        let top = below;
        if (below + h > vp.h - 10) {
            if (above >= 10) {
                side = "above";
                top = above;
            } else {
                side = "over";
                top = Math.max(10, vp.h - h - 10);
            }
        }
        pop.style.left = `${left}px`;
        pop.style.top = `${top}px`;
        pop.dataset.side = side;
        pop.style.setProperty("--ax", `${Math.min(Math.max(spot.x + spot.w / 2 - left, 18), w - 18)}px`);
    }, [rectOf]);
    const hideTour = useCallback(() => {
        tourAt.current = null;
        tourNext.current = null;
        flushSync(() => setTour(null));
    }, []);

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
            /**
             * Stop on step `i`'s subject and explain it. The camera leaves the card its band,
             * the card shows once the camera has arrived, and the film moves on when the
             * reading time runs out or Next is pressed, whichever is first.
             */
            const beat = async (i: number) => {
                const { f, shot } = BEAT[i];
                look(shot, narrow() ? RESERVE.narrow : RESERVE.wide);
                await wait(1050);
                const ms = readMs(i);
                showTour(i, f, ms);
                setHeld(true);
                await new Promise<void>((res, rej) => {
                    const go = () => {
                        clearTimeout(t);
                        tourNext.current = null;
                        if (my === token.current) res();
                        else rej(new Error("cancelled"));
                    };
                    const t = setTimeout(go, ms);
                    tourNext.current = go;
                });
                setHeld(false);
                hideTour();
                await wait(250);
            };

            const SCRIPT: (() => Promise<void>)[] = [
                // 1 · a new lead lands, and is opened
                async () => {
                    look(SHOT.inboxList);
                    hideCursor();
                    await wait(900);
                    commit({ leadIn: true });
                    await wait(1100);
                    await beat(0);
                    look(SHOT.inboxList);
                    pointAt("row-robert", 0.3);
                    await wait(800);
                    commit({ hoverRow: "robert" });
                    await click();
                    commit({ leadRead: true, drawer: "lead", hoverRow: null });
                    await wait(300);
                    look(SHOT.leadBody);
                    await wait(2200);
                },
                // 2 · promoted: the record opens with the call pinned, then back to the board
                async () => {
                    await beat(1);
                    look(SHOT.promote);
                    pointAt("promote");
                    await wait(900);
                    await click();
                    commit({ promoting: true });
                    await wait(700);
                    commit({ promoting: false, drawer: null, tab: "customers", view: "record", timeline: [EV_ADDED], enterEv: EV_ADDED.id });
                    await frame();
                    look(SHOT.recordTop);
                    await wait(2400);
                    pointAt("back");
                    await wait(900);
                    await click();
                    // Back to the board. This used to be left to the next step, which looked for
                    // a card on a page still showing the record, found none, and pulled the
                    // camera out to the whole canvas.
                    commit({ view: "board", enterEv: null });
                    await frame();
                    look(SHOT.board);
                },
                // 3 · Lead → Contacted → Quoted → Scheduled on the board, then opened
                async () => {
                    await beat(2);
                    look(SHOT.board);
                    await wait(500);
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
                    await beat(3);
                    look(SHOT.composer);
                    await wait(600);
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
                    await beat(4);
                    look(SHOT.recordHead);
                    await wait(400);
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
                    commit((w) => ({
                        reviewSending: false,
                        drawer: null,
                        reviewSent: true,
                        timeline: [EV_REVIEW, ...w.timeline],
                        enterEv: EV_REVIEW.id,
                    }));
                    await wait(250);
                    // The button and the new row together: what was sent, and where it is kept.
                    look(SHOT.recordStage);
                    pointAt("reviewbtn", 0.5, 1.7);
                    await wait(2600);
                },
            ];

            try {
                setRunId(my);
                setHeld(false);
                setClosing(false);
                hideTour();
                setRun("playing");
                setStep(from);
                cut(true);
                commit({ ...STEP_START[from], enterEv: null });
                settle();
                look(START_SHOT[from]);
                await frame();
                cut(false);
                for (let i = from; i < SCRIPT.length; i++) {
                    setStep(i);
                    await SCRIPT[i]();
                }
                // The beat: the last frame holds, the cursor leaves, then the close.
                await wait(1200);
                hideCursor();
                setRun("done");
                setClosing(true);
            } catch {
                // Cancelled by a newer run, a pause or an unmount. Whoever cancelled owns the state.
            }
        },
        [commit, cut, hideCursor, hideTour, look, pointAt, settle, showTour],
    );

    /** The finished frame of a step, with no motion. Reduced motion only ever shows these. */
    const show = useCallback(
        (i: number) => {
            token.current++;
            cut(true);
            setStep(i);
            setRun(i === DEMO_STEPS.length - 1 ? "done" : "paused");
            setClosing(false);
            commit({ ...STATIC_WORLD[i], enterEv: null });
            settle();
            hideCursor();
            setHeld(false);
            look(STATIC_SHOT[i], (viewportRef.current?.clientWidth ?? 999) < NARROW ? RESERVE.narrow : RESERVE.wide);
            // The finished frame still gets its card, pointed at what the step produced, and
            // waits for Next rather than timing out.
            afterFrame(() => {
                cut(false);
                showTour(i, STATIC_TARGET[i], 0);
            });
        },
        [commit, cut, hideCursor, look, settle, showTour],
    );

    // First framing, once the frame has a size. Nothing plays until someone presses Start.
    useEffect(() => {
        return afterFrame(() => look("all"));
    }, [look]);

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
            look(lastShot.current, lastReserve.current);
            afterFrame(() => {
                cut(false);
                const t = tourAt.current;
                if (t) showTour(t.i, t.f, t.ms);
            });
        });
        ro.observe(vp);
        return () => ro.disconnect();
    }, [cut, look, showTour]);

    /** Start, or start over from a step. Reduced motion steps through finished frames instead. */
    function start(i = 0) {
        if (reduce) show(i);
        else void play(i);
    }
    function onTourNext() {
        if (tourNext.current) return tourNext.current();
        const i = tour?.i ?? step;
        if (i >= DEMO_STEPS.length - 1) {
            hideTour();
            setRun("done");
            setClosing(true);
            return;
        }
        start(i + 1);
    }
    function onPlayButton() {
        if (run === "idle") return start(0);
        if (reduce) return show(Math.min(step + 1, DEMO_STEPS.length - 1));
        if (run === "playing") {
            token.current++;
            setRun("paused");
            return;
        }
        void play(run === "done" ? 0 : step);
    }

    const idle = run === "idle";
    const playLabel = idle
        ? "Start demo"
        : reduce
          ? "Next step"
          : run === "playing"
            ? "Pause"
            : run === "done"
              ? "Replay"
              : "Play";

    return (
        <div ref={rootRef} className={`${s.demo} ${reduce ? s.reduced : ""}`}>
            {/* Above the window, so the steps read as the demo's chapters before it plays. */}
            <div className={s.controls}>
                <button type="button" className={s.play} onClick={onPlayButton} aria-label={playLabel} title={playLabel}>
                    {idle ? (
                        <Play size={16} weight="fill" />
                    ) : reduce ? (
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
                        const state = idle
                            ? "empty"
                            : i < step
                              ? "done"
                              : i > step
                                ? "empty"
                                : run === "playing"
                                  ? "running"
                                  : "full";
                        return (
                            <button
                                key={st.key}
                                type="button"
                                className={s.step}
                                aria-current={!idle && i === step ? "step" : undefined}
                                aria-label={`Step ${i + 1}: ${st.short}`}
                                onClick={() => start(i)}
                            >
                                <b>{i + 1}</b>
                                <span className={s.stepName}>{st.short}</span>
                                <i
                                    // Keyed on the run so the bar restarts with the step.
                                    key={`${i}-${state}-${runId}`}
                                    className={s.bar}
                                    data-state={state}
                                    data-held={held && run === "playing"}
                                    style={state === "running" ? { animationDuration: `${st.ms}ms` } : undefined}
                                />
                            </button>
                        );
                    })}
                </div>
            </div>

            <div ref={frameRef} className={s.frame}>
                {/* The film is decorative: the narration below says what each frame shows, and
                    is what a screen reader gets. Nothing in the window is focusable. The start
                    button sits beside the window rather than in it, so it is not inside
                    aria-hidden. */}
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
                {/* The tour card, over the window but outside its aria-hidden subtree, so its
                    Next button is reachable and its words are announced. */}
                <div
                    className={s.tourLayer}
                    style={tour ? { left: tour.vp.x, top: tour.vp.y, width: tour.vp.w, height: tour.vp.h } : { display: "none" }}
                    aria-live="polite"
                >
                    {tour && (
                        <>
                            <span
                                className={s.spot}
                                style={{ left: tour.spot.x - 6, top: tour.spot.y - 6, width: tour.spot.w + 12, height: tour.spot.h + 12 }}
                            />
                            <div ref={popRef} className={s.pop} key={`${tour.i}-${runId}`}>
                                <p className={s.popTitle}>{DEMO_STEPS[tour.i].short}</p>
                                <p className={s.popBody}>{DEMO_STEPS[tour.i].caption}</p>
                                {DEMO_STEPS[tour.i].gated && <p className={s.popGate}>{CARRIER_LINE}</p>}
                                <div className={s.popFoot}>
                                    <span className={s.popCount}>
                                        {tour.i + 1} of {DEMO_STEPS.length}
                                    </span>
                                    <button type="button" className={s.popNext} onClick={onTourNext}>
                                        {tour.i === DEMO_STEPS.length - 1 ? "Done" : "Next"}
                                    </button>
                                </div>
                                {tour.ms > 0 && run === "playing" && (
                                    <i className={s.popTimer} style={{ animationDuration: `${tour.ms}ms` }} />
                                )}
                            </div>
                        </>
                    )}
                </div>
                {closing && (
                    <div className={s.endGate} role="status">
                        <div className={s.endPanel}>
                            <p className={s.endTitle}>{DEMO_CLOSING.title}</p>
                            <p className={s.endBody}>{DEMO_CLOSING.body}</p>
                            <div className={s.endActions}>
                                <button type="button" className={`btn primary ${s.endBtn}`} onClick={() => start(0)}>
                                    <ArrowCounterClockwise size={16} weight="bold" aria-hidden="true" />
                                    {DEMO_CLOSING.replay}
                                </button>
                                <Link href={DEMO_CLOSING.next.href} className={`btn ghost ${s.endBtn}`}>
                                    {DEMO_CLOSING.next.label}
                                </Link>
                            </div>
                        </div>
                    </div>
                )}
                {idle && (
                    <div className={s.startGate}>
                        <button type="button" className={`btn primary lg ${s.startBtn}`} onClick={() => start(0)}>
                            <Play size={18} weight="fill" aria-hidden="true" />
                            Start demo
                        </button>
                    </div>
                )}
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

/* The pinned origin call keeps CustomerRecord's tinted icon. */
const TINT = {
    call: { bg: "rgba(22,163,74,0.1)", fg: "var(--chart-pos)" },
};

/* The timeline's markers: one hue per kind from the chart tokens, as `markerHue` sets them. */
const MARKER = {
    call: { hue: "var(--chart-pos)", Icon: PhoneCall },
    sms: { hue: "var(--accent)", Icon: ChatCircle },
    stage: { hue: "var(--fg-3)", Icon: CaretRight },
    record: { hue: "var(--fg-3)", Icon: Plus },
    review: { hue: "var(--chart-warn)", Icon: Star },
};

/** Outlined, because the client did it. A neutral hue takes the strong rule as its ring. */
function Marker({ kind }: { kind: Ev["kind"] }) {
    const { hue, Icon } = MARKER[kind];
    return (
        <span
            className="relative z-[1] shrink-0 w-[27px] h-[27px] rounded-full flex items-center justify-center"
            style={{
                background: "var(--elev-1)",
                borderWidth: 1.5,
                borderStyle: "solid",
                borderColor: hue === "var(--fg-3)" ? "var(--rule-strong)" : hue,
                color: hue,
            }}
        >
            <Icon size={13} />
        </span>
    );
}

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
                        {["Everything", "Texts", "Calls", "Your notes"].map((f, i) => (
                            <span
                                key={f}
                                className="px-2.5 py-1 rounded-lg text-[12.5px] border"
                                style={{
                                    fontWeight: i === 0 ? 600 : 400,
                                    background: i === 0 ? "var(--fg)" : "var(--elev-1)",
                                    color: i === 0 ? "var(--elev-1)" : "var(--fg-2)",
                                    borderColor: i === 0 ? "var(--fg)" : "var(--rule-strong)",
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
                        <div className="pt-4 min-w-0">
                            <div className="flex items-baseline gap-2.5 mb-1">
                                <b className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
                                    Today
                                </b>
                                <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                                    {DEMO_TODAY}
                                </span>
                            </div>
                            {w.timeline.map((ev, i) => {
                                const first = i === 0;
                                const last = i === w.timeline.length - 1;
                                return (
                                    <div key={ev.id} data-f={`ev-${ev.id}`} className={`relative flex gap-3 py-2.5 min-w-0 ${w.enterEv === ev.id ? s.evEnter : ""}`}>
                                        {/* The spine, trimmed at the first and last marker. Its colour is copied from
                                            CustomerRecord, not inherited: `--rule` is the portal's every-border hairline,
                                            so if the spine is ever darkened it will change on the spine itself, and
                                            this value has to be changed by hand to match. */}
                                        <span
                                            className="absolute w-px"
                                            style={{ left: 13, top: first ? 20 : 0, bottom: last ? "calc(100% - 20px)" : 0, background: "var(--rule)" }}
                                        />
                                        <Marker kind={ev.kind} />
                                        <div className="flex-1 min-w-0 pt-px">
                                            <div className="flex items-baseline gap-2.5 flex-wrap">
                                                <span className="text-[13.5px] font-semibold" style={{ color: "var(--fg)" }}>
                                                    {ev.title}
                                                </span>
                                                <span
                                                    className="text-[9.5px] uppercase px-1.5 py-0.5 rounded"
                                                    style={{ fontFamily: "var(--font-mono)", letterSpacing: "0.09em", background: "var(--surface)", color: "var(--fg-2)" }}
                                                >
                                                    {ev.chip}
                                                </span>
                                                <span className="ml-auto shrink-0 text-[10.5px] whitespace-nowrap" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                                    {ev.time}
                                                </span>
                                            </div>
                                            {ev.body && (
                                                <div className="flex flex-col gap-1.5 mt-1.5 min-w-0">
                                                    <p
                                                        className="m-0 text-[13px] leading-snug rounded-xl px-3 py-2"
                                                        style={{ maxWidth: "min(46ch, 100%)", marginLeft: "auto", background: "rgba(37,99,235,0.08)", color: "var(--fg-2)" }}
                                                    >
                                                        {ev.body}
                                                    </p>
                                                </div>
                                            )}
                                            {ev.from && (
                                                <p className="m-0 mt-1 text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                                    From {ev.from}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
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
