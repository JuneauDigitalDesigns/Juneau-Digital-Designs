"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
} from "recharts";
import type { PortalSiteProps } from "@/app/portal/types";
import { upgradeHref } from "@/app/portal/types";
import { Card, CardLabel, SectionHeader } from "./ui/Card";
import { StatTile } from "./ui/StatTile";
import { UsageMeter } from "./ui/UsageMeter";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { GhostPreview, GhostChart, GhostStat, GhostTable } from "./ui/GhostPreview";
import { ChartSkeleton, StatRowSkeleton, TableSkeleton } from "./ui/Skeleton";
import { axisProps, tooltipProps, outcomeColor, legendStyle } from "./ui/chartTheme";
import Drawer from "./ui/Drawer";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";
import { freshness } from "./ui/format";
import type { UsageSummary } from "@/app/lib/portal-usage";

interface CallRecord {
    id: string;
    date: string | null;
    callerName: string | null;
    callerNumber: string | null;
    summary: string | null;
    durationSeconds: number | null;
    callType: string | null;
    outcome: string | null;
    email: string | null;
    address: string | null;
    recordingUrl: string | null;
    priority: string | null;
}

interface CallsData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    calls: CallRecord[];
    /** Columns the client's base actually has. Drives which stats we're allowed to show. */
    fields: string[];
    truncated?: boolean;
    error?: string;
}

