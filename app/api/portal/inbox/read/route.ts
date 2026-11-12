import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { parseReadRequest, setRead } from "@/app/lib/portal-inbox-read";

export const runtime = "nodejs";

/**
 * Mark inbox items read (opening a lead) or unread (Mark unread).
 *
 * Gated on `leads`, like the Inbox and the archive route: every tier has an Inbox, so every
 * tier has read state. Takes a list because opening a row reads every call in it.
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (siteFeature(ctx.site, "leads").state !== "ready") {
        return NextResponse.json({ error: "Not available on this site." }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = parseReadRequest(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    await setRead(accountScope(ctx.account.email), ctx.site.slug, parsed.ids, parsed.read);
    return NextResponse.json({ ok: true, read: parsed.read, count: parsed.ids.length });
}
