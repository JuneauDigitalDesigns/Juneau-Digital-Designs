import InboxSection from "@/app/components/portal/InboxSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

/**
 * The Inbox.
 *
 * Still served from `/portal/calls`: the route is in every existing bookmark, email link and
 * tour anchor, and the surface it renders is a superset of what the old Call Log showed. The
 * nav label and the heading both say "Inbox"; only the path kept its old name.
 */
export default async function InboxPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // Not `notFound()`. This URL exists; what failed is resolving the signed-in client's
    // account, and a bare 404 tells them nothing and offers nowhere to go.
    const site = await currentSite(searchParams);
    if (!site) return <PortalNoAccess />;
    return <InboxSection key={site.slug} site={site} />;
}
