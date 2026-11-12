import CalendarSection from "@/app/components/portal/calendar/CalendarSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

/**
 * The calendar: job visits, estimates, call backs and follow-ups.
 *
 * Gated on `crm`, like Customers. A Starter client gets the page anyway, saying what Growth
 * adds, for the same reason Customers shows its showcase: a locked tab they can open is the only
 * way they learn the feature exists.
 */
export default async function CalendarPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    const site = await currentSite(searchParams);
    if (!site) return <PortalNoAccess />;
    return <CalendarSection key={site.slug} site={site} />;
}
