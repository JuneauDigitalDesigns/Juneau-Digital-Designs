import SettingsSection from "@/app/components/portal/SettingsSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite, resolveDashboard } from "@/app/lib/portal-dashboard";
import { listAccountAgreements } from "@/app/lib/portal-agreements";
import { getConsentStateForAccount } from "@/app/lib/sms-consent";
import { ownerTextCampaign } from "@/app/lib/owner-text-campaign";
import { smsConsentCopy } from "@/app/lib/sms-consent-text";

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

    const agreements = await listAccountAgreements(ctx.account).catch((e) => {
        console.error("[portal/settings] could not list agreements", e);
        return [];
    });

    return (
        <SettingsSection
            key={site.slug}
            site={site}
            accountEmail={ctx.account.email}
            agreements={agreements}
            smsConsent={consent ? { phone: consent.phone, status: consent.status } : null}
            /* Read here, on the server: the browser has no OWNER_TEXT_CAMPAIGN. */
            smsCampaign={ownerTextCampaign()}
            smsConsentCopy={smsConsentCopy()}
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
