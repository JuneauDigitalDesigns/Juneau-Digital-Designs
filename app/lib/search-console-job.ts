import "server-only";
import { randomUUID } from "node:crypto";
import { isActiveSite, type PortalAccount, type PortalSite } from "@jdd/schema";
import { listAccounts } from "./account-store";
import { fetchCalls } from "./airtable-calls";
import { listLeads } from "./portal-leads";
import { querySearchAnalytics, searchConsoleConfigured } from "./search-console";
import { sendOpsNotice } from "./ops-notice";
import { PA } from "./page-additions";
import { evaluateProposals, matchTowns, type PageRow, type QueryRow, type SearchProfile, type TownSignals } from "./seo-demand";
import {
    accountScope,
    logRun,
    proposalState,
    readCursor,
    readDays,
    readHealth,
    readProfile,
    readRun,
    releaseRunLease,
    saveProposals,
    takeRunLease,
    writeCompleted,
    writeHealth,
    writeRun,
    type SeoHealth,
    type SeoRun,
    writeCursor,
    writeDays,
    writeSignals,
} from "./seo-store";

/**
 * The weekly Search Console job (L11/L12/L13; weekly since 2026-11-15). For each live site whose
 * property JDD verified (the console publishes a search profile when it does):
 *
 *   1. Pull Search Analytics since the last run, query×page and page-only, final data only, and
 *      store each day. The 7 days before the cursor are re-pulled and overwritten as well, so a
 *      day Google finalised late is never missed, a missed week is caught up, and a repeated run
 *      changes nothing. The cadence never decides coverage: the cursor does.
 *   2. Count the calls and web leads that name each of the client's towns (L13). Counts only: no
 *      caller, number, address or message is stored or leaves this job.
 *   3. Run the L12 rules over the last 90 days (180 for merging back) and store new proposals,
 *      at most 3 per site per month. The console shows them; nothing is ever published by this.
 *
 * The L12 windows (90 days, 180 for merging back) are read from the stored days, so they are the
 * same whatever the cadence; a weekly run can still make up to 3 proposals a site a month.
 *
 * Sites run one after another; the quotas (1,200 queries a minute per site) are far above this.
 * A site that fails is counted and the run goes on; the next run picks it up from its cursor.
 * Every site is worked before the run completes, across as many invocations as it takes
 * (runSearchConsoleInvocation below).
 */

export const LAG_DAYS = 2; // final data trails by 2-3 days
export const OVERLAP_DAYS = 7;
export const FIRST_PULL_DAYS = 480; // ~16 months, all Google keeps

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000));
function daysBetween(start: string, end: string): string[] {
    const out: string[] = [];
    for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
    return out;
}

export interface SiteResult {
    ok: boolean;
    days: number;
    rows: number;
    proposals: number;
    signals: boolean;
    error?: string;
}

/** L13: how many calls and web leads name each town. Text never leaves this function. */
async function townSignals(account: PortalAccount, site: PortalSite, profile: SearchProfile, acct: string): Promise<TownSignals | null> {
    const towns: TownSignals = {};
    const bump = (text: string, kind: "calls" | "leads") => {
        for (const t of matchTowns(text, profile)) {
            towns[t] ??= { calls: 0, leads: 0 };
            towns[t][kind]++;
        }
    };
    let any = false;
    const apiKey = process.env.AIRTABLE_API_KEY;
    if (site.airtableBaseId && apiKey) {
        const baseId = site.airtableBaseId;
        const scopeToSite = account.sites.some((s) => s.slug !== site.slug && s.airtableBaseId === baseId);
        const calls = await fetchCalls({ baseId, apiKey, siteSlug: site.slug, scopeToSite, acctScope: acct });
        if (calls.ok) {
            any = true;
            for (const c of calls.calls) bump(`${c.address ?? ""} ${c.summary ?? ""}`, "calls");
        }
    }
    const leads = await listLeads(acct, site.slug, 500);
    any = true;
    for (const l of leads) bump(`${l.message ?? ""} ${Object.values(l.fields ?? {}).join(" ")}`, "leads");
    return any ? towns : null;
}

