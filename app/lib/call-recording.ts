import "server-only";
import { fetchCallRow } from "./airtable-calls";
import { dropCached, getCached, setCached } from "./portal-kv";

/**
 * Finding the audio for one logged call.
 *
 * Measured 2026-11-09 on the test fixtures: a Retell `recording_url` opens with no login at all,
 * for good. The portal used to hand that link to the browser. Retell's fix is `opt_in_signed_url`
 * on the agent, which makes new links expire, and that creates the problem this module solves:
 * the link Make stores in the `Recording URL` column dies, so an owner opening an old call would
 * get nothing.
 *
 * Retell mints a fresh link each time a call is read, so the portal asks for one at play time.
 * That needs the call's id, which no column holds. It does not need a new column: `Date` is
 * Make's `parseDate(start_timestamp)`, and on the fixtures it equals Retell's `start_timestamp`
 * to the millisecond on every row, so an exact-time search finds the one call.
 *
 * ── What keeps an old call playable ─────────────────────────────────────────────────────────
 * Retell does not re-sign old files ("Files created before secure URLs were enabled will still
 * be generated without signatures"), so the link stored for an older call keeps working. When
 * Retell has no match (the agent behind the call was replaced, as the growth fixture's was), the
 * stored link is the fallback. It is only ever fetched here on the server, so it stays out of
 * the browser either way.
 *
 * ── Who can reach this ──────────────────────────────────────────────────────────────────────
 * The base comes from the signed-in account, so a row can only be read from that account's own
 * base. Where sites share a base, the row's `Site` must match, by the same rule the call list
 * uses: a blank `Site` shows everywhere.
 */

/**
 * How long a resolved link is reused, so a seek does not cost three vendor requests. Must stay
 * under `SIGNED_URL_EXPIRATION_MS` in jdd-ops/lib/voice-consent.js (15 minutes).
 */
const RESOLVED_TTL_SECONDS = 240;

const resolvedKey = (acctScope: string, siteSlug: string, recordId: string) =>
    `portal:recording:v1:${acctScope}:${siteSlug}:${recordId}`;

/** Compares two numbers however they were formatted, on their last ten digits. */
const lastTen = (n: string | null | undefined) => (n ?? "").replace(/\D/g, "").slice(-10);

export interface RetellCallSummary {
    call_id?: string;
    agent_id?: string;
    start_timestamp?: number;
    from_number?: string;
    to_number?: string;
}

/**
 * The one call this row was written from, or null.
 *
 * The search runs on the master Retell account, which holds every client's calls, so an exact
 * time is not proof on its own. The call must also be on this site's agent or on this row's
 * number. Two calls that both pass mean no answer rather than a guess: playing the wrong
 * recording to an owner is worse than playing none.
 */
export function pickRetellCall(
    items: RetellCallSummary[],
    { startMs, callerNumber, agentId }: { startMs: number; callerNumber: string | null; agentId: string | null },
): string | null {
    const number = lastTen(callerNumber);
    const matches = items.filter((call) => {
        if (call.start_timestamp !== startMs) return false;
        const onAgent = Boolean(agentId) && call.agent_id === agentId;
        const onNumber = number.length === 10 && (lastTen(call.from_number) === number || lastTen(call.to_number) === number);
        return onAgent || onNumber;
    });
    return matches.length === 1 ? (matches[0].call_id ?? null) : null;
}

/** Retell's current link for this call, or null if it can't be found. Never throws. */
async function currentLinkFromRetell(
    apiKey: string,
    match: { startMs: number; callerNumber: string | null; agentId: string | null },
): Promise<string | null> {
    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
    try {
        const list = await fetch("https://api.retellai.com/v3/list-calls", {
            method: "POST",
            headers,
            body: JSON.stringify({
                filter_criteria: { start_timestamp: { type: "number", op: "eq", value: match.startMs } },
                limit: 10,
            }),
            cache: "no-store",
        });
        if (!list.ok) {
            console.error(`[call-recording] list-calls ${list.status}`);
            return null;
        }
        const { items } = (await list.json()) as { items?: RetellCallSummary[] };
        const callId = pickRetellCall(items ?? [], match);
        if (!callId) return null;

        const call = await fetch(`https://api.retellai.com/v2/get-call/${encodeURIComponent(callId)}`, {
            headers,
            cache: "no-store",
        });
        if (!call.ok) {
            console.error(`[call-recording] get-call ${call.status}`);
            return null;
        }
        const { recording_url: url } = (await call.json()) as { recording_url?: string };
        return typeof url === "string" && url.startsWith("https://") ? url : null;
    } catch (e) {
        console.error("[call-recording] Retell lookup failed", e);
        return null;
    }
}

/**
 * Whether a link read from Airtable may be fetched by the server.
 *
 * The column is a free-form URL, and the server is about to request whatever it says, so only
 * the hosts Retell serves recordings from pass. A link from Retell's own API needs no such
 * check. It arrives over TLS from the vendor, and where it points once signing is on hasn't
 * been observed yet.
 */
export function isRetellRecordingHost(raw: string): boolean {
    try {
        const url = new URL(raw);
        return (
            url.protocol === "https:" &&
            (url.hostname.endsWith(".cloudfront.net") || url.hostname.endsWith(".retellai.com"))
        );
    } catch {
        return false;
    }
}

export interface RecordingScope {
    baseId: string;
    airtableKey: string;
    retellKey: string | undefined;
    recordId: string;
    siteSlug: string;
    /** True when another site on this account shares the base. */
    scopeToSite: boolean;
    agentId: string | null;
    acctScope: string;
}

/** A link the server can fetch this call's audio from, or null if this account has none. */
export async function resolveRecordingLink(scope: RecordingScope): Promise<string | null> {
    const key = resolvedKey(scope.acctScope, scope.siteSlug, scope.recordId);
    const hit = await getCached<string>(key);
    if (hit) return hit;

    const row = await fetchCallRow({ baseId: scope.baseId, apiKey: scope.airtableKey, recordId: scope.recordId });
    if (!row?.storedRecordingUrl) return null;
    if (scope.scopeToSite && row.site && row.site !== scope.siteSlug) return null;

    const startMs = row.date ? Date.parse(row.date) : NaN;
    const current =
        scope.retellKey && Number.isFinite(startMs)
            ? await currentLinkFromRetell(scope.retellKey, {
                  startMs,
                  callerNumber: row.callerNumber,
                  agentId: scope.agentId,
              })
            : null;

    const link = current ?? (isRetellRecordingHost(row.storedRecordingUrl) ? row.storedRecordingUrl : null);
    if (link) await setCached(key, RESOLVED_TTL_SECONDS, link);
    return link;
}

/** Forget a resolved link that turned out not to work, so the next play looks again. */
export async function forgetRecordingLink(scope: Pick<RecordingScope, "acctScope" | "siteSlug" | "recordId">) {
    await dropCached(resolvedKey(scope.acctScope, scope.siteSlug, scope.recordId));
}

/**
 * Retell's CDN labels every file `binary/octet-stream`. Browsers, Safari above all, want a real
 * audio type for an `<audio>` source, so it is taken from the file name.
 */
export function audioContentType(link: string): string {
    const path = new URL(link).pathname.toLowerCase();
    if (path.endsWith(".wav")) return "audio/wav";
    if (path.endsWith(".mp3")) return "audio/mpeg";
    return "application/octet-stream";
}
