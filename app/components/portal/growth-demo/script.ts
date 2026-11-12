import { CARRIER_LINE } from "@/app/data/portal-demo";

/**
 * The Starter → Growth demo's script: the order it plays in, how long each part holds, what each
 * scene shows at a given moment, where the cursor is, and every word it says.
 *
 * Kept free of React so the timing rules can be tested on their own (`test/growth-demo.test.mjs`).
 *
 * Rebuilt 2026-11-12 (Xander): five steps rather than four (Jobs and the calendar are new), a
 * little slower, a cursor that does every click, and the portal's real screens as they are after
 * #118 to #122. Words: the storyboard Xander approved word for word on 2026-11-12 (all of it). Lines carried
 * over from the 9 Nov 2026 approval are marked "kept". No dashes anywhere.
 */

/* ── the sequence ───────────────────────────────────────────────────────── */

/** Intro, then a title card ("scrim") before each of the five scenes, then the end card. */
export const SEGMENTS = [
    "intro",
    "scrim1",
    "s1",
    "scrim2",
    "s2",
    "scrim3",
    "s3",
    "scrim4",
    "s4",
    "scrim5",
    "s5",
    "end",
] as const;
export type Segment = (typeof SEGMENTS)[number];
export type SceneNo = 1 | 2 | 3 | 4 | 5;
export const SCENE_COUNT = 5;

/**
 * How long each part holds, in ms: about a minute and a half end to end. Xander found the old
 * minute too quick; every scene now has its caption read, the cursor's moves, and a held finished
 * frame. The Jobs scene does the most (open the file, add the job, book it, see the calendar), so
 * it gets two seconds more.
 */
export const DURATION: Record<Exclude<Segment, "end">, number> = {
    intro: 5000,
    scrim1: 4000,
    s1: 14000,
    scrim2: 4000,
    s2: 14000,
    scrim3: 4000,
    s3: 16000,
    scrim4: 4000,
    s4: 14000,
    scrim5: 4000,
    s5: 14000,
};

export const TOTAL_MS = Object.values(DURATION).reduce((a, b) => a + b, 0);

export function isScrim(seg: Segment): boolean {
    return seg === "intro" || seg.startsWith("scrim");
}

/** The scene a segment belongs to: a scrim shows its own scene's opening frame, dimmed, behind it. */
export function sceneOf(seg: Segment): SceneNo | null {
    if (seg === "end") return null;
    if (seg === "intro") return 1;
    return Number(seg.slice(-1)) as SceneNo;
}

/** Clamp a segment index into range. Back from the intro stays on the intro. */
export function clampIndex(i: number): number {
    return Math.max(0, Math.min(SEGMENTS.length - 1, i));
}

/**
 * Advance a clock by `delta` ms. Returns the new segment index and time into it. Stops on the
 * end card, which has no duration and waits for the client.
 *
 * Moves at most one segment per call, so a long stall (a background tab, a laptop lid) lands
 * on the start of the next part rather than skipping a whole scene unseen. The caller also caps
 * `delta`, for the same reason.
 */
export function tick(i: number, t: number, delta: number): { i: number; t: number } {
    const seg = SEGMENTS[i];
    if (seg === "end") return { i, t: 0 };
    const next = t + delta;
    if (next >= DURATION[seg]) return { i: clampIndex(i + 1), t: 0 };
    return { i, t: next };
}

/* ── what a scene shows at a given moment ──────────────────────────────── */

/**
 * When each thing happens inside a scene, in ms from its start. The caption comes up first and
 * the action follows, so the words say what is about to happen rather than chasing it. Every
 * click lands a beat after the cursor arrives, so it reads as a person, not a jump cut.
 */
export const BEATS = {
    caption: 800,
    s1: { open: 2800, promoting: 6000, promoted: 6800 },
    /* Dave's card steps Lead → Contacted → Quoted → Scheduled. */
    s2: { lift: 2400, moves: [3600, 5000, 6400], drop: 7000 },
    s3: { record: 2200, jobsTab: 4000, job: 6200, calendar: 8800 },
    s4: { focus: 2400, typeFrom: 2600, charsPerSec: 32, sent: 6600, reply: 9000 },
    s5: { won: 2400, open: 4400, editing: 6400, sent: 9600 },
} as const;

export type BoardStage = 0 | 1 | 2 | 3;
export type RecordView = "none" | "record" | "calendar";

