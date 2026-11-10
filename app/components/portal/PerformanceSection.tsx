"use client";

import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import { GhostPreview, GhostStat } from "./ui/GhostPreview";
import { Skeleton, StatRowSkeleton } from "./ui/Skeleton";
import { StatusDot, type Status } from "./ui/StatusDot";
import { shortDate } from "./ui/format";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";
import { AnalyticsBlock, Responsive } from "./analytics/AnalyticsHeading";

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

/** Google's own bands, so a colour here matches what PageSpeed says. */
type Band = "good" | "warn" | "poor";

function band(value: number, good: number, warn: number): Band {
    return value <= good ? "good" : value <= warn ? "warn" : "poor";
}

function scoreBand(score: number): Band {
    return score >= 90 ? "good" : score >= 50 ? "warn" : "poor";
}

const BAND_COLOUR: Record<Band, string> = {
    good: "var(--chart-pos)",
    warn: "var(--chart-warn)",
    poor: "var(--chart-neg)",
};

const BAND_DOT: Record<Band, Status> = { good: "ok", warn: "warn", poor: "down" };

/** "Good" / "Needs work" / "Poor": the health strip's existing words for the same bands. */
const BAND_WORD: Record<Band, string> = { good: "Good", warn: "Needs work", poor: "Poor" };

/**
 * The Speed section of Analytics (formerly the Performance tab).
 *
 * The vitals now read as three plain sentences, and the acronyms moved behind "Technical
 * details". A tradesperson does not know what LCP is and should not have to; they do know
 * what "shows up quickly" means.
 *
 * Each approved sentence is only shown when it is literally true of the number: "taps and
 * clicks respond in under a tenth of a second" is not printed for an INP of 150ms, even though
 * Google calls 150ms good. Otherwise the row falls back to the metric's existing plain
 * description and its value, with the band word beside it.
 */