export async function runSiteCycle(account: PortalAccount, site: PortalSite, profile: SearchProfile, now: Date): Promise<SiteResult> {
    const acct = accountScope(account.email);
    const property = profile.property as string;
    const end = iso(new Date(now.getTime() - LAG_DAYS * 86_400_000));
    const cursor = await readCursor(acct, site.slug);
    const start = cursor ? addDays(cursor, -OVERLAP_DAYS) : addDays(end, -(FIRST_PULL_DAYS - 1));

    let days = 0;
    let rowCount = 0;
    if (start <= end) {
        const [queryRows, pageRows] = [
            await querySearchAnalytics(property, { startDate: start, endDate: end, dimensions: ["date", "query", "page"] }),
            await querySearchAnalytics(property, { startDate: start, endDate: end, dimensions: ["date", "page"] }),
        ];
        const byDay = new Map<string, { rows: QueryRow[]; pages: PageRow[] }>();
        // Every day in the range is written, empty or not, so a re-pull clears a stale day.
        for (const d of daysBetween(start, end)) byDay.set(d, { rows: [], pages: [] });
        for (const r of queryRows) {
            const [date, query, page] = r.keys;
            byDay.get(date)?.rows.push({ date, query, page, clicks: r.clicks, impressions: r.impressions, position: r.position });
        }
        for (const r of pageRows) {
            const [date, page] = r.keys;
            byDay.get(date)?.pages.push({ date, page, clicks: r.clicks, impressions: r.impressions });
        }
        await writeDays(acct, site.slug, byDay);
        await writeCursor(acct, site.slug, end);
        days = byDay.size;
        rowCount = queryRows.length;
    }

    let signals: TownSignals = {};
    let haveSignals = false;
    try {
        const s = await townSignals(account, site, profile, acct);
        if (s) {
            signals = s;
            haveSignals = true;
            await writeSignals(acct, site.slug, s, now.toISOString());
        }
    } catch (err) {
        // A signal is extra evidence, never a threshold: the run goes on without it.
        console.error("[search-console] town signals failed", site.slug, String(err));
    }

    const month = now.toISOString().slice(0, 7);
    const window = daysBetween(addDays(end, -179), end);
    const { rows, pages } = await readDays(acct, site.slug, window);
    const state = await proposalState(acct, site.slug, month);
    const proposals = evaluateProposals({ profile, rows, pageRows: pages, state, signals, now });
    await saveProposals(acct, site.slug, month, proposals);

    return { ok: true, days, rows: rowCount, proposals: proposals.length, signals: haveSignals };
}

export interface CycleResult {
    configured: boolean;
    sites: number;
    done: number;
    failed: number;
    proposals: number;
    durationMs: number;
}

/**
 * Health after a completed run (or an invocation that threw). Failed: the job threw, credentials
 * are unset, or every site failed. Zero:
 * every site was read and none had a single row, two runs running, once rows have ever been
 * read. Either emails JDD once (W126–W127); a healthy run clears it.
 */
export function nextHealth(prev: SeoHealth | null, run: { threw: boolean; result: CycleResult; rows: number; at: string }): SeoHealth {
    const h: SeoHealth = prev ?? { state: "ok", failedRuns: 0, zeroRuns: 0, everHadRows: false, alertedAt: null, lastRunAt: run.at };
    const { result } = run;
    const failed = run.threw || !result.configured || (result.sites > 0 && result.done === 0 && result.failed > 0);
    const zero = !failed && result.done > 0 && run.rows === 0;
    if (failed) return { ...h, state: "failed", failedRuns: h.failedRuns + 1, zeroRuns: 0, lastRunAt: run.at };
    if (zero) return { ...h, state: h.zeroRuns + 1 >= 2 && h.everHadRows ? "zero" : "ok", zeroRuns: h.zeroRuns + 1, failedRuns: 0, lastRunAt: run.at };
    if (result.done === 0) return { ...h, lastRunAt: run.at }; // no verified site to read: nothing to judge
    return { state: "ok", failedRuns: 0, zeroRuns: 0, everHadRows: h.everHadRows || run.rows > 0, alertedAt: null, lastRunAt: run.at };
}

async function recordHealth(run: { threw: boolean; result: CycleResult; rows: number; at: string }): Promise<void> {
    try {
        const h = nextHealth(await readHealth(), run);
        if (h.state !== "ok" && !h.alertedAt) {
            await sendOpsNotice(PA.alertSubject, [PA.alertBody]);
            h.alertedAt = run.at;
        }
        await writeHealth(h);
    } catch (err) {
        console.error("[search-console] health not recorded", String(err));
    }
}

/** Start no new site after 10 minutes: the 800 s cap leaves 200 s for the last one (a first pull is ~40 s). */
export const INVOCATION_BUDGET_MS = 600_000;
/** Longer than the function's 800 s, so a live invocation never loses it; a killed one frees it on its own. */
const LEASE_SECONDS = 900;
/**
 * The weekly slot vercel.json schedules: Monday 08:00 UTC (`0 8 * * 1`; the suite pins the two
 * equal). A run belongs to the latest slot at or before it started, so a late or manual run still
 * counts for its week. The console's missed-run alert is per slot (Xander, 2026-11-15): a slot
 * whose run hasn't completed a while after it is a missed run.
 */
export const SLOT_WEEKDAY = 1; // Monday, as Date#getUTCDay counts
export const SLOT_HOUR_UTC = 8;

export function weeklySlot(at: Date): string {
    const d = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), SLOT_HOUR_UTC));
    let back = (d.getUTCDay() - SLOT_WEEKDAY + 7) % 7;
    if (back === 0 && at.getTime() < d.getTime()) back = 7;
    return new Date(d.getTime() - back * 86_400_000).toISOString();
}

