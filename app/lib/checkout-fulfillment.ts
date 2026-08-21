import "server-only";
import type Stripe from "stripe";
import { stripe } from "./stripe";
import { getAgreement, persistAgreement } from "./kv";
import { getPurchaseIntent, markIntentConsumed } from "./purchase-intent";
import { createPendingSite } from "./account-store";
import { doubleOptInEnabled, promotePendingConsent } from "./sms-consent";
import { sendSms } from "./twilio";
import type { PortalPlan } from "@jdd/schema";

/**
 * Turn a paid Stripe Checkout Session into a pending site on the buyer's account.
 *
 * Called from **two** places, deliberately: the `checkout.session.completed` webhook, and
 * `/checkout/success` as the browser comes back. Neither alone is sufficient —
 *
 *   - the webhook is authoritative but asynchronous, so the browser routinely arrives first
 *     and finds no site to send the client to;
 *   - the success page is synchronous with the client but only runs if they actually return,
 *     and they might close the tab on Stripe's confirmation screen.
 *
 * Running both is Stripe's own recommendation, and it is what lets the post-payment redirect
 * be deterministic instead of racing a webhook. It only works because every write below is
 * idempotent, which is a property to preserve rather than assume:
 *
 *   - `createPendingSite` short-circuits when a site with this `sessionId` already exists;
 *   - `markIntentConsumed` keeps its first `consumedAt` and `siteSlug`;
 *   - `promotePendingConsent` is idempotent by design (the handler was already replay-safe);
 *   - `persistAgreement` is a no-op on a key with no TTL left to clear.
 *
 * Returns null when there is nothing to provision — an unpaid session, or one with no
 * `agreement_id`. Callers decide what that means for them; it is not an error here.
 */
export interface FulfilledSession {
  slug: string;
  email: string;
  plan: PortalPlan;
}

const VALID_PLANS: PortalPlan[] = ["starter", "growth", "enterprise"];

export async function provisionPaidSession(
  sessionIdOrSession: string | Stripe.Checkout.Session,
): Promise<FulfilledSession | null> {
  // The webhook already holds the session object; the success page only has an id. Accepting
  // both avoids a redundant round trip to Stripe on the hot webhook path.
  const session =
    typeof sessionIdOrSession === "string"
      ? await stripe.checkout.sessions.retrieve(sessionIdOrSession)
      : sessionIdOrSession;

  if (session.payment_status !== "paid") return null;

  const agreementId = session.metadata?.agreement_id;
  const purchaseId = session.metadata?.purchase_id;
  const rawPlan = session.metadata?.plan ?? "";
  const plan: PortalPlan = VALID_PLANS.includes(rawPlan as PortalPlan)
    ? (rawPlan as PortalPlan)
    : "starter";

  if (!agreementId) {
    console.warn("[fulfillment] no agreement_id in session metadata", session.id);
    return null;
  }

  const agreement = await getAgreement(agreementId);
  if (!agreement) {
    console.warn("[fulfillment] agreement not found", agreementId);
    return null;
  }

  /**
   * Whose purchase is this?
   *
   * The intent, when there is one. It was written server-side while the buyer was
   * authenticated, so it records who was actually signed in — not `agreement.signerEmail`,
   * which is a string typed into a form and which Stripe lets the client change again on its
   * own checkout page. Getting this wrong creates an account nobody can sign into.
   *
   * The fallback covers sessions opened before the intent existed and still in flight at
   * deploy. Delete it once none can remain.
   */
  const intent = purchaseId ? await getPurchaseIntent(purchaseId) : null;
  if (purchaseId && !intent) {
    console.warn("[fulfillment] purchase intent missing", purchaseId, session.id);
  }
  if (intent?.consumedAt) {
    console.log("[fulfillment] intent already consumed, replay", purchaseId);
  }
  const email = intent?.accountEmail ?? agreement.signerEmail;

  /**
   * A placeholder, deliberately. The real slug is assigned by the wizard.
   *
   * This used to be `slugifyBrand(agreement.clientLegalName)`, which is stable per legal
   * entity — so a returning client buying a second site produced the *same* slug as their
   * first, and `upsertSite` merged the new purchase into their existing live site: status
   * flipped back to `pending-onboarding`, `sessionId` and `name` overwritten, and the old
   * `stripeSubscriptionId` left in place while the subscription they had just paid for was
   * orphaned. Silent, and it destroyed the record of a working site.
   *
   * Derived from the checkout session because that is what identifies this purchase and
   * nothing else. Being a pure function of the session id also means a caller can compute
   * the redirect target without reading anything back.
   */
  const slug = pendingSlugFor(session.id);

  await createPendingSite(email, {
    slug,
    name: agreement.clientLegalName || "(pending)",
    plan,
    status: "pending-onboarding",
    sessionId: session.id,
    signerEmail: agreement.signerEmail,
    signerName: agreement.signerName,
    onboardingCompletedAt: null,
    addedAt: Date.now(),
    // The agreement record is written with a 30-day TTL, so copying its identity here is what
    // keeps "which terms authorised this site" answerable afterwards.
    agreementId,
    agreementPdfUrl: agreement.pdfUrl,
    agreementVersion: agreement.agreementVersion,
    ...(purchaseId ? { purchaseId } : {}),
    // The Customer that actually paid, so metering and consolidation have a handle without
    // re-deriving one. `customer` is a string in the webhook payload.
    ...(typeof session.customer === "string" ? { stripeCustomerId: session.customer } : {}),
  });
  console.log("[fulfillment] pending site created", email, slug, plan);

  if (intent) await markIntentConsumed(intent, slug);

  /**
   * Keep the signed agreement past its TTL now that it has been paid for.
   *
   * `saveAgreement` sets a 30-day expiry, which was fine when the record's only job was to
   * survive the gap between signing and checkout. It is now the audit trail behind a live
   * site — and for the master/addendum model it is the thing later addenda are written
   * against. Losing it after a month is not acceptable.
   *
   * Best effort: the site fields copied above are what the app reads, so a failure here costs
   * the audit copy, not the client's access.
   */
  await persistAgreement(agreementId).catch((e) =>
    console.error("[fulfillment] could not persist agreement", agreementId, e),
  );

  // Payment cleared, so any consent held since signing becomes real. Its own try/catch: a
  // client who paid must still get their site record even if the consent promotion fails, and
  // the failure is recoverable by hand from the pending key.
  try {
    const promoted = await promotePendingConsent(agreementId, email);
    if (promoted) {
      console.log("[fulfillment] sms consent activated", email, promoted.phone);

      // With double opt-in on, promotion leaves the consent pending-confirmation and this
      // message is what lets them complete it. Its own catch: a failed send is recoverable
      // from the portal, a thrown error here is not.
      if (doubleOptInEnabled()) {
        await sendSms({
          to: promoted.phone,
          body:
            "Juneau Digital Designs: reply YES to confirm you want a text summary " +
            "after each call. Msg & data rates may apply. Reply STOP to opt out, " +
            "HELP for help.",
        }).catch((e) => console.error("[fulfillment] confirmation send failed", promoted.phone, e));
      }
    }
  } catch (e) {
    console.error("[fulfillment] sms consent promotion failed", agreementId, e);
  }

  return { slug, email, plan };
}

/**
 * The placeholder slug a paid session becomes, before the wizard renames it.
 *
 * Pure and exported so the redirect target can be derived without a KV read, and so the one
 * place that decides this shape is the same one that writes it.
 */
export function pendingSlugFor(sessionId: string): string {
  return `pending-${sessionId.slice(-8)}`;
}
