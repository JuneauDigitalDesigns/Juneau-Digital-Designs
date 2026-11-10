import "server-only";
import { cache } from "react";
import { siteFeature, type PortalAccount, type PortalSite } from "@jdd/schema";
import { buildInbox, type InboxItem } from "./crm-contacts";
import { getSiteCalls } from "./portal-overview";
import { accountScope } from "./portal-kv";
import { listLeads } from "./portal-leads";
import {
    archiveRecords,
    archivedRefs,
    isStale,
    listCustomers,
    listMessages,
    listTasks,
    promotedRefs,
} from "./portal-crm";
import type { PipelineCustomer, PipelineTask } from "./portal-overview-pipeline";
import type { DoneRecord, InboundText } from "./portal-overview-activity";
import {
    OVERVIEW_TIME_ZONE,
    weekBounds,
    type WeekBounds,
    type WeeklyHours,
} from "./portal-overview-time";

/**
 * The reads behind the lead-first Overview, each wrapped in React `cache()`.
 *
 * The page streams four Suspense boundaries — Needs you + this week, the tiles, the pipeline,
 * the activity feed — and most of them want the same two things. `cache()` makes each read
 * happen once per request however many boundaries ask, the way `getSiteCalls` already does
 * for the call log.
 */

/**
 * One instant and one week for the whole render.
 *
 * Every boundary reads the clock through this, so a request that straddles midnight cannot
 * put Needs you on Monday and the tiles on Tuesday. The zone is `OVERVIEW_TIME_ZONE` until a
 * client's own is stored — see the note at the top of `portal-overview-time.ts`.
 */
export const overviewClock = cache(function overviewClock(): {
    nowMs: number;
    timeZone: string;
    week: WeekBounds;
} {
    const nowMs = Date.now();
    const timeZone = OVERVIEW_TIME_ZONE;
    return { nowMs, timeZone, week: weekBounds(nowMs, timeZone) };
});

/**
 * The client's opening hours, for every after-hours figure.
 *
 * **Always null today, and that is a known data gap, not a default.** The onboarding wizard
 * asks "When are you open?" but keeps the answer only as free text (`businessHours`) inside
 * the intake envelope and the wizard draft — both on 30-day TTLs, neither on the
 * `PortalSite` record, and neither structured. The receptionist's hours live in its Retell
 * prompt, as prose. So there is nothing the portal can durably read and trust, and every
 * after-hours row, tile and "· after hours" tag hides while this returns null.
 *
 * When structured hours land on the site record, this is the one place to read them.
 */
export function clientHours(site: PortalSite): WeeklyHours | null {
    void site;
    return null;
}

export type OverviewInbox =
    | { state: "ready"; items: InboxItem[]; truncated: boolean }
    | { state: "not-on-plan" | "pending-build" | "connecting" }
    | { state: "error"; error: string };

/**
 * The Inbox, assembled exactly as `GET /api/portal/inbox` assembles it.
 *
 * Same gate (`leads`, not `calls` — a web-only site has form enquiries and no call log), same
 * sources, same `buildInbox`. Calls come through `getSiteCalls`, so the Airtable read is shared
 * with anything else on the page that needs it. Both halves degrade the way the route's do:
 * no receptionist yields a lead-only inbox, a lead-store failure a call-only one.
 *
 * Kept as a second assembly rather than a fetch of the route, because the page renders on the
 * server and a loopback HTTP request to ourselves would add a hop and lose the shared cache.
 * If the route's assembly changes, this must change with it.
 */
