import { filterInbox, groupInbox, type InboxItem } from "./crm-contacts";
import {
    dayIndexInWeek,
    inWindow,
    isAfterHours,
    msOf,
    type WeekBounds,
    type WeeklyHours,
} from "./portal-overview-time";

/**
 * The Overview's lead numbers, shaped from the same `InboxItem[]` the Inbox renders.
 *
 * Built on `buildInbox` output on purpose. The Overview and the Inbox answer the same question
 * from two pages — "who still needs me" — and if they derive it separately, they will
 * eventually disagree, and the client will trust neither. So "needs you" is the Inbox's own
 * worklist rule (`filterInbox`) and its rows are the Inbox's own repeat-caller grouping
 * (`groupInbox`), not a second reading of the raw sources.
 *
 * Pure. `test/portal-overview.test.mjs` pins it.
 */

/* ── why it needs you ─────────────────────────────────────────────────────── */

export type NeedsReason = "callback" | "web" | "hung-up";

/** Approved wording (copy draft, batch 2, "Needs you card"). */
export const REASON_LABEL: Record<NeedsReason, string> = {
    callback: "Wants a callback",
    web: "Web enquiry",
    "hung-up": "Hung up, no message",
};

/**
 * Below this, a call carried nothing the client can act on.
 *
 * Retell writes a summary for almost every call, including "The caller disconnected before
 * stating their reason" — so an empty summary alone would miss most hang-ups. Fifteen
 * seconds is about the receptionist's greeting and one breath: nobody leaves a name, a number
 * and a problem in less.
 */
export const HANG_UP_MAX_SECONDS = 15;

/**
 * The reason chip, from real fields only.
 *
 * - A web-form item is always "Web enquiry" — that is what it is, whether or not the
 *   receptionist has since rung them back.
 * - A call is "Hung up, no message" when there is nothing to call back *about*: no summary
 *   text, a duration under `HANG_UP_MAX_SECONDS`, or the receptionist's own triage word
 *   "Hung up" in Outcome. Duration is only trusted when it is recorded — a missing duration
 *   is our gap, not a short call.
 * - Every other call is "Wants a callback". The receptionist takes a message and the client
 *   rings back; that is the job the product does.
 */
export function needsReason(item: InboxItem): NeedsReason {
    if (item.source === "web-form") return "web";
    const said = item.preview?.trim();
    if (!said) return "hung-up";
    if (item.durationSeconds !== null && item.durationSeconds < HANG_UP_MAX_SECONDS) return "hung-up";
    if (item.outcome?.trim().toLowerCase() === "hung up") return "hung-up";
    return "callback";
}

/** Two letters for the avatar, or "?" for a caller with no name — as the mockup draws it. */
export function initialsOf(name: string | null): string {
    const words = (name ?? "").trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
    if (words.length === 0) return "?";
    const first = words[0][0];
    const last = words.length > 1 ? words[words.length - 1][0] : "";
    return (first + last).toUpperCase();
}

/* ── needs you ────────────────────────────────────────────────────────────── */

export interface NeedsYouRow {
    /** The Inbox group id, so a row here and the row in the Inbox are the same row. */
    id: string;
    name: string | null;
    phoneDisplay: string;
    initials: string;
    /** E.164 for the Call back button: the number they asked to be reached at, else theirs. */
    dialNumber: string | null;
    reason: NeedsReason;
    /** The newest contact in the run — what the time in the row describes. */
    at: string | null;
    preview: string | null;
    /** Null when the client's hours are unknown; the row then says nothing about it. */
    afterHours: boolean | null;
    /** How many inbox items the row stands for. Above one is a repeat caller. */
    count: number;
}

export interface NeedsYou {
    /** Rows, not items — the same count the Inbox's grouped list shows. */
    total: number;
    rows: NeedsYouRow[];
    /** The longest-waiting unhandled item, for Starter's "Longest wait" tile. */
    oldest: { at: string; name: string | null; phoneDisplay: string } | null;
}

/**
 * Everything still waiting on the client, newest first, capped for the card.
 *
 * **Newest first**, as the mockup draws it, rather than the oldest-first the discussion note
 * floated. Two reasons. It is the Inbox's order, so the five rows here are the top five rows
 * there and "Open inbox →" continues the same list instead of reshuffling it. And a lead's
 * chance of turning into a job falls off within the hour, so the one most worth a call right
 * now is usually the newest; the one that has waited longest is surfaced separately, by the
 * Starter "Longest wait" tile, rather than by pinning a two-day-old hang-up above this
 * morning's burst pipe.
 *
 * The rule for *what* waits is `filterInbox(items, "unread")` — not read, not archived ("Done"),
 * not promoted — verbatim, so the Overview can never count something the Inbox has cleared.
 * The rows are `groupInbox` over that, so three calls from one person are one row here too.
 */
