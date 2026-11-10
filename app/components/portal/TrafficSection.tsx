"use client";

import type { ReactNode } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, CardLabel } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { GhostPreview, GhostChart, GhostStat } from "./ui/GhostPreview";
import { ChartSkeleton, StatRowSkeleton } from "./ui/Skeleton";
import { axisProps, tooltipProps } from "./ui/chartTheme";
import type { CachedResult } from "./PortalDataProvider";
import { AnalyticsBlock, Responsive } from "./analytics/AnalyticsHeading";
import {
    deviceLabel,
    enquiryRate,
    formatRate,
    shares,
    sourceRows,
    topBrowsers,
    type AnalyticsRange,
    type EnquiryWindow,
} from "@/app/lib/portal-analytics";

interface DailyPoint {
    date: string;
    sessions: number;
    newUsers: number;
}

export interface TrafficData {
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

/**
 * Whether the three traffic sections (Visitors, Where they came from, Pages & devices) render
 * in full, or fold into one Visitors section that explains why there is nothing to show.
 *
 * Folding rather than repeating the same panel three times. The Analytics page reads this to
 * decide which sections the jump bar offers, so the bar never links to a section that is not
 * there. Loading counts as full: the skeletons hold each section's place, so a redirect from
 * an old tab can land on its anchor before the numbers arrive.
 */
export function trafficLayout(
    site: PortalSiteProps,
    traffic: CachedResult<TrafficData>,
): "full" | "folded" {
    if (site.features.traffic.state !== "ready") return "folded";
    if (traffic.isLoading) return "full";
    const data = traffic.data;
    if (!data || data.state !== "ready") return "folded";
    // Totals, not row count: Vercel zero-fills the day buckets, so a site nobody has visited
    // still returns a row per day. `daily.length === 0` was therefore never true, and a brand
    // new site rendered an all-zero chart instead of saying it had no visits yet.
    if ((data.totalSessions ?? 0) === 0) return "folded";
    return "full";
}

/**
 * The traffic half of Analytics: who visits, where from, and what they read.
 *
 * Built from what the Traffic tab showed, re-cut into the approved Analytics layout. The data
 * is fetched by the page (`AnalyticsSection`) rather than here, because the page needs the
 * same result to build its jump bar.
 *
 * Enquiries come from the portal's own web-form leads, computed server-side for every range at
 * once; null means they could not be read, and the two enquiry tiles then show a dash rather
 * than a zero we cannot stand behind.
 */
export default function TrafficSections({
    site,
    range,
    traffic,
    enquiries,
}: {
    site: PortalSiteProps;
    range: AnalyticsRange;
    traffic: CachedResult<TrafficData>;
    enquiries: EnquiryWindow | null;
}) {
    const availability = site.features.traffic;
    const { data, isLoading, refresh: retry } = traffic;

    if (availability.state !== "ready") {
        return (
            <AnalyticsBlock id="visitors" title="Visitors">
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
                                    <GhostChart label="Visits per day" />
                                </div>
                            </GhostPreview>
                        ) : undefined
                    }
                />
            </AnalyticsBlock>
        );
    }

    if (isLoading) {
        return (
            <>
                <AnalyticsBlock id="visitors" title="Visitors">
                    <StatRowSkeleton count={4} />
                    <ChartSkeleton height={220} />
                </AnalyticsBlock>
                <AnalyticsBlock id="sources" title="Where they came from">
                    <ChartSkeleton />
                </AnalyticsBlock>
                <AnalyticsBlock id="pages" title="Pages & devices">
                    <ChartSkeleton />
                </AnalyticsBlock>
            </>
        );
    }

    if (!data || data.state === "error") {
        return (
            <AnalyticsBlock id="visitors" title="Visitors">
                <FeatureError message={data?.error} onRetry={retry} />
            </AnalyticsBlock>
        );
    }

    // The lifecycle check above uses the site's *static* feature availability. The request
    // can still come back non-ready — a Vercel credential we haven't configured, or a project
    // whose Web Analytics was never switched on. Both are our unfinished work, and the
    // `connecting` panel says so without naming our plumbing.
    if (data.state !== "ready") {
        return (
            <AnalyticsBlock id="visitors" title="Visitors">
                <FeatureState feature="traffic" availability={{ state: data.state }} />
            </AnalyticsBlock>
        );
    }

    const visits = data.totalSessions ?? 0;
    if (visits === 0) {
        return (
            <AnalyticsBlock id="visitors" title="Visitors">
                <FeatureState feature="traffic" availability={{ state: "ready" }} />
            </AnalyticsBlock>
        );
    }

    return (
        <>
            <Visitors data={data} range={range} enquiries={enquiries} />
            <Sources data={data} />
            <PagesAndDevices data={data} />
        </>
    );
}

/* ── Visitors ─────────────────────────────────────────────────────────────── */

