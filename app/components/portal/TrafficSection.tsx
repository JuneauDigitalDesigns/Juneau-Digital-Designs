"use client";

import { useEffect, useState } from "react";
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    BarChart, Bar,
} from "recharts";

interface DailyPoint {
    date: string;
    sessions: number;
    newUsers: number;
}

interface TrafficData {
    daily: DailyPoint[];
    sources: { channel: string; sessions: number }[];
    pages: { path: string; views: number }[];
    totalSessions: number;
    totalNewUsers: number;
    noData?: boolean;
    error?: string;
}

export default function TrafficSection() {
    const [data, setData] = useState<TrafficData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        fetch("/api/portal/traffic")
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => { setData({ daily: [], sources: [], pages: [], totalSessions: 0, totalNewUsers: 0, error: "Failed to load" }); setLoading(false); });
    }, []);

    if (loading) return <LoadingState />;
    if (!data || data.error) return <ErrorState message={data?.error} />;
    if (data.noData) return <NoGA4State />;

    const tooltipStyle = {
        contentStyle: { background: "#0d1b2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, fontSize: 12 },
        labelStyle: { color: "rgba(244,246,251,0.55)" },
    };

    const displayDaily = data.daily.map((d) => ({ ...d, date: d.date.slice(4) })); // MM-DD

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Traffic
                </h2>
                <span className="text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    Last 30 days
                </span>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-4">
                <StatCard label="Sessions" value={data.totalSessions.toLocaleString()} />
                <StatCard label="New Visitors" value={data.totalNewUsers.toLocaleString()} />
            </div>

            {/* Sessions + new users area chart */}
            <div
                className="rounded-lg p-4 border"
                style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
            >
                <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    Sessions & New Visitors
                </p>
                <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={displayDaily} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <defs>
                            <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="rgba(245,237,214,0.4)" stopOpacity={1} />
                                <stop offset="95%" stopColor="rgba(245,237,214,0)" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gNewUsers" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="rgba(74,222,128,0.3)" stopOpacity={1} />
                                <stop offset="95%" stopColor="rgba(74,222,128,0)" stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(244,246,251,0.48)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 10, fill: "rgba(244,246,251,0.48)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip {...tooltipStyle} />
                        <Area type="monotone" dataKey="sessions" stroke="rgba(245,237,214,0.7)" strokeWidth={1.5} fill="url(#gSessions)" name="Sessions" />
                        <Area type="monotone" dataKey="newUsers" stroke="rgba(74,222,128,0.7)" strokeWidth={1.5} fill="url(#gNewUsers)" name="New Visitors" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Traffic sources */}
                <div
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                >
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Traffic Sources
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={data.sources} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                            <XAxis type="number" tick={{ fontSize: 10, fill: "rgba(244,246,251,0.48)" }} tickLine={false} axisLine={false} />
                            <YAxis type="category" dataKey="channel" tick={{ fontSize: 10, fill: "rgba(244,246,251,0.74)" }} tickLine={false} axisLine={false} width={90} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="sessions" fill="rgba(245,237,214,0.35)" radius={[0, 3, 3, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Top pages */}
                <div
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                >
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Top Pages
                    </p>
                    <ul className="space-y-2">
                        {data.pages.slice(0, 8).map((p) => (
                            <li key={p.path} className="flex items-center justify-between gap-2">
                                <span className="text-xs truncate" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                    {p.path}
                                </span>
                                <span className="text-xs shrink-0" style={{ color: "var(--fg-3)" }}>
                                    {p.views.toLocaleString()}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div
            className="rounded-lg p-4 border flex flex-col gap-1"
            style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
        >
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                {label}
            </span>
            <span className="text-3xl font-semibold" style={{ color: "var(--fg)", fontFamily: "var(--font-display)" }}>
                {value}
            </span>
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
            {message ?? "Failed to load traffic data."}
        </div>
    );
}

function NoGA4State() {
    return (
        <div className="flex flex-col items-center justify-center h-48 gap-3 text-center" style={{ color: "var(--fg-3)" }}>
            <span className="text-3xl">📊</span>
            <p className="text-sm max-w-sm">
                Analytics not connected yet. Your account manager will link your Google Analytics property — check back soon.
            </p>
        </div>
    );
}
