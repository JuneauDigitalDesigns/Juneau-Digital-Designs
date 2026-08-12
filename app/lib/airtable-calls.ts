import "server-only";
import { getCached, setCached, CALLS_TTL, callsKey, SCHEMA_TTL, schemaKey } from "./portal-kv";

/**
 * Airtable call-log access.
 *
 * There was no integration layer before this — the whole thing was ~25 lines inlined in
 * the calls route, with a hardcoded field list. That turned out to matter: the field set
 * `onboard.js` provisions is not the field set every live base actually has. One client
 * base has no `Outcome` column at all and instead carries `Priority`, `Email`, `Address`,
 * and `Recording URL`. The old code mapped the missing `Outcome` to `null` on every row,
 * so the UI drew a donut that was 100% "Unknown" and a header that read a permanent
 * "0% qualified" — a fabricated statistic presented as a measurement.
 *
 * So this module reads the table's real schema first and reports which fields exist. The
 * UI renders only the stats the base can actually support.
 */

/** Fields the portal knows how to display. Anything else in a base is ignored. */
export type KnownField =
    | "Date"
    | "Caller name"
    | "Caller number"
    | "Summary"
    | "Duration (seconds)"
    | "Call type"
    | "Outcome"
    | "Site"
    | "Email"
    | "Address"
    | "Recording URL"
    | "Priority";

const KNOWN_FIELDS: KnownField[] = [
    "Date",
    "Caller name",
    "Caller number",
    "Summary",
    "Duration (seconds)",
    "Call type",
    "Outcome",
    "Site",
    "Email",
    "Address",
    "Recording URL",
    "Priority",
];

export interface CallRecord {
    id: string;
    date: string | null;
    callerName: string | null;
    callerNumber: string | null;
    summary: string | null;
    durationSeconds: number | null;
    callType: string | null;
    outcome: string | null;
    site: string | null;
    email: string | null;
    address: string | null;
    recordingUrl: string | null;
    priority: string | null;
}

/** Why a fetch failed, in terms the caller can act on. Never shown to a client verbatim. */
export type CallsFailure = "auth" | "missing-table" | "upstream";

export type CallsResult =
    | { ok: true; calls: CallRecord[]; fields: KnownField[]; truncated: boolean }
    | { ok: false; failure: CallsFailure; detail: string };

const TABLE = "Call Log";
/** Enough history for a year of a busy line without letting one client's base run away. */
const MAX_RECORDS = 1000;
const PAGE_SIZE = 100;

interface AirtableRecord {
    id: string;
    fields: Record<string, unknown>;
}

function str(v: unknown): string | null {
    if (typeof v === "string") return v.trim() || null;
    if (typeof v === "number") return String(v);
    return null;
}

function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function authHeaders(apiKey: string) {
    return { Authorization: `Bearer ${apiKey}` };
}

function classify(status: number): CallsFailure {
    if (status === 401 || status === 403) return "auth";
    if (status === 404) return "missing-table";
    return "upstream";
}

/**
 * Which of the fields we know about this base actually has.
 *
 * Two layers. The `Map` is an L1 for the lifetime of a warm serverless instance; Redis is
 * the L2 that survives cold starts. The L2 is the point: this request was measured at
 * **~1.8s**, and a per-process Map misses on exactly the request where that hurts most.
 *
 * A table's columns change at provisioning time, not between two page loads, so ten minutes
 * is generous. No client data here — only column names — so this key is base-scoped rather
 * than account-scoped.
 */
const schemaCache = new Map<string, { fields: KnownField[]; at: number }>();
const SCHEMA_TTL_MS = SCHEMA_TTL * 1000;

export async function getCallLogFields(
    baseId: string,
    apiKey: string,
): Promise<{ ok: true; fields: KnownField[] } | { ok: false; failure: CallsFailure; detail: string }> {
    const local = schemaCache.get(baseId);
    if (local && Date.now() - local.at < SCHEMA_TTL_MS) {
        return { ok: true, fields: local.fields };
    }

    const shared = await getCached<KnownField[]>(schemaKey(baseId));
    if (shared) {
        schemaCache.set(baseId, { fields: shared, at: Date.now() });
        return { ok: true, fields: shared };
    }

    const res = await fetch(`https://api.airtable.com/v0/meta/bases/${baseId}/tables`, {
        headers: authHeaders(apiKey),
        cache: "no-store",
    });

    if (!res.ok) {
        return { ok: false, failure: classify(res.status), detail: `meta ${res.status}` };
    }

    const json = (await res.json()) as { tables: Array<{ name: string; fields: Array<{ name: string }> }> };
    const table = json.tables.find((t) => t.name === TABLE);
    if (!table) {
        return { ok: false, failure: "missing-table", detail: `no "${TABLE}" table in ${baseId}` };
    }

    const present = new Set(table.fields.map((f) => f.name));
    const fields = KNOWN_FIELDS.filter((f) => present.has(f));

    schemaCache.set(baseId, { fields, at: Date.now() });
    await setCached(schemaKey(baseId), SCHEMA_TTL, fields);
    return { ok: true, fields };
}

