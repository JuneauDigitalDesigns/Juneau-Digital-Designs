import { CARRIER_LINE, DEMO_STEPS } from "@/app/data/portal-demo";

/**
 * The Starter → Growth demo's script: the order it plays in, how long each part holds, what
 * each scene shows at a given moment, and every word it says.
 *
 * Kept free of React so the timing rules can be tested on their own (`test/growth-demo.test.mjs`).
 *
 * Wording. Every client-facing string here was approved by Xander word for word on 9 Nov 2026
 * ("Starter → Growth demo" in the portal UX rework copy draft, plus the text inside the
 * GrowthDemo / GrowthDemoPhone mockups). The four step captions are not restated: they are the
 * homepage demo's own (`DEMO_STEPS` in `app/data/portal-demo.ts`, approved 4 Nov 2026), read from
 * there so the two demos cannot drift apart. Do not edit any of it without a fresh approval.
 */

/* ── the sequence ───────────────────────────────────────────────────────── */

/** Intro, then a title card ("scrim") before each of the four scenes, then the end card. */
export const SEGMENTS = ["intro", "scrim1", "s1", "scrim2", "s2", "scrim3", "s3", "scrim4", "s4", "end"] as const;
export type Segment = (typeof SEGMENTS)[number];
export type SceneNo = 1 | 2 | 3 | 4;

/**
 * How long each part holds, in ms. About a minute end to end (60.5s), which is what the
 * Customers page promises ("A one-minute demo…") and the intro repeats ("About a minute").
 *
 * The mockup's starting point was 4s / 3s / 7s, which came to 44s and left the scenes too short
 * to read: a caption plus the carrier line is ~25 words, and the scene is still moving while it
 * is up. The scrims got half a second more so their one line can be read after the title, and
 * each scene got the time its beats (`BEATS`) need plus a few seconds' hold on the finished frame.
 */
