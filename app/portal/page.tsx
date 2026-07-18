import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardShell from "../components/portal/DashboardShell";
import PortalPending from "../components/portal/PortalPending";
import PortalNoAccess from "../components/portal/PortalNoAccess";
import { getPendingClient, deletePendingClient } from "../lib/pending-client";

export const dynamic = "force-dynamic";

export interface PortalUserMetadata {
    slug: string;
    name?: string;
    plan: "starter" | "growth" | "enterprise";
    // "building" = onboarded + signed up, site not provisioned live yet.
    // Absent ⇒ treat as live (backward compatible with pre-existing clients).
    status?: "building" | "live";
    canonical: string;
    airtableBaseId: string | null;
    vercelProjectId: string | null;
    sites?: Array<{
        slug: string;
        name?: string;
        canonical: string;
        vercelProjectId: string | null;
    }>;
}

export interface PortalClientProps {
    slug: string;
    name: string;
    plan: "starter" | "growth" | "enterprise";
    hasCallData: boolean;
    hasTraffic: boolean;
    isEnterprise: boolean;
    sites?: Array<{ slug: string; name: string; hasTraffic: boolean }>;
}

// Fallback so the header is never blank for clients onboarded before `name`
// was stored: derive a display name from the canonical host, then the slug.
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

export default async function PortalPage() {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in");

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    let meta = user.publicMetadata as Partial<PortalUserMetadata>;

    // Fallback for webhook lag: if this user has no portal access yet, look up
    // their email-keyed pending record and self-heal (mirrors the user.created
    // webhook). Removes any dependence on webhook delivery timing.
    if (!meta.plan) {
        const email =
            user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
            user.emailAddresses[0]?.emailAddress;
        if (email) {
            const pending = await getPendingClient(email);
            if (pending) {
                const provisioned = {
                    slug: pending.slug,
                    plan: pending.plan,
                    name: pending.brandName,
                    status: pending.status,
                };
                await client.users.updateUser(userId, { publicMetadata: provisioned });
                await deletePendingClient(email);
                meta = { ...meta, ...provisioned };
            }
        }
    }

    // Authenticated but no portal access (no metadata + no pending record).
    // Render a terminal page — do NOT redirect to /portal/sign-in, which would
    // loop forever (Clerk bounces signed-in users off sign-in back to /portal).
    if (!meta.plan) return <PortalNoAccess />;

    // Site not built yet — show the "we're building your site" holding page.
    if (meta.status === "building") {
        return (
            <PortalPending
                name={displayName(meta.slug ?? "", meta.name, meta.canonical)}
                plan={meta.plan}
            />
        );
    }

    // Live clients (existing + provisioned) require a slug. Missing here means a
    // malformed record — terminal page rather than a sign-in redirect loop.
    if (!meta.slug) return <PortalNoAccess />;

    const clientProps: PortalClientProps = {
        slug: meta.slug,
        name: displayName(meta.slug, meta.name, meta.canonical),
        plan: meta.plan,
        hasCallData: meta.plan !== "starter" && !!meta.airtableBaseId,
        hasTraffic: !!meta.vercelProjectId,
        isEnterprise: meta.plan === "enterprise",
        sites: meta.sites?.map((s) => ({
            slug: s.slug,
            name: displayName(s.slug, s.name, s.canonical),
            hasTraffic: !!s.vercelProjectId,
        })),
    };

    return <DashboardShell {...clientProps} />;
}
