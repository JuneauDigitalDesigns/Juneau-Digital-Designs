import SupportSection from "@/app/components/portal/SupportSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function SupportPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    const site = await currentSite(searchParams);
    // Same reasoning as the other (dash) pages: this URL exists; what failed is resolving the
    // signed-in client's account, so render the account-level fallback rather than a bare 404.
    if (!site) return <PortalNoAccess />;
    return <SupportSection key={site.slug} site={site} />;
}
