import {
    filterInbox,
    groupInbox,
    inboxStatus,
    type InboxFilter,
    type InboxGroup,
    type InboxItem,
    type InboxStatus,
} from "@/app/lib/crm-contacts";

/**
 * The Inbox's reading of the list, with no React in it.
 *
 * Everything here is a decision the component used to make inline, pulled out so it can be
 * pinned by `test/inbox-model.test.mjs`: which bucket a row is in, which day heading it sits
 * under, what the counts on the chips say, what time "Tomorrow morning" really is. All of it
 * takes `now` as an argument and reads the *client's local* clock — "Today" means the owner's
 * today, not the server's or UTC's.
 */

/* ── rows ─────────────────────────────────────────────────────────────────── */

/** A list row: one person's run of calls, or one enquiry, all in one status. */
export interface InboxRow extends InboxGroup {
    status: InboxStatus;
}

function timeOf(iso: string | null | undefined): number {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/**
 * Filter, bucket by status, group each bucket by person, then order by latest activity.
 *
 * Grouping inside a status rather than across them is what keeps every row's actions coherent.
 * In All, someone with two calls still waiting and one already Done reads as two rows — the
 * waiting run and the finished call — so "Done" on a row always means the same ids it shows,
 * and the archived-run behaviour `groupInbox` documents (group after filtering) still holds.
 *
 * A run is placed by its newest call, so a person who rang on Monday and again this morning
 * sits under Today with both calls in it, not under Monday.
 */
export function inboxRows(
    items: InboxItem[],
    filter: InboxFilter,
    search = "",
    now: number = Date.now(),
): InboxRow[] {
    const shown = filterInbox(items, filter, search, now);
    const buckets = new Map<InboxStatus, InboxItem[]>();
    for (const item of shown) {
        const s = inboxStatus(item, now);
        const list = buckets.get(s);
        if (list) list.push(item);
        else buckets.set(s, [item]);
    }

    const rows: InboxRow[] = [];
    for (const [status, list] of buckets) {
        for (const g of groupInbox(list)) {
            // Prefixed so one person's waiting run and their Done call never share a key.
            rows.push({ ...g, id: `${status}:${g.id}`, status });
        }
    }
    rows.sort((a, b) => timeOf(b.at) - timeOf(a.at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return rows;
}

/**
 * The numbers on the chips. Rows, not items: a person who rang three times is one thing to
 * call back, and the chip should agree with the list under it.
 */
export function inboxCounts(items: InboxItem[], now: number = Date.now()) {
    return {
        needs: inboxRows(items, "needs", "", now).length,
        reminders: inboxRows(items, "reminders", "", now).length,
        promoted: inboxRows(items, "promoted", "", now).length,
        done: inboxRows(items, "done", "", now).length,
    };
}

/**
 * "N leads handled this week", for the empty state.
 *
 * What can be computed honestly from the payload: leads that *came in* since Monday and have
 * since been marked Done or promoted. There is no "when was it marked Done" on the item (the
 * archive record holds one server-side, but the inbox does not send it), so a lead from last
 * week finished today is not counted. Counted as rows, like the chips.
 */
export function handledThisWeek(items: InboxItem[], now: number = Date.now()): number {
    const since = startOfWeek(new Date(now));
    const handled = items.filter((i) => {
        const s = inboxStatus(i, now);
        return (s === "done" || s === "promoted") && timeOf(i.at) >= since;
    });
    return groupInbox(handled).length;
}

/** The row after the ones being removed, else the one before; what the pane moves to. */
export function neighbourRow(rows: InboxRow[], leaving: string[]): InboxRow | null {
    const gone = new Set(leaving);
    const first = rows.findIndex((r) => gone.has(r.id));
    if (first === -1) return null;
    for (let i = first + 1; i < rows.length; i++) if (!gone.has(rows[i].id)) return rows[i];
    for (let i = first - 1; i >= 0; i--) if (!gone.has(rows[i].id)) return rows[i];
    return null;
}

/** j / k. Stops at the ends rather than wrapping, the way a mail client does. */
export function stepRow(rows: InboxRow[], currentId: string | null, delta: 1 | -1): InboxRow | null {
    if (rows.length === 0) return null;
    const at = currentId ? rows.findIndex((r) => r.id === currentId) : -1;
    if (at === -1) return rows[0];
    return rows[Math.min(rows.length - 1, Math.max(0, at + delta))];
}

/* ── date sections ────────────────────────────────────────────────────────── */

export type SectionKey = "today" | "yesterday" | "week" | "earlier";

/**
 * Section headings. The first three are approved copy; "EARLIER" is not yet (see the PR) and
 * is the plainest word for what is left.
 */
export const SECTION_LABEL: Record<SectionKey, string> = {
    today: "TODAY",
    yesterday: "YESTERDAY",
    week: "EARLIER THIS WEEK",
    earlier: "EARLIER",
};

const SECTION_ORDER: SectionKey[] = ["today", "yesterday", "week", "earlier"];

function startOfDay(d: Date, offsetDays = 0): number {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + offsetDays).getTime();
}

/** Monday 00:00 local. The week the "Next week" reminder also counts from. */
export function startOfWeek(d: Date): number {
    const sinceMonday = (d.getDay() + 6) % 7;
    return startOfDay(d, -sinceMonday);
}

/**
 * Which heading a time sits under. "Yesterday" outranks the week, so on a Monday yesterday is
 * still Yesterday rather than "Earlier". A time in the future (a skewed clock) is Today; an
 * undated item is Earlier.
 */
export function sectionFor(iso: string | null, now: Date): SectionKey {
    const t = timeOf(iso);
    if (!t) return "earlier";
    if (t >= startOfDay(now)) return "today";
    if (t >= startOfDay(now, -1)) return "yesterday";
    if (t >= startOfWeek(now)) return "week";
    return "earlier";
}

export interface InboxSectionGroup {
    key: SectionKey;
    label: string;
    rows: InboxRow[];
}

/** Rows under their headings, in heading order, empty headings dropped. Keeps row order. */
export function sectionRows(rows: InboxRow[], now: Date): InboxSectionGroup[] {
    const by = new Map<SectionKey, InboxRow[]>();
    for (const r of rows) {
        const k = sectionFor(r.at, now);
        const list = by.get(k);
        if (list) list.push(r);
        else by.set(k, [r]);
    }
    return SECTION_ORDER.filter((k) => by.has(k)).map((k) => ({
        key: k,
        label: SECTION_LABEL[k],
        rows: by.get(k) ?? [],
    }));
}

/* ── what a row says ──────────────────────────────────────────────────────── */

export type Reason = "callback" | "web" | "missed";

/**
 * Why the lead is waiting, from what the item actually carries.
 *
 * There is no intent or urgency field in the payload, so this does not pretend to one: a web
 * form is a web enquiry; a call is "hung up" when it has no summary, lasted under 15 seconds,
 * or Airtable's Outcome says "Hung up"; any other call left a message to answer.
 *
 * The same rule as the Overview's `needsReason()` (#87, `app/lib/portal-overview-leads.ts`),
 * so the two screens never label one lead differently. To be deduplicated once both land.
 */
export const HUNG_UP_UNDER_SECONDS = 15;

export function reasonFor(item: InboxItem): Reason {
    if (item.source === "web-form") return "web";
    const hungUp =
        !item.preview?.trim() ||
        (item.durationSeconds !== null && item.durationSeconds < HUNG_UP_UNDER_SECONDS) ||
        item.outcome?.trim().toLowerCase() === "hung up";
    return hungUp ? "missed" : "callback";
}

export const REASON_LABEL: Record<Reason, string> = {
    callback: "Wants a callback",
    web: "Web enquiry",
    missed: "Hung up, no message",
};

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "7 AM", "6:30 PM" — the short clock the reminder copy uses. */
export function shortClock(d: Date): string {
    const h = d.getHours();
    const m = d.getMinutes();
    const h12 = h % 12 || 12;
    const ap = h < 12 ? "AM" : "PM";
    return m ? `${h12}:${String(m).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
}

/** "7:00 AM" — the clock the list and the menus use. */
export function fullClock(d: Date): string {
    const h12 = d.getHours() % 12 || 12;
    return `${h12}:${String(d.getMinutes()).padStart(2, "0")} ${d.getHours() < 12 ? "AM" : "PM"}`;
}

function daysAhead(at: Date, now: Date): number {
    return Math.round((startOfDay(at) - startOfDay(now)) / 86_400_000);
}

/** The list's time column: a clock today and yesterday, the weekday this week, else a date. */
export function rowWhen(iso: string | null, now: Date): string {
    const t = timeOf(iso);
    if (!t) return "";
    const d = new Date(t);
    const s = sectionFor(iso, now);
    if (s === "today" || s === "yesterday") return fullClock(d);
    if (s === "week") return DAY_SHORT[d.getDay()];
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`;
}

/** "Today 2:13 AM", "Yesterday 6:40 PM", "Mon 4:25 PM", "Nov 2, 4:25 PM". */
export function fullWhen(iso: string | null, now: Date): string {
    const t = timeOf(iso);
    if (!t) return "—";
    const d = new Date(t);
    const s = sectionFor(iso, now);
    if (s === "today") return `Today ${fullClock(d)}`;
    if (s === "yesterday") return `Yesterday ${fullClock(d)}`;
    if (s === "week") return `${DAY_SHORT[d.getDay()]} ${fullClock(d)}`;
    const year = d.getFullYear() === now.getFullYear() ? "" : ` ${d.getFullYear()}`;
    return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}${year}, ${fullClock(d)}`;
}

/** The status chip on a reminded row: "Remind Tue 7 AM", "Remind today 6 PM". */
export function remindChip(iso: string, now: Date): string {
    const at = new Date(iso);
    if (Number.isNaN(at.getTime())) return "Remind";
    const ahead = daysAhead(at, now);
    const day =
        ahead === 0
            ? "today"
            : ahead > 0 && ahead < 7
              ? DAY_SHORT[at.getDay()]
              : `${MONTH_SHORT[at.getMonth()]} ${at.getDate()}`;
    return `Remind ${day} ${shortClock(at)}`;
}

/**
 * The toast after a reminder is set, worded the way the approved ones are: "at 6 PM today",
 * "tomorrow at 7 AM", "Monday at 7 AM". A picked date further out than a week gets its date.
 */
export function remindToast(at: Date, now: Date): string {
    const ahead = daysAhead(at, now);
    const clock = shortClock(at);
    if (ahead === 0) return `We’ll remind you at ${clock} today`;
    if (ahead === 1) return `We’ll remind you tomorrow at ${clock}`;
    if (ahead > 1 && ahead <= 7) return `We’ll remind you ${DAY_LONG[at.getDay()]} at ${clock}`;
    return `We’ll remind you ${MONTH_SHORT[at.getMonth()]} ${at.getDate()} at ${clock}`;
}

export interface RemindPreset {
    key: "today" | "tomorrow" | "nextweek";
    label: string;
    detail: string;
    at: Date;
}

/**
 * The three Remind me presets, computed in the browser as the API shape asks.
 *
 * "Later today" is dropped once 6 PM has passed — a reminder for a time already gone would put
 * the lead straight back, which reads as the button not working. "Next week" is the coming
 * Monday, a full week out when today is Monday.
 */
export function remindPresets(now: Date): RemindPreset[] {
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const out: RemindPreset[] = [];
    const sixPm = new Date(y, m, d, 18, 0, 0, 0);
    if (now.getTime() < sixPm.getTime()) {
        out.push({ key: "today", label: "Later today", detail: "6:00 PM", at: sixPm });
    }
    out.push({
        key: "tomorrow",
        label: "Tomorrow morning",
        detail: "7:00 AM",
        at: new Date(y, m, d + 1, 7, 0, 0, 0),
    });
    const toMonday = (8 - now.getDay()) % 7 || 7;
    out.push({
        key: "nextweek",
        label: "Next week",
        detail: "Mon 7:00 AM",
        at: new Date(y, m, d + toMonday, 7, 0, 0, 0),
    });
    return out;
}

/** Tomorrow 7 AM — what the bulk bar's "Remind me tomorrow" means. */
export function tomorrowMorning(now: Date): Date {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 0, 0, 0);
}

/* ── texting ──────────────────────────────────────────────────────────────── */

/**
 * The first name to greet, or null.
 *
 * Null for an unknown caller — `name` is null — and for a "name" that is really a number,
 * which some call logs write into the name column. "Hi (512)," is worse than "Hi,".
 */
export function firstName(name: string | null): string | null {
    const n = name?.trim();
    if (!n || /^[\d(+]/.test(n)) return null;
    return n.split(/\s+/)[0] ?? null;
}

/** "Hi Dave, " — what the composer opens with. */
export function greeting(name: string | null): string {
    const first = firstName(name);
    return first ? `Hi ${first}, ` : "Hi, ";
}

/**
 * A quick reply, greeted: "Hi Dave, " + the body with its first letter lowered so it reads as
 * one sentence. A body that opens with "I" keeps it, because "Hi Dave, i'll" is a typo.
 */
export function prefillReply(name: string | null, body: string): string {
    const text = body.trim();
    const keep = /^I(\b|['’])/.test(text);
    const joined = keep || !text ? text : text.charAt(0).toLowerCase() + text.slice(1);
    return greeting(name) + joined;
}

/* ── the callback line ────────────────────────────────────────────────────── */

/** "41 seconds", "3 minutes": how long after the form the receptionist rang. Null if unknown. */
export function callbackGap(fromIso: string | null, toIso: string | null): string | null {
    const from = timeOf(fromIso);
    const to = timeOf(toIso);
    if (!from || !to || to < from) return null;
    const secs = Math.round((to - from) / 1000);
    if (secs < 60) return `${secs} second${secs === 1 ? "" : "s"}`;
    const mins = Math.round(secs / 60);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
}

/** A `datetime-local` value as a future Date, or null for blank, junk, or the past. */
export function parsePickedTime(value: string, now: Date): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime()) || d.getTime() <= now.getTime()) return null;
    return d;
}

/** `datetime-local` wants local wall time with no zone: "2026-11-10T07:00". */
export function toLocalInputValue(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