export interface SceneView {
    caption: boolean;
    /* 1: the lead opens and is promoted */
    leadOpen: boolean;
    promoting: boolean;
    promoted: boolean;
    /* 2: Dave's column, 0 = Lead … 3 = Scheduled, and whether his card is in hand */
    daveStage: BoardStage;
    lifted: boolean;
    /* 3: the file opens on Timeline, goes to Jobs, a job is added, the calendar shows the visit */
    view: RecordView;
    tab: "timeline" | "jobs";
    job: boolean;
    /* 4: the text being typed, then sent, then answered */
    composing: boolean;
    typed: string;
    sent: boolean;
    reply: boolean;
    /* 5: the review request */
    won: boolean;
    reviewOpen: boolean;
    editing: boolean;
    reviewSent: boolean;
}

/**
 * The scene's state `ms` into it. `still` is reduced motion: every scene is drawn as its
 * finished frame from the first moment, so nothing inside it moves. Scene 5 keeps the review
 * window open, on its message, because that window is what its caption is about.
 */
export function sceneView(scene: SceneNo, ms: number, still = false): SceneView {
    const at = still ? Number.POSITIVE_INFINITY : ms;
    const v: SceneView = {
        caption: at >= BEATS.caption,
        leadOpen: false,
        promoting: false,
        promoted: false,
        daveStage: 0,
        lifted: false,
        view: "none",
        tab: "timeline",
        job: false,
        composing: false,
        typed: "",
        sent: false,
        reply: false,
        won: false,
        reviewOpen: false,
        editing: false,
        reviewSent: false,
    };
    if (scene === 1) {
        v.leadOpen = at >= BEATS.s1.open;
        v.promoted = at >= BEATS.s1.promoted;
        v.promoting = at >= BEATS.s1.promoting && !v.promoted;
        return v;
    }
    // From scene 2 on, Dave is a customer.
    v.promoted = true;
    if (scene === 2) {
        v.daveStage = BEATS.s2.moves.filter((m) => at >= m).length as BoardStage;
        v.lifted = at >= BEATS.s2.lift && at < BEATS.s2.drop;
        return v;
    }
    v.daveStage = 3;
    if (scene === 3) {
        v.view = at >= BEATS.s3.calendar ? "calendar" : at >= BEATS.s3.record ? "record" : "none";
        v.tab = at >= BEATS.s3.jobsTab ? "jobs" : "timeline";
        v.job = at >= BEATS.s3.job;
        return v;
    }
    // The job and its visit are booked before scene 4 opens.
    v.view = "record";
    v.job = true;
    if (scene === 4) {
        v.sent = at >= BEATS.s4.sent;
        v.reply = at >= BEATS.s4.reply;
        v.composing = at >= BEATS.s4.focus && !v.sent;
        if (!v.sent && at >= BEATS.s4.typeFrom) {
            const n = Math.floor(((at - BEATS.s4.typeFrom) / 1000) * BEATS.s4.charsPerSec);
            v.typed = COPY.sms.slice(0, n);
        }
        if (still) v.composing = false;
        return v;
    }
    // Scene 5: the conversation from scene 4 is all there.
    v.sent = true;
    v.reply = true;
    v.won = at >= BEATS.s5.won;
    v.reviewSent = at >= BEATS.s5.sent && !still;
    v.reviewOpen = still || (at >= BEATS.s5.open && !v.reviewSent);
    v.editing = still || (at >= BEATS.s5.editing && !v.reviewSent);
    return v;
}

/* ── the cursor ─────────────────────────────────────────────────────────── */

/**
 * Where the cursor goes, as CSS selectors resolved inside the replica at render time, so it lands
 * on the real element wherever the real layout puts it. `null` is off screen. A `click` is drawn
 * as a press and a ring at that moment; `down` holds the button (the drag on the board).
 */
export interface CursorStop {
    at: number;
    to: string | null;
    click?: boolean;
    down?: boolean;
}

export const DAVE_ID = "demo-dave";

const col = (label: string) => `section[aria-label="${label} column"]`;

