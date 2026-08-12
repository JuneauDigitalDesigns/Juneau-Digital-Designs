import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { fetchCalls, type CallsFailure } from "@/app/lib/airtable-calls";
import { accountScope } from "@/app/lib/portal-kv";

export const runtime = "nodejs";

/**
 * Client-facing failure text.
 *
 * Never leaks the upstream's name. A client has no idea what Airtable is, and telling them
 * "Airtable not configured" (as this route used to, with a 500) turns our misconfiguration
 * into their confusion. The specific cause goes to the server log instead, where it can
 * actually be acted on.
 */
const FAILURE_MESSAGE: Record<CallsFailure, string> = {
    auth: "We're having trouble reaching your call records right now.",
    "missing-table": "We're having trouble reading your call records right now.",
    upstream: "We couldn't load your call log just now.",
};

export async function GET(request: Request) {
    // The site is resolved from the account, never trusted from the request beyond the
    // slug — which resolvePortalRequest validates against the account's own sites.
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // Lifecycle first: an unbuilt or unwired site costs zero upstream calls, and the client
    // gets a truthful reason rather than an empty list that looks like "no one called you".
    const availability = siteFeature(ctx.site, "calls");
    if (availability.state !== "ready") {
        return NextResponse.json({ state: availability.state, calls: [], fields: [] });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) {
        console.error("[portal/calls] AIRTABLE_API_KEY is not set");
        return NextResponse.json(
            { state: "error", error: FAILURE_MESSAGE.auth, calls: [], fields: [] },
            { status: 502 },
        );
    }

    // Only separate rows by site when another site on this account shares the base. That is
    // exactly the enterprise case, and exactly when onboard.js provisions a `Site` column.
    const baseId = ctx.site.airtableBaseId as string;
    const scopeToSite = ctx.account.sites.some(
        (s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId,
    );

    const result = await fetchCalls({
        baseId,
        apiKey,
        siteSlug: ctx.site.slug,
        scopeToSite,
        acctScope: accountScope(ctx.account.email),
    });

    if (!result.ok) {
        console.error(`[portal/calls] ${ctx.site.slug} ${result.failure}: ${result.detail}`);
        return NextResponse.json(
            { state: "error", error: FAILURE_MESSAGE[result.failure], calls: [], fields: [] },
            { status: 502 },
        );
    }

    return NextResponse.json({
        state: "ready",
        calls: result.calls,
        // Which columns this base actually has, so the UI can omit stats it has no source
        // for instead of rendering a zero it cannot stand behind.
        fields: result.fields,
        truncated: result.truncated,
    });
}
