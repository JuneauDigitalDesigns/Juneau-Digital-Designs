import "server-only";
import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
    accountFromLegacyMetadata,
    siteFeatures,
    type LegacyPortalMetadata,
    type PortalAccount,
    type PortalSite,
} from "@jdd/schema";
import {
    getAccount,
    getCachedAccountByUserId,
    saveAccount,
    linkClerkUser,
} from "./account-store";
import { verifiedEmailOf } from "./portal-account";
import { selectSite, type PortalSiteProps } from "@/app/portal/types";
import { hasBillingLink } from "./plan-billing";

/**
 * Resolve the signed-in client's dashboard context.
 *
 * Wrapped in React `cache()` so the layout and the page beneath it share one resolution
 * per request instead of each hitting Clerk and KV. Tabs are real routes now, so without
 * this every navigation would double the reads the old single-page dashboard did.
 *
 * Returns `null` for "authenticated but nothing to show" — callers decide whether that
 * means the no-access page or a redirect.
 */
export const resolveDashboard = cache(async (): Promise<{
    account: PortalAccount;
    sites: PortalSiteProps[];
} | null> => {
    // Every `return null` below is logged with its reason. This function had three silent
    // exits, and "the portal 404s" gave no way to tell them apart from the outside — the
    // absence of these lines cost real debugging time.
    const { userId } = await auth();
    if (!userId) {
        console.warn("[portal] resolveDashboard: no signed-in user");
        return null;
    }

    // The user-id index first, and *only* reach for Clerk if it misses.
    //
    // This used to call `clerkClient().users.getUser()` unconditionally, on every single
    // navigation, for an email that established clients never need — the index already
    // resolves them. That was a network round trip on the critical path of every tab
    // switch. The email is still fetched below for the two cases that genuinely need it:
    // a first sign-in whose index entry doesn't exist yet, and the legacy migration.
    let account: PortalAccount | null = await getCachedAccountByUserId(userId);

    let client: Awaited<ReturnType<typeof clerkClient>> | null = null;
    let user: Awaited<ReturnType<Awaited<ReturnType<typeof clerkClient>>["users"]["getUser"]>> | null = null;
    let email: string | null = null;

    if (!account) {
        client = await clerkClient();
        user = await client.users.getUser(userId);
        email = verifiedEmailOf(user);
        if (email) account = await getAccount(email);
    }

    // Lazy one-time migration off the legacy Clerk metadata. Order matters: write the
    // record FIRST, and only strip the old fields once that write has succeeded — a strip
    // after a failed write would lock the client out.
    if (!account && email && client && user) {
        const legacy = user.publicMetadata as LegacyPortalMetadata | undefined;
        const migrated = accountFromLegacyMetadata(email, legacy);
        if (migrated) {
            await saveAccount(migrated);
            account = migrated;

            // Clear the infra IDs now that nothing reads them. publicMetadata is
            // browser-readable, so leaving airtableBaseId / vercelProjectId there would
            // keep shipping internal identifiers to the client. Best-effort: a failure
            // here must not break the page (we'll retry on a later load).
            try {
                await client.users.updateUserMetadata(userId, {
                    publicMetadata: {
                        slug: null,
                        name: null,
                        plan: null,
                        status: null,
                        canonical: null,
                        airtableBaseId: null,
                        vercelProjectId: null,
                        sites: null,
                    },
                });
            } catch (e) {
                console.error("[portal] legacy metadata strip failed", userId, e);
            }
        }
    }

    if (!account) {
        console.warn(
            "[portal] resolveDashboard: no account for user",
            userId,
            email ? `(email ${email})` : "(no verified email on the Clerk user)",
        );
        return null;
    }
    if (account.sites.length === 0) {
        console.warn("[portal] resolveDashboard: account has no sites", account.email);
        return null;
    }

    // Bind the Clerk user to the account once, so a later email change can't orphan it.
    if (account.clerkUserId !== userId) {
        account = await linkClerkUser(account, userId);
    }

    const sites: PortalSiteProps[] = account.sites.map((s) => ({
        slug: s.slug,
        name: displayName(s.slug, s.name, s.canonical),
        canonical: s.canonical?.trim() || null,
        billingLinked: hasBillingLink(s),
        plan: s.plan,
        status: s.status,
        features: siteFeatures(s),
        featured: s.featured ?? null,
        cancelRequestedAt: s.cancelRequestedAt ?? null,
        cancelEffectiveAt: s.cancelEffectiveAt ?? null,
    }));

    return { account, sites };
});

/**
 * The site a dashboard page is scoped to. Pages call this instead of re-deriving the
 * selection rule, so the nav's idea of the current site and the panel's always agree.
 */
export async function currentSite(
    searchParams: Promise<{ site?: string }>,
): Promise<PortalSiteProps | null> {
    const ctx = await resolveDashboard();
    if (!ctx) return null;
    const requested = (await searchParams).site;
    return selectSite(ctx.sites, requested) ?? ctx.sites[0] ?? null;
}

/**
 * The current site plus its raw KV record and account.
 *
 * Server components that fetch data need the raw `PortalSite` — `airtableBaseId`,
 * `vercelProjectId` and `canonical` are infra identifiers that are deliberately kept out of
 * `PortalSiteProps`, because those props are serialised into the browser.
 */
export async function currentSiteContext(
    searchParams: Promise<{ site?: string }>,
): Promise<{ props: PortalSiteProps; raw: PortalSite; account: PortalAccount } | null> {
    const ctx = await resolveDashboard();
    if (!ctx) return null;

    const requested = (await searchParams).site;
    const props = selectSite(ctx.sites, requested) ?? ctx.sites[0];
    if (!props) return null;

    const raw = ctx.account.sites.find((s) => s.slug === props.slug);
    if (!raw) return null;

    return { props, raw, account: ctx.account };
}

/**
 * Fallback so the header is never blank for clients onboarded before `name` was stored:
 * derive a display name from the canonical host, then the slug.
 */
function displayName(slug: string, name?: string, canonical?: string): string {
    if (name) return name;
    if (canonical) {
        try {
            const host = new URL(canonical).hostname.replace(/^www\./, "");
            if (host) return host;
        } catch {
            /* fall through to slug */
        }
    }
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
