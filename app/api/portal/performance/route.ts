import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getCachedPagespeed, setCachedPagespeed, getPortalRatelimit } from "@/app/lib/portal-kv";
import type { PortalUserMetadata } from "@/app/portal/page";

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

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rl = getPortalRatelimit();
    const { success } = await rl.limit(userId);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata as Partial<PortalUserMetadata>;

    if (!meta.slug || !meta.canonical) {
        return NextResponse.json({ error: "Portal not fully configured" }, { status: 500 });
    }

    // Return cached result if already fetched today (UTC) — this IS the per-client rate limit
    const cached = await getCachedPagespeed(meta.slug);
    if (cached) return NextResponse.json({ ...cached, fromCache: true });

    const apiKey = process.env.PAGESPEED_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "PageSpeed not configured" }, { status: 500 });

    const psUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
    psUrl.searchParams.set("url", meta.canonical);
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

    await setCachedPagespeed(meta.slug, result);
    return NextResponse.json(result);
}
