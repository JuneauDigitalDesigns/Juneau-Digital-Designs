import type { InboxItem } from "./crm-contacts";
import { msOf } from "./portal-overview-time";
import { dollars, type PipelineCustomer } from "./portal-overview-pipeline";

/**
 * The Overview's "Latest activity" feed, merged from every store that records an event.
 *
 * Only event types something actually writes down appear here. The approved list had two more,
 * and both are left out rather than approximated:
 *
 * - "{name} left you a Google review" — nothing tells us. Google does not report reviews back,
 *   and no store here records one.
 * - "Review requested" — the send *is* recorded (`reviewSent`), but no feed line for it was
 *   approved, and the Growth "Reviews asked for" tile already counts them.
 *
 * Pure: the loader fetches, this sorts and words.
 */

export type ActivityKind = "call" | "web" | "text-in" | "won" | "done";

export interface ActivityEvent {
    id: string;
    kind: ActivityKind;
    at: string;
    /** The bold line, in the approved wording (copy draft, batch 2, "Activity feed"). */
    title: string;
    /** The quieter line under it, when there is something worth saying. */
    detail: string | null;
}

export interface InboundText {
    id: string;
    customerId: string;
    body: string;
    at: string;
}

export interface DoneRecord {
    /** The inbox item id that was put away. */
    id: string;
    at: string;
}

function who(name: string | null, fallback: string): string {
    return name?.trim() || fallback;
}

/** Above this, two "done" stamps for one person are one action — archiving a whole row. */
const SAME_ACTION_MS = 60_000;

/**
 * Newest first, at most `limit`.
 *
 * - **call** — every call the receptionist answered, including ones since promoted or done:
 *   the feed is what happened, not what is outstanding.
 * - **web** — every web enquiry. Its callback is folded in by `buildInbox` and is not a second
 *   event.
 * - **text-in** — inbound SMS on a customer thread (Growth, texting live).
 * - **won** — a customer whose stage is Won, at the time it moved there. Read off the record's
 *   `stageChangedAt` rather than the activity log: it is the same instant, and it is already
 *   in hand without a read per customer. The dollar figure shows only when `showValues`.
 * - **done** — an inbox item the client marked done. Archiving a row stamps every item in it
 *   at once, so stamps for one person inside a minute collapse into one line.
 */
export function activityFeed({
    items,
    customers = [],
    texts = [],
    done = [],
    showValues,
    limit = 6,
}: {
    items: InboxItem[];
    customers?: PipelineCustomer[];
    texts?: InboundText[];
    done?: DoneRecord[];
    showValues: boolean;
    limit?: number;
}): ActivityEvent[] {
    const events: ActivityEvent[] = [];

    for (const i of items) {
        if (!i.at) continue;
        const name = who(i.name, i.phoneDisplay);
        events.push(
            i.source === "call"
                ? {
                      id: `call:${i.id}`,
                      kind: "call",
                      at: i.at,
                      title: `Your receptionist answered ${name}`,
                      detail: i.preview?.trim() || null,
                  }
                : {
                      id: `web:${i.id}`,
                      kind: "web",
                      at: i.at,
                      title: `New web enquiry from ${name}`,
                      detail: i.preview?.trim() || null,
                  },
        );
    }

    const byCustomer = new Map(customers.map((c) => [c.customerId, c]));
    for (const t of texts) {
        const c = byCustomer.get(t.customerId);
        events.push({
            id: `text:${t.id}`,
            kind: "text-in",
            at: t.at,
            title: `${who(c?.name ?? null, "A customer")} texted back`,
            detail: t.body.trim() ? `“${t.body.trim()}”` : null,
        });
    }

    for (const c of customers) {
        if (c.stage !== "won" || c.archived) continue;
        const name = who(c.name, "A customer");
        const money = showValues && c.value !== null ? ` · ${dollars(c.value)}` : "";
        events.push({
            id: `won:${c.customerId}`,
            kind: "won",
            at: c.stageChangedAt,
            title: `${name} moved to Won${money}`,
            detail: null,
        });
    }

    const itemById = new Map(items.map((i) => [i.id, i]));
    /** Per person, the last "done" line written and the stamp it was last moved to. */
    const lastDone = new Map<string, { event: ActivityEvent; t: number }>();
    const doneSorted = [...done].sort((a, b) => (msOf(a.at) ?? 0) - (msOf(b.at) ?? 0));
    for (const d of doneSorted) {
        const item = itemById.get(d.id);
        const t = msOf(d.at);
        if (!item || t === null) continue;
        const key = item.phone ?? item.id;
        const prev = lastDone.get(key);
        if (prev && t - prev.t <= SAME_ACTION_MS) {
            // Same click, another item in the row: one line, at the latest stamp.
            prev.event.at = d.at;
            prev.t = t;
            continue;
        }
        const event: ActivityEvent = {
            id: `done:${d.id}`,
            kind: "done",
            at: d.at,
            title: `You marked ${who(item.name, item.phoneDisplay)} done`,
            detail: null,
        };
        events.push(event);
        lastDone.set(key, { event, t });
    }

    return events
        .filter((e) => msOf(e.at) !== null)
        .sort((a, b) => (msOf(b.at) as number) - (msOf(a.at) as number) || (a.id < b.id ? -1 : 1))
        .slice(0, limit);
}
