import { CARRIER_LINE } from "@/app/data/portal-demo";

/**
 * The Starter → Growth demo's script: the order it plays in, how long each part holds, what each
 * scene shows at a given moment, where the cursor (or, on a phone, the finger) is, and every word
 * it says.
 *
 * Kept free of React so the timing rules can be tested on their own (`test/growth-demo.test.mjs`).
 *
 * Rebuilt 2026-11-12 (Xander): five steps, a cursor that does every click, and the portal's real
 * screens. Rebuilt again 2026-11-19 for the phone app (portal-tour-mobile, approved mockup
 * versions 4 to 6): on a phone the scenes play on the new app screens (Inbox, the full-screen
 * lead, Customers with its stage pills and press-and-hold Stage sheet, the contact-card record,
 * the texting screen, Calendar), the step box sits at the top, there is no top bar, and the review
 * is the record's one tap with its "Review request sent!" note, on the desktop too. No dashes in
 * any client copy.
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
 * How long each part holds, in ms: about a minute and forty seconds end to end.
 *
 * 2026-11-19 (Xander, on the phone mockup): Promote lingered after the promotion, so it is 10.5s;
 * Jobs is a touch slower between its beats (18.5s); the Timeline now walks the history, opens the
 * texting screen and comes back (19.5s); the review is one tap (13s). The rest are as before.
 */