export const CURSOR: Record<SceneNo, CursorStop[]> = {
    1: [
        { at: 1200, to: `[data-row-id="${DAVE_ID}"]` },
        { at: 2600, to: `[data-row-id="${DAVE_ID}"]`, click: true },
        { at: 4800, to: '[data-tour="inbox-promote"]' },
        { at: 6000, to: '[data-tour="inbox-promote"]', click: true },
        { at: 8000, to: null },
    ],
    2: [
        { at: 1400, to: `[data-customer-id="${DAVE_ID}"]` },
        { at: 2400, to: `[data-customer-id="${DAVE_ID}"]`, down: true },
        { at: 3000, to: col("Contacted"), down: true },
        { at: 4400, to: col("Quoted"), down: true },
        { at: 5800, to: col("Scheduled"), down: true },
        { at: 7000, to: `[data-customer-id="${DAVE_ID}"]` },
        { at: 8600, to: null },
    ],
    3: [
        { at: 1000, to: `[data-customer-id="${DAVE_ID}"]` },
        { at: 1800, to: `[data-customer-id="${DAVE_ID}"]`, click: true },
        { at: 3200, to: "#crm-tab-jobs" },
        { at: 3800, to: "#crm-tab-jobs", click: true },
        { at: 5000, to: '[data-tour="crm-jobs-add"]' },
        { at: 5800, to: '[data-tour="crm-jobs-add"]', click: true },
        { at: 7400, to: '[data-tour="crm-job-calendar"]' },
        { at: 8200, to: '[data-tour="crm-job-calendar"]', click: true },
        { at: 10000, to: '[data-tour="cal-day"]' },
        { at: 12500, to: null },
    ],
    4: [
        { at: 1400, to: "#crm-sms" },
        { at: 2200, to: "#crm-sms", click: true },
        { at: 5400, to: '[data-demo="send"]' },
        { at: 6200, to: '[data-demo="send"]', click: true },
        /* Up to the timeline, where the text has just landed, and where the reply comes in. */
        { at: 7000, to: '[data-tour="crm-drawer-timeline"]' },
        { at: 11500, to: null },
    ],
    5: [
        { at: 1200, to: '[data-demo="stage-won"]' },
        { at: 2200, to: '[data-demo="stage-won"]', click: true },
        { at: 3400, to: '[data-tour="crm-drawer-review"]' },
        { at: 4200, to: '[data-tour="crm-drawer-review"]', click: true },
        { at: 5600, to: '[data-demo="review-message"]' },
        { at: 6200, to: '[data-demo="review-message"]', click: true },
        { at: 8400, to: '[data-demo="review-send"]' },
        { at: 9200, to: '[data-demo="review-send"]', click: true },
        { at: 10800, to: null },
    ],
};

/** How long the cursor takes between two stops. */
export const CURSOR_MOVE_MS = 700;
/** How long a click's press shows. */
export const CLICK_MS = 260;

export interface CursorState {
    /** Where it is coming from and going to; equal once it has arrived. */
    from: string | null;
    to: string | null;
    /** 0 at the start of the move, 1 on arrival (eased by the caller). */
    p: number;
    down: boolean;
    /** The number of clicks so far, so each one replays its ring. */
    clicks: number;
    /** A click is pressing right now. */
    pressing: boolean;
}

/** The cursor `ms` into a scene. Reduced motion draws no cursor at all. */
export function cursorAt(scene: SceneNo, ms: number, still = false): CursorState {
    const off: CursorState = { from: null, to: null, p: 1, down: false, clicks: 0, pressing: false };
    if (still) return off;
    const stops = CURSOR[scene];
    let prev: string | null = null;
    let cur: CursorStop | null = null;
    let clicks = 0;
    let lastClickAt = -Infinity;
    for (const s of stops) {
        if (s.at > ms) break;
        prev = cur ? cur.to : null;
        cur = s;
        if (s.click) {
            clicks++;
            lastClickAt = s.at;
        }
    }
    if (!cur) return off;
    const p = Math.min(1, (ms - cur.at) / CURSOR_MOVE_MS);
    return {
        from: prev === cur.to ? cur.to : prev,
        to: cur.to,
        p: prev === cur.to ? 1 : p,
        down: Boolean(cur.down),
        clicks,
        pressing: ms - lastClickAt < CLICK_MS,
    };
}

/* ── the words ──────────────────────────────────────────────────────────── */

export interface ScrimCopy {
    label: string;
    title: string;
    /** The desktop line. */
    sub: string;
    /** The phone's shorter line, where it has one. */
    subPhone?: string;
}

