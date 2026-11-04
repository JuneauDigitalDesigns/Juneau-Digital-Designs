import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { fetchCalls, type CallsFailure } from "@/app/lib/airtable-calls";
import { accountScope } from "@/app/lib/portal-kv";
import { archivedRefs, promotedRefs } from "@/app/lib/portal-crm";
import { listLeads } from "@/app/lib/portal-leads";
import { buildInbox } from "@/app/lib/crm-contacts";

export const runtime = "nodejs";

/**
 * The Inbox — raw inbound awaiting triage, on every tier.
 *
 * Gated on `leads`, not `calls`: a web-only site has no Airtable base and never will, but does
 * receive web-form enquiries. When the call feature isn't available we return the lead-only
 * inbox rather than an error.
 *
 * Both sources degrade independently. A site with no Airtable base yields a lead-only inbox; a
 * lead-store failure yields a call-only one. Neither blanks an inbox that has usable data in the
 * other half — which is the whole reason they are fetched separately rather than in one helper.
 */

const FAILURE_MESSAGE: Record<CallsFailure, string> = {
    auth: "We're having trouble reaching your call records right now.",
    "missing-table": "We're having trouble reading your call records right now.",
    upstream: "We couldn't load your inbox just now.",
};

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const leadsGate = siteFeature(ctx.site, "leads");
    if (leadsGate.state !== "ready") {
        return NextResponse.json({ state: leadsGate.state, items: [], canPromote: false });
    }

    const acct = accountScope(ctx.account.email);
    const canPromote = siteFeature(ctx.site, "crm").state === "ready";

    // Calls are available only when the receptionist is wired up. A web-only site skips this
    // entirely and still gets a working inbox.
    const callsGate = siteFeature(ctx.site, "calls");
    let calls: Awaited<ReturnType<typeof fetchCalls>> | null = null;

    if (callsGate.state === "ready") {
        const apiKey = process.env.AIRTABLE_API_KEY;
        if (!apiKey) {
            console.error("[portal/inbox] AIRTABLE_API_KEY is not set");
            return NextResponse.json(
                { state: "error", error: FAILURE_MESSAGE.auth, items: [], canPromote },
                { status: 502 },
            );
        }
        const baseId = ctx.site.airtableBaseId as string;
        const scopeToSite = ctx.account.sites.some(
            (s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId,
        );
        calls = await fetchCalls({
            baseId,
            apiKey,
            siteSlug: ctx.site.slug,
            scopeToSite,
            acctScope: acct,
        });
        if (!calls.ok) {
            console.error(`[portal/inbox] ${ctx.site.slug} ${calls.failure}: ${calls.detail}`);
            return NextResponse.json(
                { state: "error", error: FAILURE_MESSAGE[calls.failure], items: [], canPromote },
                { status: 502 },
            );
        }
    }

    const [promoted, archived, leads] = await Promise.all([
        promotedRefs(acct, ctx.site.slug),
        archivedRefs(acct, ctx.site.slug),
        listLeads(acct, ctx.site.slug).catch((e) => {
            console.error(`[portal/inbox] lead read failed for ${ctx.site.slug}`, e);
            return [];
        }),
    ]);

    // Archived items stay in the payload, flagged, exactly as promoted ones do: `filterInbox`
    // keeps them out of the worklist, the archived view needs them, and a deep link from an
    // owner's text has to open one that has since been put away.
    const items = buildInbox({
        calls: calls?.ok ? calls.calls : [],
        leads,
        promoted,
        archived,
    });

    return NextResponse.json({
        state: "ready",
        items,
        canPromote,
        truncated: calls?.ok ? calls.truncated : false,
    });
}
