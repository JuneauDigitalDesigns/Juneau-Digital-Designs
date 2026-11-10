import { Suspense } from "react";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import AnalyticsSection from "@/app/components/portal/analytics/AnalyticsSection";
import { SiteHealth } from "@/app/components/portal/analytics/SiteHealth";
import PortalNoAccess from "@/app/components/portal/PortalNoAccess";
import { HealthStripSkeleton } from "@/app/components/portal/ui/Skeleton";
import { currentSiteContext } from "@/app/lib/portal-dashboard";
import { getInfraSnapshot, type InfraSnapshot } from "@/app/lib/portal-infra";
import { getSiteCalls } from "@/app/lib/portal-overview";
import { listLeads } from "@/app/lib/portal-leads";
import { accountScope } from "@/app/lib/portal-kv";
import { summarizeEnquiries, type EnquirySummary } from "@/app/lib/portal-analytics";
import type { PortalSiteProps } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * Analytics: the old Traffic and Performance tabs on one page, plus site health and the
 * visits → enquiries rate.
 *
 * Traffic and speed are fetched in the browser through the portal's cache, as the two tabs
 * were. What only the server can read is resolved here: the enquiry counts (from the
 * account's own lead records) and the infra snapshot behind Site health, which streams in its
 * own Suspense boundary because it makes a live request to the client's site.
 */
export default async function AnalyticsPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    // See the note in calls/page.tsx: a resolution failure is not a missing URL.
    const ctx = await currentSiteContext(searchParams);
    if (!ctx) return <PortalNoAccess />;
    const { props: site, raw, account } = ctx;

    const enquiries = await loadEnquiries(site, account);

    return (
        <AnalyticsSection
            key={site.slug}
            site={site}
            enquiries={enquiries}
            health={
                <Suspense fallback={<HealthStripSkeleton />}>
                    <HealthBlock site={site} raw={raw} account={account} />
                </Suspense>
            }
        />
    );
}

/**
 * Form enquiries for every range at once, so the 7 / 30 / 90 control never waits on a request.
 *
 * Null rather than zeros when the Inbox is not live for this site or the read fails: "0
 * enquiries" beside real visits would read as a website that converts nobody, which is a claim
 * we would be making about a number we never had.
 */
async function loadEnquiries(site: PortalSiteProps, account: PortalAccount): Promise<EnquirySummary | null> {
    if (site.features.leads.state !== "ready") return null;
    try {
        const leads = await listLeads(accountScope(account.email), site.slug);
        return summarizeEnquiries(
            leads.map((l) => l.createdAt),
            Date.now(),
        );
    } catch (e) {
        console.error(`[portal/analytics] ${site.slug} could not read leads`, e);
        return null;
    }
}

async function HealthBlock({
    site,
    raw,
    account,
}: {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}) {
    const [infra, calls] = await Promise.all([
        // A failed snapshot reads as "Unknown / Not checked" in every cell, which is the truth,
        // rather than throwing to the error boundary and taking the whole page with it.
        getInfraSnapshot(raw, account.email).catch((e) => {
            console.error(`[portal/analytics] ${raw.slug} infra snapshot failed`, e);
            return unknownSnapshot();
        }),
        // The shared, request-deduped call read. Only the latest call's time is used.
        getSiteCalls(account, raw).catch(() => null),
    ]);

    let lastCallAt: string | null = null;
    if (calls?.ok) {
        for (const c of calls.calls) {
            if (c.date && (!lastCallAt || new Date(c.date).getTime() > new Date(lastCallAt).getTime())) {
                lastCallAt = c.date;
            }
        }
    }

    return <SiteHealth infra={infra} calls={site.features.calls} lastCallAt={lastCallAt} slug={site.slug} />;
}

/** Every segment unmeasured: what Site health says when the snapshot itself failed. */
function unknownSnapshot(): InfraSnapshot {
    return {
        site: { state: "unknown", url: null, status: null, ms: null },
        deploy: { state: "unknown", readyAt: null, raw: null, commitMessage: null },
        domain: { state: "unknown", name: null, verified: null },
        credentialsConfigured: true,
        fetchedAt: Date.now(),
    };
}