export const DURATION: Record<Exclude<Segment, "end">, number> = {
    intro: 5000,
    scrim1: 4000,
    s1: 10500,
    scrim2: 4000,
    s2: 14000,
    scrim3: 4000,
    s3: 18500,
    scrim4: 4000,
    s4: 19500,
    scrim5: 4000,
    s5: 13000,
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
 * The desktop's beats, in ms from the scene's start. The caption comes up first and the action
 * follows, so the words say what is about to happen rather than chasing it. Every click lands a
 * beat after the cursor arrives, so it reads as a person, not a jump cut.
 */
export const BEATS = {
    caption: 800,
    s1: { open: 2800, promoting: 6000, promoted: 6800 },
    /* Dave's card steps Lead → Contacted → Quoted → Scheduled. */
    s2: { lift: 2400, moves: [3600, 5000, 6400], drop: 7000 },
    s3: { record: 2200, jobsTab: 4000, job: 6200, calendar: 8800 },
    s4: { focus: 3000, typeFrom: 3200, sent: 7800, reply: 10800 },
    /* One tap on Request a review, then its note. */
    s5: { won: 2400, sent: 4400 },
} as const;

/**
 * The phone's beats (the approved mockup's `script()`, 2026-11-19). A tap shows the finger at a
 * time, presses it 560ms later, and what it causes happens just after the press.
 */
export const PHONE_BEATS = {
    caption: 800,
    /* Inbox → Dave's lead full screen → down to Promote → Adding… → promoted. */
    s1: { open: 2700, scroll: 4000, promoting: 5900, promoted: 6900 },
    /* Press and hold Dave, the Stage sheet, pick the next stage; three times. Then the quiet one. */
    s2: { moves: [2000, 5200, 8400], sheetAfter: 700, pickAfter: 2100, quiet: 11200 },
    /* Dave's record → Jobs → Add a job → Add to calendar → back → the Calendar tab. */
    s3: { record: 3000, jobsTab: 5200, job: 7000, visit: 9500, back: 11300, calendar: 12700 },
    /* Down the timeline to the text bar, back up, Text → the texting screen, typed, sent,
       delivered, answered, then back to the timeline with both texts on it. */
    s4: {
        down: 2000,
        end: 3600,
        bar: 4800,
        top: 6400,
        thread: 8200,
        typeFrom: 8600,
        typeTo: 11200,
        sending: 11900,
        delivered: 12700,
        reply: 14200,
        back: 16600,
        settle: 17000,
    },
    /* The record's top, the stage pill → Won, the Review button lit, one tap, the note. */
    s5: { top: 400, sheet: 2800, won: 4200, lit: 5400, sent: 6700 },
} as const;

export type BoardStage = 0 | 1 | 2 | 3;
export type RecordView = "none" | "record" | "calendar";
/** Where the phone's step box sits: the top, just below the middle, or the bottom. */
export type CaptionAt = "top" | "mid" | "bottom";

/**
 * A scroll the phone scene makes on its own, as a person would: to the top, to the end, or to
 * an element (a selector) with `offset` px left above it for the step box. `key` changes each time
 * a new scroll is due, so the replica runs each one once.
 */
export interface ScrollCue {
    key: string;
    to: "top" | "end" | string;
    offset?: number;
}

export interface SceneView {
    caption: boolean;
    /** Phone: where the step box sits. The desktop's caption has its own fixed place. */
    captionAt: CaptionAt;
    /** Phone: step 4's second words, while the texting screen is open. */
    captionPhase: "4b" | null;
    /* 1: the lead opens and is promoted */
    leadOpen: boolean;
    promoting: boolean;
    promoted: boolean;
    /* 2: Dave's stage, 0 = Lead … 3 = Scheduled; desktop: whether his card is in hand */
    daveStage: BoardStage;
    lifted: boolean;
    /** Phone: the Stage sheet is open (scenes 2 and 5). */
    stageSheet: boolean;
    /** Phone: the customer going quiet is pointed out. */
    quiet: boolean;
    /* 3: the file opens on Timeline, goes to Jobs, a job is added and booked, the calendar shows it */
    view: RecordView;
    tab: "timeline" | "jobs";
    job: boolean;
    visit: boolean;
    /* 4: the text being typed, then sent, delivered and answered */
    composing: boolean;
    typed: string;
    sending: boolean;
    sent: boolean;
    delivered: boolean;
    reply: boolean;
    /** Phone: the texting screen is open. */
    thread: boolean;
    /** Phone: the "Text Dave…" bar under the timeline is pointed out. */
    barLit: boolean;
    /* 5: Won, and the one-tap review request */
    won: boolean;
    /** Phone: the Review button is lit, about to be tapped. */
    reviewLit: boolean;
    reviewSent: boolean;
    /** "Review request sent!" is showing. */
    toast: boolean;
    /** Phone: the scroll the scene is on. */
    scroll: ScrollCue | null;
}

export interface ViewOptions {
    /** Reduced motion: every scene is its finished frame from the first moment. */
    still?: boolean;
    /** The phone's beats and screens rather than the desktop's. */
    phone?: boolean;
    /** The text Dave is sent: the trade's own (`TradeSample.sms`). */
    sms?: string;
}

/** `text` typed out between `from` and `to`, all of it by `to`, whatever its length. */
function typedAt(text: string, at: number, from: number, to: number): string {
    if (at < from) return "";
    if (at >= to) return text;
    return text.slice(0, Math.floor(((at - from) / (to - from)) * text.length));
}

/** The latest of `cues` that has come due, as a ScrollCue keyed by scene and time. */
function cueAt(scene: SceneNo, at: number, cues: [number, ScrollCue["to"], number?][]): ScrollCue {
    let cur: ScrollCue = { key: `${scene}:0`, to: "top" };
    for (const [t, to, offset] of cues) if (at >= t) cur = { key: `${scene}:${t}`, to, offset };
    return cur;
}

/** The timeline's selector on the phone record, where scene 4 walks to. */
export const PHONE_TIMELINE = '[data-tour="crm-drawer-timeline"]';
/** Room left above a scrolled-to element for the step box at the top. */
const BOX_ROOM = 190;

/**
 * The scene's state `ms` into it. `still` is reduced motion: every scene is drawn as its
 * finished frame from the first moment, so nothing inside it moves.
 */
export function sceneView(scene: SceneNo, ms: number, opts: ViewOptions = {}): SceneView {
    const { still = false, phone = false, sms = "" } = opts;
    const at = still ? Number.POSITIVE_INFINITY : ms;
    const B = phone ? PHONE_BEATS : BEATS;
    const v: SceneView = {
        caption: at >= B.caption,
        captionAt: "top",
        captionPhase: null,
        leadOpen: false,
        promoting: false,
        promoted: false,
        daveStage: 0,
        lifted: false,
        stageSheet: false,
        quiet: false,
        view: "none",
        tab: "timeline",
        job: false,
        visit: false,
        composing: false,
        typed: "",
        sending: false,
        sent: false,
        delivered: false,
        reply: false,
        thread: false,
        barLit: false,
        won: false,
        reviewLit: false,
        reviewSent: false,
        toast: false,
        scroll: phone ? { key: `${scene}:0`, to: "top" } : null,
    };
    return phone ? phoneScene(v, scene, at, still, sms) : deskScene(v, scene, at, still, sms);
}

function deskScene(v: SceneView, scene: SceneNo, at: number, still: boolean, sms: string): SceneView {
    const B = BEATS;
    if (scene === 1) {
        v.leadOpen = at >= B.s1.open;
        v.promoted = at >= B.s1.promoted;
        v.promoting = at >= B.s1.promoting && !v.promoted;
        return v;
    }
    // From scene 2 on, Dave is a customer.
    v.promoted = true;
    if (scene === 2) {
        v.daveStage = B.s2.moves.filter((m) => at >= m).length as BoardStage;
        v.lifted = at >= B.s2.lift && at < B.s2.drop;
        return v;
    }
    v.daveStage = 3;
    if (scene === 3) {
        v.view = at >= B.s3.calendar ? "calendar" : at >= B.s3.record ? "record" : "none";
        v.tab = at >= B.s3.jobsTab ? "jobs" : "timeline";
        v.job = at >= B.s3.job;
        v.visit = v.view === "calendar";
        return v;
    }
    // The job and its visit are booked before scene 4 opens.
    v.view = "record";
    v.job = true;
    v.visit = true;
    if (scene === 4) {
        v.sent = at >= B.s4.sent;
        v.delivered = v.sent;
        v.reply = at >= B.s4.reply;
        v.composing = at >= B.s4.focus && !v.sent && !still;
        if (!v.sent) v.typed = typedAt(sms, at, B.s4.typeFrom, B.s4.sent - 600);
        return v;
    }
    // Scene 5: the conversation from scene 4 is all there; Won, then one tap.
    v.sent = v.delivered = v.reply = true;
    v.won = at >= B.s5.won;
    v.reviewSent = v.toast = at >= B.s5.sent;
    return v;
}

function phoneScene(v: SceneView, scene: SceneNo, at: number, still: boolean, sms: string): SceneView {
    const B = PHONE_BEATS;
    if (scene === 1) {
        v.leadOpen = at >= B.s1.open;
        v.promoted = at >= B.s1.promoted;
        v.promoting = at >= B.s1.promoting && !v.promoted;
        v.scroll = cueAt(1, at, [[B.s1.scroll, "end"]]);
        return v;
    }
    v.promoted = true;
    if (scene === 2) {
        const { moves, sheetAfter, pickAfter } = B.s2;
        v.daveStage = moves.filter((m) => at >= m + pickAfter).length as BoardStage;
        v.stageSheet = moves.some((m) => at >= m + sheetAfter && at < m + pickAfter);
        v.quiet = at >= B.s2.quiet;
        return v;
    }
    v.daveStage = 3;
    if (scene === 3) {
        const s = B.s3;
        v.view = at >= s.calendar ? "calendar" : at >= s.record && at < s.back ? "record" : "none";
        v.tab = at >= s.jobsTab ? "jobs" : "timeline";
        v.job = at >= s.job;
        v.visit = at >= s.visit;
        // The calendar opens at its top; then down to today's list, where Dave's visit is.
        v.scroll = cueAt(3, at, [[s.calendar + 400, '[data-tour="cal-day"]', BOX_ROOM]]);
        return v;
    }
    // Scene 4 opens on Dave's record, the job and its visit already booked.
    v.view = "record";
    v.job = true;
    v.visit = true;
    if (scene === 4) {
        const s = B.s4;
        v.thread = at >= s.thread && at < s.back;
        v.captionAt = v.thread ? "mid" : "top";
        v.captionPhase = v.thread ? "4b" : null;
        v.barLit = at >= s.bar && at < s.top;
        v.sent = at >= s.sending;
        v.sending = v.sent && at < s.delivered;
        v.delivered = at >= s.delivered;
        v.reply = at >= s.reply;
        v.composing = v.thread && !v.sent && at >= s.typeFrom && !still;
        if (!v.sent) v.typed = typedAt(sms, at, s.typeFrom, s.typeTo);
        v.scroll = cueAt(4, at, [
            [s.down, PHONE_TIMELINE, BOX_ROOM],
            [s.end, "end"],
            [s.top, "top"],
            [s.settle, PHONE_TIMELINE, BOX_ROOM],
        ]);
        return v;
    }
    // Scene 5: the step box at the bottom, so the record's top (stage pill, Review) stays in view.
    const s = B.s5;
    v.captionAt = "bottom";
    v.sent = v.delivered = v.reply = true;
    v.stageSheet = at >= s.sheet && at < s.won;
    v.won = at >= s.won;
    v.reviewLit = at >= s.lit && at < s.sent;
    v.reviewSent = v.toast = at >= s.sent;
    v.scroll = cueAt(5, at, [[s.top, "top"]]);
    return v;
}

/* ── the cursor ─────────────────────────────────────────────────────────── */

/**
 * Where the cursor goes, as CSS selectors resolved inside the replica at render time, so it lands
 * on the real element wherever the real layout puts it. `null` is off screen. A `click` is drawn
 * as a press and a ring at that moment; `down` holds the button (the drag on the board, the
 * press and hold on a phone).
 */
export interface CursorStop {
    at: number;
    to: string | null;
    click?: boolean;
    down?: boolean;
}

export const DAVE_ID = "demo-dave";
/** Dave's inbox row on the desktop: rows are keyed `{status}:contact:{e164}`. */
const DAVE_ROW = '[data-row-id$="contact:+15125550129"]';

const col = (label: string) => `section[aria-label="${label} column"]`;

export const CURSOR: Record<SceneNo, CursorStop[]> = {
    1: [
        { at: 1200, to: DAVE_ROW },
        { at: 2600, to: DAVE_ROW, click: true },
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
        { at: 1800, to: "#crm-sms" },
        { at: 2800, to: "#crm-sms", click: true },
        { at: 6800, to: '[data-demo="send"]' },
        { at: 7600, to: '[data-demo="send"]', click: true },
        /* Up to the timeline, where the text has just landed, and where the reply comes in. */
        { at: 8600, to: '[data-tour="crm-drawer-timeline"]' },
        { at: 13500, to: null },
    ],
    5: [
        { at: 1200, to: '[data-demo="stage-won"]' },
        { at: 2200, to: '[data-demo="stage-won"]', click: true },
        { at: 3400, to: '[data-tour="crm-drawer-review"]' },
        { at: 4200, to: '[data-tour="crm-drawer-review"]', click: true },
        { at: 5600, to: null },
    ],
};

/* The phone's finger. Selectors on the new app screens; `PhoneReplica` tags the two rows that
   have no attribute of their own (`data-demo-row`). */
export const PHONE_TARGET = {
    inboxRow: '[data-demo-row="dave"]',
    promote: '[data-tour="inbox-promote"]',
    daveCard: `[data-customer-id="${DAVE_ID}"]`,
    quietCard: '[data-customer-id="demo-kyle"]',
    stageOption: (stage: string) => `[data-demo-stage="${stage}"]`,
    jobsTab: "#crm-tab-jobs",
    addJob: '[data-tour="crm-jobs-add"]',
    addToCalendar: '[data-tour="crm-job-calendar"]',
    back: '[data-demo="back"]',
    calendarTab: '[data-demo-tab="calendar"]',
    textBar: "#crm-composer button",
    text: 'a.portal-round[href="#crm-sms"]',
    send: 'section[aria-label^="Texts with"] button[type="submit"]',
    threadBack: 'section[aria-label^="Texts with"] header button',
    stagePill: '[data-tour="crm-drawer-stage"] button',
    review: '[data-tour="crm-drawer-review"]',
} as const;

/** A tap: the finger shows at `at`, presses 560ms later, and lifts away. */
function tapAt(at: number, to: string): CursorStop[] {
    return [
        { at, to },
        { at: at + 560, to, click: true },
        { at: at + 1100, to: null },
    ];
}
/** Press and hold: the finger stays down, the sheet opens under it, then it lifts. */
function holdAt(at: number, to: string): CursorStop[] {
    return [
        { at, to },
        { at: at + 560, to, down: true },
        { at: at + 1100, to },
    ];
}

const P = PHONE_BEATS;
const T = PHONE_TARGET;
const STAGE_ORDER = ["contacted", "quoted", "scheduled"] as const;

export const PHONE_CURSOR: Record<SceneNo, CursorStop[]> = {
    1: [...tapAt(P.s1.open - 700, T.inboxRow), ...tapAt(P.s1.promoting - 700, T.promote)],
    2: [
        ...P.s2.moves.flatMap((m, i) => [
            ...holdAt(m, T.daveCard),
            ...tapAt(m + 1500, T.stageOption(STAGE_ORDER[i])).slice(0, 2),
            { at: m + 2400, to: null },
        ]),
        /* Pointed at, not tapped: the orange dot is the point. */
        { at: P.s2.quiet, to: T.quietCard },
        { at: P.s2.quiet + 1600, to: null },
    ],
    3: [
        ...tapAt(P.s3.record - 700, T.daveCard),
        ...tapAt(P.s3.jobsTab - 700, T.jobsTab),
        ...tapAt(P.s3.job - 700, T.addJob),
        ...tapAt(P.s3.visit - 700, T.addToCalendar),
        ...tapAt(P.s3.back - 700, T.back),
        ...tapAt(P.s3.calendar - 700, T.calendarTab),
    ],
    4: [
        /* The text bar is pointed out, not tapped: Text above it is what opens the conversation. */
        { at: P.s4.bar, to: T.textBar },
        { at: P.s4.top, to: null },
        ...tapAt(P.s4.thread - 600, T.text),
        { at: P.s4.sending - 500, to: T.send },
        { at: P.s4.sending - 100, to: T.send, click: true },
        { at: P.s4.sending + 400, to: null },
        ...tapAt(P.s4.back - 600, T.threadBack),
    ],
    5: [
        ...tapAt(P.s5.sheet - 600, T.stagePill),
        ...tapAt(P.s5.won - 600, T.stageOption("won")),
        ...tapAt(P.s5.sent - 700, T.review),
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

/** The cursor `ms` into a scene, from the desktop's stops or the phone's. Reduced motion draws none. */
export function cursorAt(scene: SceneNo, ms: number, still = false, phone = false): CursorState {
    const off: CursorState = { from: null, to: null, p: 1, down: false, clicks: 0, pressing: false };
    if (still) return off;
    const stops = (phone ? PHONE_CURSOR : CURSOR)[scene];
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
            sub: "Watch a lead become a customer you never lose track of.", // 2026-11-19, phone and desktop
        },
        scrim1: {
            label: "STEP 1 OF 5",
            title: "Turn a lead into a customer", // Xander, 2026-11-19
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
            title: "Timeline", // Xander, 2026-11-19
            sub: "Your customer, from lead to now.", // 2026-11-19
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
            /* 2026-11-19: on a phone he moves by press and hold. */
            textPhone:
                "Move Dave along as the job moves: Lead, Contacted, Quoted, Scheduled. Press and hold to change his stage. Anyone going quiet gets an orange dot.",
        },
        3: {
            title: "Jobs",
            text: "Open Dave's file and add the job: the service, its status and what it's worth. Add to calendar books the visit.",
        },
        4: {
            title: "Timeline", // Xander, 2026-11-19
            text: "Keep track of everything you've done for a customer and message them all in one place.",
            /* Phone, while the texting screen is open (2026-11-19). */
            textThread:
                "Or tap Text for the whole conversation. Your texts go out from your business number, and the replies land on the timeline too.",
        },
        5: {
            title: "Review",
            text: "When the job is done, one tap sends them a Google review request. Want to change what it says? Set your Review message in More.",
        },
    },
    /** The record's one-tap note, as the portal shows it (Xander's words, 2026-11-19). */
    reviewSent: "Review request sent!",
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

export interface CaptionOptions {
    phone?: boolean;
    /** Step 4's second words, while the texting screen is open (phone only). */
    phase?: "4b" | null;
}

export function captionFor(
    scene: SceneNo,
    { phone = false, phase = null }: CaptionOptions = {},
): { step: string; title: string; text: string; gate: string | null } {
    const c: { title: string; text: string; textPhone?: string; textThread?: string } = COPY.captions[scene];
    const text = phone && phase === "4b" && c.textThread ? c.textThread : phone && c.textPhone ? c.textPhone : c.text;
    // The phone has no top bar to say it is sample data, so the step box does (2026-11-19).
    const step = `STEP ${scene} OF ${SCENE_COUNT}${phone ? " · SAMPLE DATA" : ""}`;
    return { step, title: c.title, text, gate: GATED[scene] ? CARRIER_LINE : null };
}

/**
 * What the polite live region says when a part begins: the title card's words, or the scene's
 * caption. The replica itself is hidden from assistive tech, so this is the narration a screen
 * reader gets. The end card says nothing here, because focus moves onto its heading instead.
 */
export function announcementFor(seg: Segment, opts: CaptionOptions = {}): string {
    if (seg === "end") return "";
    if (isScrim(seg)) {
        const c: ScrimCopy = COPY.scrims[seg as keyof typeof COPY.scrims];
        return `${c.label}. ${c.title}. ${(opts.phone && c.subPhone) || c.sub}`;
    }
    const cap = captionFor(sceneOf(seg)!, opts);
    return `${cap.title}. ${cap.text}${cap.gate ? ` ${cap.gate}` : ""}`;
}

/** Which of the five step dots a segment lights; 6 once past the last, so all five read as done. */
export function stepOf(seg: Segment): number {
    return seg === "end" ? SCENE_COUNT + 1 : sceneOf(seg)!;
}
