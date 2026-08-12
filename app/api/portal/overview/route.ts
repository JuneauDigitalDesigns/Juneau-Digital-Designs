import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getOverviewData } from "@/app/lib/portal-overview";

export const runtime = "nodejs";

/**
 * The overview's headline numbers.
 *
 * Answers the one question a client actually opens the portal with: is this thing earning
 * me money? So it leads with calls, not the PageSpeed score the old dashboard opened on.
 *
 * The computation lives in `app/lib/portal-overview.ts` so the page can render it directly
 * on the server. This route remains for refreshes and for anything that wants the numbers
 * without a navigation.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const data = await getOverviewData(ctx.account, ctx.site);
    const status = data.state === "error" ? 502 : 200;
    return NextResponse.json(data, { status });
}
