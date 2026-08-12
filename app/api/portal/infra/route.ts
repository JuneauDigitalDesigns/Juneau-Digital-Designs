import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getInfraSnapshot } from "@/app/lib/portal-infra";

export const runtime = "nodejs";

/**
 * Live infrastructure state for the Overview health strip.
 *
 * The Overview page renders this server-side and never calls the route, but it exists so a
 * client can refresh the strip without a full navigation, and so the data has one shape
 * whichever way it's reached.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    try {
        const snapshot = await getInfraSnapshot(ctx.site, ctx.account.email);
        return NextResponse.json({ state: "ready", ...snapshot });
    } catch (e) {
        console.error(`[portal/infra] ${ctx.site.slug} failed`, e);
        return NextResponse.json(
            { state: "error", error: "We couldn't check your site's status just now." },
            { status: 502 },
        );
    }
}
