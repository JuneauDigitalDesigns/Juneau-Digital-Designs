import { normalizeE164, formatUsPhone } from "./phone";
import type { CallRecord } from "./airtable-calls";

/**
 * Inbox assembly — turning raw inbound into a triage list.
 *
 * Two sources feed it: the Airtable call log, and web-form leads captured into KV. Both resolve
 * to the same contact identity (`normalizeE164`), which is what lets a form submission and the
 * callback it triggered collapse into **one** entry instead of reading as two unrelated
 * enquiries minutes apart.
 *
 * Pure and deterministic — the route does the fetching, this does the shaping.
 */

/** The web-form lead shape, mirroring `@jdd/schema`'s `WebLead`. */
export interface WebLeadLike {
    leadId: string;
    name: string | null;
    phone: string | null;
    phoneRaw: string | null;
    email: string | null;
    message: string | null;
    createdAt: string;
    readAt: string | null;
    callbackPlaced: boolean;
}

export type InboxSource = "call" | "web-form";

export interface InboxItem {
    /** Airtable record id, or `lead:{leadId}`. Stable, and what promotion records. */
    id: string;
    source: InboxSource;
    name: string | null;
    phone: string | null;
    phoneDisplay: string;
    /**
     * The number the caller asked to be reached at, only when it isn't `phone`. The agent reads
     * the number on the call back to them, so most calls extract that same number here, and
     * showing it twice would say nothing. `phone` stays the contact's identity either way.
     */
    callbackPhone: string | null;
    callbackPhoneDisplay: string | null;
    email: string | null;
    /** One line for the list. The enquiry text for a form, the call summary for a call. */
    preview: string | null;
    at: string | null;
    read: boolean;
    promoted: boolean;
    /**
     * Put away by the client, and out of the worklist until they restore it.
     *
     * Portal-side state for both sources, including calls: the row a call comes from is the
     * client's own Airtable log and is not ours to change, so archiving hides it here and
     * leaves the log alone.
     */
    archived: boolean;
    durationSeconds: number | null;
    recordingUrl: string | null;
    /**
     * Carried for promotion rather than for the list, which shows neither.
     *
     * The receptionist takes an address down by ear and Airtable keeps it on the row, so it was
     * already a field away from the customer record — it just never travelled. `outcome` is the
     * Airtable triage word ("Qualified"), which becomes a starting tag. Both are null on a
     * web-form lead, which has neither.
     */
    address: string | null;
    outcome: string | null;
    /**
     * The receptionist's callback, when this form enquiry triggered one.
     *
     * Present only on `web-form` items. Rendering it nested under the enquiry is the whole
     * point: to the client it was one enquiry, and a list that counts it twice is a list they
     * stop trusting.
     */
    callback: {
        /**
         * The Airtable record id of the call itself.
         *
         * Carried because a consumed call still has to be addressable. An owner's text links
         * to whatever the voice stack logged — often the callback — and that call is not an
         * inbox item: it was folded in here, so matching a deep link against item ids alone
         * finds nothing. See `inboxItemForDeepLink`.
         */
        id: string;
        at: string | null;
        durationSeconds: number | null;
        summary: string | null;
        recordingUrl: string | null;
    } | null;
}

/** How long after a form submission a matching call still counts as *its* callback. */
const CALLBACK_WINDOW_MS = 60 * 60 * 1000;

function timeOf(iso: string | null): number {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}

/** Lexicographic compare, for breaking ties on a stable id. */
function cmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function callContactId(call: CallRecord): string | null {
    return normalizeE164(call.callerNumber);
}

/**
 * The two callback fields for an item shown under `phone`. Goes through `normalizeE164` because
 * Retell extracts this one as bare digits and `Caller number` is E.164: a raw compare would show
 * every call's own number as a "different" one. Anything that isn't a dialable number is dropped.
 */
function callbackFields(raw: string | null | undefined, phone: string | null) {
    const e164 = normalizeE164(raw);
    return e164 && e164 !== phone
        ? { callbackPhone: e164, callbackPhoneDisplay: formatUsPhone(e164) }
        : { callbackPhone: null, callbackPhoneDisplay: null };
}

