import "server-only";
import { siteFeature, type PortalSite } from "@jdd/schema";
import { getCached, setCached, TRAFFIC_TTL, trafficKey, accountScope } from "./portal-kv";
import { hasVercelCredentials } from "./portal-vercel";
import {
    clientStateFor,
    describeReason,
    reasonForStatus,
    type FailureReason,
} from "./portal-failure";

/**
 * Vercel Web Analytics for a site, cached for an hour.
 *
 * Shared by the Traffic tab and the Overview sparkline so both read one cached payload
 * rather than each issuing its own upstream queries.
 *
 * Failure is deliberately not one state. This panel spent a long time showing "We couldn't
 * load this" on a perfectly healthy client whose only problem was that the portal had no
 * `VERCEL_TOKEN` — the request never reached Vercel. See portal-failure.ts.
 */

const WA_BASE = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";

export interface TrafficData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    daily?: Array<{ date: string; sessions: number; newUsers: number }>;
    sources?: Array<{ channel: string; sessions: number }>;
    pages?: Array<{ path: string; views: number }>;
    devices?: Array<{ device: string; sessions: number }>;
    browsers?: Array<{ browser: string; sessions: number }>;
    totalSessions?: number;
    totalNewUsers?: number;
    error?: string;
    /**
     * Operator-facing. Logged and read by ops tooling; never rendered to a client.
     * Present only when `state` is `connecting` or `error` for a Vercel-side reason.
     */
    reason?: FailureReason;
}

interface WARow {
    timestamp?: string;
    referrerHostname?: string;
    route?: string;
    deviceType?: string;
    browserName?: string;
    pageviews?: number;
    visitors?: number;
}

/**
 * Thrown with the upstream status attached, so the caller can tell a project without Web
 * Analytics (4xx — our unfinished setup) from Vercel having a bad day (5xx — transient).
 */
class WAError extends Error {
    constructor(
        message: string,
        readonly status: number | null,
    ) {
        super(message);
    }
}

async function waQuery(
    token: string,
    params: Record<string, string>,
    by: string,
    extra: Record<string, string> = {},
): Promise<WARow[]> {
    const qs = new URLSearchParams({ ...params, by, ...extra });
    const res = await fetch(`${WA_BASE}?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        next: { revalidate: 0 },
    });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new WAError(`${by} query failed (${res.status}) ${body.slice(0, 200)}`, res.status);
    }
    const parsed = (await res.json()) as { data?: WARow[] };
    return parsed.data ?? [];
}


/** Build a non-ready payload, logging the operator-facing reason exactly once. */
function failure(slug: string, reason: FailureReason, detail?: string): TrafficData {
    console.error(`[portal/traffic] ${slug} ${reason}: ${describeReason(reason, detail)}`);
    return {
        state: clientStateFor(reason),
        reason,
        // Only a genuine upstream failure gets the retryable error copy; the other reasons
        // are our own unfinished configuration and re-fetching cannot change them.
        ...(clientStateFor(reason) === "error"
            ? { error: "We couldn't load your traffic just now." }
            : {}),
    };
}

export async function getTrafficData(
    site: PortalSite,
    accountEmail: string,
    days = 30,
): Promise<TrafficData> {
    // Lifecycle first, so an unbuilt or unwired site costs nothing upstream and the client
    // gets a truthful reason instead of an empty chart.
    const availability = siteFeature(site, "traffic");
    if (availability.state !== "ready") return { state: availability.state };

    const key = trafficKey(accountScope(accountEmail), site.slug, days);
    const cached = await getCached<TrafficData>(key);
    if (cached) return cached;

    if (!hasVercelCredentials()) return failure(site.slug, "not-configured");
    const token = process.env.VERCEL_TOKEN as string;

    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - days);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const projectId = site.vercelProjectId as string;
    const params: Record<string, string> = {
        projectId,
        since: fmt(since),
        until: fmt(until),
    };
    const teamId = process.env.VERCEL_TEAM_ID;
    if (teamId) params.teamId = teamId;

    let dailyRows: WARow[];
    let sourceRows: WARow[];
    let pageRows: WARow[];
    let deviceRows: WARow[];
    let browserRows: WARow[];
    try {
        [dailyRows, sourceRows, pageRows, deviceRows, browserRows] = await Promise.all([
            waQuery(token, params, "day"),
            waQuery(token, params, "referrerHostname", { limit: "6" }),
            waQuery(token, params, "route", { limit: "10" }),
            waQuery(token, params, "deviceType", { limit: "6" }),
            waQuery(token, params, "browserName", { limit: "6" }),
        ]);
    } catch (e) {
        const status = e instanceof WAError ? e.status : null;
        const detail = e instanceof Error ? e.message : String(e);
        return failure(site.slug, reasonForStatus(status), `${projectId} ${detail}`);
    }

    // Vercel reports page views + unique visitors; the UI labels these
    // "Sessions" and "New Visitors" respectively.
    const daily = dailyRows.map((row) => ({
        date: (row.timestamp ?? "").slice(0, 10).replace(/-/g, ""), // YYYYMMDD
        sessions: row.pageviews ?? 0,
        newUsers: row.visitors ?? 0,
    }));

    // `daily.length === 0` is not the empty signal it looks like: Vercel zero-fills the day
    // buckets, so a site with no visitors still returns one row per day. Totals are the only
    // honest emptiness test, and the UI reads them rather than the row count.
    const payload: TrafficData = {
        state: "ready",
        daily,
        sources: sourceRows.map((row) => ({
            channel: row.referrerHostname || "Direct",
            sessions: row.pageviews ?? 0,
        })),
        pages: pageRows.map((row) => ({ path: row.route ?? "/", views: row.pageviews ?? 0 })),
        devices: deviceRows.map((row) => ({
            device: titleCase(row.deviceType) || "Unknown",
            sessions: row.pageviews ?? 0,
        })),
        browsers: browserRows.map((row) => ({
            browser: row.browserName || "Unknown",
            sessions: row.pageviews ?? 0,
        })),
        totalSessions: daily.reduce((s, d) => s + d.sessions, 0),
        totalNewUsers: daily.reduce((s, d) => s + d.newUsers, 0),
    };

    await setCached(key, TRAFFIC_TTL, payload);
    return payload;
}

/** Vercel returns device types lowercased ("mobile"); the UI reads better capitalised. */
function titleCase(s: string | undefined): string {
    if (!s) return "";
    return s.charAt(0).toUpperCase() + s.slice(1);
}
