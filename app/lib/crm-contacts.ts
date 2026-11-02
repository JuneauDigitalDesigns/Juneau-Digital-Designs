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
    email: string | null;
    /** One line for the list. The enquiry text for a form, the call summary for a call. */
    preview: string | null;
    at: string | null;
    read: boolean;
    promoted: boolean;
    durationSeconds: number | null;
    recordingUrl: string | null;
    /**
     * The receptionist's callback, when this form enquiry triggered one.
     *
     * Present only on `web-form` items. Rendering it nested under the enquiry is the whole
     * point: to the client it was one enquiry, and a list that counts it twice is a list they
     * stop trusting.
     */
    callback: {
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
 * Build the inbox.
 *
 * `leads` is optional on purpose: the web-form capture is owned by another workstream, and the
 * Inbox has to work (calls only) before it lands.
 */
export function buildInbox({
    calls,
    leads = [],
    promoted = new Set<string>(),
    readCallIds = new Set<string>(),
}: {
    calls: CallRecord[];
    leads?: WebLeadLike[];
    promoted?: Set<string>;
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
            email: lead.email,
            preview: lead.message,
            at: lead.createdAt,
            read: lead.readAt !== null,
            promoted: promoted.has(id),
            durationSeconds: null,
            recordingUrl: null,
            callback: cb
                ? {
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
            email: call.email,
            preview: call.summary,
            at: call.date,
            read: readCallIds.has(call.id),
            promoted: promoted.has(call.id),
            durationSeconds: call.durationSeconds,
            recordingUrl: call.recordingUrl,
            callback: null,
        });
    }

    items.sort((a, b) => timeOf(b.at) - timeOf(a.at));
    return items;
}
