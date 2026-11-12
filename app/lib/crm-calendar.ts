/**
 * The portal calendar's shapes, vocabulary and time maths. Client-safe (no Redis), so the grid,
 * the form and the API share one source; the I/O is `portal-calendar.ts`.
 *
 * Ported from the console's calendar (`jdd-ops/console/src/lib/meetingTime.ts` and
 * `meetingTypes.ts`), Xander's ask on 2026-11-12: "We have this calendar already built in the
 * console. I basically just want to copy it over and adapt it to the portal." What carried over
 * unchanged is the part that is easy to get plausibly wrong: the **wall-clock** slot (a `day`
 * string plus minutes from midnight, no timezone, nothing that shifts across DST), the 6×7
 * Sunday-first month matrix, the overlap test and the chronological index score.
 *
 * What changed for a trade business: the kinds are Job visit, Estimate, Call back and Other (the
 * console had phone and video meetings), an appointment ties to a customer and one of their jobs
 * instead of a sales lead, and a length can be the whole day.
 */

/* ── vocabulary (approved wording, 2026-11-12) ────────────────────────────── */

export const APPT_KINDS = ["visit", "estimate", "callback", "other"] as const;
export type ApptKind = (typeof APPT_KINDS)[number];

export const APPT_KIND_LABEL: Record<ApptKind, string> = {
    visit: "Job visit",
    estimate: "Estimate",
    callback: "Call back",
    other: "Other",
};

export const APPT_STATUSES = ["scheduled", "done", "cancelled", "no-show"] as const;
export type ApptStatus = (typeof APPT_STATUSES)[number];

export const APPT_STATUS_LABEL: Record<ApptStatus, string> = {
    scheduled: "Scheduled",
    done: "Done",
    cancelled: "Cancelled",
    "no-show": "No-show",
};

/** A whole day is stored as midnight plus 1440 minutes. */
export const ALL_DAY = 1440;

/** The only lengths the form offers, in minutes. */
export const APPT_LENGTHS = [30, 60, 90, 120, 180, 240, ALL_DAY] as const;

export const LENGTH_LABEL: Record<number, string> = {
    30: "30 min",
    60: "1 hr",
    90: "1.5 hrs",
    120: "2 hrs",
    180: "3 hrs",
    240: "4 hrs",
    [ALL_DAY]: "All day",
};

/** Start-time picker granularity, in minutes. Same as the console. */
export const TIME_STEP = 15;