export type InvocationStatus = "complete" | "continuing" | "busy" | "stale";

/**
 * One invocation of the weekly run (Xander, 2026-11-15). The run works through every live,
 * verified site, however many invocations that takes: this one works until its budget is spent
 * (always finishing at least one site, so a chain of invocations always ends), records which
 * sites are done, and says "continuing" when sites are left. The route then asks for the next
 * invocation with the run's id. Only the invocation that finishes the last site records the
 * completed-run marker, logs the run and judges health: a run is judged whole, never in parts.
 *
 * Single-flight: an invocation holds the run lease or does nothing ("busy"); a continuation only
 * ever continues the run it names ("stale" otherwise, as for a doubled request after the run
 * finished). The cron with no run id resumes an unfinished run from the same slot; one left from
 * an earlier slot is closed off, and a new run starts.
 */
export async function runSearchConsoleInvocation({
    now = new Date(),
    budgetMs = INVOCATION_BUDGET_MS,
    runId = null,
}: { now?: Date; budgetMs?: number; runId?: string | null } = {}): Promise<{ status: InvocationStatus; runId: string | null; result: CycleResult }> {
    const started = Date.now();
    const configured = searchConsoleConfigured();
    const counts = (run: SeoRun | null, left = 0): CycleResult => ({
        configured,
        sites: run ? run.done.length + run.failed.length + left : 0,
        done: run?.done.length ?? 0,
        failed: run?.failed.length ?? 0,
        proposals: run?.proposals ?? 0,
        durationMs: Date.now() - started,
    });

    const token = randomUUID();
    if (!(await takeRunLease(token, LEASE_SECONDS))) return { status: "busy", runId, result: counts(null) };
    let run: SeoRun | null = null;
    try {
        run = await readRun();
        if (runId) {
            if (!run || run.id !== runId || run.completedAt) return { status: "stale", runId, result: counts(null) };
        } else if (!run || run.completedAt || run.slot !== weeklySlot(now)) {
            if (run && !run.completedAt) {
                console.error("[search-console] an unfinished run was closed off", { slot: run.slot, done: run.done.length, failed: run.failed.length });
            }
            run = {
                id: now.toISOString(),
                slot: weeklySlot(now),
                startedAt: now.toISOString(),
                done: [],
                failed: [],
                rows: 0,
                proposals: 0,
                invocations: 0,
                configured,
                completedAt: null,
            };
        }
        run.invocations++;
        run.configured = configured;
        await writeRun(run);

        if (configured) {
            const left = await workSites(run, now, started, budgetMs);
            if (left > 0) {
                await writeRun(run);
                return { status: "continuing", runId: run.id, result: counts(run, left) };
            }
        } else {
            console.error("[search-console] Google credentials not set; nothing pulled");
        }

        const at = now.toISOString();
        run.completedAt = new Date().toISOString();
        await writeRun(run);
        const result = counts(run);
        await writeCompleted({
            id: run.id,
            slot: run.slot,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            configured,
            sites: result.sites,
            done: result.done,
            failed: result.failed,
            proposals: result.proposals,
            invocations: run.invocations,
        });
        await logRun({ at, id: run.id, slot: run.slot, invocations: run.invocations, ...result });
        await recordHealth({ threw: false, result, rows: run.rows, at });
        return { status: "complete", runId: run.id, result };
    } catch (err) {
        await recordHealth({ threw: true, result: counts(run), rows: run?.rows ?? 0, at: now.toISOString() });
        throw err;
    } finally {
        await releaseRunLease(token).catch(() => {});
    }
}

/** Works the run's remaining sites until the budget is spent. Returns how many are left. */
async function workSites(run: SeoRun, now: Date, started: number, budgetMs: number): Promise<number> {
    const seen = new Set([...run.done, ...run.failed]);
    let worked = 0;
    let left = 0;
    for (const account of await listAccounts()) {
        const acct = accountScope(account.email);
        for (const site of account.sites) {
            if (site.status !== "live" || !isActiveSite(site, now.getTime())) continue;
            const key = `${acct}:${site.slug}`;
            if (seen.has(key)) continue;
            const profile = await readProfile(acct, site.slug);
            if (!profile?.property) continue; // not verified by JDD yet
            if (worked > 0 && Date.now() - started >= budgetMs) {
                left++;
                continue;
            }
            worked++;
            try {
                const r = await runSiteCycle(account, site, profile, now);
                run.done.push(key);
                run.rows += r.rows;
                run.proposals += r.proposals;
                console.log("[search-console] site done", site.slug, r);
            } catch (err) {
                run.failed.push(key);
                console.error("[search-console] site failed", site.slug, String(err));
            }
            await writeRun(run);
        }
    }
    return left;
}
