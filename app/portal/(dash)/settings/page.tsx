import SettingsSection from "@/app/components/portal/SettingsSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite, resolveDashboard } from "@/app/lib/portal-dashboard";
import { getConsentStateForAccount } from "@/app/lib/sms-consent";

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

    // Consent is keyed by account, not by site: one owner, one cell phone, however many
    // sites they run. A missing record simply means they never opted in.
    const consent = await getConsentStateForAccount(ctx.account.email).catch(() => null);

    return (
        <SettingsSection
            key={site.slug}
            site={site}
            accountEmail={ctx.account.email}
            smsConsent={consent ? { phone: consent.phone, status: consent.status } : null}
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
