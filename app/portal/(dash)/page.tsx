import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { HealthStrip } from "@/app/components/portal/HealthStrip";
import { BuildProgress } from "@/app/components/portal/BuildProgress";
import {
    GrowthProvisioning,
    isProvisioningGrowth,
} from "@/app/components/portal/GrowthProvisioning";
import {
    OverviewMetrics,
    LatestCalls,
    OverviewAside,
} from "@/app/components/portal/OverviewSection";
import { SectionHeader, Card } from "@/app/components/portal/ui/Card";
import {
    StatRowSkeleton,
    HealthStripSkeleton,
    Skeleton,
} from "@/app/components/portal/ui/Skeleton";
import { currentSiteContext } from "@/app/lib/portal-dashboard";
import { getInfraSnapshot } from "@/app/lib/portal-infra";
import { getOverviewData, getCachedScore } from "@/app/lib/portal-overview";
import { getTrafficData } from "@/app/lib/portal-traffic";
import { getBillingSummary } from "@/app/lib/portal-billing-summary";
import { getUsageSummary } from "@/app/lib/portal-usage";
import type { PortalSiteProps } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * The Overview: the client's whole web presence at a glance.
 *
 * Rendered on the server, streamed per module. The page used to be a client component that
 * `fetch()`ed its own API from a `useEffect`, so every visit flashed a skeleton even though
 * the layout above had already awaited the account from KV.
 *
 * Each module is its own Suspense boundary because their upstreams have wildly different
 * latencies — the infra probe is a live HTTP request, Airtable can paginate, Stripe is a
 * round trip. One shared boundary would make the whole page wait for the slowest.
 */
export default async function OverviewPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string; upgraded?: string }>;
}) {
    const ctx = await currentSiteContext(searchParams);
    if (!ctx) notFound();

    const { upgraded } = await searchParams;
    const { props: site, raw, account } = ctx;

    /**
     * A site that has been paid for but never described. There is no dashboard to draw for
     * it — no deployment, no domain, no agent — so the wizard *is* this site's Overview.
     *
     * Scoped to the selected site rather than the account, which is the whole fix. The old
     * check lived in the layout and asked only about `sites[0]`, so an existing client's
     * second purchase was invisible; asking `.some()` there instead would have held their
     * working site hostage to an unrelated new one. Here, a client with one live site and one
     * pending site gets a normal dashboard on the first and the wizard on the second, and can
     * switch between them freely with the site selector still in the chrome above.
     */
    if (raw.status === "pending-onboarding") {
        redirect(`/portal/onboarding?site=${encodeURIComponent(site.slug)}`);
    }

    const building = site.status !== "live";

    // Only softens the tracker's opening line. It used to be its own card, which meant the
    // acknowledgement disappeared on the next navigation while the wait it described carried
    // on for another day or two.
    const justUpgraded = upgraded === "1";

    // A paid tier whose call feature isn't ready yet is mid-provisioning. Derived rather than
    // stored — see `isProvisioningGrowth`. Renders alongside the build tracker when a site is
    // both building and upgraded: two independent tracks, not one merged timeline.
    const provisioningGrowth = isProvisioningGrowth(site, site.features.calls);

    return (
        <div className="space-y-6" key={site.slug}>
            <SectionHeader
                title={building ? "Your site is being built" : "Overview"}
                meta={building ? undefined : "Everything we watch for you, live"}
            />

            {provisioningGrowth && (
                <GrowthProvisioning
                    site={site}
                    calls={site.features.calls}
                    justUpgraded={justUpgraded}
                />
            )}

            {building ? (
                <Suspense fallback={<HealthStripSkeleton />}>
                    <BuildBlock site={site} raw={raw} account={account} />
                </Suspense>
            ) : (
                <>
                    <Suspense fallback={<HealthStripSkeleton />}>
                        <HealthBlock site={site} raw={raw} account={account} />
                    </Suspense>

                    <Suspense fallback={<StatRowSkeleton count={5} />}>
                        <MetricsBlock site={site} raw={raw} account={account} />
                    </Suspense>

                    <div className="portal-band">
                        <Suspense fallback={<FeedSkeleton />}>
                            <FeedBlock site={site} raw={raw} account={account} />
                        </Suspense>
                        <Suspense fallback={<AsideSkeleton />}>
                            <AsideBlock site={site} raw={raw} account={account} />
                        </Suspense>
                    </div>
                </>
            )}
        </div>
    );
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
    const [infra, score] = await Promise.all([
        getInfraSnapshot(raw, account.email),
        getCachedScore(raw.slug),
    ]);
    return (
        <HealthStrip
            infra={infra}
            score={score}
            slug={site.slug}
            calls={site.features.calls}
            billingLinked={site.billingLinked}
        />
    );
}

async function BuildBlock({
    site,
    raw,
    account,
}: {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}) {
    // A build in flight is exactly when infra can fail in interesting ways, so this must
    // never be the thing that takes the page down.
    const infra = await getInfraSnapshot(raw, account.email).catch(() => null);
    return <BuildProgress site={site} infra={infra} />;
}

async function MetricsBlock({
    site,
    raw,
    account,
}: {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}) {
    const [data, usage] = await Promise.all([
        getOverviewData(account, raw),
        getUsageSummary(account, raw),
    ]);
    return <OverviewMetrics site={site} data={data} usage={usage} />;
}

async function FeedBlock({
    site,
    raw,
    account,
}: {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}) {
    // React dedupes this against MetricsBlock's identical call within the same request, so
    // the two boundaries share one Airtable read.
    const data = await getOverviewData(account, raw);
    return <LatestCalls site={site} data={data} />;
}

async function AsideBlock({
    site,
    raw,
    account,
}: {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}) {
    const [traffic, billing] = await Promise.all([
        getTrafficData(raw, account.email),
        getBillingSummary(raw, account.email),
    ]);
    return <OverviewAside site={site} traffic={traffic} billing={billing} />;
}

function FeedSkeleton() {
    return (
        <Card className="flex flex-col gap-4">
            <Skeleton width="30%" height={9} />
            {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton width="45%" height={13} />
                    <Skeleton width="85%" height={11} />
                </div>
            ))}
        </Card>
    );
}

function AsideSkeleton() {
    return (
        <div className="flex flex-col gap-4">
            <Card className="flex flex-col gap-3">
                <Skeleton width="40%" height={9} />
                <Skeleton width="55%" height={30} />
                <Skeleton height={40} rounded={6} />
            </Card>
            <Card density="compact" className="flex flex-col gap-2">
                <Skeleton width="45%" height={12} />
                <Skeleton width="70%" height={9} />
            </Card>
        </div>
    );
}
