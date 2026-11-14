import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveFacts, type FactsInput } from "@/app/lib/page-additions-store";

/**
 * The client's facts for one proposed page: "Save and finish later" (`submit: false`) or "Send to
 * Juneau Digital Designs" (`submit: true`). Signed-in client of the site only, as every portal
 * route. Nothing here publishes: the facts reach the console intake tagged Client, and JDD checks
 * them before any export.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const requested = new URL(request.url).searchParams.get("site");
    if (requested && ctx.site.slug !== requested) return NextResponse.json({ error: "No portal access" }, { status: 403 });
    let body: FactsInput & { id?: unknown; submit?: unknown };
    try {
        body = (await request.json()) as typeof body;
    } catch {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    if (typeof body.id !== "string" || !/^(spoke|town):[a-z0-9-]+(:[a-z0-9-]+)?$/.test(body.id)) {
        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const out = await saveFacts(ctx.account, ctx.site, body.id, body, { submit: body.submit === true });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: out.status });
    return NextResponse.json(out);
}