/**
 * Fetch a site's calls, cached for `CALLS_TTL`.
 *
 * `siteSlug` scopes rows via the `Site` column — but only when the base actually has one.
 * That column is provisioned for enterprise (multi-site) bases only, so filtering on it
 * unconditionally would make Airtable reject the formula with UNKNOWN_FIELD_NAME and take
 * a working single-site call log down with it.
 *
 * The cache is keyed by **account scope + site slug**, never by base id alone. Site slugs
 * are unique only within an account (`upsertSite` matches on `account.sites.findIndex`), so
 * a base-keyed entry could in principle be served across accounts. This payload holds caller
 * names, numbers, emails and addresses; the key must make that structurally impossible.
 *
 * Only successful reads are cached. An Airtable outage must not be replayed for two minutes.
 */
export async function fetchCalls({
    baseId,
    apiKey,
    siteSlug,
    scopeToSite,
    acctScope,
}: {
    baseId: string;
    apiKey: string;
    siteSlug: string;
    /** True when other sites on this account share the base and rows must be separated. */
    scopeToSite: boolean;
    /** `accountScope(account.email)` — required, so a key can never be account-agnostic. */
    acctScope: string;
}): Promise<CallsResult> {
    const key = callsKey(acctScope, siteSlug);

    const hit = await getCached<CallsResult>(key);
    if (hit) return hit;

    await assertSingleAccountBase(baseId, acctScope);

    const result = await fetchCallsUncached({ baseId, apiKey, siteSlug, scopeToSite });
    if (result.ok) await setCached(key, CALLS_TTL, result);
    return result;
}

/**
 * Warn loudly if one Airtable base is ever seen under two different accounts.
 *
 * `scopeToSite` is computed as "does *my* account have another site on this base". Two
 * separate accounts sharing a base would therefore each compute `false` and each receive
 * **every** row — one client reading another's calls. Nothing in provisioning permits this,
 * and nothing enforces it either.
 *
 * Detection only: it does not block the read, because a false positive from a legitimate
 * base reassignment must not take a client's call log offline. It records the first account
 * scope seen for a base and shouts if a second appears. Runs on cache misses only.
 */
async function assertSingleAccountBase(baseId: string, acctScope: string): Promise<void> {
    const key = `portal:baseowner:v1:${baseId}`;
    const seen = await getCached<string>(key);

    if (seen && seen !== acctScope) {
        console.error(
            `[airtable-calls] SECURITY: base ${baseId} accessed by two account scopes ` +
                `(${seen} and ${acctScope}). Rows are only separated per-account, so each ` +
                `may be seeing the other's calls. Verify base ownership immediately.`,
        );
        return;
    }
    if (!seen) await setCached(key, 86_400, acctScope);
}

async function fetchCallsUncached({
    baseId,
    apiKey,
    siteSlug,
    scopeToSite,
}: {
    baseId: string;
    apiKey: string;
    siteSlug: string;
    scopeToSite: boolean;
}): Promise<CallsResult> {
    const schema = await getCallLogFields(baseId, apiKey);
    if (!schema.ok) return schema;

    const fields = schema.fields;
    const hasSite = fields.includes("Site");
    const sortable = fields.includes("Date");

    const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
    // Sorting on a column the base doesn't have is a 422. Fall back to Airtable's own order.
    if (sortable) {
        params.set("sort[0][field]", "Date");
        params.set("sort[0][direction]", "desc");
    }
    if (scopeToSite && hasSite) {
        // Rows predating the tagging fix have no Site value; keep showing them everywhere
        // rather than silently dropping them.
        const safe = siteSlug.replace(/'/g, "\\'");
        params.set("filterByFormula", `OR({Site}='${safe}',{Site}=BLANK())`);
    }

    const records: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
        if (offset) params.set("offset", offset);
        const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLE)}?${params}`;
        const res = await fetch(url, { headers: authHeaders(apiKey), cache: "no-store" });

        if (!res.ok) {
            return {
                ok: false,
                failure: classify(res.status),
                detail: `records ${res.status}: ${(await res.text()).slice(0, 200)}`,
            };
        }

        const json = (await res.json()) as { records: AirtableRecord[]; offset?: string };
        records.push(...json.records);
        offset = json.offset;
    } while (offset && records.length < MAX_RECORDS);

    const truncated = Boolean(offset) || records.length > MAX_RECORDS;

    const calls: CallRecord[] = records.slice(0, MAX_RECORDS).map((r) => ({
        id: r.id,
        date: str(r.fields["Date"]),
        callerName: str(r.fields["Caller name"]),
        // Deliberately NOT masked. These are the client's own callers, and a call log you
        // cannot return a call from is a report, not a tool.
        callerNumber: str(r.fields["Caller number"]),
        summary: str(r.fields["Summary"]),
        durationSeconds: num(r.fields["Duration (seconds)"]),
        callType: str(r.fields["Call type"]),
        outcome: str(r.fields["Outcome"]),
        site: str(r.fields["Site"]),
        email: str(r.fields["Email"]),
        address: str(r.fields["Address"]),
        recordingUrl: str(r.fields["Recording URL"]),
        priority: str(r.fields["Priority"]),
    }));

    return { ok: true, calls, fields, truncated };
}