export const COPY = {
    tag: "GROWTH DEMO · SAMPLE DATA", // kept
    exit: "Exit demo", // kept
    back: "Back", // kept
    pause: "Pause", // kept
    play: "Play", // kept
    next: "Next", // kept
    scrims: {
        intro: {
            label: "GROWTH, ON SAMPLE DATA", // kept
            title: "One call, start to finish", // kept
            sub: "Watch a late-night call become a booked job and a Google review. About a minute and a half.",
            subPhone: "Watch a late-night call become a booked job and a Google review.", // kept
        },
        scrim1: {
            label: "STEP 1 OF 5",
            title: "Turn a caller into a customer",
            sub: "Your receptionist answered Dave at 2:13 AM. Open the call and keep him.",
            subPhone: "Your receptionist answered Dave at 2:13 AM.",
        },
        scrim2: {
            label: "STEP 2 OF 5",
            title: "Work the job", // kept
            sub: "Every customer on one board, from first call to booked.", // kept
            subPhone: "Every customer on one board.", // kept
        },
        scrim3: {
            label: "STEP 3 OF 5",
            title: "Book the visit",
            sub: "Track what the job is worth and put it on your calendar.",
        },
        scrim4: {
            label: "STEP 4 OF 5",
            title: "Text them from your business number", // kept
            sub: "No more giving out your mobile.", // kept
        },
        scrim5: {
            label: "STEP 5 OF 5",
            title: "Ask for the review", // kept
            sub: "The job’s done. One tap brings in the next one.", // kept
            subPhone: "One tap brings in the next job.", // kept
        },
    } satisfies Record<Exclude<Segment, "end" | "s1" | "s2" | "s3" | "s4" | "s5">, ScrimCopy>,
    captions: {
        1: {
            title: "Promote",
            text: "Open the call to see what Dave needs, then promote him to a customer. The call comes with him, summary and recording included.",
        },
        2: {
            title: "Pipeline",
            text: "Drag Dave along as the job moves: Lead, Contacted, Quoted, Scheduled. Anyone going quiet gets an amber dot.",
        },
        3: {
            title: "Jobs",
            text: "Open Dave's file and add the job: the service, its status and what it's worth. Add to calendar books the visit.",
        },
        4: {
            title: "Message",
            text: "Text Dave from your business number without leaving his file. His reply lands right in the timeline.",
        },
        5: {
            title: "Review",
            text: "When the job is done, ask for a Google review. The message is already written, and you can change it before it goes.",
        },
    } satisfies Record<SceneNo, { title: string; text: string }>,
    /* Sample content */
    sms: "Hi Dave, it's Mike from Your HVAC Co. I can be there by 8 to get the heat back on.",
    reply: "Perfect, see you at 8. Thank you!", // kept
    /* End card: kept word for word from the 9 Nov 2026 approval. */
    end: {
        label: "THAT'S GROWTH",
        title: "Are you ready to grow?",
        loop: ["Answer the call", "Work the job", "Ask for the review"],
        body: "That's the loop: answer the call, work the job, ask for the review. Growth gives you all of it, and your Inbox keeps working exactly as it does today.",
        upgrade: "Upgrade to Growth",
        replay: "Watch again",
        notNow: "Not now",
    },
} as const;

/** Which scenes wait on the carriers: texting and review requests. */
const GATED: Record<SceneNo, boolean> = { 1: false, 2: false, 3: false, 4: true, 5: true };

export function captionFor(scene: SceneNo): { step: string; title: string; text: string; gate: string | null } {
    const c = COPY.captions[scene];
    return { step: `STEP ${scene} OF ${SCENE_COUNT}`, title: c.title, text: c.text, gate: GATED[scene] ? CARRIER_LINE : null };
}

/**
 * What the polite live region says when a part begins: the title card's words, or the scene's
 * caption. The replica itself is hidden from assistive tech, so this is the narration a screen
 * reader gets. The end card says nothing here, because focus moves onto its heading instead.
 */
export function announcementFor(seg: Segment): string {
    if (seg === "end") return "";
    if (isScrim(seg)) {
        const c = COPY.scrims[seg as keyof typeof COPY.scrims];
        return `${c.label}. ${c.title}. ${c.sub}`;
    }
    const cap = captionFor(sceneOf(seg)!);
    return `${cap.title}. ${cap.text}${cap.gate ? ` ${cap.gate}` : ""}`;
}

/** Which of the five step dots a segment lights; 6 once past the last, so all five read as done. */
export function stepOf(seg: Segment): number {
    return seg === "end" ? SCENE_COUNT + 1 : sceneOf(seg)!;
}
