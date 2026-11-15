import "server-only";
import { Redis } from "@upstash/redis";
import { accountScope } from "./portal-kv";
import type { PageRow, ProposalState, QueryRow, SearchProfile, TownSignals } from "./seo-demand";
import { stageOf, type PageProposal } from "./page-additions";

/** Approved spokes not yet live: they hold a place under the spoke cap. */
const IN_FLIGHT = new Set(["waiting", "received", "building", "paused"]);

/**
 * KV for the weekly Search Console job (L11/L12). Every key carries the account scope, because
 * slugs are unique only within an account and all of it is client-derived.
 *
 *   jdd:seo:profile:v1:{acct}:{slug}          the site's search profile, written by the console
 *   jdd:seo:day:v1:{acct}:{slug}:{YYYY-MM-DD} one day of Search Analytics, query×page and page-only
 *   jdd:seo:cursor:v1:{acct}:{slug}           the last day pulled
 *   jdd:seo:signals:v1:{acct}:{slug}          L13: calls and leads naming each town, counts only
 *   jdd:seo:proposal:v1:{acct}:{slug}:{id}    one proposal; the console decides it
 *   jdd:seo:proposal:index:v1:{acct}:{slug}   zset of proposal ids by creation time
 *   jdd:seo:proposed:v1:{acct}:{slug}:{YYYY-MM} how many were proposed that month (L12: at most 3)
 *   jdd:seo:runs:v1                           the last 60 runs, counts only
 *
 * Days are kept 800 days, longer than Google's 16 months, so a site's history outlives Google's.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

export const DAY_TTL_SECONDS = 800 * 86_400;

export const profileKey = (acct: string, slug: string) => `jdd:seo:profile:v1:${acct}:${slug}`;
export const dayKey = (acct: string, slug: string, date: string) => `jdd:seo:day:v1:${acct}:${slug}:${date}`;
export const cursorKey = (acct: string, slug: string) => `jdd:seo:cursor:v1:${acct}:${slug}`;
export const signalsKey = (acct: string, slug: string) => `jdd:seo:signals:v1:${acct}:${slug}`;
export const proposalKey = (acct: string, slug: string, id: string) => `jdd:seo:proposal:v1:${acct}:${slug}:${id}`;
export const proposalIndexKey = (acct: string, slug: string) => `jdd:seo:proposal:index:v1:${acct}:${slug}`;
export const monthKey = (acct: string, slug: string, month: string) => `jdd:seo:proposed:v1:${acct}:${slug}:${month}`;
export const RUNS_KEY = "jdd:seo:runs:v1";

export { accountScope };

export async function readProfile(acct: string, slug: string): Promise<SearchProfile | null> {
    const raw = await getRedis().get<SearchProfile>(profileKey(acct, slug));
    return raw && raw.v === 1 ? raw : null;
}

interface StoredDay {
    /** [query, page, clicks, impressions, position] */
    q: Array<[string, string, number, number, number]>;
    /** [page, clicks, impressions] */
    p: Array<[string, number, number]>;
}

/** Overwrite whole days: a re-pull of a day replaces it, so a run is safe to repeat. */
export async function writeDays(acct: string, slug: string, days: Map<string, { rows: QueryRow[]; pages: PageRow[] }>): Promise<void> {
    const redis = getRedis();
    for (const [date, d] of days) {
        const stored: StoredDay = {
            q: d.rows.map((r) => [r.query, r.page, r.clicks, r.impressions, r.position]),
            p: d.pages.map((p) => [p.page, p.clicks, p.impressions]),
        };
        await redis.set(dayKey(acct, slug, date), stored, { ex: DAY_TTL_SECONDS });
    }
}

export async function readDays(acct: string, slug: string, dates: string[]): Promise<{ rows: QueryRow[]; pages: PageRow[] }> {
    const rows: QueryRow[] = [];
    const pages: PageRow[] = [];
    const redis = getRedis();
    for (let i = 0; i < dates.length; i += 50) {
        const chunk = dates.slice(i, i + 50);
        const got = await redis.mget<(StoredDay | null)[]>(...chunk.map((d) => dayKey(acct, slug, d)));
        got.forEach((day, j) => {
            if (!day) return;
            const date = chunk[j];
            for (const [query, page, clicks, impressions, position] of day.q ?? []) rows.push({ date, query, page, clicks, impressions, position });
            for (const [page, clicks, impressions] of day.p ?? []) pages.push({ date, page, clicks, impressions });
        });
    }
    return { rows, pages };
}

export async function readCursor(acct: string, slug: string): Promise<string | null> {
    return (await getRedis().get<string>(cursorKey(acct, slug))) ?? null;
}

export async function writeCursor(acct: string, slug: string, date: string): Promise<void> {
    await getRedis().set(cursorKey(acct, slug), date);
}

export async function writeSignals(acct: string, slug: string, towns: TownSignals, at: string): Promise<void> {
    await getRedis().set(signalsKey(acct, slug), { towns, at });
}

export async function listProposals(acct: string, slug: string): Promise<PageProposal[]> {
    const redis = getRedis();
    const ids = await redis.zrange<string[]>(proposalIndexKey(acct, slug), 0, -1);
    if (!ids.length) return [];
    const got = await redis.mget<(PageProposal | null)[]>(...ids.map((id) => proposalKey(acct, slug, id)));
    return got.filter((p): p is PageProposal => Boolean(p));
}

