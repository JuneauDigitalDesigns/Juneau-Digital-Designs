import BillingSection from "@/app/components/portal/BillingSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite, resolveDashboard } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function BillingPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const site = await currentSite(searchParams);
    const ctx = await resolveDashboard();
    if (!site || !ctx) return <PortalNoAccess />;
    return <BillingSection key={site.slug} site={site} accountEmail={ctx.account.email} />;
}
