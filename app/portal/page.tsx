import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import DashboardShell from "../components/portal/DashboardShell";

export const dynamic = "force-dynamic";

export interface PortalUserMetadata {
    slug: string;
    plan: "starter" | "growth" | "enterprise";
    canonical: string;
    airtableBaseId: string | null;
    ga4PropertyId: string | null;
    sites?: Array<{
        slug: string;
        canonical: string;
        ga4PropertyId: string | null;
    }>;
}

export interface PortalClientProps {
    slug: string;
    plan: "starter" | "growth" | "enterprise";
    hasCallData: boolean;
    hasGA4: boolean;
    isEnterprise: boolean;
    sites?: Array<{ slug: string; hasGA4: boolean }>;
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
        plan: meta.plan,
        hasCallData: meta.plan !== "starter" && !!meta.airtableBaseId,
        hasGA4: !!meta.ga4PropertyId,
        isEnterprise: meta.plan === "enterprise",
        sites: meta.sites?.map((s) => ({ slug: s.slug, hasGA4: !!s.ga4PropertyId })),
    };

    return <DashboardShell {...clientProps} />;
}
