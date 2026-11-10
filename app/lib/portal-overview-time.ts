/**
 * The Overview's clock: "this week", "today", and "after hours", in the client's own time.
 *
 * Pure and deterministic — every function takes `nowMs` and a time zone rather than reading
 * the clock, so the week bounds and the after-hours rule are testable on fixed instants
 * (`test/portal-overview.test.mjs`).
 *
 * **Whose time zone.** Neither `PortalAccount` nor `PortalSite` (`@jdd/schema` v1.31) stores
 * one, and nothing else the portal can read does either. Until it does, every caller passes
 * `OVERVIEW_TIME_ZONE`, which is Eastern for the same reason the agreement PDFs print ET
 * (`pdf-signer.ts`): it is the business time the rest of this repository already assumes.
 * The old Overview windowed on the server's clock, which on Vercel is UTC — "today" there
 * rolled over at 7 or 8 PM for an East Coast client. When a per-client zone lands, it is
 * one argument at the call site; nothing in here changes.
 */

/** The zone the Overview counts in until a client's own is stored. See the note above. */
export const OVERVIEW_TIME_ZONE = "America/New_York";

const DAY_MS = 86_400_000;

/** One instant as a wall clock in `timeZone`. `weekday` is 0 = Monday … 6 = Sunday. */
export interface ZonedParts {
    year: number;
    /** 1–12. */
    month: number;
    day: number;
    weekday: number;
    hour: number;
    minute: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
};

/**
 * One formatter per zone. `Intl.DateTimeFormat` construction is the expensive part, and a
 * single Overview render asks for a few hundred instants.
 */
const partsFormatters = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string): Intl.DateTimeFormat {
    let f = partsFormatters.get(timeZone);
    if (!f) {
        f = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            weekday: "short",
            hour: "numeric",
            minute: "numeric",
            // h23, not hour12:false — the latter renders midnight as "24" in some engines.
            hourCycle: "h23",
        });
        partsFormatters.set(timeZone, f);
    }
    return f;
}

export function zonedParts(ms: number, timeZone: string): ZonedParts {
    const out: Record<string, string> = {};
    for (const p of partsFormatter(timeZone).formatToParts(new Date(ms))) out[p.type] = p.value;
    return {
        year: Number(out.year),
        month: Number(out.month),
        day: Number(out.day),
        weekday: WEEKDAY_INDEX[out.weekday] ?? 0,
        hour: Number(out.hour) % 24,
        minute: Number(out.minute),
    };
}

/** How far `timeZone` is ahead of UTC at this instant, in ms (negative west of Greenwich). */
function offsetAt(ms: number, timeZone: string): number {
    const p = zonedParts(ms, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    // Seconds are dropped by the formatter, so compare against the instant floored to the minute.
    return asUtc - Math.floor(ms / 60_000) * 60_000;
}

/**
 * The instant local midnight begins on a calendar date in `timeZone`.
 *
 * `month`/`day` may overflow (day 0, day 32) and roll over the way `Date.UTC` rolls them, which
 * is how the week walks forward without month arithmetic. The offset is re-read at the
 * candidate because the date may sit on the other side of a DST change from the first guess.
 */
export function zonedMidnight(year: number, month: number, day: number, timeZone: string): number {
    const wall = Date.UTC(year, month - 1, day);
    let guess = wall - offsetAt(wall, timeZone);
    const corrected = wall - offsetAt(guess, timeZone);
    if (corrected !== guess) guess = corrected;
    return guess;
}

/**
 * Monday to now, plus the same stretch of last week.
 *
 * `dayStarts` holds eight instants, Monday 00:00 through the following Monday 00:00, each a
 * real local midnight — so a DST week has one 23- or 25-hour day rather than every bucket
 * after the change being off by an hour.
 *
 * The comparison window is **the same elapsed span** of last week, not all of it. On a Tuesday
 * morning, last week's full seven days would make every client look like they were having a
 * terrible week; "▲ 4 more than last week" has to be a like-for-like count to be true.
 */
export interface WeekBounds {
    startMs: number;
    nowMs: number;
    dayStarts: number[];
    /** 0 = Monday … 6 = Sunday. */
    todayIndex: number;
    /** End of today, local. The "due today" cut-off. */
    todayEndMs: number;
    previousStartMs: number;
    previousEndMs: number;
    /** Monday's date, for the "This week, Mon Nov 3 – today" line. */
    monday: { year: number; month: number; day: number };
}

export function weekBounds(nowMs: number, timeZone: string): WeekBounds {
    const today = zonedParts(nowMs, timeZone);
    const mondayDay = today.day - today.weekday;
    const dayStarts = Array.from({ length: 8 }, (_, i) =>
        zonedMidnight(today.year, today.month, mondayDay + i, timeZone),
    );
    const startMs = dayStarts[0];
    const previousStartMs = zonedMidnight(today.year, today.month, mondayDay - 7, timeZone);

    // Normalise Monday's date through Date.UTC so day 0 / negative days resolve to a real date.
    const m = new Date(Date.UTC(today.year, today.month - 1, mondayDay));

    return {
        startMs,
        nowMs,
        dayStarts,
        todayIndex: today.weekday,
        todayEndMs: dayStarts[today.weekday + 1],
        previousStartMs,
        previousEndMs: previousStartMs + (nowMs - startMs),
        monday: { year: m.getUTCFullYear(), month: m.getUTCMonth() + 1, day: m.getUTCDate() },
    };
}

/** Which day of this week an instant falls on, 0–6, or -1 when it is outside the week. */
export function dayIndexInWeek(ms: number, week: WeekBounds): number {
    if (ms < week.startMs || ms >= week.dayStarts[7]) return -1;
    for (let i = 0; i < 7; i++) {
        if (ms < week.dayStarts[i + 1]) return i;
    }
    return -1;
}

/** Parses an ISO string to epoch ms, or null — never NaN. */
export function msOf(iso: string | null | undefined): number | null {
    if (!iso) return null;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? null : t;
}

export function inWindow(ms: number | null, from: number, to: number): boolean {
    return ms !== null && ms >= from && ms < to;
}

/* ── opening hours ────────────────────────────────────────────────────────── */

/**
 * One stretch of a day the business is open, as local 24-hour "HH:MM".
 *
 * A `close` at or before `open` runs past midnight into the next day: `{ open: "18:00",
 * close: "02:00" }` on Friday covers Friday evening and the small hours of Saturday. "24:00"
 * is accepted as a close, for a day that runs to midnight.
 */
export interface OpeningSpan {
    open: string;
    close: string;
}

/** Keyed 0 = Monday … 6 = Sunday. A missing or empty day is closed all day. */
export type WeeklyHours = Partial<Record<number, OpeningSpan[]>>;

function minutesOf(hhmm: string): number | null {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 24 || min > 59 || (h === 24 && min !== 0)) return null;
    return h * 60 + min;
}

