import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { BuildProgress } from "@/app/components/portal/BuildProgress";
import {
    GrowthProvisioning,
    isProvisioningReceptionist,
} from "@/app/components/portal/GrowthProvisioning";
import { PendingSiteBanner } from "@/app/components/portal/PendingSiteBanner";
import { SectionHeader, Card } from "@/app/components/portal/ui/Card";
import { FeatureError, FeatureState } from "@/app/components/portal/ui/FeatureState";
import {
    HealthStripSkeleton,
    Skeleton,
    StatRowSkeleton,
} from "@/app/components/portal/ui/Skeleton";
import { ActivityFeed } from "@/app/components/portal/overview/ActivityFeed";
import { LeadsWeekCard } from "@/app/components/portal/overview/LeadsWeekCard";
import { NeedsYouCard } from "@/app/components/portal/overview/NeedsYouCard";
import {
    OverviewHeader,
    StatusLine,
    greetingLine,
} from "@/app/components/portal/overview/OverviewHeader";
import {
    OverviewTiles,
    afterHoursTile,
    callbackSpeedTile,
    followUpsTile,
    handledTile,
    longestWaitTile,
    reviewsTile,
    type TileSpec,
} from "@/app/components/portal/overview/OverviewTiles";
import { GrowthLockedPanel, PipelineCard } from "@/app/components/portal/overview/PipelineCard";
import { currentSiteContext } from "@/app/lib/portal-dashboard";
import { getInfraSnapshot } from "@/app/lib/portal-infra";
import { getCachedScore } from "@/app/lib/portal-overview";
import { activityFeed } from "@/app/lib/portal-overview-activity";
import {
    callbackSpeedSeconds,
    caughtAfterHours,
    leadWeek,
    needsYou,
} from "@/app/lib/portal-overview-leads";
import {
    followUpsDue,
    pipelineSummary,
    reviewsAskedThisWeek,
} from "@/app/lib/portal-overview-pipeline";
import {
    clientHours,
    getDoneRecords,
    getInboundTexts,
    getOverviewCrm,
    getOverviewInbox,
    overviewClock,
} from "@/app/lib/portal-overview-sources";
import { overviewStatus } from "@/app/lib/portal-overview-status";
import {
    mondayLabel,
    msOf,
    partOfDay,
    sinceLabel,
    spanLabel,
} from "@/app/lib/portal-overview-time";
import { tabHref, type PortalSiteProps } from "@/app/portal/types";

export const dynamic = "force-dynamic";

/**
 * The Overview: what came in, what needs the client, and what it is worth.
 *
 * It used to lead with the website's technical health — a five-segment strip, then call
 * stats, then visitors and billing. The rework (2026-11-09, mockups approved by Xander) turns
 * it around: a client opens the portal to see their leads. Site health is one status line
 * linking to Analytics; visitors and billing moved to Analytics and Settings. Those
 * components (`HealthStrip`, `OverviewAside`) are kept for the pages they moved to.
 *
 * Rendered on the server, streamed per module. Each module is its own Suspense boundary
 * because their upstreams have very different latencies — the infra probe is a live HTTP
 * request, Airtable can paginate, the CRM is a handful of KV reads. The reads are `cache()`d
 * (`portal-overview-sources.ts`), so boundaries that share a source share one read.
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

    // A site whose receptionist isn't ready yet is mid-provisioning, on any tier. Derived
    // rather than stored — see `isProvisioningReceptionist`. Renders alongside the build
    // tracker when a site is both building and setting up: two independent tracks, not one
    // merged timeline.
    const provisioningGrowth = isProvisioningReceptionist(site.features.calls);

    const { nowMs, timeZone, week } = overviewClock();

    return (
        <div className="flex flex-col gap-3 lg:gap-4" key={site.slug}>
            {building ? (
                <SectionHeader title="Your site is being built" />
            ) : (
                <OverviewHeader
                    greeting={greetingLine(account.profile?.contactName, partOfDay(nowMs, timeZone))}
                    sub={`This week, ${mondayLabel(week)} – today`}
                    status={
                        // No fallback: the line is small and optional, and a placeholder pill
                        // that then turns into nothing would be worse than a late arrival.
                        <Suspense fallback={null}>
                            <StatusBlock site={site} raw={raw} account={account} />
                        </Suspense>
                    }
                />
            )}

            {/*
              * Above everything else on purpose. A site that has been paid for and not yet
              * described is the only thing on this page the client has to act on — the rest
              * reports state they can read at their leisure. Renders nothing when there is
              * nothing outstanding.
              */}
            <PendingSiteBanner sites={account.sites} currentSlug={site.slug} />

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
                    <Suspense fallback={<LeadsSkeleton />}>
                        <LeadsBlock site={site} raw={raw} account={account} />
                    </Suspense>

                    <Suspense fallback={<StatRowSkeleton count={3} />}>
                        <TilesBlock site={site} raw={raw} account={account} />
                    </Suspense>

                    {site.features.crm.state === "ready" ? (
                        <Suspense fallback={<CardSkeleton rows={2} />}>
                            <PipelineBlock site={site} raw={raw} account={account} />
                        </Suspense>
                    ) : site.features.crm.state === "not-on-plan" ? (
                        // PR C makes `demo=growth` open the Growth demo on arrival.
                        <GrowthLockedPanel
                            demoHref={`${tabHref("customers", site.slug)}&demo=growth`}
                        />
                    ) : null}

                    <Suspense fallback={<CardSkeleton rows={4} />}>
                        <ActivityBlock site={site} raw={raw} account={account} />
                    </Suspense>
                </>
            )}
        </div>
    );
}

