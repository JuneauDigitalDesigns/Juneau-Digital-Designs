import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { getCachedPagespeed, setCachedPagespeed } from "@/app/lib/portal-kv";
import { resolvePortalRequest } from "@/app/lib/portal-account";

export const runtime = "nodejs";

interface PagespeedCategory {
    score: number | null;
}

interface PagespeedAudit {
    numericValue?: number;
}

/**
 * CrUX field data — the p75 of real visits over the trailing 28 days.
 *
 * PSI returns this in the same response as the Lighthouse run, so reading it costs nothing
 * extra. It was previously discarded, which meant a client was shown a simulated
 * throttled-mobile score as if it described their visitors' experience.
 */
interface CruxMetric {
    percentile?: number;
    category?: string; // FAST | AVERAGE | SLOW
}

interface CruxBlock {
    metrics?: {
        LARGEST_CONTENTFUL_PAINT_MS?: CruxMetric;
        CUMULATIVE_LAYOUT_SHIFT_SCORE?: CruxMetric;
        INTERACTION_TO_NEXT_PAINT?: CruxMetric;
        FIRST_CONTENTFUL_PAINT_MS?: CruxMetric;
        EXPERIMENTAL_TIME_TO_FIRST_BYTE?: CruxMetric;
    };
    overall_category?: string;
}

// PageSpeed Insights v5 nests the Lighthouse data under `lighthouseResult`.
interface PagespeedApiResponse {
    lighthouseResult?: {
        categories?: {
            performance?: PagespeedCategory;
        };
        audits?: {
            "largest-contentful-paint"?: PagespeedAudit;
            "cumulative-layout-shift"?: PagespeedAudit;
            "interaction-to-next-paint"?: PagespeedAudit;
            "first-contentful-paint"?: PagespeedAudit;
            "server-response-time"?: PagespeedAudit;
        };
        runtimeError?: { code?: string; message?: string };
    };
    /** Field data for this exact URL. Absent when the page has too few real visits. */
    loadingExperience?: CruxBlock;
    /** Field data for the whole origin — the fallback when the page itself is too quiet. */
    originLoadingExperience?: CruxBlock;
}

export interface FieldVitals {
    lcp: number | null;
    cls: number | null;
    inp: number | null;
    fcp: number | null;
    ttfb: number | null;
    overall: string | null;
    /** Whether these numbers describe this page or the whole origin. */
    source: "page" | "origin";
}

/**
 * CLS is reported by CrUX as an integer scaled by 100 (a p75 of 0.08 arrives as 8), unlike
 * every other metric which is already in milliseconds.
 */
function fieldFrom(block: CruxBlock | undefined, source: "page" | "origin"): FieldVitals | null {
    const m = block?.metrics;
    if (!m) return null;

    const lcp = m.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null;
    const cls = m.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;
    const inp = m.INTERACTION_TO_NEXT_PAINT?.percentile ?? null;
    const fcp = m.FIRST_CONTENTFUL_PAINT_MS?.percentile ?? null;
    const ttfb = m.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile ?? null;

    // A block with no usable metric is the same as no block at all.
    if (lcp === null && cls === undefined && inp === null && fcp === null && ttfb === null) {
        return null;
    }

    return {
        lcp,
        cls: cls === undefined ? null : cls / 100,
        inp,
        fcp,
        ttfb,
        overall: block?.overall_category ?? null,
        source,
    };
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const { site } = ctx;

    // Lifecycle first: a site with no live URL has nothing to measure, and saying so beats
    // the old "Portal not fully configured" 500, which told the client nothing usable.
    const availability = siteFeature(site, "performance");
    if (availability.state !== "ready") {
        return NextResponse.json({ state: availability.state });
    }
    const canonical = site.canonical as string;

    // Cached per SITE per day (UTC) — this IS the per-site rate limit, so each site on a
    // multi-site account gets its own daily score.
    const cached = await getCachedPagespeed(site.slug);
    if (cached) return NextResponse.json({ state: "ready", ...cached, fromCache: true });

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) {
        console.error("[portal/performance] PAGESPEED_API_KEY is not set");
        return NextResponse.json(
            { state: "error", error: "We couldn't load your performance score just now." },
            { status: 502 },
        );
    }

    const psUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    psUrl.searchParams.set("url", canonical);
    psUrl.searchParams.set("strategy", "mobile");
    psUrl.searchParams.set("key", apiKey);
    psUrl.searchParams.set("category", "performance");

    const res = await fetch(psUrl.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
        console.error(`[portal/performance] ${site.slug} PSI ${res.status}`);
        return NextResponse.json(
            { state: "error", error: "We couldn't load your performance score just now." },
            { status: 502 },
        );
    }

    const data = await res.json() as PagespeedApiResponse;
    const lh = data.lighthouseResult;

    // Bail without caching if the analysis didn't produce a usable score (missing
    // lighthouseResult, a runtimeError like ERRORED_DOCUMENT_REQUEST, or a null score).
    // Caching an empty result here is what previously poisoned the daily cache.
    const score = lh?.categories?.performance?.score;
    if (!lh || lh.runtimeError || score == null) {
        console.error(
            `[portal/performance] ${site.slug} no score:`,
            lh?.runtimeError?.message ?? "missing lighthouseResult",
        );
        return NextResponse.json(
            { state: "error", error: "We couldn't score your site on this run." },
            { status: 502 },
        );
    }

    const audits = lh.audits ?? {};

    // Prefer this page's own field data; fall back to the origin's when the page has too
    // few visits for CrUX to report, and to null when the site is too new for either.
    const field =
        fieldFrom(data.loadingExperience, "page") ??
        fieldFrom(data.originLoadingExperience, "origin");

    const result = {
        score: Math.round(score * 100),
        lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        inp: audits["interaction-to-next-paint"]?.numericValue ?? null,
        fcp: audits["first-contentful-paint"]?.numericValue ?? null,
        ttfb: audits["server-response-time"]?.numericValue ?? null,
        field,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
    };

    await setCachedPagespeed(site.slug, result);
    return NextResponse.json({ state: "ready", ...result });
}
