"use client";

import { useEffect, useState } from "react";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts";

interface CallRecord {
    id: string;
    date: string | null;
    callerName: string;
    callerNumber: string;
    summary: string | null;
    durationSeconds: number;
    callType: string | null;
    outcome: string | null;
    site: string | null;
}

interface CallsData {
    calls: CallRecord[];
    noData?: boolean;
    error?: string;
}

const OUTCOME_COLORS: Record<string, string> = {
    "Qualified": "#4ade80",
    "Not qualified": "#f87171",
    "Follow-up needed": "#facc15",
    "No answer": "#94a3b8",
    "Voicemail": "#a78bfa",
};

function fmtDuration(s: number): string {
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function buildVolume(calls: CallRecord[]): { date: string; count: number }[] {
    const map = new Map<string, number>();
    for (const c of calls) {
        const d = c.date?.slice(0, 10) ?? "Unknown";
        map.set(d, (map.get(d) ?? 0) + 1);
    }
    return Array.from(map.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-30)
        .map(([date, count]) => ({ date: date.slice(5), count })); // MM-DD
}

function buildOutcomes(calls: CallRecord[]): { name: string; value: number }[] {
    const map = new Map<string, number>();
    for (const c of calls) {
        const o = c.outcome ?? "Unknown";
        map.set(o, (map.get(o) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
}

export default function CallsSection({
    selectedSite,
    isEnterprise,
}: {
    selectedSite: string | null;
    isEnterprise: boolean;
}) {
    const [data, setData] = useState<CallsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [expanded, setExpanded] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch("/api/portal/calls")
            .then((r) => r.json())
            .then((d) => { setData(d); setLoading(false); })
            .catch(() => { setData({ calls: [], error: "Failed to load" }); setLoading(false); });
    }, []);

    if (loading) return <LoadingState />;
    if (!data || data.error) return <ErrorState message={data?.error} />;
    if (data.noData || data.calls.length === 0) return <EmptyState />;

    const calls = isEnterprise && selectedSite
        ? data.calls.filter((c) => !c.site || c.site === selectedSite)
        : data.calls;

    const volume = buildVolume(calls);
    const outcomes = buildOutcomes(calls);
    const qualified = calls.filter((c) => c.outcome === "Qualified").length;
    const qualRate = calls.length ? Math.round((qualified / calls.length) * 100) : 0;

    const tooltipStyle = {
        contentStyle: { background: "#0d1b2e", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, fontSize: 12 },
        labelStyle: { color: "rgba(244,246,251,0.55)" },
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Call Log
                </h2>
                <span className="text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    {calls.length} calls · {qualRate}% qualified
                </span>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Volume bar chart */}
                <div
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                >
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Call Volume (last 30 days)
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={volume} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(244,246,251,0.48)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: "rgba(244,246,251,0.48)" }} tickLine={false} axisLine={false} allowDecimals={false} />
                            <Tooltip {...tooltipStyle} />
                            <Bar dataKey="count" fill="rgba(245,237,214,0.4)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Outcome donut */}
                <div
                    className="rounded-lg p-4 border"
                    style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                >
                    <p className="text-xs uppercase tracking-widest mb-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                        Outcomes
                    </p>
                    <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                            <Pie data={outcomes} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                                {outcomes.map((entry) => (
                                    <Cell key={entry.name} fill={OUTCOME_COLORS[entry.name] ?? "#64748b"} />
                                ))}
                            </Pie>
                            <Tooltip {...tooltipStyle} />
                            <Legend
                                iconSize={8}
                                formatter={(value) => <span style={{ color: "rgba(244,246,251,0.74)", fontSize: 11 }}>{value}</span>}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Calls table */}
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule)" }}>
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid var(--rule)" }}>
                            {["Date", "Caller", "Number", "Type", "Outcome", "Duration"].map((h) => (
                                <th key={h} className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {calls.slice(0, 50).map((c) => (
                            <>
                                <tr
                                    key={c.id}
                                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                                    className="cursor-pointer transition-colors"
                                    style={{ borderBottom: "1px solid var(--rule)" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                                >
                                    <td className="px-4 py-3" style={{ color: "var(--fg-2)" }}>{c.date?.slice(0, 10) ?? "—"}</td>
                                    <td className="px-4 py-3" style={{ color: "var(--fg)" }}>{c.callerName}</td>
                                    <td className="px-4 py-3" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{c.callerNumber}</td>
                                    <td className="px-4 py-3" style={{ color: "var(--fg-2)" }}>{c.callType ?? "—"}</td>
                                    <td className="px-4 py-3">
                                        <span
                                            className="px-2 py-0.5 rounded-full text-xs"
                                            style={{
                                                background: `${OUTCOME_COLORS[c.outcome ?? ""] ?? "#64748b"}22`,
                                                color: OUTCOME_COLORS[c.outcome ?? ""] ?? "var(--fg-3)",
                                            }}
                                        >
                                            {c.outcome ?? "Unknown"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                        {fmtDuration(c.durationSeconds)}
                                    </td>
                                </tr>
                                {expanded === c.id && c.summary && (
                                    <tr key={`${c.id}-summary`} style={{ background: "rgba(245,237,214,0.03)", borderBottom: "1px solid var(--rule)" }}>
                                        <td colSpan={6} className="px-4 py-3 text-sm" style={{ color: "var(--fg-2)" }}>
                                            <span className="font-medium" style={{ color: "var(--accent)" }}>Summary: </span>
                                            {c.summary}
                                        </td>
                                    </tr>
                                )}
                            </>
                        ))}
                    </tbody>
                </table>
                {calls.length > 50 && (
                    <div className="px-4 py-3 text-xs text-center" style={{ color: "var(--fg-3)" }}>
                        Showing 50 of {calls.length} calls
                    </div>
                )}
            </div>
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
            {message ?? "Failed to load call data."}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center h-48 gap-2" style={{ color: "var(--fg-3)" }}>
            <span className="text-3xl">📞</span>
            <p className="text-sm">No calls recorded yet. Calls will appear here once they come in.</p>
        </div>
    );
}