/**
 * Did this instant fall outside the client's own opening hours?
 *
 * **Null when the hours are unknown**, and that is the whole contract: the caller must hide an
 * after-hours figure rather than count against a default. Xander's decision (2026-11-09) was
 * "the client's own hours"; a fixed 8–6 would mark a 7 AM plumber's first call of the day as
 * after hours and call it a fact.
 *
 * A malformed span is ignored rather than thrown on, so one bad entry cannot blank the tile.
 */
export function isAfterHours(
    ms: number,
    hours: WeeklyHours | null | undefined,
    timeZone: string,
): boolean | null {
    if (!hours) return null;
    const p = zonedParts(ms, timeZone);
    const minute = p.hour * 60 + p.minute;
    const yesterday = (p.weekday + 6) % 7;

    for (const span of hours[p.weekday] ?? []) {
        const open = minutesOf(span.open);
        const close = minutesOf(span.close);
        if (open === null || close === null) continue;
        if (close > open) {
            if (minute >= open && minute < close) return false;
        } else if (minute >= open) {
            // Overnight span, evening half.
            return false;
        }
    }
    // Yesterday's overnight spans reach into this morning.
    for (const span of hours[yesterday] ?? []) {
        const open = minutesOf(span.open);
        const close = minutesOf(span.close);
        if (open === null || close === null) continue;
        if (close <= open && minute < close) return false;
    }
    return true;
}

/* ── labels ───────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "Mon Nov 3" — the start of the approved "This week, Mon Nov 3 – today" line. */
export function mondayLabel(week: WeekBounds): string {
    return `Mon ${MONTHS[week.monday.month - 1]} ${week.monday.day}`;
}

/** "morning" before noon, "afternoon" before 5 PM, then "evening" — local to the client. */
export function partOfDay(nowMs: number, timeZone: string): "morning" | "afternoon" | "evening" {
    const { hour } = zonedParts(nowMs, timeZone);
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
}

/** "2:13 AM". */
export function clockLabel(ms: number, timeZone: string): string {
    const { hour, minute } = zonedParts(ms, timeZone);
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
}

/** Whole local days between two instants' calendar dates: 0 today, 1 yesterday. */
function daysAgo(ms: number, nowMs: number, timeZone: string): number {
    const a = zonedParts(ms, timeZone);
    const b = zonedParts(nowMs, timeZone);
    return Math.round(
        (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
    );
}

/**
 * When something happened, in the mockups' forms.
 *
 * `long` is the Needs you row: "2:13 AM" today, "Yesterday 6:40 PM", "Sat 7:15 PM" inside the
 * last week, "Oct 28" beyond. `short` is the activity feed: the time today, then "Yesterday",
 * a weekday, a date.
 *
 * Computed on the server in the client's zone, so the HTML is final — no relative "3 hours
 * ago" that drifts between render and hydration.
 */
export function whenLabel(
    ms: number,
    nowMs: number,
    timeZone: string,
    style: "long" | "short" = "long",
): string {
    const ago = daysAgo(ms, nowMs, timeZone);
    const p = zonedParts(ms, timeZone);
    if (ago <= 0) return clockLabel(ms, timeZone);
    if (ago === 1) return style === "long" ? `Yesterday ${clockLabel(ms, timeZone)}` : "Yesterday";
    if (ago < 7) {
        return style === "long"
            ? `${WEEKDAYS[p.weekday]} ${clockLabel(ms, timeZone)}`
            : WEEKDAYS[p.weekday];
    }
    return `${MONTHS[p.month - 1]} ${p.day}`;
}

/** "Saturday" for the Longest wait sub-line, or a date beyond the last week, or the time today. */
export function sinceLabel(ms: number, nowMs: number, timeZone: string): string {
    const ago = daysAgo(ms, nowMs, timeZone);
    const p = zonedParts(ms, timeZone);
    if (ago <= 0) return clockLabel(ms, timeZone);
    if (ago === 1) return "yesterday";
    if (ago < 7) {
        return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][
            p.weekday
        ];
    }
    return `${MONTHS[p.month - 1]} ${p.day}`;
}

/** "48 sec", "3 min", "2 hours", "2 days" — one unit, rounded, for a tile's big number. */
export function spanLabel(seconds: number): string {
    const s = Math.max(0, Math.round(seconds));
    if (s < 90) return `${s} sec`;
    const min = Math.round(s / 60);
    if (min < 90) return `${min} min`;
    const hrs = Math.round(min / 60);
    if (hrs < 36) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
    const days = Math.round(hrs / 24);
    return `${days} day${days === 1 ? "" : "s"}`;
}
