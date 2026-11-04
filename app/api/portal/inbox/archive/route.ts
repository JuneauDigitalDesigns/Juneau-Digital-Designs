import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { setArchived } from "@/app/lib/portal-crm";
import { isDeepLinkId } from "@/app/lib/crm-contacts";

export const runtime = "nodejs";

/**
 * Put inbox items away, or bring them back.
 *
 * Gated on `leads`, like the Inbox itself rather than on `crm`: archiving is housekeeping on
 * the worklist, and a Starter client with no customer board still needs to clear a robocall.
 *
 * Takes a list because a row is usually every call one person made, and archiving a row has to
 * be one action and one undo. Ids are checked against the two real shapes before they reach a
 * KV key — the same guard the deep links use.
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
    const b = (body ?? {}) as Record<string, unknown>;

    const ids = Array.isArray(b.ids)
        ? b.ids.filter((v): v is string => typeof v === "string" && isDeepLinkId(v))
        : [];
    if (ids.length === 0) {
        return NextResponse.json({ error: "Nothing to archive" }, { status: 400 });
    }
    // A row is one caller's run of calls; a hundred is someone else's script.
    if (ids.length > 100) {
        return NextResponse.json({ error: "Too many items at once" }, { status: 400 });
    }

    const archived = b.archived !== false;
    await setArchived(
        accountScope(ctx.account.email),
        ctx.site.slug,
        ids,
        archived,
        ctx.userId,
    );

    return NextResponse.json({ ok: true, archived, count: ids.length });
}
