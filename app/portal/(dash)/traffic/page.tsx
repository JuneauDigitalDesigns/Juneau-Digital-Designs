import TrafficSection from "@/app/components/portal/TrafficSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function TrafficPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const site = await currentSite(searchParams);
    if (!site) return <PortalNoAccess />;
    return <TrafficSection key={site.slug} site={site} />;
}
