import "server-only";
import { Redis } from "@upstash/redis";
import { stripe } from "./stripe";
import { getPlan } from "./plans";
import { resolveSubscriptionId } from "./plan-billing";
import { getAccount, saveAccount } from "./account-store";
import { upsertSite, growthSitesForConsolidation, type PortalAccount } from "@jdd/schema";

/**
 * Moving a client off two Growth subscriptions and onto one Enterprise bundle.
 *
 * The ordering here is the whole design, and it is deliberately the *opposite* of the obvious
 * one. The obvious version creates the Enterprise subscription first and cancels the Growth
 * ones after; a failure between those two steps leaves the client paying for three
 * subscriptions at once, which is the single worst outcome available and the one they came
 * here to avoid.
 *
 * So money is captured through a Checkout Session before anything is cancelled, and the
 * cancellations run in the webhook once payment has actually cleared. A failure now leaves
 * them *paid but not yet consolidated* — still fully served, briefly over-subscribed, and
 * recoverable by resuming. Wrong in the direction that does not hurt the client.
 *
 * A Checkout Session rather than `subscriptions.create` for a second reason: because
 * `customer_email` used to mint a new Stripe Customer per purchase, a client with two Growth
 * sites frequently has *two Customers*, each holding its own payment method. Stripe cannot
 * merge them. Creating a subscription directly on whichever one we picked could land on a
 * Customer with no usable card; Checkout asks the client to confirm payment and guarantees
 * the host Customer ends up with one.
 *
 * Every step is written to `jdd:consolidation:{email}` *before* the next is attempted, so a
 * webhook redelivery resumes rather than restarting — and in particular can never open a
 * second Enterprise subscription.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const CONSOLIDATION_TTL = 60 * 60 * 24 * 90; // 90 days — long enough to debug a stalled one
const consolidationKey = (email: string) => `jdd:consolidation:${email}`;

export type ConsolidationStatus = "awaiting-payment" | "cancelling" | "done" | "stalled";

export interface ConsolidationRecord {
  id: string;
  accountEmail: string;
  /** The Customer the Enterprise subscription is opened on. */
  hostCustomerId: string;
  /** Growth site slugs being absorbed, captured at start so the set cannot drift. */
  absorbing: string[];
  /** The addendum authorising the move. */
  agreementId: string;
  status: ConsolidationStatus;
  startedAt: number;
  /** Set once Checkout completes. */
  enterpriseSubscriptionId?: string;
  /** Growth subscription ids already cancelled — the resume marker. */
  cancelled: string[];
  /** True once every absorbed site points at the Enterprise subscription. */
  rewritten?: boolean;
  lastError?: string;
  updatedAt: number;
}

export async function getConsolidation(email: string): Promise<ConsolidationRecord | null> {
  return getRedis().get<ConsolidationRecord>(consolidationKey(email));
}

export async function saveConsolidation(rec: ConsolidationRecord): Promise<void> {
  await getRedis().set(
    consolidationKey(rec.accountEmail),
    { ...rec, updatedAt: Date.now() },
    { ex: CONSOLIDATION_TTL },
  );
}

/**
 * Which Customer should host the Enterprise subscription?
 *
 * The one behind the oldest Growth site, because that is the Customer most likely to carry
 * the client's original payment method and their billing history. Any choice works — Checkout
 * collects a method regardless — but picking deterministically means a resumed consolidation
 * cannot land on a different Customer than the one it started on.
 */
export async function pickHostCustomer(account: PortalAccount): Promise<string | null> {
  if (account.stripeCustomerId) return account.stripeCustomerId;

  const growth = [...growthSitesForConsolidation(account)].sort((a, b) => a.addedAt - b.addedAt);
  for (const site of growth) {
    if (site.stripeCustomerId) return site.stripeCustomerId;
    const subId = await resolveSubscriptionId(site);
    if (!subId) continue;
    try {
      const sub = await stripe.subscriptions.retrieve(subId);
      const id = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      if (id) return id;
    } catch (e) {
      console.error("[consolidation] could not resolve customer for", site.slug, e);
    }
  }
  return null;
}

/**
 * Finish a consolidation whose payment has cleared: cancel the Growth subscriptions, then
 * repoint every absorbed site at the Enterprise subscription.
 *
 * Idempotent at the level of each individual cancellation, not just the run as a whole — the
 * `cancelled` list is written after each one, so a redelivery picks up where it stopped
 * rather than re-issuing a cancel against a subscription Stripe has already closed.
 *
 * Cancels with `prorate: true` so the unused remainder of each Growth period lands on the
 * Customer's balance and is credited against the Enterprise invoice. Without it the client
 * pays twice for the overlap.
 */
export async function completeConsolidation(
  rec: ConsolidationRecord,
  enterpriseSubscriptionId: string,
): Promise<ConsolidationRecord> {
  let current: ConsolidationRecord = {
    ...rec,
    enterpriseSubscriptionId,
    status: "cancelling",
  };
  await saveConsolidation(current);

  const account = await getAccount(rec.accountEmail);
  if (!account) {
    current = { ...current, status: "stalled", lastError: "account not found" };
    await saveConsolidation(current);
    return current;
  }

  for (const slug of rec.absorbing) {
    const site = account.sites.find((s) => s.slug === slug);
    if (!site) continue;

    const subId = await resolveSubscriptionId(site);
    // Never cancel the subscription we just opened. A site whose record was already
    // repointed by an earlier partial run would otherwise be read back as Enterprise.
    if (!subId || subId === enterpriseSubscriptionId) continue;
    if (current.cancelled.includes(subId)) continue;

    try {
      await stripe.subscriptions.cancel(subId, { prorate: true });
      current = { ...current, cancelled: [...current.cancelled, subId] };
      await saveConsolidation(current);
      console.log("[consolidation] cancelled growth subscription", slug, subId);
    } catch (e) {
      // Already cancelled by an earlier run is success, not failure.
      const message = e instanceof Error ? e.message : String(e);
      if (/no such subscription|canceled/i.test(message)) {
        current = { ...current, cancelled: [...current.cancelled, subId] };
        await saveConsolidation(current);
        continue;
      }
      current = { ...current, status: "stalled", lastError: `cancel ${subId}: ${message}` };
      await saveConsolidation(current);
      console.error("[consolidation] cancel failed", slug, subId, e);
      return current;
    }
  }

  // Repoint last. Until this lands the records still describe what Stripe was actually
  // billing, which is what makes a stalled consolidation diagnosable rather than a mystery.
  let next = account;
  for (const slug of rec.absorbing) {
    next = upsertSite(next, {
      slug,
      plan: "enterprise",
      stripeSubscriptionId: enterpriseSubscriptionId,
      stripeCustomerId: rec.hostCustomerId,
    });
  }
  await saveAccount({ ...next, stripeCustomerId: rec.hostCustomerId, updatedAt: Date.now() });

  current = { ...current, rewritten: true, status: "done" };
  await saveConsolidation(current);
  console.log("[consolidation] complete", rec.accountEmail, enterpriseSubscriptionId);
  return current;
}

/** The Enterprise recurring price, or null when it isn't configured. */
export function enterprisePriceId(): string | null {
  return getPlan("enterprise")?.monthlyPriceId ?? null;
}
