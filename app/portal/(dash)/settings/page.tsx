import SettingsSection from "@/app/components/portal/SettingsSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite, resolveDashboard } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const site = await currentSite(searchParams);
    const ctx = await resolveDashboard();
    if (!site || !ctx) return <PortalNoAccess />;

    return (
        <SettingsSection
            key={site.slug}
            site={site}
            accountEmail={ctx.account.email}
            accountProfile={
                ctx.account.profile
                    ? {
                          contactName: ctx.account.profile.contactName,
                          contactPhone: ctx.account.profile.contactPhone,
                      }
                    : null
            }
        />
    );
}
