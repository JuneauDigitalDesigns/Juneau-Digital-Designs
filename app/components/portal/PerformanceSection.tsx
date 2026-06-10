"use client";

import { useEffect, useState } from "react";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";

interface PerformanceData {
    score: number;
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    fetchedAt: string;
    fromCache: boolean;
    error?: string;
    noData?: boolean;
}

function scoreColor(score: number): string {
    if (score >= 90) return "#4ade80";
    if (score >= 50) return "#facc15";
    return "#f87171";
}

function MetricCard({ label, value, unit, good, warn }: {
    label: string;
    value: number | null;
    unit: string;
    good: number;
    warn: number;
}) {
    const color =
        value === null ? "var(--fg-3)"
        : value <= good ? "#4ade80"
        : value <= warn ? "#facc15"
        : "#f87171";

    const display =
        value === null ? "—"
        : unit === "s" ? `${(value / 1000).toFixed(2)}s`
        : unit === "cls" ? value.toFixed(3)
        : `${Math.round(value)}ms`;

    return (
        <div
            className="rounded-lg p-4 border flex flex-col gap-1"
            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
        >
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                {label}
            </span>
            <span className="text-2xl font-semibold" style={{ color }}>
                {display}
            </span>
        </div>
    );
}

export default function PerformanceSection({ selectedSite }: { selectedSite: string | null }) {
    const [data, setData] = useState<PerformanceData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch("/api/portal/performance")
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => { setData({ score: 0, lcp: null, cls: null, inp: null, fcp: null, fetchedAt: "", fromCache: false, error: "Failed to load" }); setLoading(false); });
    }, [selectedSite]);

    if (loading) return <LoadingState />;
    if (!data || data.error) return <ErrorState message={data?.error} />;

    const chartData = [{ name: "Score", value: data.score, fill: scoreColor(data.score) }];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Performance
                </h2>
                {data.fetchedAt && (
                    <span className="text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        {data.fromCache ? "Cached · " : "Live · "}
                        {new Date(data.fetchedAt).toLocaleString()}
                    </span>
                )}
            </div>

            <div className="flex flex-col md:flex-row items-center gap-10">
                {/* Score gauge */}
                <div className="flex flex-col items-center gap-2 shrink-0">
                    <div style={{ width: 160, height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%" cy="50%"
                                innerRadius="70%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                                data={chartData}
                            >
                                <RadialBar dataKey="value" cornerRadius={6} background={{ fill: "rgba(255,255,255,0.06)" }} />
                                <Tooltip
                                    contentStyle={{ background: "#0d1b2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6 }}
                                    formatter={(v) => [`${v ?? 0}/100`, "Score"]}
                                />
                            </RadialBarChart>
                        </ResponsiveContainer>
                    </div>
                    <span className="text-4xl font-bold" style={{ color: scoreColor(data.score), fontFamily: "var(--font-display)" }}>
                        {data.score}
                    </span>
                    <span className="text-xs uppercase tracking-widest" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Performance Score
                    </span>
                </div>

                {/* Metric cards */}
                <div className="grid grid-cols-2 gap-4 flex-1 w-full">
                    <MetricCard label="LCP" value={data.lcp} unit="s" good={2500} warn={4000} />
                    <MetricCard label="FCP" value={data.fcp} unit="s" good={1800} warn={3000} />
                    <MetricCard label="INP" value={data.inp} unit="ms" good={200} warn={500} />
                    <MetricCard label="CLS" value={data.cls} unit="cls" good={0.1} warn={0.25} />
                </div>
            </div>

            <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                Scores update once per day via Google PageSpeed Insights (mobile, live site).
            </p>
        </div>
    );
}

function LoadingState() {
    return (
        <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: "var(--rule-strong)", borderTopColor: "var(--accent)" }} />
        </div>
    );
}

function ErrorState({ message }: { message?: string }) {
    return (
        <div className="flex items-center justify-center h-48 text-sm" style={{ color: "var(--fg-3)" }}>
            {message ?? "Failed to load performance data."}
        </div>
    );
}
