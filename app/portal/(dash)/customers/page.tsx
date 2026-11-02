import CustomersSection from "@/app/components/portal/crm/CustomersSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

/**
 * The customer CRM.
 *
 * Gated on `crm` (growth/enterprise + live). A Starter client is not redirected or 404'd — the
 * section renders the upsell showcase instead, because a locked tab they can open is the only
 * way they learn the feature exists.
 */
export default async function CustomersPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // Same reasoning as the Inbox: a resolution failure is not a missing URL.
    const site = await currentSite(searchParams);
    if (!site) return <PortalNoAccess />;
    return <CustomersSection key={site.slug} site={site} />;
}
