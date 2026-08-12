"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import { tabHref, upgradeHref } from "@/app/portal/types";
import type { OverviewData, RecentCall } from "@/app/lib/portal-overview";
import type { TrafficData } from "@/app/lib/portal-traffic";
import type { BillingSummary } from "@/app/lib/portal-billing-summary";
import type { UsageSummary } from "@/app/lib/portal-usage";
import { Card, CardLabel } from "./ui/Card";
import { StatTile } from "./ui/StatTile";
import { Sparkline } from "./ui/Sparkline";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { Stagger, StaggerItem } from "./ui/Motion";
import { outcomeColor } from "./ui/chartTheme";
import { usageHint, usageLevel, usageStatTone } from "./ui/usage";
import { duration, money, relativeTime, shortDate, shortDateTime } from "./ui/format";

/**
 * The tile's one hint line: the threshold warning when there is one, then the reset date.
 * Kept to a single line because this is the glance; the Call Log carries the full sentence.
 */
function usageGlance(usage: UsageSummary): string | undefined {
    const parts = [usageHint(usage)];
    if (usage.periodEnd) parts.push(`resets ${shortDate(usage.periodEnd)}`);
    const line = parts.filter(Boolean).join(" · ");
    return line || undefined;
}

/**
 * The Overview's value modules: leads, traffic, billing.
 *
 * Presentation only. This used to `fetch()` its own API from a `useEffect`, which guaranteed
 * a skeleton flash on every visit even though the layout above it had already awaited the
 * account from KV — the data now arrives as props from the server-rendered page.
 */
export function OverviewMetrics({
    site,
    data,
    usage,
}: {
    site: PortalSiteProps;
    data: OverviewData;
    usage: UsageSummary;
}) {
    if (data.state === "error") {
        return <FeatureError message={data.error} />;
    }
    if (data.state !== "ready") {
        // No ghost here — the Call Log page carries the full pitch. On the Overview this is
        // one panel among several, and a hatched placeholder table in the middle of the page
        // reads as broken rather than illustrative.
        return (
            <FeatureState
                feature="calls"
                availability={{ state: data.state }}
                upgradeHref={upgradeHref(site.slug)}
                billingLinked={site.billingLinked}
            />
        );
    }

    const series = data.dailySeries ?? [];

    return (
        <Stagger className="portal-metric-grid">
            <StaggerItem>
                <StatTile
                    label="Calls this month"
                    value={data.callsThisMonth ?? null}
                    count={data.callsThisMonth ?? null}
                    delta={data.callsDelta}
                    hint={
                        data.callsLastMonth !== undefined
                            ? `${data.callsLastMonth} last month`
                            : undefined
                    }
                    series={series}
                />
            </StaggerItem>

            {data.hasOutcome && (
                <StaggerItem>
                    <StatTile
                        label="Qualified leads"
                        value={data.qualifiedThisMonth ?? null}
                        count={data.qualifiedThisMonth ?? null}
                        delta={data.qualifiedDelta}
                        tone="positive"
                        hint="this month"
                    />
                </StaggerItem>
            )}

            <StaggerItem>
                <StatTile
                    label="Avg. call length"
                    value={duration(data.avgDurationSeconds)}
                    hint="this month"
                />
            </StaggerItem>

            <StaggerItem>
                <StatTile
                    label="Calls on record"
                    value={data.totalCalls ?? null}
                    count={data.totalCalls ?? null}
                    hint={`all time · ${site.plan} plan`}
                />
            </StaggerItem>

            {/* Only on plans with an allowance, and only once we have a figure we can stand
                behind — the Call Log carries the full meter and the overage estimate. */}
            {usage.state === "ready" && usage.minutesUsed !== null && (
                <StaggerItem>
                    <StatTile
                        label="Minutes used"
                        value={usage.minutesUsed}
                        count={usage.minutesUsed}
                        unit={`of ${usage.minutesCap?.toLocaleString()} (${Math.round(usage.pct ?? 0)}%)`}
                        tone={usageStatTone(usageLevel(usage.pct))}
                        hint={usageGlance(usage)}
                        href={tabHref("calls", site.slug)}
                    />
                </StaggerItem>
            )}
        </Stagger>
    );
}

