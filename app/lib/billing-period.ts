import "server-only";
import { cache } from "react";
import type { PortalSite } from "@jdd/schema";
import { stripe } from "./stripe";
import { resolveSubscriptionId, subscriptionPeriod } from "./plan-billing";
import { getCached, setCached, accountScope, periodKey, PERIOD_TTL } from "./portal-kv";

/**
 * The client's billing window, which is the one window the portal measures anything against.
 *
 * The portal used to mix two definitions of "this month": usage read the Stripe billing cycle
 * while the Overview's call counts read the calendar month. On a client whose cycle starts
 * mid-month those two disagree, which is exactly how "3 calls this month" ended up sitting
 * beside "0 minutes used" and looking broken. Both now resolve here.
 */

export type WhichPeriod = "current" | "previous";

export interface BillingPeriod {
    startMs: number;
    endMs: number;
}

/**
 * Step back one calendar month, preserving the day-of-month anchor Stripe bills on.
 *
 * NOT `start - (end - start)`. Fixed-duration stepping drifts across variable month lengths:
 * the Feb 3 to Mar 3 period is 28 days, so subtracting the *current* period's 31 days from
 * Mar 3 lands on Jan 31 and silently reports the wrong month's usage.
 *
 * `Date.UTC` normalises overflow, so stepping back from Mar 31 gives Mar 3 rather than an
 * invalid Feb 31. That is the standard subscription behaviour: a short month clamps.
 */
function oneMonthEarlier(ms: number): number {
    const d = new Date(ms);
    const target = new Date(
        Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth() - 1,
            d.getUTCDate(),
            d.getUTCHours(),
            d.getUTCMinutes(),
            d.getUTCSeconds(),
            d.getUTCMilliseconds(),
        ),
    );
    // Clamp a day-of-month that does not exist in the earlier month (Mar 31 to Feb 31).
    if (target.getUTCDate() !== d.getUTCDate()) target.setUTCDate(0);
    return target.getTime();
}

/**
 * Wrapped in React `cache()` so one request resolves this once. Without it the Overview page
 * would hit Stripe twice per render, since the metrics block and the usage block both need it.
 */
const resolveCurrent = cache(async function resolveCurrent(
    site: PortalSite,
    accountEmail: string,
): Promise<BillingPeriod | null> {
    const key = periodKey(accountScope(accountEmail), site.slug);

    // A cached period is only trustworthy while it is still the *current* one. Serving a
    // closed period past its end would report the previous month's usage as this month's,
    // which is the one failure this whole change exists to prevent.
    const hit = await getCached<BillingPeriod>(key);
    if (hit && Date.now() < hit.endMs) return hit;

    try {
        const subscriptionId = await resolveSubscriptionId(site);
        if (!subscriptionId) return null;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const period = subscriptionPeriod(sub);
        if (!period) {
            console.error(`[billing-period] ${site.slug} no period on ${subscriptionId}`);
            return null;
        }

        const resolved: BillingPeriod = { startMs: period.start * 1000, endMs: period.end * 1000 };
        await setCached(key, PERIOD_TTL, resolved);
        return resolved;
    } catch (e) {
        console.error(`[billing-period] ${site.slug} failed`, e);
        return null;
    }
});

/** The current or previous billing window, or null when it cannot be determined. */
export async function getBillingPeriod(
    site: PortalSite,
    accountEmail: string,
    which: WhichPeriod = "current",
): Promise<BillingPeriod | null> {
    const current = await resolveCurrent(site, accountEmail);
    if (!current || which === "current") return current;

    return { startMs: oneMonthEarlier(current.startMs), endMs: current.startMs };
}

/** Exported for the unit checks; the month-step is the part worth testing directly. */
export const __oneMonthEarlier = oneMonthEarlier;