interface BlockProps {
    site: PortalSiteProps;
    raw: PortalSite;
    account: PortalAccount;
}

/** The header's status line, from the same infra snapshot and receptionist state the
 *  HealthStrip read. Links to Analytics' Site health section (PR A builds that route). */
async function StatusBlock({ site, raw, account }: BlockProps) {
    const [infra, score] = await Promise.all([
        // The line is optional; a probe failure means no line, never a broken header.
        getInfraSnapshot(raw, account.email).catch(() => null),
        getCachedScore(raw.slug).catch(() => null),
    ]);
    return (
        <StatusLine
            status={overviewStatus(infra, score, site.features.calls)}
            href={`${tabHref("analytics", site.slug)}#health`}
        />
    );
}

async function BuildBlock({ site, raw, account }: BlockProps) {
    // A build in flight is exactly when infra can fail in interesting ways, so this must
    // never be the thing that takes the page down.
    const infra = await getInfraSnapshot(raw, account.email).catch(() => null);
    return <BuildProgress site={site} infra={infra} />;
}

/** Needs you, beside New leads this week. */
async function LeadsBlock({ site, raw, account }: BlockProps) {
    const inbox = await getOverviewInbox(account, raw);
    if (inbox.state === "error") return <FeatureError message={inbox.error} />;
    if (inbox.state !== "ready") {
        return <FeatureState feature="leads" availability={{ state: inbox.state }} siteSlug={site.slug} />;
    }

    const { nowMs, timeZone, week } = overviewClock();
    const hours = clientHours(raw);
    const waiting = needsYou(inbox.items, { hours, timeZone });
    const thisWeek = leadWeek(inbox.items, week, { hours, timeZone });

    return (
        <div className="grid grid-cols-1 gap-3 lg:gap-4 items-start lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <NeedsYouCard
                data={waiting}
                handledThisWeek={thisWeek.handled}
                inboxHref={tabHref("calls", site.slug)}
                nowMs={nowMs}
                timeZone={timeZone}
            />
            <LeadsWeekCard
                week={thisWeek}
                todayIndex={week.todayIndex}
                chart={site.features.crm.state === "ready"}
            />
        </div>
    );
}

/**
 * The tiles. Growth (CRM live): Callback speed, Caught after hours, Follow-ups due today,
 * Reviews asked for. Starter: Caught after hours, Handled this week, Longest wait. Each hides
 * when it has nothing true to show — see `OverviewTiles`.
 */
