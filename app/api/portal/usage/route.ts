import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getUsageSummary } from "@/app/lib/portal-usage";

export const runtime = "nodejs";

/**
 * Call-minute usage for the selected site's account.
 *
 * No feature gate here — `getUsageSummary` already answers `not-on-plan` for Starter, and
 * duplicating that check would give two places for the plan rules to disagree.
 *
 * `resolvePortalRequest` validates the requested slug against the signed-in account's own
 * sites, so the response can never describe someone else's usage.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const usage = await getUsageSummary(ctx.account, ctx.site);
    return NextResponse.json(usage);
}
