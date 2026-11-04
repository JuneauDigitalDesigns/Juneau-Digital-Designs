import "server-only";
import { Redis } from "@upstash/redis";
import type Stripe from "stripe";
import { stripe } from "./stripe";
import { getPlan } from "./plans";
import { releaseScheduledChange, resolveSubscriptionId, subscriptionPeriod } from "./plan-billing";
import { billingIntervalOf, consolidationPrice } from "./billing-periods.mjs";
import { getPlanChange, isPendingPlanChange, savePlanChange } from "./plan-change";
import { growthSitesForConsolidation, type PortalAccount, type PortalSite } from "@jdd/schema";

/**
 * Moving a client's Growth sites onto one Enterprise plan, in place.
 *
 * Contract v5.3 §15.4: a change to a higher-priced plan "takes effect immediately, and Client is
 * charged the difference between the two plans' prices for the remainder of the current billing
 * period", and the billing period carries over. So the move is an upgrade of one subscription,
 * not a new one (Xander approved this, option C3, on 2026-11-04):
 *
 *   1. The oldest Growth site's subscription (the host) has its price changed to Enterprise on
 *      the same period, through `changeSubscriptionPlan`: prorated, invoiced now, and refused by
 *      Stripe if the card doesn't pay, in which case nothing has changed at all.
 *   2. Every other Growth subscription is cancelled with `prorate` and `invoice_now`. The final
 *      invoice is negative, so the unused time lands on the customer's credit balance, which
 *      Stripe takes off the next invoices.
 *   3. Every absorbed site is pointed at the host subscription.
 *
 * This replaced a Checkout Session for a brand-new Enterprise subscription. That charged a full
 * new Enterprise period up front and restarted the client's billing date. Its cancellations left
 * the Growth credit as pending invoice items that never reduced the Enterprise charge. And a
 * stalled or repeated checkout could open a second paid Enterprise subscription.
 *
 * Every step is idempotent, so a retry or a second acceptance resumes rather than repeats: the
 * host already on Enterprise is "no change" (no second invoice), and a subscription already
 * cancelled is skipped. The records are written last, so until the move completes they still
 * describe what Stripe was billing before it.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const CONSOLIDATION_TTL = 60 * 60 * 24 * 90; // 90 days, long enough to debug a stalled one
const consolidationKey = (email: string) => `jdd:consolidation:${email}`;

export type ConsolidationStatus = "upgrading" | "cancelling" | "done" | "stalled";

/** The audit trail of one move, and the resume marker if it stops partway. */
export interface ConsolidationRecord {
  id: string;
  accountEmail: string;
  /** Growth site slugs being absorbed, captured at start so the set cannot drift. */
  absorbing: string[];
  /** The site whose subscription became the Enterprise one. */
  hostSlug: string;
  hostSubscriptionId: string;
  /** The Customer every absorbed subscription bills to. */
  customerId: string;
  /** The Enterprise agreement authorising the move. */
  agreementId: string;
  status: ConsolidationStatus;
  startedAt: number;
  /** Growth subscription ids already cancelled. */
  cancelled: string[];
  lastError?: string;
  updatedAt: number;
}

export async function getConsolidation(email: string): Promise<ConsolidationRecord | null> {
  return getRedis().get<ConsolidationRecord>(consolidationKey(email));
}

export async function saveConsolidation(rec: ConsolidationRecord): Promise<void> {
  await getRedis().set(consolidationKey(rec.accountEmail), { ...rec, updatedAt: Date.now() }, { ex: CONSOLIDATION_TTL });
}

export interface AbsorbedSubscription {
  site: PortalSite;
  subscription: Stripe.Subscription;
}

export type ConsolidationPlan =
  | {
      ok: true;
      /** The oldest Growth site: its subscription becomes the Enterprise one. */
      host: AbsorbedSubscription;
      /** The other Growth sites, whose subscriptions are cancelled and credited. */
      others: AbsorbedSubscription[];
      interval: "month" | "year";
      enterprisePriceId: string;
      /** End of the host's current period, epoch ms: what the client pays the difference to. */
      periodEnd: number;
      customerId: string;
    }
  | {
      ok: false;
      code: "no-sites" | "mixed-periods" | "different-customers" | "cancel-pending" | "no-price" | "unreadable" | "inactive";
      /** For `cancel-pending`: when the site is set to cancel, epoch ms. */
      cancelAt?: number;
    };

/**
 * Can this account's Growth sites move to Enterprise in place, and on what terms?
 *
 * Read-only. The page runs it before the client is offered anything to accept, and the move runs
 * it again, so a refusal is shown up front and never after an agreement has been accepted and
 * emailed. Refuses, rather than guessing, whenever there isn't one obvious way to do it:
 *
 *   - sites billed on different periods (one monthly, one annual) have no one period to keep;
 *   - subscriptions on different Stripe Customers can't share a credit balance, so the unused
 *     Growth time would land where the Enterprise invoices never see it;
 *   - a site set to cancel would be absorbed and then cancelled.
 */
