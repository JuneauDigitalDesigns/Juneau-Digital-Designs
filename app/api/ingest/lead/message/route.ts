import { NextResponse } from "next/server";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import { appendLeadMessage, resolveIngestToken } from "@/app/lib/portal-leads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A visitor's message for a lead already in the portal, sent by a client site's `/api/contact`
 * when the AI callback couldn't be placed. The site comes from the token, so a site can only
 * ever reach its own leads. No owner text: the one for the lead has already gone.
 */

const MAX_BODY_BYTES = 8 * 1024;

export async function POST(request: Request) {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

    let owner;
    try {
        owner = await resolveIngestToken(token);
    } catch {
        return NextResponse.json({ error: "Lead store unavailable" }, { status: 503 });
    }
    if (!owner) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { success } = await getPortalRatelimit().limit(`ingest-message:${owner.slug}`);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: { leadId?: unknown; message?: unknown };
    try {
        body = JSON.parse(raw) ?? {};
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const leadId = typeof body.leadId === "string" ? body.leadId : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!leadId || !message) {
        return NextResponse.json({ error: "A lead and a message are required" }, { status: 400 });
    }

    try {
        const lead = await appendLeadMessage(owner.acctScope, owner.slug, leadId, message);
        if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
        return NextResponse.json({ ok: true });
    } catch (e) {
        console.error(`[ingest/lead/message] write failed for ${owner.slug}`, e);
        return NextResponse.json({ error: "Could not save the message" }, { status: 502 });
    }
}
