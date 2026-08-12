import "server-only";
import type { PortalSite } from "@jdd/schema";
import { stripe } from "./stripe";
import { subscriptionPeriod } from "./plan-billing";
import { accountScope, billingKey, getCached, setCached, BILLING_TTL } from "./portal-kv";

/**
 * The one line of billing the Overview shows: what you pay and when you next pay it.
 *
 * A deliberately narrow read — the Billing tab still owns payment method, invoice history
 * and cancellation. This exists so a client doesn't have to leave the landing page to
 * answer "am I paid up?".
 *
 * Never throws: billing is the least important thing on the Overview, and a Stripe hiccup
 * must not take the page down with it.
 */

export interface BillingSummary {
    state: "ready" | "pending-build" | "not-billed" | "unavailable";
    amount: number | null; // cents
    currency: string;
    interval: string | null;
    currentPeriodEnd: number | null; // epoch ms
    cancelAt: number | null; // epoch ms
    status: string | null;
}

const UNAVAILABLE: BillingSummary = {
    state: "unavailable",
    amount: null,
    currency: "usd",
    interval: null,
    currentPeriodEnd: null,
    cancelAt: null,
    status: null,
};

export async function getBillingSummary(
    site: PortalSite,
    accountEmail: string,
): Promise<BillingSummary> {
    if (site.status !== "live") return { ...UNAVAILABLE, state: "pending-build" };

    // Account-scoped: this carries the amount the client pays. Only a `ready` result is
    // cached, so a Stripe outage doesn't stick for twelve hours.
    const key = billingKey(accountScope(accountEmail), site.slug, "summary");
    const hit = await getCached<BillingSummary>(key);
    if (hit) return hit;

    const result = await loadSummary(site);
    if (result.state === "ready") await setCached(key, BILLING_TTL, result);
    return result;
}

async function loadSummary(site: PortalSite): Promise<BillingSummary> {
    try {
        const subscriptionId = await resolveSubscriptionId(site);
        if (!subscriptionId) {
            // No trace of checkout means this site simply isn't billed through the portal —
            // comped accounts and manually-invoiced clients land here, and telling them
            // we're "finishing setup" would be a promise nothing ever keeps.
            const everPaid = Boolean(site.sessionId || site.stripeCustomerId);
            return { ...UNAVAILABLE, state: everPaid ? "unavailable" : "not-billed" };
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const price = sub.items.data[0]?.price;
        const period = subscriptionPeriod(sub);

        return {
            state: "ready",
            amount: price?.unit_amount ?? null,
            currency: price?.currency ?? "usd",
            interval: price?.recurring?.interval ?? null,
            currentPeriodEnd: period ? period.end * 1000 : null,
            cancelAt: sub.cancel_at ? sub.cancel_at * 1000 : null,
            status: sub.status,
        };
    } catch (e) {
        console.error(`[portal/billing-summary] ${site.slug} failed`, e);
        return UNAVAILABLE;
    }
}

async function resolveSubscriptionId(site: {
    stripeSubscriptionId?: string;
    sessionId?: string;
}): Promise<string | null> {
    if (site.stripeSubscriptionId) return site.stripeSubscriptionId;
    if (!site.sessionId) return null;

    const session = await stripe.checkout.sessions.retrieve(site.sessionId, {
        expand: ["subscription"],
    });
    const sub = session.subscription;
    return sub && typeof sub === "object" && "id" in sub ? sub.id : null;
}
