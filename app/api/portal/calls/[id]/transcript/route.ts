import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { AIRTABLE_RECORD_ID } from "@/app/lib/call-brief";
import { resolveTranscript } from "@/app/lib/call-recording";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope, getRecordingRatelimit } from "@/app/lib/portal-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One call's transcript, turn by turn, for the signed-in owner of that account (2026-11-19,
 * Xander: "We should have a transcript for each call").
 *
 * Read from Retell at request time, through the same lookup the recording uses, so nothing new is
 * stored in the call log. Shares the recording's rate limit: the two are opened together.
 *
 * Every refusal, and a call with no transcript, is the same 404, so this can't be used to learn
 * which record ids exist. The page shows "There’s no transcript for this call." for it.
 */
const NOT_FOUND = () => NextResponse.json({ error: "Transcript not available" }, { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await resolvePortalRequest(request, getRecordingRatelimit());
    if (!ctx.ok) return ctx.response;

    const { id } = await params;
    if (!AIRTABLE_RECORD_ID.test(id)) return NOT_FOUND();
    if (siteFeature(ctx.site, "calls").state !== "ready") return NOT_FOUND();

    const airtableKey = process.env.AIRTABLE_API_KEY;
    if (!airtableKey) {
        console.error("[portal/transcript] AIRTABLE_API_KEY is not set");
        return NOT_FOUND();
    }

    const baseId = ctx.site.airtableBaseId as string;
    const turns = await resolveTranscript({
        baseId,
        airtableKey,
        retellKey: process.env.RETELL_API_KEY,
        recordId: id,
        siteSlug: ctx.site.slug,
        scopeToSite: ctx.account.sites.some((s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId),
        agentId: ctx.site.retellAgentId ?? null,
        acctScope: accountScope(ctx.account.email),
    });
    if (!turns) return NOT_FOUND();

    return NextResponse.json({ turns }, { headers: { "Cache-Control": "private, no-store" } });
}