function Visitors({
    data,
    range,
    enquiries,
}: {
    data: TrafficData;
    range: AnalyticsRange;
    enquiries: EnquiryWindow | null;
}) {
    const visits = data.totalSessions ?? 0;
    const rate = enquiries ? enquiryRate(enquiries.count, visits) : null;
    const more = enquiries ? enquiries.count - enquiries.previous : 0;
    const enquiryDays = new Set(enquiries?.days ?? []);

    const chart = (data.daily ?? []).map((d) => ({
        date: d.date,
        label: dayLabel(d.date),
        sessions: d.sessions,
        enquiry: enquiryDays.has(d.date),
    }));

    return (
        <AnalyticsBlock id="visitors" title="Visitors">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {/* "Visits" is page views and "New visitors" is unique visitors: the same two
                    Vercel figures, under the same two labels, the Traffic tab used. Vercel does
                    not say which visitors are first-timers, so the mockup's "80% first time on
                    your site" line is left off rather than guessed at. */}
                <Tile label="Visits" value={visits.toLocaleString()} />
                <Tile label="New visitors" value={(data.totalNewUsers ?? 0).toLocaleString()} />
                <Tile
                    label={<Responsive desktop="Enquiries from the site" phone="Enquiries" />}
                    value={enquiries ? enquiries.count.toLocaleString() : null}
                    sub={
                        // TODO(wording): only the "more" case is approved. A fall or no change
                        // shows nothing until Xander approves words for it.
                        more > 0 ? (
                            <span style={{ color: "var(--chart-pos)", fontWeight: 600 }}>
                                <Responsive
                                    desktop={`▲ ${more} more than last period`}
                                    phone={`▲ ${more} more`}
                                />
                            </span>
                        ) : undefined
                    }
                />
                <Tile
                    label="Visits → enquiries"
                    value={rate ? formatRate(rate.pct) : null}
                    sub={
                        rate?.oneIn ? (
                            <Responsive
                                desktop={`About 1 in ${rate.oneIn.toLocaleString()} visits sends an enquiry`}
                                phone={`1 in ${rate.oneIn.toLocaleString()} visits`}
                            />
                        ) : undefined
                    }
                />
            </div>

            <Card>
                <div className="flex items-center justify-between gap-4 flex-wrap mb-2.5">
                    <CardLabel>Visits per day</CardLabel>
                    <span className="text-xs flex items-center gap-4" style={{ color: "var(--fg-3)" }}>
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                style={{ width: 14, height: 3, borderRadius: 2, background: "var(--chart-series-1)" }}
                            />
                            Visits
                        </span>
                        {enquiryDays.size > 0 && (
                            <span className="inline-flex items-center gap-1.5">
                                <span
                                    aria-hidden="true"
                                    style={{
                                        width: 9,
                                        height: 9,
                                        borderRadius: "50%",
                                        border: "2px solid var(--chart-series-1)",
                                        background: "var(--elev-1)",
                                        boxSizing: "border-box",
                                    }}
                                />
                                A day someone sent an enquiry
                            </span>
                        )}
                    </span>
                </div>
                <div role="img" aria-label={`Visits per day over the last ${range} days`}>
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chart} margin={{ top: 6, right: 6, bottom: 0, left: -20 }}>
                            <defs>
                                <linearGradient id="visitsFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="var(--chart-series-1)" stopOpacity={0.22} />
                                    <stop offset="100%" stopColor="var(--chart-series-1)" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                            <YAxis {...axisProps} allowDecimals={false} />
                            <Tooltip {...tooltipProps} />
                            <Area
                                type="monotone"
                                dataKey="sessions"
                                name="Visits"
                                stroke="var(--chart-series-1)"
                                strokeWidth={2}
                                fill="url(#visitsFill)"
                                isAnimationActive={false}
                                dot={(props: { cx?: number; cy?: number; index?: number; payload?: { enquiry?: boolean } }) =>
                                    props.payload?.enquiry && props.cx != null && props.cy != null ? (
                                        <circle
                                            key={`enq-${props.index}`}
                                            cx={props.cx}
                                            cy={props.cy}
                                            r={4.5}
                                            fill="var(--elev-1)"
                                            stroke="var(--chart-series-1)"
                                            strokeWidth={2}
                                        />
                                    ) : (
                                        <g key={`enq-${props.index}`} />
                                    )
                                }
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </AnalyticsBlock>
    );
}

/** A headline figure with an optional line beneath it. */
function Tile({ label, value, sub }: { label: ReactNode; value: string | null; sub?: ReactNode }) {
    return (
        <Card className="flex flex-col gap-2">
            <CardLabel>{label}</CardLabel>
            <span
                className="portal-numeral"
                style={{
                    fontSize: "clamp(26px, 2.6vw, 32px)",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: value === null ? "var(--fg-3)" : "var(--fg)",
                }}
            >
                {value ?? "—"}
            </span>
            {sub && (
                <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                    {sub}
                </span>
            )}
        </Card>
    );
}