export function needsYou(
    items: InboxItem[],
    {
        limit = 5,
        hours = null,
        timeZone,
    }: { limit?: number; hours?: WeeklyHours | null; timeZone: string },
): NeedsYou {
    const waiting = filterInbox(items, "unread");
    const groups = groupInbox(waiting);

    const rows = groups.slice(0, limit).map((g): NeedsYouRow => {
        // The row speaks for the newest contact, but a repeat caller whose latest attempt was a
        // hang-up still left a message on an earlier call — show that one's words and reason.
        const said = g.items.find((i) => needsReason(i) !== "hung-up") ?? g.lead;
        const atMs = msOf(g.lead.at);
        return {
            id: g.id,
            name: g.lead.name ?? said.name,
            phoneDisplay: g.lead.phoneDisplay,
            initials: initialsOf(g.lead.name ?? said.name),
            dialNumber: g.lead.callbackPhone ?? g.lead.phone,
            reason: needsReason(said),
            at: g.lead.at,
            preview: said.preview?.trim() || null,
            afterHours: atMs === null ? null : isAfterHours(atMs, hours, timeZone),
            count: g.count,
        };
    });

    let oldest: NeedsYou["oldest"] = null;
    let oldestMs = Infinity;
    for (const i of waiting) {
        const t = msOf(i.at);
        if (t !== null && t < oldestMs) {
            oldestMs = t;
            oldest = { at: i.at as string, name: i.name, phoneDisplay: i.phoneDisplay };
        }
    }

    return { total: groups.length, rows, oldest };
}

/* ── this week's leads ────────────────────────────────────────────────────── */

export interface LeadWeek {
    total: number;
    /** The same elapsed stretch of last week. See `weekBounds`. */
    previousTotal: number;
    perDay: number[];
    calls: number;
    web: number;
    /** Null when the client's hours are unknown — the row and tile are hidden, not zeroed. */
    afterHours: number | null;
    /** Called back (read), marked done, or promoted. Starter's "Handled this week". */
    handled: number;
}

/**
 * Every new lead this week, by channel and by day.
 *
 * Counts **items**, the Inbox's unit before grouping: two calls from one person on Monday and
 * Thursday are two leads that week. Promoted and done items still count — they came in this
 * week, which is what the card says; whether they still need anything is the Needs you card.
 *
 * A Growth web enquiry and the receptionist's callback to it are already one item (see
 * `buildInbox`), so the callback is not a second "call answered".
 */
export function leadWeek(
    items: InboxItem[],
    week: WeekBounds,
    { hours = null, timeZone }: { hours?: WeeklyHours | null; timeZone: string },
): LeadWeek {
    const perDay = new Array<number>(7).fill(0);
    let total = 0;
    let previousTotal = 0;
    let calls = 0;
    let web = 0;
    let afterHours = 0;
    let handled = 0;

    for (const item of items) {
        const t = msOf(item.at);
        if (inWindow(t, week.previousStartMs, week.previousEndMs)) previousTotal += 1;
        if (!inWindow(t, week.startMs, week.nowMs + 1)) continue;

        total += 1;
        const idx = dayIndexInWeek(t as number, week);
        if (idx >= 0) perDay[idx] += 1;
        if (item.source === "call") calls += 1;
        else web += 1;
        if (hours && isAfterHours(t as number, hours, timeZone)) afterHours += 1;
        if (item.read || item.archived || item.promoted) handled += 1;
    }

    return {
        total,
        previousTotal,
        perDay,
        calls,
        web,
        afterHours: hours ? afterHours : null,
        handled,
    };
}

/**
 * Calls the receptionist answered outside the client's hours this week — "Caught after hours".
 *
 * Calls only: the tile's approved sub-line is "Calls outside your opening hours that still got
 * answered", and a web form at 2 AM was not caught by anyone. Null when hours are unknown.
 */
export function caughtAfterHours(
    items: InboxItem[],
    week: WeekBounds,
    { hours = null, timeZone }: { hours?: WeeklyHours | null; timeZone: string },
): number | null {
    if (!hours) return null;
    let n = 0;
    for (const item of items) {
        if (item.source !== "call") continue;
        const t = msOf(item.at);
        if (!inWindow(t, week.startMs, week.nowMs + 1)) continue;
        if (isAfterHours(t as number, hours, timeZone)) n += 1;
    }
    return n;
}

/**
 * Average seconds from a web-form submission to the receptionist's callback, this week.
 *
 * Only enquiries with a logged callback count — `buildInbox` nests that call under the
 * enquiry as `callback`, so both timestamps are already on the item. Enquiries the receptionist
 * has not rung (yet, or at all) are left out rather than counted as zero or as infinity: the
 * tile's approved line is "Average time for your receptionist to call a web lead back", which
 * is a claim about the calls that happened. Null when there were none, and the tile hides.
 *
 * "This week" is by when the enquiry arrived. A negative gap cannot come out of `buildInbox`
 * (it pairs only calls at or after the form) but is skipped anyway rather than averaged.
 */
export function callbackSpeedSeconds(items: InboxItem[], week: WeekBounds): number | null {
    let sum = 0;
    let n = 0;
    for (const item of items) {
        if (item.source !== "web-form" || !item.callback) continue;
        const sent = msOf(item.at);
        const rang = msOf(item.callback.at);
        if (sent === null || rang === null || !inWindow(sent, week.startMs, week.nowMs + 1)) continue;
        const gap = (rang - sent) / 1000;
        if (gap < 0) continue;
        sum += gap;
        n += 1;
    }
    return n === 0 ? null : Math.round(sum / n);
}
