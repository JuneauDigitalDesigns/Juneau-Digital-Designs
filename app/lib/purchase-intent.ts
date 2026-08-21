import "server-only";
import { Redis } from "@upstash/redis";
import type { PlanSlug } from "./plans";

/**
 * What we decided, server-side, before sending the client to Stripe.
 *
 * The webhook used to reconstruct all of this from `agreement.signerEmail` — a string the
 * client typed into an anonymous form. A typo, or signing with one address and creating a
 * Clerk login with another, produced an orphaned account nobody could reach. Stripe Checkout
 * also lets the client change their email on Stripe's own page, so even a correct signature
 * could come back attached to a different address.
 *
 * The intent removes the guessing. Identity is decided while the caller is authenticated,
 * written down, and referenced by id from the session metadata. The webhook reads the
 * decision instead of re-deriving it, so nothing typed after this point can move a purchase
 * onto the wrong account.
 *
 * Also, incidentally, the abandoned-checkout list: an unconsumed intent older than an hour is
 * someone who reached Stripe and did not pay.
 *
 * NOT a client record. Nothing here should ever surface in the console roster — intent is not
 * a customer, and payment remains the only event that makes someone one.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

/** Long enough to outlive any real checkout, short enough that abandoned ones age out. */
const INTENT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const intentKey = (id: string) => `jdd:purchase:${id}`;

export interface PurchaseIntent {
  id: string;
  /** Authenticated identity at the moment of purchase. The authority for account linkage. */
  clerkUserId: string;
  /** Normalized account email — the KV key the site will be written under. */
  accountEmail: string;
  plan: PlanSlug;
  /** The master or addendum authorising this purchase. */
  agreementId: string;
  createdAt: number;
  /** Set by the webhook once the site has been created. Makes replay a no-op. */
  consumedAt?: number;
  /** The site the purchase produced. Only meaningful alongside `consumedAt`. */
  siteSlug?: string;
}

export async function savePurchaseIntent(intent: PurchaseIntent): Promise<void> {
  await getRedis().set(intentKey(intent.id), intent, { ex: INTENT_TTL_SECONDS });
}

export async function getPurchaseIntent(id: string): Promise<PurchaseIntent | null> {
  return getRedis().get<PurchaseIntent>(intentKey(id));
}

/**
 * Record that this intent produced a site.
 *
 * Stripe redelivers `checkout.session.completed`, so the webhook needs a durable "already
 * handled" marker. `createPendingSite` is separately idempotent on `sessionId`, which covers
 * the common case; this makes the intent itself self-describing, so a replay can be
 * recognised and logged rather than merely being harmless by accident.
 *
 * Preserves the original `consumedAt` if one is already set — a second replay should not keep
 * moving the timestamp.
 */
export async function markIntentConsumed(
  intent: PurchaseIntent,
  siteSlug: string,
): Promise<void> {
  await savePurchaseIntent({
    ...intent,
    consumedAt: intent.consumedAt ?? Date.now(),
    siteSlug: intent.siteSlug ?? siteSlug,
  });
}
