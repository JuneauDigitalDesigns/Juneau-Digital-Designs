import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getTrafficData } from "@/app/lib/portal-traffic";

export const runtime = "nodejs";

/**
 * Vercel Web Analytics for the Traffic tab.
 *
 * The queries live in `app/lib/portal-traffic.ts` so the Overview sparkline reads the same
 * hour-cached payload rather than firing its own three upstream requests. This route used
 * to be the portal's only fully-uncached upstream — three live Vercel queries on every
 * render, against a 30-day window that changes once a day.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // `reason` is operator state — it names our own missing configuration. It stays in the
    // server log and the ops audit; it does not travel to a client's browser.
    const data = { ...(await getTrafficData(ctx.site, ctx.account.email)) };
    delete data.reason;

    // Only a genuine upstream failure is a 502. A site we haven't finished wiring up is a
    // successful answer to "what's my traffic" — the answer is "not yet".
    const status = data.state === "error" ? 502 : 200;
    return NextResponse.json(data, { status });
}
