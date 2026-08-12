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
import { freshness, shortDate } from "./ui/format";
import { duration } from "@/app/lib/duration";
import DateRangePicker, { dayStartMs, dayEndMs, toDayString } from "./ui/DateRangePicker";
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
    return duration(s) ?? "—";
}

export type PeriodKey = "current" | "previous" | "today" | "yesterday" | "custom";
type BucketSize = "hour" | "day" | "week";

const PERIOD_LABELS: Record<PeriodKey, string> = {
    current: "This billing period",
    previous: "Previous billing period",
    today: "Today",
    yesterday: "Yesterday",
    custom: "Custom range",
};

/** Local midnight for the day containing `ms`. */
function localDayStart(ms: number): number {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
}

/**
 * Half-open window `[fromMs, toMs)` for the selection, or null when it cannot be resolved yet.
 *
 * Billing periods come from the usage payload rather than being recomputed here, so the table
 * and the allowance meter are guaranteed to describe the same window. Returning null while
 * usage is still loading is deliberate: showing every call for a moment and then snapping to a
 * period would read as data appearing and vanishing.
 */
function resolveRange(
    period: PeriodKey,
    usage: UsageSummary | null,
    previousUsage: UsageSummary | null,
    from: string,
    to: string,
    loadedAt: number,
): { fromMs: number; toMs: number } | null {
    if (period === "today") {
        const start = localDayStart(loadedAt);
        return { fromMs: start, toMs: start + 86_400_000 };
    }
    if (period === "yesterday") {
        const start = localDayStart(loadedAt) - 86_400_000;
        return { fromMs: start, toMs: start + 86_400_000 };
    }
    if (period === "custom") {
        if (!from || !to) return null;
        return { fromMs: dayStartMs(from), toMs: dayEndMs(to) };
    }

    const src = period === "previous" ? previousUsage : usage;
    if (!src?.periodStart || !src?.periodEnd) return null;
    return { fromMs: src.periodStart, toMs: src.periodEnd };
}

/** Start of the bucket containing `ms`, in local time. */
function bucketStart(ms: number, bucket: BucketSize): number {
    const d = new Date(ms);
    if (bucket === "hour") {
        d.setMinutes(0, 0, 0);
        return d.getTime();
    }
    d.setHours(0, 0, 0, 0);
    if (bucket === "week") d.setDate(d.getDate() - d.getDay()); // back to Sunday
    return d.getTime();
}