function fmtDuration(s: number | null): string {
    if (s === null) return "—";
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function fmtDate(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function fmtPhone(raw: string | null): string {
    if (!raw) return "Unknown";
    const digits = raw.replace(/\D/g, "");
    const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
    if (ten.length !== 10) return raw;
    return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

export default function CallsSection({ site }: { site: PortalSiteProps }) {
    const availability = site.features.calls;
    const router = useRouter();
    const params = useSearchParams();

    const [openId, setOpenId] = useState<string | null>(null);

    // `fetchedAt` is when the response landed; the relative date filters read it rather than
    // the clock, so a filtered view doesn't shift under the user mid-session.
    const {
        data,
        isLoading,
        fetchedAt,
        refresh: retry,
    } = useCachedFetch<CallsData>(
        `calls:${site.slug}`,
        `/api/portal/calls?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
    );

    // Separate from the call log on purpose: usage comes from Retell (authoritative for
    // billing) while the log comes from Airtable, and they have very different TTLs.
    const { data: usage } = useCachedFetch<UsageSummary>(
        `usage:${site.slug}`,
        `/api/portal/usage?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.usage,
    );

    // Filters live in the URL so a filtered view can be linked and survives a refresh.
    const search = params.get("q") ?? "";
    const outcomeFilter = params.get("outcome") ?? "";
    const typeFilter = params.get("type") ?? "";
    const daysFilter = params.get("days") ?? "";

    const setParam = useCallback(
        (key: string, value: string) => {
            const next = new URLSearchParams(params.toString());
            if (value) next.set(key, value);
            else next.delete(key);
            router.replace(`?${next.toString()}`, { scroll: false });
        },
        [params, router],
    );

    const ready = availability.state === "ready";
    const loadedAt = fetchedAt ?? 0;
    const all = useMemo(() => data?.calls ?? [], [data]);

    // Which columns exist decides which stats we may render. A base with no Outcome column
    // must not produce a "0% qualified" figure — that reads as a measured result.
    const hasOutcome = data?.fields.includes("Outcome") ?? false;
    const hasType = data?.fields.includes("Call type") ?? false;

    const outcomes = useMemo(
        () => Array.from(new Set(all.map((c) => c.outcome).filter((o): o is string => Boolean(o)))).sort(),
        [all],
    );
    const types = useMemo(
        () => Array.from(new Set(all.map((c) => c.callType).filter((t): t is string => Boolean(t)))).sort(),
        [all],
    );

    const filtered = useMemo(() => {
        // Relative to when the data was fetched, not to render time — reading the clock
        // during render makes the same props produce different output.
        const cutoff = daysFilter ? loadedAt - Number(daysFilter) * 86_400_000 : null;
        const q = search.trim().toLowerCase();
        return all.filter((c) => {
            if (outcomeFilter && c.outcome !== outcomeFilter) return false;
            if (typeFilter && c.callType !== typeFilter) return false;
            if (cutoff !== null) {
                const t = c.date ? new Date(c.date).getTime() : NaN;
                if (Number.isNaN(t) || t < cutoff) return false;
            }
            if (q) {
                const hay = `${c.callerName ?? ""} ${c.summary ?? ""} ${c.callerNumber ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [all, outcomeFilter, typeFilter, daysFilter, search, loadedAt]);

    const volume = useMemo(() => {
        const map = new Map<string, number>();
        for (const c of filtered) {
            if (!c.date) continue;
            const day = c.date.slice(0, 10);
            map.set(day, (map.get(day) ?? 0) + 1);
        }
        return Array.from(map.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-30)
            .map(([date, count]) => ({ date: date.slice(5), count }));
    }, [filtered]);

    const outcomeBreakdown = useMemo(() => {
        if (!hasOutcome) return [];
        const map = new Map<string, number>();
        for (const c of filtered) {
            const key = c.outcome ?? "Uncategorised";
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
    }, [filtered, hasOutcome]);

    const qualified = hasOutcome
        ? filtered.filter((c) => c.outcome?.toLowerCase() === "qualified").length
        : null;

    const avgDuration = useMemo(() => {
        const withDuration = filtered.filter((c) => c.durationSeconds !== null);
        if (withDuration.length === 0) return null;
        return Math.round(
            withDuration.reduce((sum, c) => sum + (c.durationSeconds ?? 0), 0) / withDuration.length,
        );
    }, [filtered]);

    const openCall = all.find((c) => c.id === openId) ?? null;

    // ── Lifecycle states ────────────────────────────────────────────────────
    if (!ready) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Call Log" />
                <FeatureState
                    feature="calls"
                    availability={availability}
                    upgradeHref={upgradeHref(site.slug)}
                    billingLinked={site.billingLinked}
                    ghost={
                        // Shown for both "not built yet" and "not on your plan". The ghost is
                        // the argument in the second case: a Starter client is being asked to
                        // buy something they have never seen, so show them its shape.
                        availability.state === "pending-build" ||
                        availability.state === "not-on-plan" ? (
                            <GhostPreview
                                description={
                                    availability.state === "not-on-plan"
                                        ? "With Growth, this page lists every call your AI receptionist answers, with a summary of each one."
                                        : "Once your site is live, this page lists every call your AI receptionist answers, with a summary of each one."
                                }
                            >
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                        <GhostStat label="Calls" />
                                        <GhostStat label="Qualified" />
                                        <GhostStat label="Avg. length" />
                                    </div>
                                    <GhostChart label="Call volume" />
                                    <GhostTable columns={["Date", "Caller", "Number", "Outcome", "Length"]} />
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
                <SectionHeader title="Call Log" />
                <StatRowSkeleton />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ChartSkeleton />
                    <ChartSkeleton />
                </div>
                <TableSkeleton />
            </div>
        );
    }

    if (!data || data.state === "error") {
        return (
            <div className="space-y-8">
                <SectionHeader title="Call Log" />
                <FeatureError message={data?.error} onRetry={retry} />
            </div>
        );
    }

    if (all.length === 0) {
        return (
            <div className="space-y-8">
                <SectionHeader title="Call Log" />
                <FeatureState feature="calls" availability={{ state: "ready" }} />
            </div>
        );
    }

    const filtersActive = Boolean(search || outcomeFilter || typeFilter || daysFilter);

    return (
        <div className="space-y-8">
            <SectionHeader
                title="Call Log"
                meta={freshness(
                    data.truncated
                        ? `showing the most recent ${all.length} calls`
                        : `${all.length} call${all.length === 1 ? "" : "s"} on record`,
                    fetchedAt,
                )}
            />

            {/* Allowance first: it's the only number here that costs the client money. */}
            {usage && <UsageMeter usage={usage} />}

            {/* Stats — only those this base can actually support. */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatTile label="Calls" value={filtered.length} hint={filtersActive ? "matching filters" : undefined} />
                {hasOutcome && (
                    <StatTile
                        label="Qualified"
                        value={qualified}
                        unit={
                            filtered.length && qualified !== null
                                ? `of ${filtered.length} (${Math.round((qualified / filtered.length) * 100)}%)`
                                : undefined
                        }
                        tone="positive"
                    />
                )}
                <StatTile label="Avg. length" value={avgDuration === null ? null : fmtDuration(avgDuration)} />
            </div>

            {/* Filters */}
            <Card className="flex flex-wrap items-end gap-3">
                <Field label="Search">
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setParam("q", e.target.value)}
                        placeholder="Name, number, or summary"
                        className="text-sm px-3 py-1.5 rounded border outline-none w-56"
                        style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                </Field>
                <Field label="Period">
                    <Select value={daysFilter} onChange={(v) => setParam("days", v)}>
                        <option value="">All time</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </Select>
                </Field>
                {hasOutcome && outcomes.length > 0 && (
                    <Field label="Outcome">
                        <Select value={outcomeFilter} onChange={(v) => setParam("outcome", v)}>
                            <option value="">Any</option>
                            {outcomes.map((o) => (
                                <option key={o} value={o}>{o}</option>
                            ))}
                        </Select>
                    </Field>
                )}
                {hasType && types.length > 0 && (
                    <Field label="Type">
                        <Select value={typeFilter} onChange={(v) => setParam("type", v)}>
                            <option value="">Any</option>
                            {types.map((t) => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </Select>
                    </Field>
                )}
                {filtersActive && (
                    <button
                        type="button"
                        onClick={() => router.replace(`?site=${encodeURIComponent(site.slug)}`, { scroll: false })}
                        className="text-sm underline underline-offset-4 cursor-pointer pb-1.5"
                        style={{ color: "var(--accent)" }}
                    >
                        Clear
                    </button>
                )}
            </Card>

            {/* Charts */}
            <div className={`grid grid-cols-1 ${hasOutcome ? "md:grid-cols-2" : ""} gap-6`}>
                <Card>
                    <CardLabel>Call volume</CardLabel>
                    <div className="mt-3">
                        <ResponsiveContainer width="100%" height={160}>
                            <BarChart data={volume} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                                <XAxis dataKey="date" {...axisProps} interval="preserveStartEnd" />
                                <YAxis {...axisProps} allowDecimals={false} />
                                <Tooltip {...tooltipProps} />
                                <Bar dataKey="count" fill="var(--chart-series-1)" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                {hasOutcome && (
                    <Card>
                        <CardLabel>Outcomes</CardLabel>
                        <div className="mt-3">
                            <ResponsiveContainer width="100%" height={160}>
                                <PieChart>
                                    <Pie data={outcomeBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={65}>
                                        {outcomeBreakdown.map((entry) => (
                                            <Cell key={entry.name} fill={outcomeColor(entry.name)} />
                                        ))}
                                    </Pie>
                                    <Tooltip {...tooltipProps} cursor={false} />
                                    <Legend
                                        iconSize={8}
                                        formatter={(value) => <span style={legendStyle}>{value}</span>}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </Card>
                )}
            </div>

            {/* Desktop table */}
            <Card density="none" className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                            {["Date", "Caller", "Number", ...(hasType ? ["Type"] : []), ...(hasOutcome ? ["Outcome"] : []), "Length"].map((h) => (
                                <th
                                    key={h}
                                    className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium whitespace-nowrap"
                                    style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((c) => (
                            <tr
                                key={c.id}
                                onClick={() => setOpenId(c.id)}
                                className="cursor-pointer transition-colors"
                                style={{ borderBottom: "1px solid var(--rule)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface)")}
                                onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                            >
                                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fg-2)" }}>{fmtDate(c.date)}</td>
                                <td className="px-4 py-3" style={{ color: "var(--fg)" }}>{c.callerName ?? "Unknown"}</td>
                                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                    {fmtPhone(c.callerNumber)}
                                </td>
                                {hasType && <td className="px-4 py-3" style={{ color: "var(--fg-2)" }}>{c.callType ?? "—"}</td>}
                                {hasOutcome && (
                                    <td className="px-4 py-3">
                                        <OutcomeChip outcome={c.outcome} />
                                    </td>
                                )}
                                <td className="px-4 py-3 whitespace-nowrap" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                                    {fmtDuration(c.durationSeconds)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length === 0 && <NoMatches />}
            </Card>

            {/* Mobile cards — a six-column table is unusable on a phone, and a tradesman
                checking calls from a truck is the likeliest mobile visitor here. */}
            <div className="md:hidden space-y-3">
                {filtered.map((c) => (
                    <button
                        key={c.id}
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        className="w-full text-left rounded-lg border p-4 cursor-pointer"
                        style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <span className="font-medium" style={{ color: "var(--fg)" }}>
                                {c.callerName ?? "Unknown"}
                            </span>
                            {hasOutcome && <OutcomeChip outcome={c.outcome} />}
                        </div>
                        <div className="mt-1 text-sm" style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
                            {fmtPhone(c.callerNumber)}
                        </div>
                        <div className="mt-2 flex gap-3 text-xs" style={{ color: "var(--fg-3)" }}>
                            <span>{fmtDate(c.date)}</span>
                            <span>{fmtDuration(c.durationSeconds)}</span>
                        </div>
                    </button>
                ))}
                {filtered.length === 0 && <NoMatches />}
            </div>

            <Drawer
                open={openCall !== null}
                onClose={() => setOpenId(null)}
                title={openCall?.callerName ?? "Call detail"}
            >
                {openCall && <CallDetail call={openCall} />}
            </Drawer>
        </div>
    );
}

function CallDetail({ call }: { call: CallRecord }) {
    return (
        <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
                {call.outcome && <OutcomeChip outcome={call.outcome} />}
                {call.priority && (
                    <span
                        className="px-2 py-0.5 rounded-full text-xs"
                        style={{ background: "var(--chart-track)", color: "var(--fg-2)" }}
                    >
                        {call.priority}
                    </span>
                )}
            </div>

            <dl className="space-y-3 text-sm">
                <Row label="When" value={call.date ? new Date(call.date).toLocaleString() : "—"} />
                <Row label="Length" value={fmtDuration(call.durationSeconds)} />
                {call.callType && <Row label="Type" value={call.callType} />}
                {call.callerNumber && (
                    <Row
                        label="Number"
                        value={
                            <a
                                href={`tel:${call.callerNumber.replace(/[^\d+]/g, "")}`}
                                className="underline underline-offset-4"
                                style={{ color: "var(--accent)" }}
                            >
                                {fmtPhone(call.callerNumber)}
                            </a>
                        }
                    />
                )}
                {call.email && (
                    <Row
                        label="Email"
                        value={
                            <a href={`mailto:${call.email}`} className="underline underline-offset-4" style={{ color: "var(--accent)" }}>
                                {call.email}
                            </a>
                        }
                    />
                )}
                {call.address && <Row label="Address" value={call.address} />}
            </dl>

            {call.summary && (
                <div>
                    <CardLabel>Summary</CardLabel>
                    <p
                        className="mt-2 text-sm"
                        style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
                    >
                        {call.summary}
                    </p>
                </div>
            )}

            {call.recordingUrl && (
                <div>
                    <CardLabel>Recording</CardLabel>
                    <audio controls preload="none" src={call.recordingUrl} className="mt-2 w-full">
                        <a href={call.recordingUrl}>Download recording</a>
                    </audio>
                </div>
            )}
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-4">
            <dt style={{ color: "var(--fg-3)" }}>{label}</dt>
            <dd className="text-right" style={{ color: "var(--fg)" }}>{value}</dd>
        </div>
    );
}

function OutcomeChip({ outcome }: { outcome: string | null }) {
    const color = outcomeColor(outcome);
    return (
        <span
            className="px-2 py-0.5 rounded-full text-xs whitespace-nowrap"
            style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
        >
            {outcome ?? "Uncategorised"}
        </span>
    );
}

function NoMatches() {
    return (
        <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--fg-3)" }}>
            No calls match these filters.
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <label className="flex flex-col gap-1.5">
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            {children}
        </label>
    );
}

function Select({
    value,
    onChange,
    children,
}: {
    value: string;
    onChange: (v: string) => void;
    children: React.ReactNode;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-sm px-3 py-1.5 rounded border outline-none cursor-pointer"
            style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
        >
            {children}
        </select>
    );
}
