/**
 * Turning a customer's stored history into something a first-time owner can read.
 *
 * The record used to render the activity list almost as it came: one row per event, a tinted
 * icon, a summary, a truncated line of detail, a timestamp. Dense and uninformative at the same
 * time — nothing said what kind of thing an entry was, and nothing said *who did it*, which is
 * the first thing an owner wants to know. Whether a customer chased you or you chased them is
 * the difference between a lead going cold and a job in hand.
 *
 * So the shaping happens here, in plain functions, and the component draws what it is given:
 *
 *   - every entry gets a **sentence naming the actor** — "Rosalind called you", "You texted";
 *   - every entry gets a **one-word type**, so nothing rests on recognising an icon;
 *   - runs of texts collapse into one **conversation**, which is how they were had;
 *   - days carry a **weekday**, because "Sunday" places an event and "2 NOV" does not.
 *
 * Client-safe: no `server-only`, so the record renders it and the tests import it.
 */

/** The stored shape, structural so `portal-crm`'s `server-only` Activity type stays put. */
export interface TimelineEventLike {
    id: string;
    kind:
        | "call"
        | "web-form"
        | "sms-out"
        | "sms-in"
        | "review-request"
        | "stage-change"
        | "note"
        | "task"
        | "file";
    at: string;
    summary: string;
    actor: "customer" | "client" | "system";
    meta?: Record<string, unknown>;
}

/** One row of the timeline: a single event, or a run of texts read as one conversation. */
export interface TimelineEntry {
    id: string;
    /** The event the row is built from; the newest of a run. */
    lead: TimelineEventLike;
    /** The whole run, oldest first, so a conversation reads downwards the way it happened. */
    run: TimelineEventLike[];
    title: string;
    /** One word for the type. Shown beside the title so an icon is never load-bearing. */
    kindLabel: string;
    /**
     * What the marker should depict — which is not always `lead.kind`.
     *
     * `"record"` is a bookkeeping entry wearing a contact kind, and it has to be decided here
     * rather than in the component: the first fix for that case corrected the title and the
     * chip and left the marker reading `lead.kind`, so a row saying "Added to your customers
     * from your inbox" still drew a green phone. Two places deciding the same thing is how
     * they came to disagree; now there is one, and it is tested.
     */
    markerKind: TimelineEventLike["kind"] | "record";
    /** The customer did this, rather than the client. Drives the filled marker. */
    inbound: boolean;
    at: string;
    /** `2:41 – 2:44 PM` for a conversation, a single time otherwise. */
    timeLabel: string;
}

export interface TimelineDay {
    /** `YYYY-MM-DD`, for React keys and tests. */
    key: string;
    /** "Today", "Yesterday", else the weekday. */
    label: string;
    /** The full date beside the label — the weekday alone is ambiguous past a week. */
    detail: string;
    entries: TimelineEntry[];
}

const KIND_LABEL: Record<TimelineEventLike["kind"], string> = {
    call: "Call",
    "web-form": "Web lead",
    "sms-out": "Texts",
    "sms-in": "Texts",
    "review-request": "Review",
    "stage-change": "Stage",
    note: "Note",
    task: "Task",
    file: "File",
};

export function kindLabel(kind: TimelineEventLike["kind"]): string {
    return KIND_LABEL[kind] ?? "Event";
}

/**
 * Does this event's kind describe something the customer did?
 *
 * A call and a web enquiry are things that happen *to* the business, so the stored kind
 * normally implies a customer actor. It does not always: promotion writes the **source's**
 * kind onto a bookkeeping entry — `customers/route.ts` stores `kind: "call"`, `actor: "client"`,
 * summary "Added to your customers from your inbox" — which records where the customer came
 * from rather than another phone call.
 *
 * So the actor is the authority, not the kind. Without this check the row claimed "Robert
 * Ochoa called you", chipped it "Call", and drew it outlined as something the client did: a
 * sentence and a marker contradicting each other, with the real wording thrown away.
 */
function kindMatchesActor(event: TimelineEventLike): boolean {
    if (event.kind === "call" || event.kind === "web-form") return event.actor === "customer";
    return true;
}

/**
 * The word beside the title.
 *
 * Takes the event rather than the kind, for the same reason as above: "Call" on an entry that
 * says "Added to your customers from your inbox" is worse than no chip at all. Promotion is
 * the only writer that stores a contact kind against a client actor today, so "Added" is the
 * honest word for it; should another appear, its own summary still carries the row.
 */
export function entryKindLabel(event: TimelineEventLike): string {
    if (!kindMatchesActor(event)) return "Added";
    return kindLabel(event.kind);
}

function isSms(kind: TimelineEventLike["kind"]): boolean {
    return kind === "sms-in" || kind === "sms-out";
}

function timeOf(iso: string): number {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}

function clockTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * "Today" with the date beside it, or the weekday with the date.
 *
 * The old header was `2 NOVEMBER` in grey mono capitals, which is both hard to read and less
 * useful than it looks: a weekday is how someone remembers a job. "Sunday" explains a missed
 * call in a way a date never will.
 */
export function dayHeading(iso: string, now = new Date()): { key: string; label: string; detail: string } {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return { key: "unknown", label: "Earlier", detail: "" };

    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const same = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
    const date = d.toLocaleDateString(undefined, { day: "numeric", month: "long" });

    if (same(d, now)) return { key, label: "Today", detail: `${weekday} ${date}` };
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (same(d, yesterday)) return { key, label: "Yesterday", detail: `${weekday} ${date}` };

    return { key, label: weekday, detail: date };
}

/**
 * A sentence saying who did what.
 *
 * Composed rather than taken from `summary` wherever the stored text leaves the actor implicit
 * — "Moved to Quoted" and "2 messages" are both true and both leave an owner working it out.
 * Where the server already writes a full sentence (a review request, a note), that text wins:
 * it was written closer to the event than this is.
 */
export function entryTitle(
    lead: TimelineEventLike,
    run: TimelineEventLike[],
    customerName: string | null | undefined,
): string {
    const who = customerName?.trim() || "they";
    const Who = who === "they" ? "They" : who;

    if (isSms(lead.kind)) {
        const outbound = run.some((e) => e.kind === "sms-out");
        const inbound = run.some((e) => e.kind === "sms-in");
        if (outbound && inbound) {
            // Named in the order they happened, so the row says who started it.
            return run[0].kind === "sms-out" ? `You texted, ${who} replied` : `${Who} texted, you replied`;
        }
        return outbound ? `You texted ${who}` : `${Who} texted you`;
    }

    // A contact kind recorded against the client is bookkeeping, not contact: its own summary
    // is the only honest thing to show. See `kindMatchesActor`.
    if (!kindMatchesActor(lead)) return lead.summary;

    switch (lead.kind) {
        case "call":
            return `${Who} called you`;
        case "web-form":
            return `${Who} sent an enquiry from your website`;
        case "stage-change": {
            const to = typeof lead.meta?.to === "string" ? lead.meta.to : null;
            return to ? `You moved ${who} to ${titleCase(to)}` : lead.summary;
        }
        default:
            // review-request, note, task, file: the server writes these as whole sentences.
            return lead.summary;
    }
}

function titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Group into days, newest day first, collapsing consecutive texts into one conversation.
 *
 * Newest first is kept: an owner opens a record to see where things stand, not to read it from
 * the beginning. Within a conversation the run is flipped to oldest first, because a thread
 * read bottom-up is nonsense — that is the one place the ordering inverts, and it inverts for
 * the same reason every messaging app does it.
 */
export function buildTimeline(
    events: TimelineEventLike[],
    customerName: string | null | undefined,
    now = new Date(),
): TimelineDay[] {
    const sorted = [...events].sort((a, b) => timeOf(b.at) - timeOf(a.at));
    const days: TimelineDay[] = [];

    for (const event of sorted) {
        const heading = dayHeading(event.at, now);
        let day = days.find((d) => d.key === heading.key);
        if (!day) {
            day = { ...heading, entries: [] };
            days.push(day);
        }

        const last = day.entries[day.entries.length - 1];
        // Only texts collapse, and only against texts: two calls an hour apart are two calls.
        if (last && isSms(last.lead.kind) && isSms(event.kind)) {
            last.run.unshift(event);
            retitle(last, customerName);
            continue;
        }
        day.entries.push(entryFor(event, customerName));
    }

    return days;
}

function entryFor(event: TimelineEventLike, customerName: string | null | undefined): TimelineEntry {
    const run = [event];
    const entry: TimelineEntry = {
        id: event.id,
        lead: event,
        run,
        title: entryTitle(event, run, customerName),
        kindLabel: entryKindLabel(event),
        markerKind: kindMatchesActor(event) ? event.kind : "record",
        inbound: event.actor === "customer",
        at: event.at,
        timeLabel: clockTime(event.at),
    };
    return entry;
}

/** Re-derive a conversation's title, actor and time span after a message joins it. */
function retitle(entry: TimelineEntry, customerName: string | null | undefined): void {
    entry.title = entryTitle(entry.lead, entry.run, customerName);
    // A conversation is inbound if the customer said anything in it: an unanswered reply is
    // the thing most worth noticing, and it must not be hidden by the client having spoken.
    entry.inbound = entry.run.some((e) => e.actor === "customer");
    const first = clockTime(entry.run[0].at);
    const last = clockTime(entry.run[entry.run.length - 1].at);
    entry.timeLabel = first && last && first !== last ? `${first} – ${last}` : last || first;
}
