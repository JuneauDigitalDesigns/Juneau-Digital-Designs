import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";

export const runtime = "nodejs";

const WA_BASE = "https://api.vercel.com/v1/query/web-analytics/visits/aggregate";

interface WARow {
    timestamp?: string;
    referrerHostname?: string;
    route?: string;
    pageviews?: number;
    visitors?: number;
}

// One grouped Web Analytics query (visits/aggregate) for the given project.
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
        throw new Error(`Web Analytics ${by} query failed (${res.status})`);
    }
    const body = await res.json() as { data?: WARow[] };
    return body.data ?? [];
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const projectId = ctx.site.vercelProjectId ?? null;

    if (!projectId) {
        return NextResponse.json({ noData: true });
    }

    const token = process.env.VERCEL_TOKEN;
    if (!token) return NextResponse.json({ error: "Analytics not configured" }, { status: 500 });

    // 30-day window (YYYY-MM-DD, inclusive of today).
    const until = new Date();
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

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
    try {
        [dailyRows, sourceRows, pageRows] = await Promise.all([
            waQuery(token, params, "day"),
            waQuery(token, params, "referrerHostname", { limit: "6" }),
            waQuery(token, params, "route", { limit: "10" }),
        ]);
    } catch {
        return NextResponse.json({ error: "Failed to fetch traffic data" }, { status: 502 });
    }

    // Vercel reports page views + unique visitors; the UI labels these
    // "Sessions" and "New Visitors" respectively.
    const daily = dailyRows.map((row) => ({
        date: (row.timestamp ?? "").slice(0, 10).replace(/-/g, ""), // YYYYMMDD
        sessions: row.pageviews ?? 0,
        newUsers: row.visitors ?? 0,
    }));

    const sources = sourceRows.map((row) => ({
        channel: row.referrerHostname || "Direct",
        sessions: row.pageviews ?? 0,
    }));

    const pages = pageRows.map((row) => ({
        path: row.route ?? "/",
        views: row.pageviews ?? 0,
    }));

    const totalSessions = daily.reduce((s, d) => s + d.sessions, 0);
    const totalNewUsers = daily.reduce((s, d) => s + d.newUsers, 0);

    return NextResponse.json({ daily, sources, pages, totalSessions, totalNewUsers });
}
