import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { cleanReviewTemplate, defaultReviewTemplate } from "@/app/lib/review-template";
import { getReviewTemplate, setReviewTemplate } from "@/app/lib/review-template-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The site's own review message (2026-11-19, set from More › Review message).
 *
 * GET → what a review request will say: the saved message, or the default.
 * PUT { template } → save it. Saving the default's exact words, or nothing, clears the custom
 * one, so a client who changes their mind is back on the standard text (and on any future
 * improvement to it) rather than a frozen copy.
 *
 * Gated on the CRM, which is where the Review button lives. It is a setting, not a send, so it
 * works before carrier approval and the More screen can be filled in ahead of time.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return NextResponse.json({ error: "Review requests come with Growth." }, { status: 403 });
    }
    const fallback = defaultReviewTemplate(ctx.site.name ?? "us");
    const saved = await getReviewTemplate(accountScope(ctx.account.email), ctx.site.slug);
    return NextResponse.json({ template: saved ?? fallback, isDefault: saved === null, defaultTemplate: fallback });
}

export async function PUT(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return NextResponse.json({ error: "Review requests come with Growth." }, { status: 403 });
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const fallback = defaultReviewTemplate(ctx.site.name ?? "us");
    const cleaned = cleanReviewTemplate((body as { template?: unknown } | null)?.template);
    const toStore = cleaned && cleaned !== fallback ? cleaned : null;
    try {
        await setReviewTemplate(accountScope(ctx.account.email), ctx.site.slug, toStore);
    } catch (e) {
        console.error("[review-message] save failed", e);
        return NextResponse.json({ error: "That change didn't save. Please try again." }, { status: 502 });
    }
    return NextResponse.json({ template: toStore ?? fallback, isDefault: toStore === null, defaultTemplate: fallback });
}
