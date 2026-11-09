import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { AIRTABLE_RECORD_ID } from "@/app/lib/call-brief";
import { audioContentType, forgetRecordingLink, resolveRecordingLink } from "@/app/lib/call-recording";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope, getRecordingRatelimit } from "@/app/lib/portal-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Plays one call's recording to the signed-in owner of that account.
 *
 * The audio is streamed through this route so the vendor's link never reaches the browser. That
 * matters most for calls made before signed links were turned on: those links never expire, so
 * one that reached a browser could be copied and would work forever. The only address a browser
 * sees is this one, and it answers nobody but the owner.
 *
 * A streamed response is also what lets a recording through at all. A buffered Vercel response
 * is capped at 4.5 MB, and a test call's WAV measured 5.5 MB.
 *
 * Every refusal is the same 404, so this can't be used to learn which record ids exist.
 */
const NOT_FOUND = () => NextResponse.json({ error: "Recording not available" }, { status: 404 });

/** Passed through so seeking works. S3 answers these for itself. */
const FORWARDED_HEADERS = ["content-length", "content-range", "accept-ranges"];

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await resolvePortalRequest(request, getRecordingRatelimit());
    if (!ctx.ok) return ctx.response;

    const { id } = await params;
    if (!AIRTABLE_RECORD_ID.test(id)) return NOT_FOUND();
    if (siteFeature(ctx.site, "calls").state !== "ready") return NOT_FOUND();

    const airtableKey = process.env.AIRTABLE_API_KEY;
    if (!airtableKey) {
        console.error("[portal/recording] AIRTABLE_API_KEY is not set");
        return NOT_FOUND();
    }

    const baseId = ctx.site.airtableBaseId as string;
    const scope = {
        baseId,
        airtableKey,
        retellKey: process.env.RETELL_API_KEY,
        recordId: id,
        siteSlug: ctx.site.slug,
        scopeToSite: ctx.account.sites.some((s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId),
        agentId: ctx.site.retellAgentId ?? null,
        acctScope: accountScope(ctx.account.email),
    };

    const link = await resolveRecordingLink(scope);
    if (!link) return NOT_FOUND();

    const range = request.headers.get("range");
    let upstream: Response;
    try {
        upstream = await fetch(link, {
            headers: range ? { Range: range } : {},
            redirect: "error",
            cache: "no-store",
        });
    } catch (e) {
        console.error("[portal/recording] upstream fetch failed", e);
        return NOT_FOUND();
    }

    if (!upstream.ok || !upstream.body) {
        // Most often a stored link that has expired. Never log the link: it is the credential.
        console.warn(`[portal/recording] ${ctx.site.slug} upstream ${upstream.status}`);
        await forgetRecordingLink(scope);
        return NOT_FOUND();
    }

    const headers = new Headers({
        "Content-Type": audioContentType(link),
        "Cache-Control": "private, no-store",
    });
    for (const name of FORWARDED_HEADERS) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }

    return new Response(upstream.body, { status: upstream.status, headers });
}