export interface Appointment {
    id: string;
    /** Who it is with. Null for something not tied to a customer ("Other"). */
    customerId: string | null;
    /** Which of that customer's jobs it is for, when it is for one. */
    jobId: string | null;
    /** Local calendar day, strictly 'YYYY-MM-DD'. Wall clock, never a timestamp. */
    day: string;
    /** Minutes from local midnight, 0 to 1439. */
    startMinutes: number;
    /** Minutes long; one of APPT_LENGTHS. `ALL_DAY` means the whole day. */
    durationMinutes: number;
    kind: ApptKind;
    status: ApptStatus;
    address: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export type ApptSlot = Pick<Appointment, "day" | "startMinutes" | "durationMinutes">;

/* ── parsing (what the API will store) ────────────────────────────────────── */

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDay(day: unknown): day is string {
    if (typeof day !== "string" || !DAY_RE.test(day)) return false;
    const { y, m, d } = parseDay(day);
    return m >= 0 && m < 12 && d >= 1 && d <= daysInMonth(y, m);
}

export type ApptFields = Pick<
    Appointment,
    "customerId" | "jobId" | "day" | "startMinutes" | "durationMinutes" | "kind" | "status" | "address" | "notes"
>;

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

function text(v: unknown, max: number): string | null | undefined {
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
}

/** The fields a change may carry; absent means unchanged. */
export function parseApptPatch(b: Record<string, unknown>): Parsed<Partial<ApptFields>> {
    const out: Partial<ApptFields> = {};
    if ("day" in b) {
        if (!isDay(b.day)) return { ok: false, error: "That isn't a day." };
        out.day = b.day;
    }
    if ("startMinutes" in b) {
        const n = b.startMinutes;
        if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 1439 || n % TIME_STEP !== 0) {
            return { ok: false, error: "That isn't a start time." };
        }
        out.startMinutes = n;
    }
    if ("durationMinutes" in b) {
        if (!(APPT_LENGTHS as readonly unknown[]).includes(b.durationMinutes)) {
            return { ok: false, error: "That isn't a length." };
        }
        out.durationMinutes = b.durationMinutes as number;
    }
    if ("kind" in b) {
        if (!(APPT_KINDS as readonly unknown[]).includes(b.kind)) return { ok: false, error: "That isn't a kind." };
        out.kind = b.kind as ApptKind;
    }
    if ("status" in b) {
        if (!(APPT_STATUSES as readonly unknown[]).includes(b.status)) return { ok: false, error: "That isn't a status." };
        out.status = b.status as ApptStatus;
    }
    for (const k of ["customerId", "jobId"] as const) {
        if (k in b) {
            const v = b[k];
            if (v !== null && (typeof v !== "string" || !v)) return { ok: false, error: `Bad ${k}.` };
            out[k] = v as string | null;
        }
    }
    for (const [k, max] of [
        ["address", 300],
        ["notes", 4000],
    ] as const) {
        if (k in b) {
            const t = text(b[k], max);
            if (t === undefined) return { ok: false, error: `Bad ${k}.` };
            out[k] = t;
        }
    }
    // A whole day starts at midnight, whatever start came with it.
    if (out.durationMinutes === ALL_DAY) out.startMinutes = 0;
    return { ok: true, value: out };
}

/** A new appointment: a day is required; the rest default to a one-hour job visit at 9:00a. */
export function parseNewAppt(b: Record<string, unknown>): Parsed<ApptFields> {
    if (!isDay(b.day)) return { ok: false, error: "That isn't a day." };
    const p = parseApptPatch(b);
    if (!p.ok) return p;
    const v: ApptFields = {
        customerId: null,
        jobId: null,
        startMinutes: 9 * 60,
        durationMinutes: 60,
        kind: "visit",
        status: "scheduled",
        address: null,
        notes: null,
        ...p.value,
        day: b.day,
    };
    // A job belongs to a customer; without one, the job link means nothing.
    if (!v.customerId) v.jobId = null;
    return { ok: true, value: v };
}

/* ── time and grid maths (ported from the console's meetingTime.ts) ───────── */

/** 'YYYY-MM-DD' → { y, m (0-based), d }. Pure string parse, no Date. */
export function parseDay(day: string): { y: number; m: number; d: number } {
    const [y, m, d] = day.split("-").map(Number);
    return { y, m: m - 1, d };
}

/** 'YYYY-MM-DD' from parts (month 0-based, zero-padded). */
export function toDay(y: number, m0: number, d: number): string {
    return `${y}-${String(m0 + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Today in the browser's local zone. `Date` is used only to read "now". */
export function todayDay(now = new Date()): string {
    return toDay(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysInMonth(y: number, m0: number): number {
    return new Date(y, m0 + 1, 0).getDate();
}

/** '2:30p', '11:00a', '12:15p'. Midnight is '12:00a', noon '12:00p'. Same as the console. */
export function formatTime(startMinutes: number): string {
    const h24 = Math.floor(startMinutes / 60);
    const min = startMinutes % 60;
    const ap = h24 < 12 ? "a" : "p";
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${String(min).padStart(2, "0")}${ap}`;
}

export function isAllDay(a: Pick<Appointment, "durationMinutes">): boolean {
    return a.durationMinutes >= ALL_DAY;
}

/** "11:00a to 1:00p", or "All day". */
export function formatSpan(a: Pick<Appointment, "startMinutes" | "durationMinutes">): string {
    if (isAllDay(a)) return LENGTH_LABEL[ALL_DAY];
    return `${formatTime(a.startMinutes)} to ${formatTime((a.startMinutes + a.durationMinutes) % 1440)}`;
}