/** Recent calls feed — the left side of the lower band. */
export function LatestCalls({ site, data }: { site: PortalSiteProps; data: OverviewData }) {
    // No retry button: the data is server-rendered, so recovering means reloading the page
    // rather than re-running a client fetch.
    if (data.state === "error") {
        return <FeatureError message={data.error} />;
    }
    if (data.state !== "ready") return null;

    const recent = data.recent ?? [];

    return (
        <Card className="space-y-1">
            <div className="flex items-center justify-between gap-4 mb-3">
                <CardLabel>Latest calls</CardLabel>
                <Link
                    href={tabHref("calls", site.slug)}
                    className="text-xs inline-flex items-center gap-1 hover:gap-1.5 transition-all"
                    style={{ color: "var(--accent)" }}
                >
                    See all
                    <ArrowRight size={12} weight="bold" />
                </Link>
            </div>

            {recent.length === 0 ? (
                <p className="text-sm py-8 text-center" style={{ color: "var(--fg-3)" }}>
                    No calls yet. The first one your receptionist answers will show up here.
                </p>
            ) : (
                <ul className="flex flex-col">
                    {recent.map((c) => (
                        <li key={c.id}>
                            <CallRow call={c} slug={site.slug} />
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}

function CallRow({ call, slug }: { call: RecentCall; slug: string }) {
    // A null caller previously produced `&q=`, i.e. a filter that matches everything —
    // link to the unfiltered log instead of pretending to search for nothing.
    const href = call.callerName
        ? `${tabHref("calls", slug)}&q=${encodeURIComponent(call.callerName)}`
        : tabHref("calls", slug);

    return (
        <Link href={href} className="portal-row block px-2.5 py-2.5 -mx-2.5">
            <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium truncate" style={{ color: "var(--fg)" }}>
                    {call.callerName ?? "Unknown caller"}
                </span>
                {/* suppressHydrationWarning: this is rendered on the server and rehydrated
                    on the client, and "22m ago" legitimately becomes "23m ago" if a minute
                    ticks over in between. The exact time is on the title attribute. */}
                <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                    title={shortDateTime(call.date)}
                    suppressHydrationWarning
                >
                    {relativeTime(call.date)}
                </span>
            </div>

            {call.outcome && (
                <span
                    className="inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                    style={{
                        background: `color-mix(in srgb, ${outcomeColor(call.outcome)} 16%, transparent)`,
                        color: outcomeColor(call.outcome),
                    }}
                >
                    {call.outcome}
                </span>
            )}

            {call.summary && (
                <p
                    className="mt-1.5 text-sm line-clamp-2"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-base)" }}
                >
                    {call.summary}
                </p>
            )}
        </Link>
    );
}

/** Traffic trend + billing line — the right side of the lower band. */
export function OverviewAside({
    site,
    traffic,
    billing,
}: {
    site: PortalSiteProps;
    traffic: TrafficData;
    billing: BillingSummary;
}) {
    return (
        <div className="flex flex-col gap-4">
            <TrafficCard site={site} traffic={traffic} />
            <BillingLine site={site} billing={billing} />
        </div>
    );
}

function TrafficCard({ site, traffic }: { site: PortalSiteProps; traffic: TrafficData }) {
    const daily = traffic.state === "ready" ? (traffic.daily ?? []) : [];
    const series = daily.map((d) => d.sessions);
    const total = traffic.totalSessions ?? null;

    return (
        <Card className="space-y-1 overflow-hidden">
            <div className="flex items-center justify-between gap-4">
                <CardLabel>Visitors</CardLabel>
                {traffic.state === "ready" && (
                    <Link
                        href={tabHref("traffic", site.slug)}
                        className="text-xs inline-flex items-center gap-1"
                        style={{ color: "var(--accent)" }}
                    >
                        Details
                        <ArrowRight size={12} weight="bold" />
                    </Link>
                )}
            </div>

            {traffic.state !== "ready" ? (
                <p className="text-sm py-4" style={{ color: "var(--fg-3)" }}>
                    {traffic.state === "not-on-plan"
                        ? "Traffic reporting isn't part of your plan."
                        : traffic.state === "error"
                          ? "We couldn't load your traffic just now."
                          : traffic.state === "connecting"
                            ? // Reached when the site IS live but our own wiring isn't
                              // finished — a missing Vercel credential or a project whose
                              // Web Analytics was never switched on. "Once your site is
                              // live" would be plainly false to a client looking at it.
                              "We're still connecting your visitor reporting."
                            : "Traffic starts reporting once your site is live."}
                </p>
            ) : (
                <>
                    <div className="flex items-baseline gap-2">
                        <span
                            className="portal-numeral"
                            style={{ fontSize: "34px", fontWeight: 700, color: "var(--fg)" }}
                        >
                            {total ?? "—"}
                        </span>
                        <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                            page views
                        </span>
                    </div>
                    <span className="text-xs block" style={{ color: "var(--fg-3)" }}>
                        last 30 days · {traffic.totalNewUsers ?? 0} unique visitors
                    </span>
                    {series.length > 1 && (
                        <div className="-mx-4 -mb-4 mt-2" aria-hidden="true">
                            <Sparkline data={series} color="var(--chart-series-3)" height={52} />
                        </div>
                    )}
                </>
            )}
        </Card>
    );
}

function BillingLine({ site, billing }: { site: PortalSiteProps; billing: BillingSummary }) {
    const planName = site.plan.charAt(0).toUpperCase() + site.plan.slice(1);
    const amount = money(billing.amount, billing.currency);

    let detail: string;
    if (billing.state === "not-billed") {
        detail = "Not billed through the portal";
    } else if (billing.state === "pending-build") {
        detail = "Billing starts when your site goes live";
    } else if (billing.state === "unavailable") {
        detail = "Billing details unavailable right now";
    } else if (billing.cancelAt) {
        detail = `Ends ${shortDate(billing.cancelAt)}`;
    } else if (amount && billing.currentPeriodEnd) {
        detail = `${amount}/${billing.interval ?? "month"} · next ${shortDate(billing.currentPeriodEnd)}`;
    } else if (amount) {
        detail = `${amount}/${billing.interval ?? "month"}`;
    } else {
        detail = "Active";
    }

    return (
        <Card
            as="div"
            density="compact"
            interactive
            className="flex items-center justify-between gap-3"
        >
            <Link href={tabHref("billing", site.slug)} className="flex-1 min-w-0 flex items-center justify-between gap-3">
                <span className="min-w-0">
                    <span className="block text-sm font-semibold" style={{ color: "var(--fg)" }}>
                        {planName} plan
                    </span>
                    <span className="block text-xs truncate" style={{ color: "var(--fg-3)" }}>
                        {detail}
                    </span>
                </span>
                <ArrowRight size={14} weight="bold" style={{ color: "var(--fg-3)" }} className="shrink-0" />
            </Link>
        </Card>
    );
}
