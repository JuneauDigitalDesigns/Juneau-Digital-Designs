"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, CardLabel, SectionHeader } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { GhostPreview, GhostStat } from "./ui/GhostPreview";
import { Skeleton, StatRowSkeleton } from "./ui/Skeleton";
import { relativeTime } from "./ui/format";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";

interface FieldVitals {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    ttfb: number | null;
    overall: string | null;
    source: "page" | "origin";
}

interface PerformanceData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    score?: number;
    lcp?: number | null;
    cls?: number | null;
    inp?: number | null;
    fcp?: number | null;
    ttfb?: number | null;
    /** CrUX p75 over the trailing 28 days of real visits. Null when the site is too new. */
    field?: FieldVitals | null;
    fetchedAt?: string;
    fromCache?: boolean;
    error?: string;
}

function scoreTone(score: number): string {
    if (score >= 90) return "var(--chart-pos)";
    if (score >= 50) return "var(--chart-warn)";
    return "var(--chart-neg)";
}

/**
 * One Core Web Vital.
 *
 * `null` renders an em-dash rather than a formatted zero — a metric PageSpeed didn't
 * return and a metric that measured zero are different facts.
 */
function MetricCard({
    label,
    value,
    unit,
    good,
    warn,
    description,
}: {
    label: string;
    value: number | null | undefined;
    unit: "s" | "ms" | "cls";
    good: number;
    warn: number;
    description: string;
}) {
    const missing = value === null || value === undefined;
    const color = missing
        ? "var(--fg-3)"
        : value <= good
          ? "var(--chart-pos)"
          : value <= warn
            ? "var(--chart-warn)"
            : "var(--chart-neg)";

    const display = missing
        ? "—"
        : unit === "s"
          ? `${(value / 1000).toFixed(2)}s`
          : unit === "cls"
            ? value.toFixed(3)
            : `${Math.round(value)}ms`;

    return (
        <Card className="flex flex-col gap-1">
            <CardLabel>{label}</CardLabel>
            <span className="text-2xl font-semibold" style={{ color }}>
                {display}
            </span>
            <span className="text-xs" style={{ color: "var(--fg-3)" }}>
                {description}
            </span>
        </Card>
    );
}

export default function PerformanceSection({ site }: { site: PortalSiteProps }) {
    const availability = site.features.performance;
    const ready = availability.state === "ready";

    const {
        data,
        isLoading,
        refresh: retry,
    } = useCachedFetch<PerformanceData>(
        `performance:${site.slug}`,
        `/api/portal/performance?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.performance,
    );

    if (!ready) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Performance" />
                <FeatureState
                    feature="performance"
                    availability={availability}
                    ghost={
                        availability.state === "pending-build" ? (
                            <GhostPreview description="Once your site is live, this page shows a daily speed score out of 100 and a breakdown of how quickly your pages load on a phone.">
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <GhostStat label="Score" />
                                    <GhostStat label="LCP" />
                                    <GhostStat label="INP" />
                                    <GhostStat label="CLS" />
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
                <SectionHeader title="Performance" />
                <div className="flex flex-col md:flex-row items-center gap-10">
                    <Skeleton width={160} height={160} rounded="50%" />
                    <div className="flex-1 w-full">
                        <StatRowSkeleton count={4} />
                    </div>
                </div>
            </div>
        );
    }

    if (!data || data.state === "error" || data.score === undefined) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Performance" />
                <FeatureError message={data?.error} onRetry={retry} />
            </div>
        );
    }

    const score = data.score;
    const tone = scoreTone(score);
    const chartData = [{ name: "Score", value: score, fill: tone }];
    const field = data.field ?? null;

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Performance"
                meta={
                    data.fetchedAt
                        ? `${field ? "Real visitors" : "Lab test"} · checked ${relativeTime(data.fetchedAt)}`
                        : undefined
                }
            />

            <div className="flex flex-col md:flex-row items-center gap-10">
                <div className="relative shrink-0" style={{ width: 168, height: 168 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadialBarChart
                            cx="50%"
                            cy="50%"
                            innerRadius="72%"
                            outerRadius="100%"
                            startAngle={90}
                            endAngle={-270}
                            data={chartData}
                        >
                            {/* A fixed 0–100 domain, so the arc is a score and not a bar that
                                always looks full regardless of the number beside it. */}
                            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                            <RadialBar
                                dataKey="value"
                                cornerRadius={8}
                                background={{ fill: "var(--chart-track)" }}
                            />
                        </RadialBarChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span
                            className="text-5xl font-bold leading-none"
                            style={{ color: tone, fontFamily: "var(--font-display)" }}
                        >
                            {score}
                        </span>
                        <span
                            className="text-xs uppercase tracking-widest mt-1"
                            style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                        >
                            out of 100
                        </span>
                    </div>
                </div>

                {/* Field data when CrUX has enough real visits, lab otherwise. A client's
                    actual visitors beat a simulated throttled phone every time — and the
                    numbers were already in the PageSpeed response we pay for. */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1 w-full">
                    <MetricCard label="LCP" value={field?.lcp ?? data.lcp} unit="s" good={2500} warn={4000} description="Time until the main content appears" />
                    <MetricCard label="FCP" value={field?.fcp ?? data.fcp} unit="s" good={1800} warn={3000} description="Time until anything appears" />
                    <MetricCard label="INP" value={field?.inp ?? data.inp} unit="ms" good={200} warn={500} description="Response to a tap or click" />
                    <MetricCard label="CLS" value={field?.cls ?? data.cls} unit="cls" good={0.1} warn={0.25} description="How much the layout shifts while loading" />
                    {field?.ttfb != null && (
                        <MetricCard label="TTFB" value={field.ttfb} unit="ms" good={800} warn={1800} description="Time until the server answers" />
                    )}
                </div>
            </div>

            <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                {field
                    ? `The score is measured once a day by Google PageSpeed Insights on a simulated mobile connection. The four metrics above come from your real visitors over the last 28 days${field.source === "origin" ? ", across your whole site" : ""}.`
                    : "Measured once a day by Google PageSpeed Insights, on a simulated mobile connection. Once your site has enough visitors, these numbers switch to what real people experience."}
            </p>
        </div>
    );
}