export async function proposalState(acct: string, slug: string, month: string): Promise<ProposalState> {
    const all = await listProposals(acct, slug);
    const proposed = Number((await getRedis().get<number | string>(monthKey(acct, slug, month))) ?? 0);
    return {
        open: all.filter((p) => p.status === "open").map((p) => p.id),
        decided: all
            .filter((p) => p.status !== "open" && p.decidedAt)
            .map((p) => ({ id: p.id, status: p.status, decidedAt: p.decidedAt as string, ...(p.stage ? { stage: p.stage } : {}) })),
        proposedThisMonth: Number.isFinite(proposed) ? proposed : 0,
        inFlightSpokes: all.filter((p) => p.id.startsWith("spoke:") && IN_FLIGHT.has(stageOf(p))).length,
    };
}

/** Writes new proposals (a decided one with the same id is replaced: its cooldown has passed). */
export async function saveProposals(acct: string, slug: string, month: string, proposals: PageProposal[]): Promise<void> {
    if (!proposals.length) return;
    const redis = getRedis();
    for (const p of proposals) {
        await redis.set(proposalKey(acct, slug, p.id), p);
        await redis.zadd(proposalIndexKey(acct, slug), { score: Date.parse(p.createdAt), member: p.id });
    }
    for (let i = 0; i < proposals.length; i++) await redis.incr(monthKey(acct, slug, month));
    await redis.expire(monthKey(acct, slug, month), 40 * 86_400);
}

/** One invocation runs at a time (the run lease below), so read-modify-write is safe here. */
export async function logRun(entry: Record<string, unknown>): Promise<void> {
    const redis = getRedis();
    const runs = (await redis.get<Record<string, unknown>[]>(RUNS_KEY)) ?? [];
    await redis.set(RUNS_KEY, [entry, ...runs].slice(0, 60));
}

/**
 * The weekly job's sign-in health (Xander, 2026-11-14). A revoked or broken Google sign-in makes
 * the job fail, or read nothing for every site; either way no proposal is ever made again and
 * nothing looks wrong. The console shows this state; the job emails JDD once per incident.
 */
export const HEALTH_KEY = "jdd:seo:health:v1";
export interface SeoHealth {
    state: "ok" | "failed" | "zero";
    failedRuns: number;
    zeroRuns: number;
    /** Some run has read rows before: until then, an empty read is a new site, not a broken sign-in. */
    everHadRows: boolean;
    /** When JDD was emailed about the current incident; null once a run is healthy again. */
    alertedAt: string | null;
    lastRunAt: string;
}

export async function readHealth(): Promise<SeoHealth | null> {
    return (await getRedis().get<SeoHealth>(HEALTH_KEY)) ?? null;
}

export async function writeHealth(h: SeoHealth): Promise<void> {
    await getRedis().set(HEALTH_KEY, h);
}

/**
 * The weekly run (Xander, 2026-11-15) works through every site, across as many invocations as it
 * takes. Its progress is one record; the console watches only the completed-run marker.
 *
 *   jdd:seo:run:v1         the current or last run: which sites are done, counts so far
 *   jdd:seo:run:lease:v1   held by the one invocation working on it (SET NX, expires on its own)
 *   jdd:seo:completed:v1   the last run that finished every site, with its weekly slot, counts only
 */
export const RUN_KEY = "jdd:seo:run:v1";
export const RUN_LEASE_KEY = "jdd:seo:run:lease:v1";
export const COMPLETED_KEY = "jdd:seo:completed:v1";

export interface SeoRun {
    id: string;
    /** The scheduled weekly slot this run belongs to (`weeklySlot`), as an ISO time. */
    slot: string;
    startedAt: string;
    /** `{acctScope}:{slug}` of each site finished in this run, and of each that failed. */
    done: string[];
    failed: string[];
    rows: number;
    proposals: number;
    invocations: number;
    configured: boolean;
    completedAt: string | null;
}

export interface SeoCompletedRun {
    id: string;
    /** The slot this run completed: the console's missed-run alert clears once the latest slot's has. */
    slot: string;
    startedAt: string;
    completedAt: string;
    configured: boolean;
    sites: number;
    done: number;
    failed: number;
    proposals: number;
    invocations: number;
}

export async function readRun(): Promise<SeoRun | null> {
    return (await getRedis().get<SeoRun>(RUN_KEY)) ?? null;
}

export async function writeRun(run: SeoRun): Promise<void> {
    await getRedis().set(RUN_KEY, run);
}

export async function writeCompleted(c: SeoCompletedRun): Promise<void> {
    await getRedis().set(COMPLETED_KEY, c);
}

/** True when this invocation now holds the lease. It outlives the function's 800 s by design. */
export async function takeRunLease(token: string, seconds: number): Promise<boolean> {
    return (await getRedis().set(RUN_LEASE_KEY, token, { nx: true, ex: seconds })) === "OK";
}

/** Releases the lease only if it is still this invocation's. */
export async function releaseRunLease(token: string): Promise<void> {
    const redis = getRedis();
    if ((await redis.get<string>(RUN_LEASE_KEY)) === token) await redis.del(RUN_LEASE_KEY);
}
