"use client";

import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart, Bar,
} from "recharts";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, CardLabel, SectionHeader } from "./ui/Card";
import { StatTile } from "./ui/StatTile";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { GhostPreview, GhostChart, GhostStat } from "./ui/GhostPreview";
import { ChartSkeleton, StatRowSkeleton } from "./ui/Skeleton";
import { axisProps, tooltipProps } from "./ui/chartTheme";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";
import { freshness } from "./ui/format";

interface DailyPoint {
    date: string;
    sessions: number;
    newUsers: number;
}

interface TrafficData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    daily?: DailyPoint[];
    sources?: { channel: string; sessions: number }[];
    pages?: { path: string; views: number }[];
    devices?: { device: string; sessions: number }[];
    browsers?: { browser: string; sessions: number }[];
    totalSessions?: number;
    totalNewUsers?: number;
    error?: string;
}

export default function TrafficSection({ site }: { site: PortalSiteProps }) {
    const availability = site.features.traffic;
    const ready = availability.state === "ready";

    const {
        data,
        isLoading,
        fetchedAt,
        refresh: retry,
    } = useCachedFetch<TrafficData>(
        `traffic:${site.slug}`,
        `/api/portal/traffic?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.traffic,
    );

    if (!ready) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Traffic" />
                <FeatureState
                    feature="traffic"
                    availability={availability}
                    ghost={
                        availability.state === "pending-build" ? (
                            <GhostPreview description="Once your site is live, this page shows how many people visit, where they come from, and which pages they read.">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <GhostStat label="Visits" />
                                        <GhostStat label="New visitors" />
                                    </div>
                                    <GhostChart label="Visits over time" />
                                </div>
                            </GhostPreview>
                        ) : undefined
                    }
                />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Traffic" />
                <StatRowSkeleton count={2} />
                <ChartSkeleton height={220} />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
            </div>
        );
    }

    if (!data || data.state === "error") {
        return (
            <div className="space-y-8">
                <SectionHeader title="Traffic" />
                <FeatureError message={data?.error} onRetry={retry} />
            </div>
        );
    }

    // The lifecycle check above uses the site's *static* feature availability. The request
    // can still come back non-ready — a Vercel credential we haven't configured, or a project
    // whose Web Analytics was never switched on. Both are our unfinished work, and the
    // `connecting` panel says so without naming our plumbing. Without this branch they fell
    // through to "No visits recorded yet", which blames the client's site for our gap.
    if (data.state !== "ready") {
        return (
            <div className="space-y-8">
                <SectionHeader title="Traffic" />
                <FeatureState feature="traffic" availability={{ state: data.state }} />
            </div>
        );
    }

    const daily = data.daily ?? [];
    const sources = data.sources ?? [];
    const pages = data.pages ?? [];
    const devices = data.devices ?? [];
    const browsers = data.browsers ?? [];

    // Totals, not row count: Vercel zero-fills the day buckets, so a site nobody has visited
    // still returns thirty rows. `daily.length === 0` was therefore never true, and a brand
    // new site rendered an all-zero chart instead of saying it had no visits yet.
    if ((data.totalSessions ?? 0) === 0) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Traffic" />
                <FeatureState feature="traffic" availability={{ state: "ready" }} />
            </div>
        );
    }

    // YYYYMMDD → MM-DD
    const displayDaily = daily.map((d) => ({ ...d, date: d.date.slice(4) }));

    return (
        <div className="space-y-8">
            <SectionHeader title="Traffic" meta={freshness("Last 30 days", fetchedAt)} />

            <div className="grid grid-cols-2 gap-4">
                <StatTile label="Visits" value={data.totalSessions ?? null} />
                <StatTile label="New visitors" value={data.totalNewUsers ?? null} />
            </div>

            <Card>
                <CardLabel>Visits over time</CardLabel>
                <div className="mt-3">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={displayDaily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.35} />
                                    <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
                            <YAxis {...axisProps} allowDecimals={false} />
                            <Tooltip {...tooltipProps} />
                            <Area
                                type="monotone"
                                dataKey="sessions"
                                name="Visits"
                                stroke="var(--chart-series-1)"
                                strokeWidth={2}
                                fill="url(#trafficFill)"
                            />
                            <Area
                                type="monotone"
                                dataKey="newUsers"
                                name="New visitors"
                                stroke="var(--chart-series-2)"
                                strokeWidth={1.5}
                                fill="none"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardLabel>Where visitors came from</CardLabel>
                    <div className="mt-3">
                        {sources.length === 0 ? (
                            <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                                No referrers recorded yet.
                            </p>
                        ) : (
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={sources} layout="vertical" margin={{ left: 8, right: 8 }}>
                                    <XAxis type="number" {...axisProps} allowDecimals={false} />
                                    <YAxis type="category" dataKey="channel" width={100} {...axisProps} />
                                    <Tooltip {...tooltipProps} />
                                    <Bar dataKey="sessions" name="Visits" fill="var(--chart-series-1)" radius={[0, 3, 3, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </Card>

                <Card>
                    <CardLabel>Most-read pages</CardLabel>
                    {pages.length === 0 ? (
                        <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                            No page views recorded yet.
                        </p>
                    ) : (
                        <ul className="mt-3 space-y-2">
                            {pages.slice(0, 8).map((p) => (
                                <li key={p.path} className="flex items-center justify-between gap-4 text-sm">
                                    <span className="truncate" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                        {p.path}
                                    </span>
                                    <span className="shrink-0" style={{ color: "var(--fg)" }}>
                                        {p.views}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>
            </div>

            {/* "Most of your customers are looking you up on a phone" is a decision a local
                business can act on — it's the most useful thing in the Web Analytics API that
                the portal wasn't already showing. */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <DimensionCard
                    label="Devices"
                    empty="No device data recorded yet."
                    rows={devices.map((d) => ({ key: d.device, value: d.sessions }))}
                    fill="var(--chart-series-2)"
                />
                <DimensionCard
                    label="Browsers"
                    empty="No browser data recorded yet."
                    rows={browsers.map((b) => ({ key: b.browser, value: b.sessions }))}
                    fill="var(--chart-series-3)"
                />
            </div>
        </div>
    );
}

/** A horizontal bar breakdown of one Web Analytics dimension. */
function DimensionCard({
    label,
    empty,
    rows,
    fill,
}: {
    label: string;
    empty: string;
    rows: { key: string; value: number }[];
    fill: string;
}) {
    return (
        <Card>
            <CardLabel>{label}</CardLabel>
            <div className="mt-3">
                {rows.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                        {empty}
                    </p>
                ) : (
                    <ResponsiveContainer width="100%" height={Math.max(120, rows.length * 34)}>
                        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 8 }}>
                            <XAxis type="number" {...axisProps} allowDecimals={false} />
                            <YAxis type="category" dataKey="key" width={100} {...axisProps} />
                            <Tooltip {...tooltipProps} />
                            <Bar dataKey="value" name="Visits" fill={fill} radius={[0, 3, 3, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </div>
        </Card>
    );
}
