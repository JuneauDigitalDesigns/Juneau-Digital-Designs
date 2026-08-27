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
 * Why "this month" does not mean the calendar month.
 *
 * Clients pay monthly and think in months, so the labels keep that word. What they do not
 * expect is that the month runs from their subscription date. This is the sentence that closes
 * that gap, and it is attached to every tile the billing period governs.
 */
const PERIOD_INFO =
    "Counts run on your billing period, which starts the day you subscribed and resets on that date each month. This is not the calendar month.";

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

    // Which number leads. The old page rendered five tiles of identical weight in an
    // auto-fit grid, so "Qualified leads" and "Calls on record" competed as equals and
    // nothing said where to look. One figure now carries the page and the rest visibly
    // support it.
    //
    // Chosen per plan because the plans genuinely differ: an Outcome column means the client
    // is triaging leads and the triaged count is the point; without one, volume is all we
    // can honestly lead with. Starter has no call data at all and is handled a level up, in
    // `page.tsx`, by rendering the traffic hero instead.
    const leadsAreTheStory = data.hasOutcome && data.qualifiedThisMonth !== null;

    return (
        <div>
            {leadsAreTheStory ? (
                <HeroMetric
                    label="Marked qualified · this period"
                    info={PERIOD_INFO}
                    value={data.qualifiedThisMonth ?? 0}
                    delta={data.qualifiedDelta}
                    /* States the denominator and claims nothing further. An earlier draft
                       read "a 45% conversion", which is our arithmetic dressed as their
                       result — and a call is not a converted lead until the owner rings
                       back. Same trap `airtable-calls.ts` documents as "0% qualified, a
                       fabricated statistic presented as a measurement". */
                    sub={`of ${data.callsThisMonth ?? 0} calls answered`}
                    series={series}
                />
            ) : (
                <HeroMetric
                    label="Calls this period"
                    info={PERIOD_INFO}
                    value={data.callsThisMonth ?? 0}
                    delta={data.callsDelta}
                    sub={
                        data.callsLastMonth !== undefined
                            ? `${data.callsLastMonth} last period`
                            : undefined
                    }
                    series={series}
                />
            )}

            <StatStrip>
                <StatStripCell label="Avg. call length" value={duration(data.avgDurationSeconds) ?? "—"} />
                <StatStripCell
                    label="Calls on record"
                    value={data.totalCalls?.toLocaleString() ?? "—"}
                    unit="all time"
                />
                {/* Only on plans with an allowance, and only once we have a figure we can
                    stand behind — the Call Log carries the full meter and the overage
                    estimate. */}
                {usage.state === "ready" && usage.secondsUsed !== null && (
                    <StatStripCell
                        label="Minutes used"
                        value={duration(usage.secondsUsed)}
                        unit={`of ${usage.minutesCap?.toLocaleString()}m`}
                        tone={usageStatTone(usageLevel(usage.pct))}
                        hint={usageGlance(usage)}
                        href={tabHref("calls", site.slug)}
                    />
                )}
            </StatStrip>
        </div>
    );
}

/**
 * The page's one large figure.
 *
 * Sized from `--text-hero`, which steps once at 1024px rather than using `clamp()` — see the
 * token note in globals.css. `.portal-numeral` gives it tabular figures so the count-up does
 * not reflow the line as digits change.
 */
export function HeroMetric({
    label,
    value,
    delta,
    sub,
    series,
    info,
    tone = "default",
}: {
    label: string;
    value: number;
    delta?: number | null;
    /** Mono metadata, not prose. State a denominator; do not derive a rate. */
    sub?: string;
    series?: number[];
    info?: string;
    tone?: "default" | "positive";
}) {
    const shown = useCountUp(value);

    return (
        <section className="portal-hero">
            <div className="portal-hero-label">
                {label}
                {info && <InfoTip text={info} label={`About ${label}`} />}
            </div>

            <div className="portal-hero-row">
                <span
                    className="portal-numeral portal-hero-num"
                    style={tone === "positive" ? { color: "var(--chart-pos)" } : undefined}
                >
                    {shown.toLocaleString()}
                </span>
                {delta !== null && delta !== undefined && <DeltaBadge delta={delta} />}
            </div>

            {sub && <p className="portal-hero-sub">{sub}</p>}

            {series && series.length > 1 && (
                <div className="portal-hero-spark" aria-hidden="true">
                    <Sparkline data={series} color="var(--chart-series-1)" height={52} />
                </div>
            )}
        </section>
    );
}

function DeltaBadge({ delta }: { delta: number }) {
    const up = delta >= 0;
    const rounded = Math.abs(Math.round(delta));
    return (
        <span
            className="portal-hero-delta"
            style={{
                background: up
                    ? "color-mix(in srgb, var(--chart-pos) 11%, transparent)"
                    : "color-mix(in srgb, var(--chart-neg) 11%, transparent)",
                color: up ? "var(--chart-pos)" : "var(--chart-neg)",
            }}
        >
            {up ? "▲" : "▼"} {rounded}%
            <span className="sr-only"> {up ? "up" : "down"} on the previous period</span>
        </span>
    );
}

/**
 * The demoted numbers: one hairline-divided strip instead of three equal cards.
 *
 * These were full `StatTile`s, which is what made the page read flat — "Calls on record, all
 * time" carried exactly as much weight as the lead count. They are still here because they
 * are still useful; they are just no longer competing.
 */
export function StatStrip({ children }: { children: React.ReactNode }) {
    return <div className="portal-strip">{children}</div>;
}

function StatStripCell({
    label,
    value,
    unit,
    hint,
    href,
    tone,
}: {
    label: string;
    value: string;
    unit?: string;
    hint?: string;
    href?: string;
    tone?: "default" | "positive" | "negative" | "warn";
}) {
    const toneColor =
        tone === "negative"
            ? "var(--chart-neg)"
            : tone === "warn"
              ? "var(--chart-warn)"
              : tone === "positive"
                ? "var(--chart-pos)"
                : undefined;

    const body = (
        <>
            <div className="portal-strip-k">{label}</div>
            <div className="portal-strip-v portal-numeral" style={{ color: toneColor }}>
                {value}
                {unit && <small>{unit}</small>}
            </div>
            {hint && <div className="portal-strip-hint">{hint}</div>}
        </>
    );

    return href ? (
        <Link href={href} className="portal-strip-cell portal-row">
            {body}
        </Link>
    ) : (
        <div className="portal-strip-cell">{body}</div>
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