export async function planConsolidation(account: PortalAccount): Promise<ConsolidationPlan> {
  const sites = [...growthSitesForConsolidation(account)].sort((a, b) => a.addedAt - b.addedAt);
  if (sites.length === 0) return { ok: false, code: "no-sites" };

  const pendingCancel = sites.find((s) => s.cancelRequestedAt);
  if (pendingCancel) return { ok: false, code: "cancel-pending", cancelAt: pendingCancel.cancelEffectiveAt };

  const absorbed: AbsorbedSubscription[] = [];
  for (const site of sites) {
    const subId = await resolveSubscriptionId(site);
    if (!subId) return { ok: false, code: "unreadable" };
    try {
      const subscription = await stripe.subscriptions.retrieve(subId);
      absorbed.push({ site, subscription });
    } catch (e) {
      console.error("[consolidation] could not read subscription for", site.slug, e);
      return { ok: false, code: "unreadable" };
    }
  }

  for (const { subscription } of absorbed) {
    // Cancelled by an earlier run of this move that stopped before repointing the records: still
    // part of the move (its site needs repointing), not a reason to refuse it.
    if (subscription.metadata?.consolidated_into) continue;
    if (subscription.status !== "active" && subscription.status !== "trialing") return { ok: false, code: "inactive" };
    if (subscription.cancel_at || subscription.cancel_at_period_end) {
      return { ok: false, code: "cancel-pending", cancelAt: (subscription.cancel_at ?? 0) * 1000 || undefined };
    }
  }

  // The period and price rule is `consolidationPrice` (billing-periods.mjs), where the test runs it.
  const cfg = getPlan("enterprise");
  const price = consolidationPrice({
    intervals: absorbed.map(({ subscription }) => intervalOf(subscription)),
    prices: { monthly: cfg?.monthlyPriceId, annual: cfg?.annualPriceId },
  });
  if (!price.ok) return { ok: false, code: price.code };
  const { interval, priceId: enterprisePriceId } = price;

  const customers = new Set(absorbed.map(({ subscription }) => customerOf(subscription)));
  if (customers.size > 1 || customers.has(null)) return { ok: false, code: "different-customers" };
  const customerId = [...customers][0] as string;

  const [host, ...others] = absorbed;
  const period = subscriptionPeriod(host.subscription);
  if (!period) return { ok: false, code: "unreadable" };

  return { ok: true, host, others, interval, enterprisePriceId, periodEnd: period.end * 1000, customerId };
}

/**
 * A downgrade scheduled on any absorbed site is withdrawn: the client is moving those sites up
 * to Enterprise now, which supersedes it, and a subscription still on a schedule can't have its
 * plan changed.
 */
export async function withdrawScheduledChanges(account: PortalAccount, plan: Extract<ConsolidationPlan, { ok: true }>) {
  for (const { site, subscription } of [plan.host, ...plan.others]) {
    if (subscription.schedule) await releaseScheduledChange(subscription.id);
    const pending = await getPlanChange(account.email, site.slug);
    if (isPendingPlanChange(pending)) await savePlanChange({ ...pending, status: "cancelled" });
  }
}

/**
 * Cancel one absorbed Growth subscription, crediting its unused time to the customer's balance.
 *
 * `invoice_now` is what makes the credit real. With `prorate` alone the credit stays a pending
 * invoice item, which Stripe "can bill on another invoice for the customer" but did not take off
 * the Enterprise charge. With both, the final invoice is negative and its total goes to the credit
 * balance, which every later invoice on the customer draws down.
 *
 * Marked `consolidated_into` first, so the `customer.subscription.deleted` webhook knows the site
 * lives on under Enterprise and doesn't treat it as churn.
 */
export async function cancelAbsorbedSubscription(subscriptionId: string, hostSubscriptionId: string): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (sub.status === "canceled") return;
  await stripe.subscriptions.update(subscriptionId, {
    metadata: { ...(sub.metadata ?? {}), consolidated_into: hostSubscriptionId },
  });
  await stripe.subscriptions.cancel(subscriptionId, { prorate: true, invoice_now: true });
}

function intervalOf(sub: Stripe.Subscription): "month" | "year" {
  const recurring = sub.items.data.filter((i) => i.price.recurring !== null);
  return billingIntervalOf(recurring[0]?.price.recurring);
}

function customerOf(sub: Stripe.Subscription): string | null {
  const c = sub.customer;
  if (!c) return null;
  return typeof c === "string" ? c : c.id;
}
