import SettingsTabs from "@/app/components/portal/SettingsTabs";
import { SectionHeader } from "@/app/components/portal/ui/Card";

/**
 * Settings: Account (`/portal/settings`) and Plan & billing (`/portal/settings/billing`).
 *
 * The heading and the two-part switch live here so they stay put while the part beneath them
 * changes. Billing used to be its own tab; it moved in here because what a client pays is
 * account business, and it freed a slot in the phone's tab bar for Analytics.
 */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="space-y-6">
            <SectionHeader title="Settings" />
            <SettingsTabs />
            <div>{children}</div>
        </div>
    );
}
