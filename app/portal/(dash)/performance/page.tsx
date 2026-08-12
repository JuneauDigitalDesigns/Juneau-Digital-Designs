import PerformanceSection from "@/app/components/portal/PerformanceSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function PerformancePage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const site = await currentSite(searchParams);
    if (!site) return <PortalNoAccess />;
    return <PerformanceSection key={site.slug} site={site} />;
}
