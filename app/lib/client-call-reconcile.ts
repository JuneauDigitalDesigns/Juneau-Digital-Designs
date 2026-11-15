import "server-only";
import { Redis } from "@upstash/redis";
import {
    CALL_PROFILE_INDEX,
    callProfileProblems,
    isMakeHookUrl,
    shouldLogCall,
    type CallProfile,
    type RetellCallLike,
} from "@jdd/schema";

/**
 * The missed-call safety net for client receptionists.
 *
 * A client's call reaches their log by one path: Retell's `call_analyzed` webhook → the client's
 * own Make clone → their Airtable `Call Log` row → this site texting the owner. If Retell doesn't
 * deliver, or Make deactivates the clone after repeated errors, the call is lost and nothing says
 * so. The demo line has had a net since 2026-08-04 (reconcile-demo-calls); this is the clients'.
 *
 * Per site, on every run (with the demo reconcile, every 15 minutes):
 *   1. list the site's Retell calls since its cursor, with two hours of overlap, and keep only
 *      the ones that ended more than 30 minutes ago (analysis is done, Make has had its chance);
 *   2. keep the ones the shared gate says should have a row (`shouldLogCall`, @jdd/schema, the
 *      rule the Make filter is tested against). A call the gate drops is never replayed: an
 *      unanswered or dropped callback is a lost lead on purpose (operator rules 2026-11-03/08);
 *   3. look for each one's row: `Date` equal to `start_timestamp` to the millisecond, which is how
 *      Make writes it, plus `Site` on an enterprise base;
 *   4. a call with no row that was never replayed is re-checked (a fresh get-call, the gate again,
 *      the row again) and then POSTed once, Retell-shaped (`{ event: "call_analyzed", call }`),
 *      to the site's own Make hook. The replay is claimed per call_id with SET NX, so it happens
 *      once however many runs overlap;
 *   5. on a later run, a replayed call that is still missing becomes an alert the console shows
 *      under Needs attention. One that turns up clears itself.
 *
 * The owner's text is once per Retell call_id (the agency's /api/ingest/call), so a replay never
 * double-texts. A replay reaches Make exactly like Retell's own delivery, so it gets the same
 * filter, the same row and the same text.
 *
 * Profiles come from jdd-ops (`lib/call-profile.js`), which refuses a master base or the master
 * hook. The hook URL is a credential: it is never logged, returned or put in an alert.
 */

// ── tuning ──────────────────────────────────────────────────────────────────────────────────

/** A call must have ended this long ago before its row is expected. */
export const SETTLE_MS = 30 * 60 * 1000;
/** Re-read this far behind the cursor, so a late analysis or a long call is never skipped. */
export const OVERLAP_MS = 2 * 60 * 60 * 1000;
/** A site with no cursor yet starts this far back. */
export const FIRST_LOOKBACK_MS = 24 * 60 * 60 * 1000;
/** However stale the cursor, never walk further back than this. */
export const MAX_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
/** A replayed call still missing after this long is an alert (the next run is 15 min later). */
export const ALERT_AFTER_MS = 10 * 60 * 1000;
/** A replayed call is watched this long, then dropped from the alert and the watch list. */
export const WATCH_MS = 14 * 24 * 60 * 60 * 1000;
/** How long the once-only replay claim lives. Longer than WATCH_MS and the lookback. */
const REPLAY_TTL_S = 30 * 24 * 60 * 60;
/** Retell allows 30 requests per 10 s per account (measured 2026-11-15: `ratelimit-policy: 30;w=10`). */
let retellMinGapMs = 400;
/** Tests replay recorded responses and have no limit to respect. */
export function setRetellPacing(ms: number) {
    retellMinGapMs = ms;
}
const RETELL_PAGE = 100;
const RETELL_MAX_PAGES = 10;

// ── keys ────────────────────────────────────────────────────────────────────────────────────