/** Same day and their [start, start+length) intervals meet. */
export function overlaps(a: ApptSlot, b: ApptSlot): boolean {
    if (a.day !== b.day) return false;
    return a.startMinutes < b.startMinutes + b.durationMinutes && b.startMinutes < a.startMinutes + a.durationMinutes;
}

/**
 * The first live appointment `candidate` overlaps, or null. Advisory only: the form warns and
 * still saves ("warn but allow", as in the console). Cancelled ones take no time.
 */
export function firstConflict<T extends Appointment>(candidate: ApptSlot, others: T[], excludeId?: string): T | null {
    for (const a of others) {
        if (excludeId && a.id === excludeId) continue;
        if (a.status === "cancelled") continue;
        if (overlaps(candidate, a)) return a;
    }
    return null;
}

/** Earliest start first, all-day ones on top; ties by creation. */
export function compareByStart(a: Appointment, b: Appointment): number {
    const aa = isAllDay(a) ? -1 : a.startMinutes;
    const bb = isAllDay(b) ? -1 : b.startMinutes;
    if (aa !== bb) return aa - bb;
    return a.createdAt.localeCompare(b.createdAt);
}

/**
 * Chronological score for the KV index: Number(day without dashes) × 1440 + startMinutes. The
 * day part dominates, so an ascending range reads in true time order across months and years.
 */
export function scoreOf(day: string, startMinutes: number): number {
    return Number(day.replace(/-/g, "")) * 1440 + startMinutes;
}

/** 6 weeks × 7 days, Sunday first, always six rows so the grid never changes height. */
export function monthMatrix(year: number, month0: number): Array<Array<{ day: string; inMonth: boolean }>> {
    const firstDow = new Date(year, month0, 1).getDay();
    const weeks: Array<Array<{ day: string; inMonth: boolean }>> = [];
    for (let w = 0; w < 6; w++) {
        const row: Array<{ day: string; inMonth: boolean }> = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(year, month0, 1 - firstDow + w * 7 + i);
            row.push({
                day: toDay(d.getFullYear(), d.getMonth(), d.getDate()),
                inMonth: d.getMonth() === month0 && d.getFullYear() === year,
            });
        }
        weeks.push(row);
    }
    return weeks;
}

/** Step a 'YYYY-MM' by ±N months. */
export function shiftMonth(ym: string, delta: number): string {
    const [y, m] = ym.split("-").map(Number);
    const total = y * 12 + (m - 1) + delta;
    return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** 'November 2026' from 'YYYY-MM'. */
export function monthLabel(ym: string): string {
    const [y, m] = ym.split("-").map(Number);
    return `${MONTHS[m - 1]} ${y}`;
}

/** 'Thursday Nov 12', or 'Today, Thursday Nov 12' (the approved day heading). */
export function dayHeadingLabel(day: string, today: string): string {
    const { y, m, d } = parseDay(day);
    const label = `${WEEKDAYS[new Date(y, m, d).getDay()]} ${MONTHS_SHORT[m]} ${d}`;
    return day === today ? `Today, ${label}` : label;
}

/** 'Thu, Nov 12', or 'Today', for a short line ("Next visit today · 11:00a"). */
export function shortDayLabel(day: string, today: string): string {
    if (day === today) return "Today";
    const { y, m, d } = parseDay(day);
    return `${WEEKDAYS[new Date(y, m, d).getDay()].slice(0, 3)}, ${MONTHS_SHORT[m]} ${d}`;
}

/**
 * The next appointment still to come for a job (or a customer): scheduled, today or later,
 * earliest first. What "Next visit" and "Coming up" show.
 */
export function upcoming<T extends Appointment>(appts: T[], today: string): T[] {
    return appts
        .filter((a) => a.status === "scheduled" && a.day >= today)
        .sort((a, b) => scoreOf(a.day, isAllDay(a) ? 0 : a.startMinutes) - scoreOf(b.day, isAllDay(b) ? 0 : b.startMinutes));
}