function bucketLabel(ms: number, bucket: BucketSize): string {
    const d = new Date(ms);
    if (bucket === "hour") {
        return d.toLocaleTimeString(undefined, { hour: "numeric" });
    }
    const label = d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
    return bucket === "week" ? `wk ${label}` : label;
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
    const periodFilter = (params.get("period") ?? "current") as PeriodKey;
    const customFrom = params.get("from") ?? "";
    const customTo = params.get("to") ?? "";

    // Only fetched when the prior window is actually selected, and cached under its own key,
    // so reading it can never disturb the current period's figure.
    const wantsPrevious = periodFilter === "previous";
    const { data: previousUsage } = useCachedFetch<UsageSummary>(
        `usage-prev:${site.slug}`,
        `/api/portal/usage?site=${encodeURIComponent(site.slug)}&period=previous`,
        CLIENT_TTL.usage,
        wantsPrevious,
    );

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

    /**
     * The window every metric on this page is measured over.
     *
     * Anchored to `loadedAt` rather than the clock, keeping the existing invariant that a
     * filtered view does not shift under the user mid-session. Day boundaries are **local**,
     * because "today" means the client's today; billing periods are absolute instants from
     * Stripe and compare directly.
     */
    const range = useMemo(
        () => resolveRange(periodFilter, usage, previousUsage, customFrom, customTo, loadedAt),
        [periodFilter, usage, previousUsage, customFrom, customTo, loadedAt],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return all.filter((c) => {
            if (outcomeFilter && c.outcome !== outcomeFilter) return false;
            if (typeFilter && c.callType !== typeFilter) return false;
            if (range) {
                const t = c.date ? new Date(c.date).getTime() : NaN;
                if (Number.isNaN(t) || t < range.fromMs || t >= range.toMs) return false;
            }
            if (q) {
                const hay = `${c.callerName ?? ""} ${c.summary ?? ""} ${c.callerNumber ?? ""}`.toLowerCase();
                if (!hay.includes(q)) return false;
            }
            return true;
        });
    }, [all, outcomeFilter, typeFilter, range, search]);

    /**
     * Buckets scale with the window. A billing period drawn daily is thirty near-empty bars;
     * a single day drawn daily is one. The old chart hardcoded days and capped at the last 30,
     * which silently truncated any longer view.
     */
    const volume = useMemo(() => {
        const spanMs = range ? range.toMs - range.fromMs : 0;
        const days = spanMs / 86_400_000;
        const bucket: BucketSize = !range ? "week" : days <= 2 ? "hour" : days <= 14 ? "day" : "week";

        const map = new Map<number, number>();
        for (const c of filtered) {
            if (!c.date) continue;
            const t = new Date(c.date).getTime();
            if (Number.isNaN(t)) continue;
            const key = bucketStart(t, bucket);
            map.set(key, (map.get(key) ?? 0) + 1);
        }

        return Array.from(map.entries())
            .sort(([a], [b]) => a - b)
            .map(([ms, count]) => ({ date: bucketLabel(ms, bucket), count }));
    }, [filtered, range]);

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

    // "Active" means narrowed beyond the default view, and the default is the current period.
    const filtersActive = Boolean(
        search || outcomeFilter || typeFilter || periodFilter !== "current",
    );

    // The allowance follows a billing-period selection and stays pinned to the current period
    // for day ranges, where a cap has no meaning. `meterUsage` is never the previous period
    // unless it was explicitly asked for.
    const onBillingPeriod = periodFilter === "current" || periodFilter === "previous";
    const meterUsage = periodFilter === "previous" ? previousUsage : usage;
    const meterLabel =
        onBillingPeriod || !usage?.periodStart || !usage?.periodEnd
            ? undefined
            : `Current period, ${shortDate(usage.periodStart)} to ${shortDate(usage.periodEnd)}`;

    // An under-count presented as fact is worse than no figure. Only warn when the cap was
    // actually hit and the window reaches back past the oldest row we hold.
    const oldestLoadedMs = all.reduce((min, c) => {
        const t = c.date ? new Date(c.date).getTime() : NaN;
        return Number.isNaN(t) ? min : Math.min(min, t);
    }, Number.POSITIVE_INFINITY);
    const rangeOutrunsData =
        Boolean(data.truncated) &&
        range !== null &&
        Number.isFinite(oldestLoadedMs) &&
        range.fromMs < oldestLoadedMs;

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

            {/* Everything that scopes the page, in one place at the top. Period sits first
                because it governs every number below it, including the allowance meter. */}
            <Card className="space-y-3">
                <div className="flex flex-wrap items-end gap-3">
                    <Field label="Period">
                        <Select
                            value={periodFilter}
                            onChange={(v) => {
                                const next = new URLSearchParams(params.toString());
                                next.set("period", v);
                                if (v !== "custom") {
                                    next.delete("from");
                                    next.delete("to");
                                } else if (!next.get("from")) {
                                    // Seed a sane range so the picker opens on something real.
                                    const today = toDayString(new Date(loadedAt));
                                    const weekAgo = toDayString(new Date(loadedAt - 6 * 86_400_000));
                                    next.set("from", weekAgo);
                                    next.set("to", today);
                                }
                                router.replace(`?${next.toString()}`, { scroll: false });
                            }}
                        >
                            {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => (
                                <option key={k} value={k}>{PERIOD_LABELS[k]}</option>
                            ))}
                        </Select>
                    </Field>

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
                </div>

                {periodFilter === "custom" && (
                    <DateRangePicker
                        value={{
                            from: customFrom || toDayString(new Date(loadedAt)),
                            to: customTo || toDayString(new Date(loadedAt)),
                        }}
                        maxDay={toDayString(new Date(loadedAt))}
                        onChange={({ from, to }) => {
                            const next = new URLSearchParams(params.toString());
                            next.set("period", "custom");
                            next.set("from", from);
                            next.set("to", to);
                            router.replace(`?${next.toString()}`, { scroll: false });
                        }}
                    />
                )}

                {range && (
                    <p className="text-xs" style={{ color: "var(--fg-3)" }}>
                        Showing {shortDate(range.fromMs)} to {shortDate(range.toMs - 1)}
                    </p>
                )}

                {rangeOutrunsData && (
                    <p className="text-xs" style={{ color: "var(--chart-warn)" }}>
                        Only the most recent {all.length.toLocaleString()} calls are loaded, so
                        this range may not include everything.
                    </p>
                )}
            </Card>

            {/* Allowance next: it's the only number here that costs the client money. */}
            {meterUsage && <UsageMeter usage={meterUsage} periodLabel={meterLabel} />}

            {/* Stats — only those this base can actually support. */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <StatTile label="Calls this period" value={filtered.length} hint={filtersActive ? "matching filters" : undefined} />
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
