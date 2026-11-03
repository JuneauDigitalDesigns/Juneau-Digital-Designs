import { NextResponse } from "next/server";
import { resolveDashboard } from "@/app/lib/portal-dashboard";
import { resolveOwnerLink } from "@/app/lib/owner-links";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `/portal/l/<id>` — the link in an owner text. Opens the portal on that one lead.
 *
 * Behind sign-in like the rest of `/portal` (proxy.ts), so a signed-out tap goes through Clerk
 * and comes back here. The decision is `resolveOwnerLink`: the item, only if the link was made
 * for the signed-in account and that account still has the site. Every other case — unknown id,
 * expired id, another account's id, malformed id — gets the SAME redirect to the plain Inbox, so
 * the response says nothing about whether an id exists or whose it is.
 *
 * 303, so a link tapped twice never re-submits anything and caches nowhere.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await resolveDashboard();
    const path = await resolveOwnerLink({ id, viewer: ctx?.account ?? null });
    return NextResponse.redirect(new URL(path, request.url), 303);
}
