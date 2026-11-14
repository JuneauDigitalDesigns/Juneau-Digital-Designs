import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { declinePage } from "@/app/lib/page-additions-store";

/**
 * "I don't want this page" (W112). Pauses the page for JDD to follow up in the console (Resume or
 * Cancel); never deletes what the client already sent. Signed-in client of the site only.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const requested = new URL(request.url).searchParams.get("site");
    if (requested && ctx.site.slug !== requested) return NextResponse.json({ error: "No portal access" }, { status: 403 });
    let body: { id?: unknown; reason?: unknown };
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (typeof body.id !== "string" || !/^(spoke|town):[a-z0-9-]+(:[a-z0-9-]+)?$/.test(body.id)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const out = await declinePage(ctx.account, ctx.site, body.id, body.reason);
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json({ ok: true });
}
