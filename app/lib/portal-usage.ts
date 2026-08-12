import "server-only";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { stripe } from "./stripe";
import { resolveSubscriptionId, subscriptionPeriod } from "./plan-billing";
import { voiceSitesOf, sumAgentMinutes } from "./retell-usage";
import { getSchedule } from "./legal/schedules";
import type { PlanSlug } from "./agreement-types";
import { accountScope, usageKey, getCached, setCached, USAGE_TTL } from "./portal-kv";

/**
 * How many of this client's included call-minutes they've used this billing period.
 *
 * Reads the same numbers the billing cron does — `voiceSitesOf` and `sumAgentMinutes` are
 * shared with `usage-billing.ts` on purpose. Showing a client 300 minutes and then invoicing
 * them for 400 is a refund and a lost customer, so there is exactly one definition of "how
 * many minutes did they use".
 *
 * Never throws: usage is one tile on the Overview, and a Retell or Stripe hiccup must not
 * take the whole page down with it. Only `ready` results are cached, so an outage doesn't
 * stick for the full TTL.
 */

export interface UsageSummary {
    state: "ready" | "not-on-plan" | "pending-build" | "unavailable";
    minutesUsed: number | null;
    minutesCap: number | null;
    /** Percent of the allowance consumed. May exceed 100 — that's the overage case. */
    pct: number | null;
    overageMinutes: number;
    /** Dollars, at the Schedule A overage rate. */
    overageCost: number;
    /**
     * Dollars per minute past the cap, from Schedule A. Carried so the UI can quote the rate
     * before any overage exists, without a second copy of the number in a component.
     */
    overageRate: number | null;
    /** Epoch ms — when the allowance resets. */
    periodEnd: number | null;
}

const EMPTY: UsageSummary = {
    state: "unavailable",
    minutesUsed: null,
    minutesCap: null,
    pct: null,
    overageMinutes: 0,
    overageCost: 0,
    overageRate: null,
    periodEnd: null,
};

export async function getUsageSummary(
    account: PortalAccount,
    site: PortalSite,
): Promise<UsageSummary> {
    const schedule = getSchedule(site.plan as PlanSlug);
    const cap = schedule.callMinutes;

    // Starter has no voice agent at all, so there is no allowance to report against.
    if (!cap) return { ...EMPTY, state: "not-on-plan" };
    if (site.status !== "live") return { ...EMPTY, state: "pending-build" };

    // Account-scoped and slug-free: enterprise pools across sites, so all of them share
    // one entry. Also keeps client email addresses out of the key namespace.
    const key = usageKey(accountScope(account.email));
    const hit = await getCached<UsageSummary>(key);
    if (hit) return hit;

    const result = await loadUsage(account, site, cap, schedule.overagePerMinute ?? 0);
    if (result.state === "ready") await setCached(key, USAGE_TTL, result);
    return result;
}

async function loadUsage(
    account: PortalAccount,
    site: PortalSite,
    cap: number,
    overageRate: number,
): Promise<UsageSummary> {
    try {
        const apiKey = process.env.RETELL_API_KEY;
        if (!apiKey) {
            console.error("[portal/usage] RETELL_API_KEY is not set");
            return EMPTY;
        }

        const voiceSites = voiceSitesOf(account.sites);
        if (voiceSites.length === 0) return { ...EMPTY, state: "pending-build" };

        // The allowance resets on the Stripe renewal date, not the 1st of the month, so the
        // window has to come from the subscription rather than the calendar.
        const subscriptionId = await resolveSubscriptionId(site);
        if (!subscriptionId) return EMPTY;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const period = subscriptionPeriod(sub);
        if (!period) {
            console.error(`[portal/usage] ${site.slug} no billing period on ${subscriptionId}`);
            return EMPTY;
        }

        const periodStartMs = period.start * 1000;
        const periodEndMs = period.end * 1000;

        // Never query past now — a future end date would just return the same calls, but it
        // makes the intent explicit that this is usage *so far* in the open period.
        const minutesUsed = await sumAgentMinutes(
            apiKey,
            voiceSites,
            periodStartMs,
            Math.min(periodEndMs, Date.now()),
        );

        const overageMinutes = Math.max(0, minutesUsed - cap);

        return {
            state: "ready",
            minutesUsed,
            minutesCap: cap,
            pct: (minutesUsed / cap) * 100,
            overageMinutes,
            overageCost: overageMinutes * overageRate,
            overageRate,
            periodEnd: periodEndMs,
        };
    } catch (e) {
        console.error(`[portal/usage] ${site.slug} failed`, e);
        return EMPTY;
    }
}