/**
 * Build the inbox.
 *
 * `leads` is optional on purpose: the web-form capture is owned by another workstream, and the
 * Inbox has to work (calls only) before it lands.
 */
export function buildInbox({
    calls,
    leads = [],
    promoted = new Set<string>(),
    archived = new Set<string>(),
    readCallIds = new Set<string>(),
}: {
    calls: CallRecord[];
    leads?: WebLeadLike[];
    promoted?: Set<string>;
    archived?: Set<string>;
    readCallIds?: Set<string>;
}): InboxItem[] {
    // Index leads by number so pairing only ever considers rows that share a contact identity.
    const leadsByPhone = new Map<string, WebLeadLike[]>();
    for (const lead of leads) {
        const e164 = normalizeE164(lead.phone ?? lead.phoneRaw);
        if (!e164) continue;
        const arr = leadsByPhone.get(e164);
        if (arr) arr.push(lead);
        else leadsByPhone.set(e164, [lead]);
    }

    /** Calls consumed as a callback, so they are not also emitted standalone. */
    const consumed = new Set<string>();
    const callbackFor = new Map<string, CallRecord>();

    // Every enquiry/call pair that *could* be a callback: same contact, call at or after the
    // form, inside the window. "At or after" matters — a call that came before the form was
    // filled in is a separate contact, because there was nothing yet to call back about.
    const pairs: { lead: WebLeadLike; call: CallRecord; gap: number }[] = [];
    for (const call of calls) {
        const e164 = callContactId(call);
        if (!e164) continue;
        const candidates = leadsByPhone.get(e164);
        if (!candidates) continue;

        const callAt = timeOf(call.date);
        for (const lead of candidates) {
            const gap = callAt - timeOf(lead.createdAt);
            if (gap >= 0 && gap <= CALLBACK_WINDOW_MS) pairs.push({ lead, call, gap });
        }
    }

    /**
     * Claim the closest pairs first, each enquiry and each call claimable once.
     *
     * This used to run per call: every call took its own nearest preceding enquiry, and the
     * "one callback per enquiry" rule was enforced first-come in `calls` array order. So when
     * two calls from one number both landed inside one enquiry's window, whichever the loop
     * reached first won — even when the other sat far closer. And `fetchCalls` asks Airtable
     * for `sort[0][direction]=desc`, so this is fed newest-first and the *furthest* call in
     * the window won: an enquiry at 11:50 with its genuine callback at 11:51 and an unrelated
     * call at 12:00 nested the 12:00 one and emitted the 11:51 callback as its own item —
     * exactly the duplicate the collapse exists to prevent.
     *
     * Smallest gap first decides both competitions the same way: the nearest call for an
     * enquiry, and, where two enquiries from one number want one call, the nearest preceding
     * enquiry. Ids break exact ties, so the pairing never depends on input order at all.
     */
    pairs.sort(
        (a, b) =>
            a.gap - b.gap || cmp(a.call.id, b.call.id) || cmp(a.lead.leadId, b.lead.leadId),
    );
    for (const { lead, call } of pairs) {
        if (callbackFor.has(lead.leadId) || consumed.has(call.id)) continue;
        callbackFor.set(lead.leadId, call);
        consumed.add(call.id);
    }

    const items: InboxItem[] = [];

    for (const lead of leads) {
        const e164 = normalizeE164(lead.phone ?? lead.phoneRaw);
        const cb = callbackFor.get(lead.leadId) ?? null;
        const id = `lead:${lead.leadId}`;
        items.push({
            id,
            source: "web-form",
            name: lead.name,
            phone: e164,
            phoneDisplay: e164 ? formatUsPhone(e164) : (lead.phoneRaw ?? "No number"),
            ...callbackFields(cb?.callbackNumber, e164),
            email: lead.email,
            preview: lead.message,
            at: lead.createdAt,
            read: lead.readAt !== null,
            promoted: promoted.has(id),
            archived: archived.has(id),
            durationSeconds: null,
            recordingUrl: null,
            address: null,
            outcome: null,
            callback: cb
                ? {
                      id: cb.id,
                      at: cb.date,
                      durationSeconds: cb.durationSeconds,
                      summary: cb.summary,
                      recordingUrl: cb.recordingUrl,
                  }
                : null,
        });
    }

    for (const call of calls) {
        if (consumed.has(call.id)) continue;
        const e164 = callContactId(call);
        items.push({
            id: call.id,
            source: "call",
            name: call.callerName,
            phone: e164,
            phoneDisplay: e164 ? formatUsPhone(e164) : (call.callerNumber ?? "Unknown"),
            ...callbackFields(call.callbackNumber, e164),
            email: call.email,
            preview: call.summary,
            at: call.date,
            read: readCallIds.has(call.id),
            promoted: promoted.has(call.id),
            archived: archived.has(call.id),
            durationSeconds: call.durationSeconds,
            recordingUrl: call.recordingUrl,
            address: call.address,
            outcome: call.outcome,
            callback: null,
        });
    }

    items.sort((a, b) => timeOf(b.at) - timeOf(a.at));
    return items;
}

