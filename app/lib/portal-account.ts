import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { resolveSite, type PortalAccount, type PortalSite } from "@jdd/schema";
import { getAccount, getCachedAccountByUserId } from "./account-store";
import { getPortalRatelimit } from "./portal-kv";

/**
 * Shared portal request plumbing: resolve the signed-in client's account and the site a
 * request is scoped to. Used by the portal page and every /api/portal/* route so site
 * resolution has exactly one implementation.
 */

interface ClerkEmailLike {
    id: string;
    emailAddress: string;
    verification?: { status?: string | null } | null;
}

/**
 * The client's verified email. Only verified addresses may resolve an account — an
 * unverified sign-up must never inherit a paid client's portal by claiming their address.
 */
export function verifiedEmailOf(user: {
    emailAddresses: ClerkEmailLike[];
    primaryEmailAddressId?: string | null;
}): string | null {
    const verified = user.emailAddresses.filter((e) => e.verification?.status === "verified");
    if (verified.length === 0) return null;
    const primary = verified.find((e) => e.id === user.primaryEmailAddressId);
    return (primary ?? verified[0])?.emailAddress ?? null;
}

/** Look up an account by Clerk user id, falling back to their verified email. */
export async function resolveAccountForUser(userId: string): Promise<PortalAccount | null> {
    // Cached lookup first — this runs on every /api/portal/* request, so it is the hottest
    // path in the portal. Clerk is only consulted when the index genuinely misses.
    const byUser = await getCachedAccountByUserId(userId);
    if (byUser) return byUser;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = verifiedEmailOf(user);
    return email ? getAccount(email) : null;
}

export type PortalRequestContext =
    | { ok: true; userId: string; account: PortalAccount; site: PortalSite }
    | { ok: false; response: NextResponse };

/**
 * Guard for /api/portal/* routes: authenticates, rate limits, resolves the account, and
 * picks the site from `?site=` (falling back to the primary). Never trusts the request
 * for anything but the site slug, which is validated against the account's own sites.
 */
export async function resolvePortalRequest(request: Request): Promise<PortalRequestContext> {
    const { userId } = await auth();
    if (!userId) {
        return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    const rl = getPortalRatelimit();
    const { success } = await rl.limit(userId);
    if (!success) {
        return { ok: false, response: NextResponse.json({ error: "Too many requests" }, { status: 429 }) };
    }

    const account = await resolveAccountForUser(userId);
    if (!account) {
        return { ok: false, response: NextResponse.json({ error: "No portal access" }, { status: 403 }) };
    }

    const siteParam = new URL(request.url).searchParams.get("site");
    const site = resolveSite(account, siteParam);
    if (!site) {
        return { ok: false, response: NextResponse.json({ error: "No sites on this account" }, { status: 404 }) };
    }

    return { ok: true, userId, account, site };
}