/** `YYYYMMDD` → "Oct 11". UTC, because the day buckets are UTC days. */
function dayLabel(yyyymmdd: string): string {
    const y = Number(yyyymmdd.slice(0, 4));
    const m = Number(yyyymmdd.slice(4, 6));
    const d = Number(yyyymmdd.slice(6, 8));
    if (!y || !m || !d) return yyyymmdd;
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

/* ── Where they came from ─────────────────────────────────────────────────── */

/**
 * Visits by source.
 *
 * The mockup's second card, "Enquiries by source", is not built: a web-form lead records what
 * the visitor typed, not where they arrived from, so there is nothing to attribute an enquiry
 * to. It needs the client sites' forms to post the referrer first.
 */
function Sources({ data }: { data: TrafficData }) {
    const rows = sourceRows(data.sources ?? [], data.totalSessions ?? 0);

    return (
        <AnalyticsBlock id="sources" title="Where they came from">
            <Card>
                <CardLabel>Visits by source</CardLabel>
                {rows.length === 0 ? (
                    <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                        No referrers recorded yet.
                    </p>
                ) : (
                    <ul className="mt-2">
                        {rows.map((r, i) => (
                            <li
                                key={r.label}
                                className="flex items-center gap-3 py-2.5 text-sm"
                                style={{ borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)" }}
                            >
                                <span className="w-28 sm:w-40 shrink-0 truncate" style={{ color: "var(--fg)" }} title={r.label}>
                                    {r.label}
                                </span>
                                <Bar pct={r.pct} />
                                <span
                                    className="shrink-0 text-right text-xs"
                                    style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", minWidth: 34 }}
                                >
                                    <Responsive
                                        desktop={`${r.sessions.toLocaleString()} · ${Math.round(r.pct)}%`}
                                        phone={`${Math.round(r.pct)}%`}
                                    />
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>
        </AnalyticsBlock>
    );
}

function Bar({ pct }: { pct: number }) {
    return (
        <span
            aria-hidden="true"
            className="flex-1 h-2 rounded-full overflow-hidden"
            style={{ background: "var(--chart-track)" }}
        >
            <span
                className="block h-full rounded-full"
                style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: "var(--chart-series-1)" }}
            />
        </span>
    );
}

/* ── Pages & devices ──────────────────────────────────────────────────────── */

const DEVICE_COLOURS = ["var(--chart-series-1)", "var(--chart-series-2)", "var(--chart-series-4)", "var(--chart-series-3)"];

function PagesAndDevices({ data }: { data: TrafficData }) {
    const pages = data.pages ?? [];
    const devices = shares((data.devices ?? []).map((d) => ({ key: deviceLabel(d.device), value: d.sessions })));
    const browsers = topBrowsers(data.browsers ?? []);

    return (
        <AnalyticsBlock id="pages" title="Pages & devices">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <Card className="lg:col-span-2">
                    <CardLabel>Most-read pages</CardLabel>
                    {pages.length === 0 ? (
                        <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                            No page views recorded yet.
                        </p>
                    ) : (
                        <ul className="mt-2">
                            {pages.slice(0, 8).map((p, i) => (
                                <li
                                    key={p.path}
                                    className="flex items-center justify-between gap-4 py-2.5 text-sm"
                                    style={{ borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)" }}
                                >
                                    <span className="truncate" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                        {p.path}
                                    </span>
                                    <span className="shrink-0" style={{ color: "var(--fg)", fontFamily: "var(--font-mono)" }}>
                                        {p.views.toLocaleString()}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                {/* "Most of your customers are looking you up on a phone" is a decision a local
                    business can act on, which is why devices sit beside the pages they read. */}
                <Card className="flex flex-col gap-3.5">
                    <CardLabel>Devices</CardLabel>
                    {devices.length === 0 ? (
                        <p className="text-sm py-6 text-center" style={{ color: "var(--fg-3)" }}>
                            No device data recorded yet.
                        </p>
                    ) : (
                        <>
                            <div aria-hidden="true" className="flex h-3 rounded-full overflow-hidden gap-0.5">
                                {devices.map((d, i) => (
                                    <span key={d.key} style={{ width: `${d.pct}%`, background: DEVICE_COLOURS[i % DEVICE_COLOURS.length] }} />
                                ))}
                            </div>
                            <ul className="flex flex-col gap-1.5 text-sm">
                                {devices.map((d, i) => (
                                    <li key={d.key} className="flex items-center justify-between gap-3">
                                        <span className="inline-flex items-center gap-2" style={{ color: "var(--fg)" }}>
                                            <span
                                                aria-hidden="true"
                                                style={{
                                                    width: 9,
                                                    height: 9,
                                                    borderRadius: 2,
                                                    background: DEVICE_COLOURS[i % DEVICE_COLOURS.length],
                                                }}
                                            />
                                            {d.key}
                                        </span>
                                        <span style={{ color: "var(--fg)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                                            {d.pct}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                    {browsers && (
                        <p
                            className="text-xs pt-2.5"
                            style={{ color: "var(--fg-3)", borderTop: "1px solid var(--rule-weak)" }}
                        >
                            Top browsers: {browsers}
                        </p>
                    )}
                </Card>
            </div>
        </AnalyticsBlock>
    );
}