/* ── what the inbox shows ─────────────────────────────────────────────────── */

export type InboxFilter = "all" | "unread" | "calls" | "forms" | "promoted" | "archived";

/**
 * The inbox is a worklist, so a promoted lead leaves it.
 *
 * It used to stay, marked with a "✓ Promoted" tag, because `buildInbox` only ever *flagged*
 * promotion and nothing downstream filtered on the flag. That made the inbox look like it never
 * empties: the one list whose whole job is "what still needs working" kept showing the items
 * that had been worked. Every filter here except `promoted` now hides them, and the `promoted`
 * filter shows nothing else — so there is still a way back to something promoted by mistake,
 * which is the only reason not to drop them outright.
 *
 * Pure, and the filter the component used to inline, so the rule is testable away from React.
 */
export function filterInbox(
    items: InboxItem[],
    filter: InboxFilter,
    search = "",
): InboxItem[] {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
        // Two views of what has left the worklist, and four slices of what is still in it.
        // Promoted wins over archived when an item is somehow both, because "it became a
        // customer" is the more useful thing to be told.
        if (filter === "promoted") {
            if (!i.promoted) return false;
        } else if (filter === "archived") {
            if (!i.archived || i.promoted) return false;
        } else {
            if (i.promoted || i.archived) return false;
            if (filter === "unread" && i.read) return false;
            if (filter === "calls" && i.source !== "call") return false;
            if (filter === "forms" && i.source !== "web-form") return false;
        }
        if (q) {
            const hay = `${i.name ?? ""} ${i.phoneDisplay} ${i.preview ?? ""}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

/* ── promotion ────────────────────────────────────────────────────────────── */

/** What `POST /api/portal/customers` is given when an inbox item becomes a customer. */
export interface PromotionInput {
    name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    note: string | null;
    tags: string[];
    source: InboxSource;
    sourceRef: string;
    /** When they actually got in touch — not when the client got round to promoting them. */
    firstContactAt: string | null;
}

/**
 * Everything worth keeping from an inbox item, in one place.
 *
 * This was four fields inlined in `InboxSection.promote()`, and the three it left behind each
 * cost the client something real: the address the receptionist had already taken down, the
 * Airtable outcome that says whether the call was worth anything, and the time they actually
 * rang — without which the record claims they turned up the moment the client clicked.
 *
 * The call summary is **not** copied beyond this note. Calls are folded into the record from
 * Airtable on read (see `customers/[id]/route.ts`), deliberately, so that a summary corrected
 * upstream cannot silently disagree with the timeline. The note is the client's own copy to
 * edit; the authoritative text stays where it is written.
 */
export function promotionInput(item: InboxItem): PromotionInput {
    const outcome = item.outcome?.trim().toLowerCase();
    return {
        name: item.name,
        phone: item.phone,
        email: item.email,
        address: item.address,
        note: item.preview,
        // One starting tag, lower-cased to match how tags are typed by hand. Triage words the
        // receptionist uses for "nothing here" would be noise on a customer the client has
        // just decided to keep, so they do not travel.
        tags: outcome && !NON_TAG_OUTCOMES.has(outcome) ? [outcome] : [],
        source: item.source,
        sourceRef: item.id,
        firstContactAt: item.at,
    };
}

/** Airtable outcomes that say "this was not a lead", which no customer should be tagged with. */
const NON_TAG_OUTCOMES = new Set(["spam", "wrong number", "no answer", "hung up", "test"]);

/* ── the record's origin ──────────────────────────────────────────────────── */

/** The timeline shape this needs, structural so the `server-only` Activity type stays put. */
interface TimelineLike {
    id: string;
    meta?: Record<string, unknown>;
}

/**
 * Flag the one timeline entry a customer was promoted from.
 *
 * `sourceRef` has been stored on every promoted customer since v2 and read by nothing. The
 * record therefore showed the call they came from as just another row among their calls, with
 * its summary and recording behind a disclosure click and no hint either existed. Marking it
 * lets the record pin that one open.
 *
 * Matches the id the detail route builds for a folded-in call (`call:{airtableId}`). A
 * web-form `sourceRef` (`lead:{leadId}`) matches nothing, because the lead store is not folded
 * into the timeline; that is not an error, so it flags nothing and says nothing.
 */
export function markOrigin<T extends TimelineLike>(timeline: T[], sourceRef: string | null): T[] {
    if (!sourceRef) return timeline;
    const originId = `call:${sourceRef}`;
    return timeline.map((e) =>
        e.id === originId ? { ...e, meta: { ...(e.meta ?? {}), origin: true } } : e,
    );
}

/* ── deep links ───────────────────────────────────────────────────────────── */

/**
 * Which inbox item a deep link should open.
 *
 * The owner's text carries whatever the voice stack logged. On a Growth site that is often the
 * *callback* — a call `buildInbox` consumed into its parent enquiry, so it is not an item of
 * its own and an id match alone finds nothing. Falling through to the enquiry it belongs to is
 * the right answer: to the client it was one enquiry, which is the whole reason the two were
 * collapsed.
 *
 * Null when the id names nothing in the list. The caller renders the inbox as normal — an id
 * that is missing, promoted away, or simply outside the loaded window all look the same here,
 * and deliberately so: the view must never tell a visitor whether an id exists.
 */
export function inboxItemForDeepLink(items: InboxItem[], id: string | null): InboxItem | null {
    if (!id) return null;
    return (
        items.find((i) => i.id === id) ?? items.find((i) => i.callback?.id === id) ?? null
    );
}

/** Where `/portal/l/<id>` should send a visitor. */
export type DeepLinkTarget =
    | { kind: "customer"; customerId: string }
    | { kind: "inbox"; itemId: string }
    | { kind: "gone" };

/**
 * The decision an inbox deep link turns on, with the lookups already done.
 *
 * Split from the lookups so the branching is testable without a live KV. `promotedCustomerId`
 * is the customer this source ref became, if it has been promoted; `leadExists` answers the
 * store for a `lead:` id and is null for anything else.
 *
 * A promoted item resolves to its customer rather than to the inbox, and that is the whole
 * reason this exists: a promoted lead is no longer *in* the inbox — `filterInbox` hides it —
 * so sending one there would land the visitor on an ordinary inbox with no sign of the thing
 * they tapped. The redirect has to know before it chooses a destination.
 */
export function classifyDeepLink(
    itemId: string,
    promotedCustomerId: string | null,
    leadExists: boolean | null,
): DeepLinkTarget {
    if (!isDeepLinkId(itemId)) return { kind: "gone" };
    if (promotedCustomerId) return { kind: "customer", customerId: promotedCustomerId };
    // Only a lead can be proven absent from here; see `resolveInboxDeepLink` on why a call id
    // is taken on trust.
    if (leadExists === false) return { kind: "gone" };
    return { kind: "inbox", itemId };
}

/**
 * The two id shapes an inbox item can have, as a guard.
 *
 * `lead:<uuid>` from `portal-leads`, or a bare Airtable record id. Anything else came from
 * somewhere we did not write, so it resolves to nothing rather than being carried into a KV
 * key or a query string.
 */
export function isDeepLinkId(id: string): boolean {
    return /^lead:[A-Za-z0-9_-]{1,64}$/.test(id) || /^rec[A-Za-z0-9]{14}$/.test(id);
}

/* ── one person, one row ──────────────────────────────────────────────────── */

/**
 * An inbox row: usually one item, sometimes every call one person made.
 *
 * `lead` is the item the row renders — the newest — and `items` holds the whole run, newest
 * first, so opening the row can list each call with its own time, length, summary and recording.
 * Nothing is merged away; the grouping is a way of reading the list, not a change to it.
 */
export interface InboxGroup {
    /** `contact:<e164>` for a real group, otherwise the single item's own id. Stable per view. */
    id: string;
    /** E.164 when these rows are grouped on a number; null for a row that could not group. */
    contact: string | null;
    lead: InboxItem;
    items: InboxItem[];
    /** `items.length`. A row is drawn as a group only when this is above one. */
    count: number;
    /** Any member unread — one unopened call in a run still wants the client's attention. */
    unread: boolean;
    at: string | null;
}

/**
 * Collapse repeat callers into one row.
 *
 * A person who rings three times is one person with one problem, and three rows of them is the
 * crowding this was asked for. The key is `normalizeE164(phone)`, which is already the contact
 * identity the CRM groups on — `portal-leads.ts` calls it "deliberate and load-bearing" and says
 * not to invent a second one — so a grouped row and the customer it would be promoted to resolve
 * to the same person by construction.
 *
 * **Apply this after filtering, never before.** Grouping the filtered list is what makes the
 * archived view accumulate: archive three calls today and a fourth next week, and the archived
 * view shows one row of four, because it groups whatever that view holds. Grouping first and
 * filtering after would split the same number across two rows.
 *
 * Only calls group. A web enquiry stays its own row: on Starter it is a different channel with
 * different content, and on Growth it never reaches the inbox at all — the form triggers a
 * receptionist callback, so the enquiry arrives as the resulting call. A call with no usable
 * number cannot be grouped either, which is most of what a client actually wants rid of:
 * withheld and spoofed numbers are each their own row, cleared by hand.
 */
export function groupInbox(items: InboxItem[]): InboxGroup[] {
    const byContact = new Map<string, InboxItem[]>();
    const groups: InboxGroup[] = [];

    /** Placeholders in `groups`, so a group keeps the position of its newest member. */
    const slotFor = new Map<string, number>();

    for (const item of items) {
        const key = item.source === "call" && item.phone ? item.phone : null;
        if (!key) {
            groups.push(singleton(item));
            continue;
        }
        const run = byContact.get(key);
        if (run) {
            run.push(item);
            continue;
        }
        byContact.set(key, [item]);
        slotFor.set(key, groups.length);
        // Reserved now and filled in below, once the whole run is known.
        groups.push(singleton(item));
    }

    for (const [e164, run] of byContact) {
        const slot = slotFor.get(e164) ?? 0;
        // `items` arrives newest first, so the run is already in order and its head is the row.
        groups[slot] = {
            id: `contact:${e164}`,
            contact: e164,
            lead: run[0],
            items: run,
            count: run.length,
            unread: run.some((i) => !i.read),
            at: run[0].at,
        };
    }

    return groups;
}

function singleton(item: InboxItem): InboxGroup {
    return {
        id: item.id,
        contact: item.source === "call" ? item.phone : null,
        lead: item,
        items: [item],
        count: 1,
        unread: !item.read,
        at: item.at,
    };
}

/** Every item id a row stands for — what an archive or restore acts on. */
export function groupItemIds(group: InboxGroup): string[] {
    return group.items.map((i) => i.id);
}

/** The row holding a given item, for opening a deep link on the grouped list. */
export function groupForItem(groups: InboxGroup[], id: string | null): InboxGroup | null {
    if (!id) return null;
    return (
        groups.find((g) => g.items.some((i) => i.id === id)) ??
        groups.find((g) => g.items.some((i) => i.callback?.id === id)) ??
        null
    );
}
