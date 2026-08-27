import "server-only";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import type { CallRecord } from "./airtable-calls";
import { getSiteCalls } from "./portal-overview";
import {
    accountScope,
    getCached,
    setCached,
    lastVisitKey,
    LAST_VISIT_TTL,
} from "./portal-kv";

/**
 * "Since your last visit."
 *
 * The Overview previously opened on the same numbers whether you had been away an hour or a
 * month, which gave a returning client nothing to come back *for*. This answers the one
 * question a second visit actually has: what happened while I was gone.
 *
 * Server-rendered from a KV timestamp rather than localStorage, for two reasons. A client
 * who checks calls on a phone in the morning and a laptop in the afternoon should not be
 * told the same three calls are new twice. And a client-side timestamp would mean this panel
 * renders empty on the server and pops in after hydration, on a page whose whole point is
 * that it does not flash.
 */

export interface LastVisitSummary {
    /** Null when there is nothing worth saying, which is most visits. */
    since: number | null;
    newCalls: number;
    newQualified: number;
}

const EMPTY: LastVisitSummary = { since: null, newCalls: 0, newQualified: 0 };

/**
 * A visit close enough to the last one is not a new visit.
 *
 * Without this, a client who clicks Call Log and then browser-backs to Overview gets "nothing
 * new" on a page that said "3 new calls" ten seconds earlier, because the first render moved
 * the marker. The window keeps the marker still long enough for a normal session, so the
 * panel says the same thing for as long as you are actually here.
 */
const SESSION_WINDOW_MS = 30 * 60 * 1000;

/**
 * Read the marker, summarise what arrived after it, then move it.
 *
 * Deliberately *not* wrapped in `cache()`. React's request dedupe would be right for a pure
 * read, but this writes, and a second caller in the same request must not re-run the write
 * with a marker the first one already moved.
 */
export async function getLastVisitSummary(
    account: PortalAccount,
    site: PortalSite,
): Promise<LastVisitSummary> {
    const scope = accountScope(account.email);
    const key = lastVisitKey(scope, site.slug);
    const now = Date.now();

    let previous: number | null = null;
    try {
        previous = await getCached<number>(key);
    } catch {
        // A KV outage here must not take the Overview down. No marker reads as a first
        // visit, which renders nothing — the correct failure.
        return EMPTY;
    }

    // First ever visit. There is no baseline, so every call on record would count as "new",
    // which is both false and the least useful thing to greet someone with.
    if (typeof previous !== "number" || !Number.isFinite(previous)) {
        await setCached(key, LAST_VISIT_TTL, now).catch(() => {});
        return EMPTY;
    }

    // Still the same sitting. Report against the older marker and leave it where it is.
    const stillSameSession = now - previous < SESSION_WINDOW_MS;
    if (!stillSameSession) {
        await setCached(key, LAST_VISIT_TTL, now).catch(() => {});
    }

    // Shares the request-scoped read with the metric row and the call feed — see
    // `getSiteCalls`. This panel must never be the reason the Overview makes a second
    // Airtable call.
    const calls = await getSiteCalls(account, site).catch(() => null);
    if (!calls?.ok) return { ...EMPTY, since: previous };

    const arrivedSince = calls.calls.filter((c) => isAfter(c, previous));

    return {
        since: previous,
        newCalls: arrivedSince.length,
        // Only counted when the client's base actually has an Outcome column to support it,
        // and only ever counting the value they typed. See `airtable-calls.ts` — deriving a
        // qualification we were not told is how "0% qualified" became a fabricated statistic
        // presented as a measurement.
        newQualified: calls.hasOutcome
            ? arrivedSince.filter((c) => c.outcome?.trim().toLowerCase() === "qualified").length
            : 0,
    };
}

function isAfter(call: CallRecord, since: number): boolean {
    if (!call.date) return false;
    const t = new Date(call.date).getTime();
    return !Number.isNaN(t) && t > since;
}
