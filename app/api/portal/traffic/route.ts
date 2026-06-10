import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import type { PortalUserMetadata } from "@/app/portal/page";

export const runtime = "nodejs";

function getAnalyticsClient(): BetaAnalyticsDataClient {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
    const credentials = JSON.parse(keyJson) as {
        client_email: string;
        private_key: string;
    };
    return new BetaAnalyticsDataClient({ credentials });
}

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = getPortalRatelimit();
    const { success } = await rl.limit(userId);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata as Partial<PortalUserMetadata>;

    if (!meta.ga4PropertyId) {
        return NextResponse.json({ noData: true });
    }

    const analytics = getAnalyticsClient();

    const [overviewResponse, sourcesResponse, pagesResponse] = await Promise.all([
        // 30-day overview: sessions + new users by date
        analytics.runReport({
            property: meta.ga4PropertyId,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "date" }],
            metrics: [{ name: "sessions" }, { name: "newUsers" }],
            orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
        }),
        // Traffic sources
        analytics.runReport({
            property: meta.ga4PropertyId,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }],
            orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
            limit: 6,
        }),
        // Top pages
        analytics.runReport({
            property: meta.ga4PropertyId,
            dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
            dimensions: [{ name: "pagePath" }],
            metrics: [{ name: "screenPageViews" }],
            orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
            limit: 10,
        }),
    ]);

    const daily = (overviewResponse[0].rows ?? []).map((row) => ({
        date: row.dimensionValues?.[0]?.value ?? "",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
        newUsers: Number(row.metricValues?.[1]?.value ?? 0),
    }));

    const sources = (sourcesResponse[0].rows ?? []).map((row) => ({
        channel: row.dimensionValues?.[0]?.value ?? "Unknown",
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
    }));

    const pages = (pagesResponse[0].rows ?? []).map((row) => ({
        path: row.dimensionValues?.[0]?.value ?? "/",
        views: Number(row.metricValues?.[0]?.value ?? 0),
    }));

    const totalSessions = daily.reduce((s, d) => s + d.sessions, 0);
    const totalNewUsers = daily.reduce((s, d) => s + d.newUsers, 0);

    return NextResponse.json({ daily, sources, pages, totalSessions, totalNewUsers });
}
