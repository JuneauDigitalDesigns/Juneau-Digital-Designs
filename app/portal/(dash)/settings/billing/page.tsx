import { Suspense } from "react";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import BillingSection from "@/app/components/portal/BillingSection";
import { CallMinutes } from "@/app/components/portal/CallMinutes";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { Skeleton } from "@/app/components/portal/ui/Skeleton";
import { currentSiteContext } from "@/app/lib/portal-dashboard";
import { getUsageSummary } from "@/app/lib/portal-usage";

export const dynamic = "force-dynamic";

/**
 * Settings › Plan & billing: what the old Billing tab showed, plus the call-minutes meter.
 *
 * The meter is read on the server (the usage figure needs the raw site record and Retell)
 * and streamed into the client section through a slot, in its own Suspense boundary, so a
 * slow usage read never holds up the invoices.
 */
export default async function PlanAndBillingPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const ctx = await currentSiteContext(searchParams);
    if (!ctx) return <PortalNoAccess />;
    const { props: site, raw, account } = ctx;

    return (
        <BillingSection
            key={site.slug}
            site={site}
            accountEmail={account.email}
            usage={
                <Suspense fallback={<Skeleton height={74} rounded={8} />}>
                    <UsageBlock raw={raw} account={account} />
                </Suspense>
            }
        />
    );
}

async function UsageBlock({ raw, account }: { raw: PortalSite; account: PortalAccount }) {
    // `getUsageSummary` never throws; an outage comes back `unavailable` and the meter hides.
    const usage = await getUsageSummary(account, raw);
    return <CallMinutes usage={usage} />;
}
