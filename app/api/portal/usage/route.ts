import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getUsageSummary } from "@/app/lib/portal-usage";

export const runtime = "nodejs";

/**
 * Call-time usage for the selected site's account.
 *
 * No feature gate here — `getUsageSummary` already answers `not-on-plan` for Starter, and
 * duplicating that check would give two places for the plan rules to disagree.
 *
 * `resolvePortalRequest` validates the requested slug against the signed-in account's own
 * sites, so the response can never describe someone else's usage.
 *
 * `?period=previous` is opt-in and cached separately. The Call Log only asks for it when a
 * client actually selects the prior window, so nobody pays for a second Retell query by
 * default, and a prior-period read can never overwrite the current period's figure.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const which =
        new URL(request.url).searchParams.get("period") === "previous" ? "previous" : "current";

    const usage = await getUsageSummary(ctx.account, ctx.site, which);
    return NextResponse.json(usage);
}
