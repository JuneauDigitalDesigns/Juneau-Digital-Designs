import "server-only";
import { isActiveSite, type PortalAccount, type PortalSite } from "@jdd/schema";
import { listAccounts } from "./account-store";
import { fetchCalls } from "./airtable-calls";
import { listLeads } from "./portal-leads";
import { querySearchAnalytics, searchConsoleConfigured } from "./search-console";
import { evaluateProposals, matchTowns, type PageRow, type QueryRow, type SearchProfile, type TownSignals } from "./seo-demand";
import {
    accountScope,
    logRun,
    proposalState,
    readCursor,
    readDays,
    readProfile,
    saveProposals,
    writeCursor,
    writeDays,
    writeSignals,
} from "./seo-store";

/**
 * The nightly Search Console job (L11/L12/L13). For each live site whose property JDD verified
 * (the console publishes a search profile when it does):
 *
 *   1. Pull Search Analytics since the last run, query×page and page-only, final data only, and
 *      store each day. The last 7 days are always re-pulled and overwritten, so a day Google
 *      finalised late is never missed and a repeated run changes nothing.
 *   2. Count the calls and web leads that name each of the client's towns (L13). Counts only: no
 *      caller, number, address or message is stored or leaves this job.
 *   3. Run the L12 rules over the last 90 days (180 for merging back) and store new proposals,
 *      at most 3 per site per month. The console shows them; nothing is ever published by this.
 *
 * Sites run one after another, and Google is paced between pages; the quotas (1,200 queries a
 * minute per site) are far above this. A site that fails is logged and skipped, and the next run
 * picks it up from its cursor. New sites stop being started once the time budget is spent.
 */

export const LAG_DAYS = 2; // final data trails by 2-3 days
export const REPULL_DAYS = 7;
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
    const start = cursor ? addDays(cursor, -(REPULL_DAYS - 1)) : addDays(end, -(FIRST_PULL_DAYS - 1));

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
    skipped: number;
    proposals: number;
    durationMs: number;
}

export async function runSearchConsoleCycle({ now = new Date(), budgetMs = 240_000 }: { now?: Date; budgetMs?: number } = {}): Promise<CycleResult> {
    const started = Date.now();
    const result: CycleResult = { configured: searchConsoleConfigured(), sites: 0, done: 0, failed: 0, skipped: 0, proposals: 0, durationMs: 0 };
    if (!result.configured) {
        console.error("[search-console] Google credentials not set; nothing pulled");
        result.durationMs = Date.now() - started;
        await logRun({ at: now.toISOString(), ...result });
        return result;
    }

    for (const account of await listAccounts()) {
        for (const site of account.sites) {
            if (site.status !== "live" || !isActiveSite(site, now.getTime())) continue;
            const profile = await readProfile(accountScope(account.email), site.slug);
            if (!profile?.property) continue; // not verified by JDD yet
            result.sites++;
            if (Date.now() - started > budgetMs) {
                result.skipped++;
                continue;
            }
            try {
                const r = await runSiteCycle(account, site, profile, now);
                result.done++;
                result.proposals += r.proposals;
                console.log("[search-console] site done", site.slug, r);
            } catch (err) {
                result.failed++;
                console.error("[search-console] site failed", site.slug, String(err));
            }
        }
    }
    result.durationMs = Date.now() - started;
    await logRun({ at: now.toISOString(), ...result });
    return result;
}