export const DURATION: Record<Exclude<Segment, "end">, number> = {
    intro: 4500,
    scrim1: 3500,
    s1: 10000,
    scrim2: 3500,
    s2: 10000,
    scrim3: 3500,
    s3: 11000,
    scrim4: 3500,
    s4: 11000,
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
 * the action follows, so the words say what is about to happen rather than chasing it.
 */
export const BEATS = {
    caption: 800,
    s1: { drawer: 2000, promoted: 5200 },
    /* Dave's card steps Lead → Contacted → Quoted → Scheduled. */
    s2: { moves: [2400, 4000, 5600] },
    s3: { typeFrom: 1600, charsPerSec: 32, sent: 4800, reply: 6600 },
    s4: { dialog: 1600, armed: 3400, sent: 5000, dialogClose: 7000 },
} as const;

export interface SceneView {
    caption: boolean;
    /* 1: the lead opens and is promoted */
    drawer: boolean;
    promoted: boolean;
    /* 2: Dave's column, 0 = Lead … 3 = Scheduled */
    daveStage: 0 | 1 | 2 | 3;
    /* 3: the text being typed, then sent, then answered */
    typed: string;
    sent: boolean;
    reply: boolean;
    /* 4: the review request */
    won: boolean;
    dialog: boolean;
    /** Send request is pulsing, about to be pressed. */
    armed: boolean;
    reviewSent: boolean;
}

/**
 * The scene's state `ms` into it. `still` is reduced motion: every scene is drawn as its
 * finished frame from the first moment, so nothing inside it moves. The one difference from
 * the last moving frame is scene 4, which keeps the review dialog open on "Review requested",
 * because that dialog (the message already written) is what its caption is about.
 */
export function sceneView(scene: SceneNo, ms: number, still = false): SceneView {
    const at = still ? Number.POSITIVE_INFINITY : ms;
    const v: SceneView = {
        caption: at >= BEATS.caption,
        drawer: false,
        promoted: false,
        daveStage: 0,
        typed: "",
        sent: false,
        reply: false,
        won: false,
        dialog: false,
        armed: false,
        reviewSent: false,
    };
    if (scene === 1) {
        v.drawer = at >= BEATS.s1.drawer;
        v.promoted = at >= BEATS.s1.promoted;
    } else if (scene === 2) {
        v.daveStage = BEATS.s2.moves.filter((m) => at >= m).length as SceneView["daveStage"];
    } else if (scene === 3) {
        v.daveStage = 3;
        v.sent = at >= BEATS.s3.sent;
        v.reply = at >= BEATS.s3.reply;
        if (!v.sent && at >= BEATS.s3.typeFrom) {
            const n = Math.floor(((at - BEATS.s3.typeFrom) / 1000) * BEATS.s3.charsPerSec);
            v.typed = COPY.sms.slice(0, n);
        }
    } else {
        // The job is done before scene 4 opens: the conversation from scene 3 is all there.
        v.daveStage = 3;
        v.won = true;
        v.sent = true;
        v.reply = true;
        v.reviewSent = at >= BEATS.s4.sent;
        v.armed = at >= BEATS.s4.armed && !v.reviewSent;
        v.dialog = still || (at >= BEATS.s4.dialog && at < BEATS.s4.dialogClose);
    }
    return v;
}

/* ── the words ──────────────────────────────────────────────────────────── */

export interface ScrimCopy {
    label: string;
    title: string;
    /** The desktop line. */
    sub: string;
    /** The phone mockup's shorter line, where it has one. */
    subPhone?: string;
}

export const COPY = {
    tag: "GROWTH DEMO · SAMPLE DATA",
    exit: "Exit demo",
    back: "Back",
    pause: "Pause",
    play: "Play",
    next: "Next",
    scrims: {
        intro: {
            label: "GROWTH, ON SAMPLE DATA",
            title: "One call, start to finish",
            sub: "Watch a late-night call become a booked job and a Google review. About a minute.",
            subPhone: "Watch a late-night call become a booked job and a Google review.",
        },
        scrim1: {
            label: "STEP 1 OF 4",
            title: "Turn a caller into a customer",
            sub: "Your receptionist answered at 2:13 AM. Here’s what happens next.",
            subPhone: "Your receptionist answered at 2:13 AM.",
        },
        scrim2: {
            label: "STEP 2 OF 4",
            title: "Work the job",
            sub: "Every customer on one board, from first call to booked.",
            subPhone: "Every customer on one board.",
        },
        scrim3: {
            label: "STEP 3 OF 4",
            title: "Text them from your business number",
            sub: "No more giving out your mobile.",
        },
        scrim4: {
            label: "STEP 4 OF 4",
            title: "Ask for the review",
            sub: "The job’s done. One tap brings in the next one.",
            subPhone: "One tap brings in the next job.",
        },
    } satisfies Record<Exclude<Segment, "end" | "s1" | "s2" | "s3" | "s4">, ScrimCopy>,
    /* Sample content */
    sms: "Hi Dave, it's Mike from Brannock. I can be there by 8 to get the heat back on.",
    reply: "Perfect, see you at 8. Thank you!",
    review: "Thanks for choosing Brannock Heating & Air! If you have a minute, would you leave us a quick Google review? g.page/r/brannock",
    /* The mockup's "+ Promote to customer": the "+" is drawn as the live button's plus icon. */
    promote: "Promote to customer",
    promoted: "Dave is now a customer",
    reviewTitle: "Request a Google review",
    reviewSend: "Send request",
    reviewSent: "Review requested",
    /* End card. Heading, body and the upgrade button are the old driver.js showcase's last step,
       reused unchanged; "Watch again" and "Not now" are new and approved with the rest. */
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

/** A scene's caption: the homepage demo's step of the same name. Its Inbox step is not used. */
const CAPTION_KEY = { 1: "promote", 2: "pipeline", 3: "message", 4: "review" } as const;

export function captionFor(scene: SceneNo): { step: string; title: string; text: string; gate: string | null } {
    const st = DEMO_STEPS.find((d) => d.key === CAPTION_KEY[scene])!;
    return { step: `STEP ${scene} OF 4`, title: st.short, text: st.caption, gate: st.gated ? CARRIER_LINE : null };
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

/** Which of the four step dots a segment lights; 5 once past the last, so all four read as done. */
export function stepOf(seg: Segment): number {
    return seg === "end" ? 5 : sceneOf(seg)!;
}
