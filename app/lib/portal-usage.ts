import "server-only";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { meteringGroupFor, sumAgentSeconds, type MeteringGroup } from "./retell-usage";
import { getBillingPeriod, type WhichPeriod } from "./billing-period";
import { getSchedule } from "./legal/schedules";
import type { PlanSlug } from "./agreement-types";
import { accountScope, usageKey, getCached, setCached, USAGE_TTL } from "./portal-kv";

/**
 * How much of this client's included call-time they've used in a billing period.
 *
 * Reads the same numbers the billing cron does — `meteringGroups` and `sumAgentSeconds` are
 * shared with `usage-billing.ts` on purpose. Showing a client 300 minutes and then invoicing
 * them for 400 is a refund and a lost customer, so there is exactly one definition of "how
 * much did they use" and, just as importantly, one definition of *whose* minutes those are.
 *
 * Carried in **seconds**, not minutes. The previous version rounded to whole minutes here and
 * that one integer fed the tile, the cap, the overage and the Stripe line item, so a 4m 44s
 * month displayed and billed as 5 minutes. Rounding now happens once, to the nearest cent, at
 * the point money is computed.
 *
 * Never throws: usage is one tile, and a Retell or Stripe hiccup must not take the page down
 * with it. Only `ready` results are cached, so an outage doesn't stick for the full TTL.
 */

export interface UsageSummary {
    state: "ready" | "not-on-plan" | "pending-build" | "unavailable";
    /** Exact seconds used in the window. */
    secondsUsed: number | null;
    /** The plan's included allowance, in whole minutes, from Schedule A. */
    minutesCap: number | null;
    /** Percent of the allowance consumed. May exceed 100 — that's the overage case. */
    pct: number | null;
    /** Exact seconds past the cap. */
    overageSeconds: number;
    /** Dollars, prorated at the Schedule A rate. */
    overageCost: number;
    /**
     * Dollars per minute past the cap, from Schedule A. Carried so the UI can quote the rate
     * before any overage exists, without a second copy of the number in a component.
     */
    overageRate: number | null;
    /** Epoch ms. Both ends, because the UI now labels which window it is showing. */
    periodStart: number | null;
    periodEnd: number | null;
}

const EMPTY: UsageSummary = {
    state: "unavailable",
    secondsUsed: null,
    minutesCap: null,
    pct: null,
    overageSeconds: 0,
    overageCost: 0,
    overageRate: null,
    periodStart: null,
    periodEnd: null,
};

export async function getUsageSummary(
    account: PortalAccount,
    site: PortalSite,
    which: WhichPeriod = "current",
): Promise<UsageSummary> {
    const schedule = getSchedule(site.plan as PlanSlug);

    // Starter has no voice agent at all, so there is no allowance to report against.
    if (!schedule.callMinutes) return { ...EMPTY, state: "not-on-plan" };
    if (site.status !== "live") return { ...EMPTY, state: "pending-build" };

    /**
     * The allowance this site actually draws on, which is not the account's.
     *
     * Growth is sold per site at 350 minutes each and the pools never meet; only Enterprise
     * pools, across its own bundle. This used to sum every voice agent on the account against
     * one cap, so a client with two Growth sites saw both sites' minutes on both tiles and a
     * cap that was 350 for the pair. `meteringGroups` is the same helper the billing cron
     * runs on, which is what keeps the number shown equal to the number billed.
     */
    const group = meteringGroupFor(account.sites, site.slug);
    if (!group) return { ...EMPTY, state: "pending-build" };

    // Scoped to the allowance, not the account: two Growth sites are two different numbers
    // and would otherwise collide on one entry. Keyed by period as well, so reading the
    // previous window can never overwrite the current one's figure.
    const key = usageKey(accountScope(account.email), group.ref, which);
    const hit = await getCached<UsageSummary>(key);
    if (hit) return hit;

    const result = await loadUsage(account, site, group, schedule.overagePerMinute ?? 0, which);
    if (result.state === "ready") await setCached(key, USAGE_TTL, result);
    return result;
}

async function loadUsage(
    account: PortalAccount,
    site: PortalSite,
    group: MeteringGroup,
    overageRate: number,
    which: WhichPeriod,
): Promise<UsageSummary> {
    try {
        const apiKey = process.env.RETELL_API_KEY;
        if (!apiKey) {
            console.error("[portal/usage] RETELL_API_KEY is not set");
            return EMPTY;
        }

        // The allowance resets on the Stripe renewal date, not the 1st of the month, so the
        // window comes from the subscription rather than the calendar.
        const period = await getBillingPeriod(site, account.email, which);
        if (!period) return EMPTY;

        // Only this allowance's agents. Never query past now — a future end date would return
        // the same calls, but this makes it explicit that an open period reports usage *so
        // far*. A closed period (previous) clamps to its own end instead.
        const secondsUsed = await sumAgentSeconds(
            apiKey,
            group.sites,
            period.startMs,
            Math.min(period.endMs, Date.now()),
        );

        const cap = group.cap;
        const capSeconds = cap * 60;
        const overageSeconds = Math.max(0, secondsUsed - capSeconds);

        return {
            state: "ready",
            secondsUsed,
            minutesCap: cap,
            pct: (secondsUsed / capSeconds) * 100,
            overageSeconds,
            overageCost: (overageSeconds / 60) * overageRate,
            overageRate,
            periodStart: period.startMs,
            periodEnd: period.endMs,
        };
    } catch (e) {
        console.error(`[portal/usage] ${site.slug} failed`, e);
        return EMPTY;
    }
}
