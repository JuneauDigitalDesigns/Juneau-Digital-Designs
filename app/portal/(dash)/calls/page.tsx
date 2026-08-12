import CallsSection from "@/app/components/portal/CallsSection";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { currentSite } from "@/app/lib/portal-dashboard";

export const dynamic = "force-dynamic";

export default async function CallsPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    const site = await currentSite(searchParams);
    // Not `notFound()`. This URL exists; what failed is resolving the signed-in client's
    // account, and a bare 404 tells them nothing and offers nowhere to go. The layout above
    // already handles the same condition this way — but a layout cannot suppress its page,
    // which renders as its own segment, so the page has to agree with it or the 404 wins.
    if (!site) return <PortalNoAccess />;
    return <CallsSection key={site.slug} site={site} />;
}