export default function SpeedSection({ site }: { site: PortalSiteProps }) {
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
            <AnalyticsBlock id="speed" title="Speed">
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
            </AnalyticsBlock>
        );
    }

    if (isLoading) {
        return (
            <AnalyticsBlock id="speed" title="Speed">
                <Card className="flex flex-col md:flex-row items-center gap-8">
                    <Skeleton width={112} height={112} rounded="50%" />
                    <div className="flex-1 w-full">
                        <StatRowSkeleton count={3} />
                    </div>
                </Card>
            </AnalyticsBlock>
        );
    }

    if (!data || data.state === "error" || data.score === undefined) {
        return (
            <AnalyticsBlock id="speed" title="Speed">
                <FeatureError message={data?.error} onRetry={retry} />
            </AnalyticsBlock>
        );
    }

    const score = data.score;
    const scoreTone = BAND_COLOUR[scoreBand(score)];
    const field = data.field ?? null;

    // Field data when CrUX has enough real visits, lab otherwise. A client's actual visitors
    // beat a simulated throttled phone every time.
    const lcp = field?.lcp ?? data.lcp ?? null;
    const fcp = field?.fcp ?? data.fcp ?? null;
    const inp = field?.inp ?? data.inp ?? null;
    const cls = field?.cls ?? data.cls ?? null;
    const ttfb = field?.ttfb ?? data.ttfb ?? null;

    const rows: { key: string; band: Band; text: React.ReactNode }[] = [];
    if (lcp !== null) {
        const b = band(lcp, 2500, 4000);
        const seconds = (lcp / 1000).toFixed(1);
        rows.push({
            key: "lcp",
            band: b,
            text:
                b === "good" ? (
                    <Responsive
                        desktop={
                            <>
                                <strong>Shows up quickly.</strong> The main part of the page appears in{" "}
                                {seconds} seconds on a phone.
                            </>
                        }
                        phone={
                            <>
                                <strong>Shows up quickly</strong>: {seconds} seconds on a phone.
                            </>
                        }
                    />
                ) : (
                    // TODO(wording): not approved. The existing metric description plus its value.
                    <>Time until the main content appears: {seconds} seconds</>
                ),
        });
    }
    if (inp !== null) {
        const b = band(inp, 200, 500);
        rows.push({
            key: "inp",
            band: b,
            text:
                inp < 100 ? (
                    <Responsive
                        desktop={
                            <>
                                <strong>Reacts straight away.</strong> Taps and clicks respond in under a
                                tenth of a second.
                            </>
                        }
                        phone={
                            <>
                                <strong>Reacts straight away</strong> to taps.
                            </>
                        }
                    />
                ) : (
                    // TODO(wording): not approved. The existing metric description plus its value.
                    <>Response to a tap or click: {Math.round(inp)} ms</>
                ),
        });
    }
    if (cls !== null) {
        const b = band(cls, 0.1, 0.25);
        rows.push({
            key: "cls",
            band: b,
            text:
                b === "good" ? (
                    <Responsive
                        desktop={
                            <>
                                <strong>Nothing jumps around.</strong> Text and buttons stay put while the
                                page loads.
                            </>
                        }
                        phone={
                            <>
                                <strong>Nothing jumps around</strong> while loading.
                            </>
                        }
                    />
                ) : (
                    // TODO(wording): not approved. The existing metric description plus its value.
                    <>How much the layout shifts while loading: {cls.toFixed(2)}</>
                ),
        });
    }

    const vitals = [
        lcp !== null && `LCP ${(lcp / 1000).toFixed(1)} s`,
        fcp !== null && `FCP ${(fcp / 1000).toFixed(1)} s`,
        inp !== null && `INP ${Math.round(inp)} ms`,
        cls !== null && `CLS ${cls.toFixed(2)}`,
        ttfb !== null && `TTFB ${Math.round(ttfb)} ms`,
    ].filter((v): v is string => Boolean(v));

    return (
        <AnalyticsBlock id="speed" title="Speed">
            <Card density="roomy" className="flex flex-col md:flex-row gap-6 md:gap-8 md:items-start">
                <div className="flex md:flex-col items-center gap-3.5 md:gap-1.5 md:w-36 shrink-0">
                    <div className="relative shrink-0 w-[72px] h-[72px] md:w-[112px] md:h-[112px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadialBarChart
                                cx="50%"
                                cy="50%"
                                innerRadius="80%"
                                outerRadius="100%"
                                startAngle={90}
                                endAngle={-270}
                                data={[{ name: "Score", value: score, fill: scoreTone }]}
                            >
                                {/* A fixed 0–100 domain, so the arc is a score and not a bar that
                                    always looks full regardless of the number beside it. */}
                                <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                                <RadialBar dataKey="value" cornerRadius={8} background={{ fill: "var(--chart-track)" }} />
                            </RadialBarChart>
                        </ResponsiveContainer>
                        <span
                            className="absolute inset-0 flex items-center justify-center font-bold"
                            style={{ fontFamily: "var(--font-display)", fontSize: "clamp(24px, 3vw, 30px)", color: "var(--fg)" }}
                            role="img"
                            aria-label={`Speed score ${score} out of 100`}
                        >
                            <span aria-hidden="true">{score}</span>
                        </span>
                    </div>
                    <div className="flex flex-col md:items-center gap-1">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: scoreTone }}>
                            <StatusDot status={BAND_DOT[scoreBand(score)]} size={8} />
                            {scoreBand(score) === "good" ? "Fast" : BAND_WORD[scoreBand(score)]}
                        </span>
                        {data.fetchedAt && (
                            <span className="text-xs md:text-center" style={{ color: "var(--fg-3)" }}>
                                Tested on a phone, {shortDate(data.fetchedAt)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <ul>
                        {rows.map((r, i) => (
                            <li
                                key={r.key}
                                className="flex items-center gap-3 py-2.5 text-sm"
                                style={{
                                    color: "var(--fg)",
                                    borderTop: i === 0 ? undefined : "1px solid var(--rule-weak)",
                                }}
                            >
                                <StatusDot status={BAND_DOT[r.band]} size={8} />
                                <span className="flex-1 min-w-0" style={{ lineHeight: 1.5 }}>
                                    {r.text}
                                </span>
                                <span className="shrink-0 text-sm font-semibold" style={{ color: BAND_COLOUR[r.band] }}>
                                    {BAND_WORD[r.band]}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <details className="mt-3 group">
                        <summary
                            className="cursor-pointer text-sm font-medium w-fit"
                            style={{ color: "var(--accent)" }}
                        >
                            Technical details
                        </summary>
                        {vitals.length > 0 && (
                            <p
                                className="mt-2.5 text-xs flex flex-wrap gap-x-5 gap-y-1"
                                style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                            >
                                {vitals.map((v) => (
                                    <span key={v}>{v}</span>
                                ))}
                            </p>
                        )}
                        <p className="mt-2.5 text-xs" style={{ color: "var(--fg-3)", lineHeight: 1.5 }}>
                            {field
                                ? `The score is measured once a day by Google PageSpeed Insights on a simulated mobile connection. The figures above come from your real visitors over the last 28 days${field.source === "origin" ? ", across your whole site" : ""}.`
                                : "Measured once a day by Google PageSpeed Insights, on a simulated mobile connection. Once your site has enough visitors, these numbers switch to what real people experience."}
                        </p>
                    </details>
                </div>
            </Card>
        </AnalyticsBlock>
    );
}
