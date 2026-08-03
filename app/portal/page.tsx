import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
    accountFromLegacyMetadata,
    siteHasCallData,
    siteHasTraffic,
    type LegacyPortalMetadata,
    type PortalAccount,
    type PortalPlan,
    type PortalSiteStatus,
} from "@jdd/schema";
import DashboardShell from "../components/portal/DashboardShell";
import PortalPending from "../components/portal/PortalPending";
import PortalNoAccess from "../components/portal/PortalNoAccess";
import { getAccount, getAccountByUserId, saveAccount, linkClerkUser } from "../lib/account-store";

export const dynamic = "force-dynamic";

/** One site as the dashboard needs it. */
export interface PortalSiteProps {
    slug: string;
    name: string;
    plan: PortalPlan;
    status: PortalSiteStatus;
    hasCallData: boolean;
    hasTraffic: boolean;
}

export interface PortalClientProps {
    sites: PortalSiteProps[];
}

// Fallback so the header is never blank for clients onboarded before `name` was stored:
// derive a display name from the canonical host, then the slug.
function displayName(slug: string, name?: string, canonical?: string): string {
    if (name) return name;
    if (canonical) {
        try {
            const host = new URL(canonical).hostname.replace(/^www\./, "");
            if (host) return host;
        } catch { /* fall through to slug */ }
    }
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * The client's verified email. Only verified addresses may resolve an account — an
 * unverified sign-up must never inherit a paid client's portal just by claiming their
 * address.
 */
function verifiedEmailOf(user: {
    emailAddresses: Array<{ id: string; emailAddress: string; verification?: { status?: string } | null }>;
    primaryEmailAddressId?: string | null;
}): string | null {
    const verified = user.emailAddresses.filter((e) => e.verification?.status === "verified");
    if (verified.length === 0) return null;
    const primary = verified.find((e) => e.id === user.primaryEmailAddressId);
    return (primary ?? verified[0]).emailAddress ?? null;
}

export default async function PortalPage() {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in");

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = verifiedEmailOf(user);

    // Resolve the account: by user index first (survives an email change), then by email.
    let account: PortalAccount | null = await getAccountByUserId(userId);
    if (!account && email) account = await getAccount(email);

    // Lazy one-time migration off the legacy Clerk metadata. Order matters: write the
    // record FIRST, and only strip the old fields once that write has succeeded — a strip
    // after a failed write would lock the client out.
    if (!account && email) {
        const legacy = user.publicMetadata as LegacyPortalMetadata | undefined;
        const migrated = accountFromLegacyMetadata(email, legacy);
        if (migrated) {
            await saveAccount(migrated);
            account = migrated;

            // Clear the infra IDs now that nothing reads them. publicMetadata is
            // browser-readable, so leaving airtableBaseId / vercelProjectId there would
            // keep shipping internal identifiers to the client. Best-effort: a failure
            // here must not break the page (we'll simply retry on a later load).
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

    // Authenticated but nothing to show → terminal page. Never redirect to sign-in here:
    // Clerk bounces signed-in users off sign-in back to /portal, which loops forever.
    if (!account || account.sites.length === 0) return <PortalNoAccess />;

    // Bind the Clerk user to the account once, so a later email change can't orphan it.
    if (account.clerkUserId !== userId) {
        account = await linkClerkUser(account, userId);
    }

    const sites: PortalSiteProps[] = account.sites.map((s) => ({
        slug: s.slug,
        name: displayName(s.slug, s.name, s.canonical),
        plan: s.plan,
        status: s.status,
        hasCallData: siteHasCallData(s),
        hasTraffic: siteHasTraffic(s),
    }));

    // Client paid but hasn't completed the wizard yet — send them to complete it.
    const primarySite = account.sites[0];
    if (primarySite?.status === "pending-onboarding") {
        redirect("/portal/onboarding");
    }

    // Wizard submitted but site not yet provisioned — show the holding page.
    if (sites.length === 1 && sites[0].status === "building") {
        return <PortalPending name={sites[0].name} plan={sites[0].plan} />;
    }

    return <DashboardShell sites={sites} />;
}