const site = (p: Pick<CallProfile, "acctScope" | "siteSlug">) => `${p.acctScope}:${p.siteSlug}`;
export const cursorKey = (p: Pick<CallProfile, "acctScope" | "siteSlug">) => `jdd:callrecon:v1:cursor:${site(p)}`;
export const replayKey = (callId: string) => `jdd:callrecon:v1:replay:${callId}`;
export const watchKey = (p: Pick<CallProfile, "acctScope" | "siteSlug">) => `jdd:callrecon:v1:watch:${site(p)}`;
export const alertKey = (p: Pick<CallProfile, "acctScope" | "siteSlug">) => `jdd:callrecon:v1:alert:${site(p)}`;
/** Every site with an open alert. The console reads this, then the alerts. */
export const ALERT_INDEX = "jdd:callrecon:v1:alerts";
export const LAST_RUN_KEY = "jdd:callrecon:v1:last-run";
const OFFSET_KEY = "jdd:callrecon:v1:offset";

// ── records ─────────────────────────────────────────────────────────────────────────────────

export interface ReplayRecord {
    callId: string;
    startMs: number;
    replayedAt: number;
    /** The hook's HTTP status, or 0 when it couldn't be reached. */
    status: number;
}

/** What the console shows: a client, a count, and that their scenario may be off. */
export interface CallReconcileAlert {
    v: 1;
    acctScope: string;
    siteSlug: string;
    label: string;
    siteColumn: string | null;
    missing: Array<{ callId: string; startMs: number; replayedAt: number }>;
    firstSeenAt: number;
    updatedAt: number;
}

export interface SiteResult {
    site: string;
    scanned: number;
    unsettled: number;
    excluded: number;
    present: number;
    replayed: number;
    stillMissing: number;
    resolved: number;
    error?: string;
}

// ── vendor access ───────────────────────────────────────────────────────────────────────────

let lastRetellAt = 0;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Retell request, paced under the account's limit and retried once after a 429. */
async function retell(path: string, init: RequestInit, apiKey: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
        const wait = lastRetellAt + retellMinGapMs - Date.now();
        if (wait > 0) await sleep(wait);
        lastRetellAt = Date.now();
        const res = await fetch(`https://api.retellai.com${path}`, {
            ...init,
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            cache: "no-store",
        });
        const remaining = Number(res.headers.get("ratelimit-remaining"));
        const resetS = Number(res.headers.get("ratelimit-reset"));
        if (res.status === 429 && attempt === 0) {
            await sleep((Number.isFinite(resetS) && resetS > 0 ? resetS : 10) * 1000);
            continue;
        }
        // Other jobs share the account (the portal's recordings, retell-usage): leave them room.
        if (Number.isFinite(remaining) && remaining <= 3 && Number.isFinite(resetS)) await sleep(resetS * 1000);
        return res;
    }
}

/** The agent's calls that started at or after `since`, every page. */
export async function listCallsSince(agentId: string, since: number, apiKey: string): Promise<RetellCallLike[]> {
    const out: RetellCallLike[] = [];
    let pagination_key: string | undefined;
    for (let page = 0; page < RETELL_MAX_PAGES; page++) {
        const res = await retell(
            "/v3/list-calls",
            {
                method: "POST",
                body: JSON.stringify({
                    // `ge`, not `gte`: Retell answers `gte` with a 400 (recorded 2026-11-15).
                    filter_criteria: { agent_id: [agentId], start_timestamp: { type: "number", op: "ge", value: since } },
                    limit: RETELL_PAGE,
                    ...(pagination_key ? { pagination_key } : {}),
                }),
            },
            apiKey,
        );
        if (!res.ok) throw new Error(`Retell list-calls ${res.status}`);
        const body = (await res.json()) as { items?: RetellCallLike[]; has_more?: boolean; pagination_key?: string };
        out.push(...(body.items ?? []));
        if (!body.has_more || !body.pagination_key) return out;
        pagination_key = body.pagination_key;
    }
    throw new Error(`Retell list-calls: more than ${RETELL_MAX_PAGES * RETELL_PAGE} calls since the cursor`);
}

async function getCall(callId: string, apiKey: string): Promise<RetellCallLike | null> {
    const res = await retell(`/v2/get-call/${encodeURIComponent(callId)}`, { method: "GET" }, apiKey);
    if (!res.ok) return null;
    return (await res.json()) as RetellCallLike;
}

