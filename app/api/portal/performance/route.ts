import { NextResponse } from "next/server";
import { getCachedPagespeed, setCachedPagespeed } from "@/app/lib/portal-kv";
import { resolvePortalRequest } from "@/app/lib/portal-account";

export const runtime = "nodejs";

interface PagespeedCategory {
    score: number | null;
}

interface PagespeedAudit {
    numericValue?: number;
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
        };
        runtimeError?: { code?: string; message?: string };
    };
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const { site } = ctx;

    if (!site.canonical) {
        return NextResponse.json({ error: "Portal not fully configured" }, { status: 500 });
    }

    // Cached per SITE per day (UTC) — this IS the per-site rate limit, so each site on a
    // multi-site account gets its own daily score.
    const cached = await getCachedPagespeed(site.slug);
    if (cached) return NextResponse.json({ ...cached, fromCache: true });

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "PageSpeed not configured" }, { status: 500 });

    const psUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    psUrl.searchParams.set("url", site.canonical);
    psUrl.searchParams.set("strategy", "mobile");
    psUrl.searchParams.set("key", apiKey);
    psUrl.searchParams.set("category", "performance");

    const res = await fetch(psUrl.toString(), { next: { revalidate: 0 } });
    if (!res.ok) {
        return NextResponse.json({ error: "PageSpeed API error" }, { status: 502 });
    }

    const data = await res.json() as PagespeedApiResponse;
    const lh = data.lighthouseResult;

    // Bail without caching if the analysis didn't produce a usable score (missing
    // lighthouseResult, a runtimeError like ERRORED_DOCUMENT_REQUEST, or a null score).
    // Caching an empty result here is what previously poisoned the daily cache.
    const score = lh?.categories?.performance?.score;
    if (!lh || lh.runtimeError || score == null) {
        return NextResponse.json(
            { error: lh?.runtimeError?.message ?? "PageSpeed returned no score" },
            { status: 502 },
        );
    }

    const audits = lh.audits ?? {};

    const result = {
        score: Math.round(score * 100),
        lcp: audits["largest-contentful-paint"]?.numericValue ?? null,
        cls: audits["cumulative-layout-shift"]?.numericValue ?? null,
        inp: audits["interaction-to-next-paint"]?.numericValue ?? null,
        fcp: audits["first-contentful-paint"]?.numericValue ?? null,
        fetchedAt: new Date().toISOString(),
        fromCache: false,
    };

    await setCachedPagespeed(site.slug, result);
    return NextResponse.json(result);
}