async function TilesBlock({ site, raw, account }: BlockProps) {
    const growth = site.features.crm.state === "ready";
    const [inbox, crm] = await Promise.all([
        getOverviewInbox(account, raw),
        growth ? getOverviewCrm(account, raw) : null,
    ]);
    const items = inbox.state === "ready" ? inbox.items : [];
    const { nowMs, timeZone, week } = overviewClock();
    const hours = clientHours(raw);
    const caught = caughtAfterHours(items, week, { hours, timeZone });

    const tiles: TileSpec[] = [];
    if (growth) {
        const speed = callbackSpeedSeconds(items, week);
        if (speed !== null) tiles.push(callbackSpeedTile(spanLabel(speed)));
        if (caught !== null) tiles.push(afterHoursTile(caught));
        if (crm?.state === "ready") {
            const customersHref = tabHref("customers", site.slug);
            const due = followUpsDue(crm.tasks, crm.customers, week.todayEndMs);
            tiles.push(
                followUpsTile({
                    count: due.count,
                    first: due.first?.title ?? null,
                    firstHref: due.first
                        ? `${customersHref}&open=${encodeURIComponent(due.first.customerId)}`
                        : null,
                    allHref: customersHref,
                }),
            );
            tiles.push(reviewsTile(reviewsAskedThisWeek(crm.customers, week)));
        }
    } else if (inbox.state === "ready") {
        if (caught !== null) tiles.push(afterHoursTile(caught));
        const thisWeek = leadWeek(items, week, { hours, timeZone });
        tiles.push(handledTile(thisWeek.handled, thisWeek.total));
        const oldest = needsYou(items, { hours, timeZone }).oldest;
        const oldestMs = msOf(oldest?.at);
        if (oldest && oldestMs !== null) {
            tiles.push(
                longestWaitTile(
                    spanLabel((nowMs - oldestMs) / 1000),
                    oldest.name ?? oldest.phoneDisplay,
                    sinceLabel(oldestMs, nowMs, timeZone),
                ),
            );
        }
    }

    return <OverviewTiles tiles={tiles} />;
}

async function PipelineBlock({ site, raw, account }: BlockProps) {
    const crm = await getOverviewCrm(account, raw);
    if (crm.state === "error") return <FeatureError message="We couldn't load your pipeline just now." />;
    if (crm.state !== "ready") return null;
    const { week } = overviewClock();
    return (
        <PipelineCard
            summary={pipelineSummary(crm.customers, week)}
            customersHref={tabHref("customers", site.slug)}
        />
    );
}

async function ActivityBlock({ site, raw, account }: BlockProps) {
    const growth = site.features.crm.state === "ready";
    const [inbox, crm] = await Promise.all([
        getOverviewInbox(account, raw),
        growth ? getOverviewCrm(account, raw) : null,
    ]);
    const items = inbox.state === "ready" ? inbox.items : [];
    const customers = crm?.state === "ready" ? crm.customers : [];

    const [done, texts] = await Promise.all([
        getDoneRecords(
            account,
            raw,
            items.filter((i) => i.archived).map((i) => i.id),
        ),
        getInboundTexts(
            account,
            raw,
            customers.filter((c) => !c.archived).map((c) => c.customerId),
        ),
    ]);

    const { nowMs, timeZone } = overviewClock();
    return (
        <ActivityFeed
            events={activityFeed({ items, customers, texts, done, showValues: growth })}
            nowMs={nowMs}
            timeZone={timeZone}
        />
    );
}

function LeadsSkeleton() {
    return (
        <div className="grid grid-cols-1 gap-3 lg:gap-4 items-start lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <CardSkeleton rows={3} />
            <Card className="flex flex-col gap-3">
                <Skeleton width="45%" height={9} />
                <Skeleton width="30%" height={44} />
                <Skeleton height={13} />
                <Skeleton height={13} />
            </Card>
        </div>
    );
}

function CardSkeleton({ rows }: { rows: number }) {
    return (
        <Card className="flex flex-col gap-4">
            <Skeleton width="30%" height={12} />
            {Array.from({ length: rows }, (_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton width="45%" height={13} />
                    <Skeleton width="85%" height={11} />
                </div>
            ))}
        </Card>
    );
}