interface LogRow {
    ms: number;
    site: string | null;
}

/**
 * The log's rows since `fromMs`: `Date` and, on an enterprise base only, `Site`. Asking a
 * single-site base for `Site` fails the whole request with UNKNOWN_FIELD_NAME (recorded).
 */
export async function logRowsSince(p: CallProfile, fromMs: number, apiKey: string, untilMs?: number): Promise<LogRow[]> {
    const rows: LogRow[] = [];
    let offset: string | undefined;
    const after = `IS_AFTER({Date}, '${new Date(fromMs - 1000).toISOString()}')`;
    const formula = untilMs ? `AND(${after}, IS_BEFORE({Date}, '${new Date(untilMs + 1000).toISOString()}'))` : after;
    do {
        const q = new URLSearchParams();
        q.append("fields[]", "Date");
        if (p.siteColumn) q.append("fields[]", "Site");
        q.set("filterByFormula", formula);
        q.set("pageSize", "100");
        if (offset) q.set("offset", offset);
        const res = await fetch(
            `https://api.airtable.com/v0/${encodeURIComponent(p.airtableBaseId)}/${encodeURIComponent(p.airtableTable)}?${q}`,
            { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Airtable ${res.status}`);
        const body = (await res.json()) as { records?: Array<{ fields?: Record<string, unknown> }>; offset?: string };
        for (const r of body.records ?? []) {
            const ms = typeof r.fields?.Date === "string" ? Date.parse(r.fields.Date) : NaN;
            if (Number.isFinite(ms)) rows.push({ ms, site: typeof r.fields?.Site === "string" ? r.fields.Site : null });
        }
        offset = body.offset;
    } while (offset);
    return rows;
}

/**
 * Does the log hold this call's row? Exact millisecond on `Date`. On an enterprise base a row
 * naming ANOTHER site is not this call's; a blank `Site` at the exact millisecond is (a clone
 * that failed to write the tag still wrote this call), since replaying it would add a duplicate.
 */
export function hasRow(rows: LogRow[], startMs: number, siteColumn: string | null): boolean {
    return rows.some((r) => r.ms === startMs && (!siteColumn || r.site === null || r.site === siteColumn));
}

/** A call with no end this long after it started is judged as it stands (Retell caps calls at an hour). */
const STUCK_MS = 3 * 60 * 60 * 1000;

/**
 * Settled: ended more than SETTLE_MS ago. Analysis isn't required: one that never arrives leaves
 * nothing for the gate to keep, and one that is merely late is re-read on the next runs, since the
 * cursor trails the cut-off by OVERLAP_MS. A call that never reports an end is judged after
 * STUCK_MS, so it can't hold the cursor back for good.
 */
export function isSettled(call: RetellCallLike, now: number): boolean {
    if (typeof call.end_timestamp === "number") return call.end_timestamp <= now - SETTLE_MS;
    return typeof call.start_timestamp === "number" && call.start_timestamp <= now - STUCK_MS;
}

const shouldHaveRow = (call: RetellCallLike) => shouldLogCall({ event: "call_analyzed", call });

// ── one site ────────────────────────────────────────────────────────────────────────────────

export async function reconcileSite(
    p: CallProfile,
    { redis, now, retellKey, airtableKey }: { redis: Redis; now: number; retellKey: string; airtableKey: string },
): Promise<SiteResult> {
    const result: SiteResult = { site: p.siteSlug, scanned: 0, unsettled: 0, excluded: 0, present: 0, replayed: 0, stillMissing: 0, resolved: 0 };

    const cursor = (await redis.get<number>(cursorKey(p))) ?? now - FIRST_LOOKBACK_MS;
    const since = Math.max(cursor - OVERLAP_MS, now - MAX_LOOKBACK_MS);
    const calls = await listCallsSince(p.retellAgentId, since, retellKey);
    result.scanned = calls.length;

    let nextCursor = now - SETTLE_MS;
    const candidates: RetellCallLike[] = [];
    for (const c of calls) {
        if (typeof c.call_id !== "string" || typeof c.start_timestamp !== "number") continue;
        // Defence in depth: the list is filtered by agent, so a stranger here is a vendor surprise.
        if (c.agent_id && c.agent_id !== p.retellAgentId) continue;
        if (!isSettled(c, now)) {
            result.unsettled++;
            nextCursor = Math.min(nextCursor, c.start_timestamp);
            continue;
        }
        if (!shouldHaveRow(c)) {
            result.excluded++;
            continue;
        }
        candidates.push(c);
    }

    const watched = (await redis.smembers(watchKey(p))) ?? [];
    const replays = watched.length
        ? ((await redis.mget<(ReplayRecord | null)[]>(...watched.map(replayKey))) ?? []).filter((r): r is ReplayRecord => Boolean(r))
        : [];

    const from = Math.min(since, ...replays.map((r) => r.startMs));
    const rows = candidates.length || replays.length ? await logRowsSince(p, from, airtableKey) : [];

    // Replay what is missing and was never replayed.
    const replayedIds = new Set(watched);
    for (const c of candidates) {
        const startMs = c.start_timestamp as number;
        if (hasRow(rows, startMs, p.siteColumn)) {
            result.present++;
            continue;
        }
        if (replayedIds.has(c.call_id as string)) continue; // judged below, never twice
        const outcome = await replayOnce(p, c, { redis, now, retellKey, airtableKey });
        if (outcome === "sent") result.replayed++;
        else if (outcome === "not-needed") result.present++; // the re-check found it, or the gate now drops it
        replayedIds.add(c.call_id as string);
    }

    // Judge earlier replays: found → resolved; still missing after a while → alert.
    const missing: CallReconcileAlert["missing"] = [];
    for (const r of replays) {
        if (hasRow(rows, r.startMs, p.siteColumn)) {
            result.resolved++;
            await redis.srem(watchKey(p), r.callId);
        } else if (now - r.replayedAt > WATCH_MS) {
            await redis.srem(watchKey(p), r.callId);
        } else if (now - r.replayedAt >= ALERT_AFTER_MS) {
            missing.push({ callId: r.callId, startMs: r.startMs, replayedAt: r.replayedAt });
        }
    }
    // A watched id whose replay claim expired has nothing left to judge.
    const known = new Set(replays.map((r) => r.callId));
    for (const id of watched) if (!known.has(id)) await redis.srem(watchKey(p), id);

    result.stillMissing = missing.length;
    await writeAlert(p, missing, { redis, now });
    await redis.set(cursorKey(p), nextCursor);
    return result;
}

/**
 * Re-check, claim, replay. "sent": this run POSTed it. "claimed": it was replayed before (the
 * claim outlives the watch list), so it is never sent again. "not-needed": the re-check found the
 * row, or the call no longer passes the gate.
 */
async function replayOnce(
    p: CallProfile,
    listed: RetellCallLike,
    { redis, now, retellKey, airtableKey }: { redis: Redis; now: number; retellKey: string; airtableKey: string },
): Promise<"sent" | "claimed" | "not-needed"> {
    const callId = listed.call_id as string;
    const startMs = listed.start_timestamp as number;

    // Re-check against fresh data: Make may have caught up since the list was read.
    const call = await getCall(callId, retellKey);
    if (!call || call.call_id !== callId || call.start_timestamp !== startMs) return "not-needed";
    if (call.agent_id && call.agent_id !== p.retellAgentId) return "not-needed";
    if (!shouldHaveRow(call)) return "not-needed";
    if (hasRow(await logRowsSince(p, startMs, airtableKey, startMs), startMs, p.siteColumn)) return "not-needed";

    const claim: ReplayRecord = { callId, startMs, replayedAt: now, status: 0 };
    const claimed = await redis.set(replayKey(callId), claim, { nx: true, ex: REPLAY_TTL_S });
    if (claimed !== "OK") return "claimed"; // replayed before: once means once
    await redis.sadd(watchKey(p), callId);

    let status = 0;
    try {
        const res = await fetch(p.hookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ event: "call_analyzed", call }),
            signal: AbortSignal.timeout(15_000),
            cache: "no-store",
        });
        status = res.status;
    } catch {
        status = 0; // judged like any other replay on the next run; never retried
    }
    await redis.set(replayKey(callId), { ...claim, status }, { keepTtl: true });
    console.warn(`[client-call-reconcile] replayed ${callId} for ${p.siteSlug} (hook answered ${status || "nothing"})`);
    return "sent";
}

async function writeAlert(p: CallProfile, missing: CallReconcileAlert["missing"], { redis, now }: { redis: Redis; now: number }) {
    const key = alertKey(p);
    if (!missing.length) {
        await redis.del(key);
        await redis.srem(ALERT_INDEX, key);
        return;
    }
    const prev = await redis.get<CallReconcileAlert>(key);
    const alert: CallReconcileAlert = {
        v: 1,
        acctScope: p.acctScope,
        siteSlug: p.siteSlug,
        label: p.label,
        siteColumn: p.siteColumn,
        missing: missing.sort((a, b) => a.startMs - b.startMs),
        firstSeenAt: prev?.firstSeenAt ?? now,
        updatedAt: now,
    };
    await redis.set(key, alert);
    await redis.sadd(ALERT_INDEX, key);
}

// ── every site ──────────────────────────────────────────────────────────────────────────────

export interface ReconcileRun {
    at: number;
    sites: number;
    checked: number;
    skipped: number;
    replayed: number;
    stillMissing: number;
    invalid: number;
    failed: number;
    results: SiteResult[];
}

let _redis: Redis | null = null;
const getRedis = () => (_redis ??= Redis.fromEnv());

/** Every published profile that is well-formed. A malformed one is counted, never acted on. */
export async function loadProfiles(redis: Redis): Promise<{ profiles: CallProfile[]; invalid: number }> {
    const keys = ((await redis.smembers(CALL_PROFILE_INDEX)) ?? []).sort();
    if (!keys.length) return { profiles: [], invalid: 0 };
    const raw = (await redis.mget<(CallProfile | null)[]>(...keys)) ?? [];
    const profiles: CallProfile[] = [];
    let invalid = 0;
    for (const p of raw) {
        if (p && callProfileProblems(p).length === 0 && isMakeHookUrl(p.hookUrl)) profiles.push(p);
        else invalid++;
    }
    return { profiles, invalid };
}

export async function reconcileClientCalls({
    now = Date.now(),
    budgetMs = 200_000,
    redis = getRedis(),
}: { now?: number; budgetMs?: number; redis?: Redis } = {}): Promise<ReconcileRun> {
    const retellKey = process.env.RETELL_API_KEY;
    const airtableKey = process.env.AIRTABLE_API_KEY;
    if (!retellKey || !airtableKey) throw new Error("RETELL_API_KEY or AIRTABLE_API_KEY not set");

    const started = Date.now();
    const { profiles, invalid } = await loadProfiles(redis);
    const run: ReconcileRun = { at: now, sites: profiles.length, checked: 0, skipped: 0, replayed: 0, stillMissing: 0, invalid, failed: 0, results: [] };

    // Start where the last run stopped, so a run that hits its budget never starves the same sites.
    const start = profiles.length ? ((await redis.get<number>(OFFSET_KEY)) ?? 0) % profiles.length : 0;
    for (let i = 0; i < profiles.length; i++) {
        if (Date.now() - started > budgetMs) {
            run.skipped = profiles.length - i;
            break;
        }
        const p = profiles[(start + i) % profiles.length];
        try {
            const r = await reconcileSite(p, { redis, now, retellKey, airtableKey });
            run.replayed += r.replayed;
            run.stillMissing += r.stillMissing;
            run.results.push(r);
        } catch (e) {
            run.failed++;
            run.results.push({ site: p.siteSlug, scanned: 0, unsettled: 0, excluded: 0, present: 0, replayed: 0, stillMissing: 0, resolved: 0, error: e instanceof Error ? e.message : String(e) });
            console.error(`[client-call-reconcile] ${p.siteSlug} failed`, e instanceof Error ? e.message : e);
        }
        run.checked++;
    }
    if (profiles.length) await redis.set(OFFSET_KEY, (start + run.checked) % profiles.length);
    await redis.set(LAST_RUN_KEY, run);
    return run;
}
