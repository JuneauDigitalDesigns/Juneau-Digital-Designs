"use client";

import type { InboxItem } from "@/app/lib/crm-contacts";
import type { PortalSiteProps } from "@/app/portal/types";
import { CLIENT_TTL, useCachedFetch } from "./PortalDataProvider";
import { inboxCounts } from "./inbox/model";

/**
 * The red counts on the phone tab bar (2026-11-19, Xander Q11): Inbox shows how many leads
 * need you, Customers how many customers have texted back unread.
 *
 * Each reads the same cache key its page uses (`inbox:{slug}`, `customers:{slug}`), so the
 * number and the page always agree, and opening the page after seeing a badge costs nothing.
 * Nothing renders while loading, at zero, or for a feature the site does not have.
 */
export default function TabBadge({ kind, site }: { kind: "calls" | "customers"; site: PortalSiteProps }) {
    const count = kind === "calls" ? <InboxCount site={site} /> : <RepliesCount site={site} />;
    return count;
}

function InboxCount({ site }: { site: PortalSiteProps }) {
    const ready = site.features.leads.state === "ready";
    const { data } = useCachedFetch<{ items?: InboxItem[] }>(
        `inbox:${site.slug}`,
        `/api/portal/inbox?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
        ready,
    );
    if (!ready || !data?.items) return null;
    return <Badge n={inboxCounts(data.items).needs} label="Needs you" />;
}

function RepliesCount({ site }: { site: PortalSiteProps }) {
    const ready = site.features.crm.state === "ready";
    const { data } = useCachedFetch<{ customers?: Array<{ unread?: boolean }> }>(
        `customers:${site.slug}`,
        `/api/portal/customers?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
        ready,
    );
    if (!ready || !data?.customers) return null;
    return <Badge n={data.customers.filter((c) => c.unread).length} label="New reply" />;
}

function Badge({ n, label }: { n: number; label: string }) {
    if (n <= 0) return null;
    return (
        <>
            <span className="portal-tab-badge" aria-hidden="true">
                {n > 99 ? "99+" : n}
            </span>
            {/* Existing chip wording only ("Needs you", "New reply"), no new strings. */}
            <span className="sr-only">
                ({label}: {n})
            </span>
        </>
    );
}
