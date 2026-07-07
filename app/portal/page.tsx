import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardShell from "../components/portal/DashboardShell";

export const dynamic = "force-dynamic";

export interface PortalUserMetadata {
    slug: string;
    name?: string;
    plan: "starter" | "growth" | "enterprise";
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
    const meta = user.publicMetadata as Partial<PortalUserMetadata>;

    if (!meta.slug || !meta.plan) redirect("/portal/sign-in");

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
