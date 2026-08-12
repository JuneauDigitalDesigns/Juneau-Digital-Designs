import "server-only";
import { cache } from "react";
import { siteFeature, type PortalAccount, type PortalSite } from "@jdd/schema";
import { fetchCalls, type CallRecord } from "./airtable-calls";
import { getCachedPagespeed, accountScope } from "./portal-kv";

/**
 * The Overview's numbers, computed once and shared by the API route and the server-rendered
 * page. Extracted so the page can render this without a browser round trip — Overview used
 * to `fetch()` its own API from a `useEffect`, guaranteeing a skeleton flash on every visit
 * even though the layout above it had already awaited the account from KV.
 */

export interface RecentCall {
    id: string;
    date: string | null;
    callerName: string | null;
    summary: string | null;
    outcome: string | null;
}

export interface OverviewData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    hasOutcome?: boolean;
    totalCalls?: number;
    callsThisMonth?: number;
    callsLastMonth?: number;
    callsDelta?: number | null;
    qualifiedThisMonth?: number | null;
    qualifiedDelta?: number | null;
    avgDurationSeconds?: number | null;
    /** Calls per day for the trailing 30 days, oldest first — the stat tile sparkline. */
    dailySeries?: number[];
    recent?: RecentCall[];
    error?: string;
}

function monthStart(offset: number): number {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - offset, 1);
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
}

function inWindow(c: CallRecord, from: number, to: number): boolean {
    if (!c.date) return false;
    const t = new Date(c.date).getTime();
    return !Number.isNaN(t) && t >= from && t < to;
}

/** Percent change, or null when the baseline is zero — "up ∞%" is not a fact. */
function pctChange(now: number, prev: number): number | null {
    if (prev === 0) return null;
    return ((now - prev) / prev) * 100;
}

/**
 * Calls bucketed by UTC day for the trailing 30 days.
 *
 * Computed from records already in memory, so it costs no extra Airtable reads. Days with
 * no calls are real zeros here — unlike a headline metric, a gap in a time series means
 * "nothing happened that day", which is exactly what should be drawn.
 */
function dailyBuckets(calls: CallRecord[], days = 30): number[] {
    const DAY = 86_400_000;
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = end.getTime() - (days - 1) * DAY;

    const buckets = new Array<number>(days).fill(0);
    for (const c of calls) {
        if (!c.date) continue;
        const t = new Date(c.date).getTime();
        if (Number.isNaN(t) || t < start) continue;
        const idx = Math.floor((t - start) / DAY);
        if (idx >= 0 && idx < days) buckets[idx] += 1;
    }
    return buckets;
}

/**
 * Wrapped in React `cache()` so the Overview's metric row and its call feed — two separate
 * Suspense boundaries — share a single Airtable read per request. Without it, splitting the
 * page into independently-streaming modules would have doubled the upstream cost.
 */
export const getOverviewData = cache(async function getOverviewData(
    account: PortalAccount,
    site: PortalSite,
): Promise<OverviewData> {
    const calls = siteFeature(site, "calls");
    if (calls.state !== "ready") return { state: calls.state };

    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
        console.error("[portal/overview] AIRTABLE_API_KEY is not set");
        return { state: "error", error: "We couldn't load your summary just now." };
    }

    const baseId = site.airtableBaseId as string;
    const scopeToSite = account.sites.some(
        (s) => s.slug !== site.slug && s.airtableBaseId === baseId,
    );

    const result = await fetchCalls({
        baseId,
        apiKey,
        siteSlug: site.slug,
        scopeToSite,
        acctScope: accountScope(account.email),
    });
    if (!result.ok) {
        console.error(`[portal/overview] ${site.slug} ${result.failure}: ${result.detail}`);
        return { state: "error", error: "We couldn't load your summary just now." };
    }

    const thisMonth = monthStart(0);
    const lastMonth = monthStart(1);
    const now = Date.now();

    const current = result.calls.filter((c) => inWindow(c, thisMonth, now));
    const previous = result.calls.filter((c) => inWindow(c, lastMonth, thisMonth));

    // Only claim a qualified count when the base actually has the column to support it.
    const hasOutcome = result.fields.includes("Outcome");
    const qualifiedOf = (rows: CallRecord[]) =>
        rows.filter((c) => c.outcome?.trim().toLowerCase() === "qualified").length;

    const withDuration = current.filter((c) => c.durationSeconds !== null);
    const avgDuration = withDuration.length
        ? Math.round(
              withDuration.reduce((s, c) => s + (c.durationSeconds ?? 0), 0) / withDuration.length,
          )
        : null;

    return {
        state: "ready",
        hasOutcome,
        totalCalls: result.calls.length,
        callsThisMonth: current.length,
        callsLastMonth: previous.length,
        callsDelta: pctChange(current.length, previous.length),
        qualifiedThisMonth: hasOutcome ? qualifiedOf(current) : null,
        qualifiedDelta: hasOutcome ? pctChange(qualifiedOf(current), qualifiedOf(previous)) : null,
        avgDurationSeconds: avgDuration,
        dailySeries: dailyBuckets(result.calls),
        recent: result.calls.slice(0, 5).map((c) => ({
            id: c.id,
            date: c.date,
            callerName: c.callerName,
            summary: c.summary,
            outcome: c.outcome,
        })),
    };
});

/**
 * The performance score for the health strip, read from cache only.
 *
 * Deliberately never triggers a fresh PageSpeed run: a cold run takes 10–20s and would
 * block the server render of the client's landing page to produce one number. When the
 * cache is cold the strip says so and points at the Performance tab, which does run it.
 */
export async function getCachedScore(slug: string): Promise<number | null> {
    const cached = await getCachedPagespeed(slug);
    const score = cached?.score;
    return typeof score === "number" ? score : null;
}
