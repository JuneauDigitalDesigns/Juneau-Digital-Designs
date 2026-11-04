import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { deleteLead } from "@/app/lib/portal-leads";
import { setArchived } from "@/app/lib/portal-crm";
import { isDeepLinkId } from "@/app/lib/crm-contacts";

export const runtime = "nodejs";

/**
 * Delete one web enquiry for good.
 *
 * **Web enquiries only.** A call item's id names a row in the client's Airtable call log, with a
 * recording attached, read by the client and by the ops console. Deleting one would destroy a
 * third party's record from a portal that otherwise only reads it, with no undo — so a `rec…`
 * id is refused here rather than handled. Archiving covers the same need for calls.
 *
 * The id is shape-checked before anything touches a KV key, and must then be a `lead:` id. The
 * two checks are separate on purpose: one rejects a malformed id, the other rejects a
 * well-formed id of the wrong kind, and they deserve different answers.
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
    const id = (body as Record<string, unknown>)?.id;

    if (typeof id !== "string" || !isDeepLinkId(id)) {
        return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }
    if (!id.startsWith("lead:")) {
        return NextResponse.json(
            { error: "Calls can't be deleted. They live in your call log." },
            { status: 400 },
        );
    }

    const acct = accountScope(ctx.account.email);
    const leadId = id.slice("lead:".length);

    const existed = await deleteLead(acct, ctx.site.slug, leadId);
    // Whether or not the record was there, clear its archive entry: a stale id would otherwise
    // keep counting towards the archived total for the full backstop TTL.
    await setArchived(acct, ctx.site.slug, [id], false, ctx.userId);

    if (!existed) {
        return NextResponse.json({ error: "That enquiry is already gone." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