export const getOverviewInbox = cache(async function getOverviewInbox(
    account: PortalAccount,
    site: PortalSite,
): Promise<OverviewInbox> {
    const gate = siteFeature(site, "leads");
    if (gate.state !== "ready") return { state: gate.state };

    const acct = accountScope(account.email);
    const callsGate = siteFeature(site, "calls");
    const calls = callsGate.state === "ready" ? await getSiteCalls(account, site) : null;
    if (calls && !calls.ok) {
        return { state: "error", error: "We couldn't load your leads just now." };
    }

    const [promoted, archived, leads] = await Promise.all([
        promotedRefs(acct, site.slug),
        archivedRefs(acct, site.slug),
        listLeads(acct, site.slug).catch((e) => {
            console.error(`[portal/overview] lead read failed for ${site.slug}`, e);
            return [];
        }),
    ]);

    return {
        state: "ready",
        items: buildInbox({ calls: calls?.ok ? calls.calls : [], leads, promoted, archived }),
        truncated: calls?.ok ? calls.truncated : false,
    };
});

/**
 * When each done (archived) inbox item was put away. Every tier has Done.
 *
 * Not `cache()`d: only the activity feed asks, and an array argument would never hit the
 * cache anyway — it keys on identity.
 */
export async function getDoneRecords(
    account: PortalAccount,
    site: PortalSite,
    ids: string[],
): Promise<DoneRecord[]> {
    try {
        return await archiveRecords(accountScope(account.email), site.slug, ids);
    } catch (e) {
        // The feed is the least important thing on the page; a KV blip drops a line type, it
        // does not take the feed down.
        console.error(`[portal/overview] archive read failed for ${site.slug}`, e);
        return [];
    }
}

export type OverviewCrm =
    | { state: "ready"; customers: PipelineCustomer[]; tasks: PipelineTask[] }
    | { state: "unavailable" }
    | { state: "error" };

/** The CRM records, with `stale` derived by the board's own `isStale`. Growth/Enterprise. */
export const getOverviewCrm = cache(async function getOverviewCrm(
    account: PortalAccount,
    site: PortalSite,
): Promise<OverviewCrm> {
    if (siteFeature(site, "crm").state !== "ready") return { state: "unavailable" };
    const acct = accountScope(account.email);
    try {
        const [customers, tasks] = await Promise.all([
            listCustomers(acct, site.slug),
            listTasks(acct, site.slug),
        ]);
        const now = Date.now();
        return {
            state: "ready",
            customers: customers.map((c) => ({
                customerId: c.customerId,
                name: c.name,
                phone: c.phone,
                stage: c.stage,
                value: c.value,
                archived: c.archived,
                stageChangedAt: c.stageChangedAt,
                reviewSent: c.reviewSent ? { sentAt: c.reviewSent.sentAt } : null,
                stale: isStale(c.stage, c.stageChangedAt, now),
            })),
            tasks: tasks.map((t) => ({
                taskId: t.taskId,
                customerId: t.customerId,
                title: t.title,
                dueAt: t.dueAt,
                done: t.done,
            })),
        };
    } catch (e) {
        console.error(`[portal/overview] crm read failed for ${site.slug}`, e);
        return { state: "error" };
    }
});

/**
 * How many customer threads the feed reads for inbound texts.
 *
 * Threads are one list per customer, so this is a read per customer. `listCustomers` returns
 * them most recently contacted first, and sending a text stamps `lastContactAt` — so a reply
 * almost always sits on a customer near the top. Twenty bounds the cost on a big board.
 */
const TEXT_THREADS_READ = 20;

/** Recent inbound SMS on customer threads, for "{name} texted back". Not cached, as above. */
export async function getInboundTexts(
    account: PortalAccount,
    site: PortalSite,
    customerIds: string[],
): Promise<InboundText[]> {
    if (siteFeature(site, "messaging").state !== "ready") return [];
    const acct = accountScope(account.email);
    try {
        const threads = await Promise.all(
            customerIds.slice(0, TEXT_THREADS_READ).map(async (customerId) => ({
                customerId,
                messages: await listMessages(acct, site.slug, customerId),
            })),
        );
        return threads.flatMap(({ customerId, messages }) =>
            messages
                .filter((m) => m.direction === "in")
                .map((m) => ({ id: m.id, customerId, body: m.body, at: m.at })),
        );
    } catch (e) {
        console.error(`[portal/overview] thread read failed for ${site.slug}`, e);
        return [];
    }
}
