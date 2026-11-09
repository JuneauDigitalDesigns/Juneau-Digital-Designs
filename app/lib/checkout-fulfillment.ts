import "server-only";
import type Stripe from "stripe";
import { stripe } from "./stripe";
import { sessionSettled } from "./pay-link.mjs";
import { claimWelcomeEmailSend, clearWelcomeEmailMark, getAgreement, persistAgreement } from "./kv";
import { getPurchaseIntent, markIntentConsumed } from "./purchase-intent";
import { createPendingSite, getAccount, saveAccount } from "./account-store";
import { acquireFulfilLock, getOrder, releaseFulfilLock, transitionOrder } from "./operator-orders";
import { invitePortalUser } from "./portal-invite";
import { sendWelcomeEmail } from "./welcome-email";
import { doubleOptInEnabled, promotePendingConsent } from "./sms-consent";
import { sendSms } from "./twilio";
import type { PortalPlan } from "@jdd/schema";
import type { ReceptionistMode } from "./agreement-types";

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
  /**
   * The phone-handling choice from the signed agreement, and the welcome-email inputs that go
   * with it. Carried out so the webhook can send a tailored welcome email without re-reading
   * the agreement. `receptionistMode`/`forwardingNumber` are absent on Enterprise (deferred to
   * onboarding), upgrades, and agreements signed before this shipped.
   */
  receptionistMode?: ReceptionistMode;
  forwardingNumber?: string;
  clientLegalName: string;
  signerName: string;
  signerEmail: string;
  /**
   * The welcome email has already been dealt with by this path (operator orders send their own,
   * because only the first caller holds the portal invite link). The webhook skips its send.
   */
  welcomeSent?: boolean;
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

  if (!sessionSettled(session)) return null;

  /**
   * An operator-closed client (sold on a call) takes its own path, decided HERE rather than in
   * the webhook. Three callers run this function — the webhook, `/checkout/success`, and the ops
   * order status check — and if any of them fell through to the self-serve code below, it would
   * create a `pending-…` placeholder site, and the `sessionId` idempotency would then lock that
   * wrong slug in for every later caller.
   */
  if (session.metadata?.order_id) return provisionOperatorOrder(session);

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
    // The phone choice made at signing, so the onboarding form opens prefilled and the portal
    // knows a website-only site has no call log. Schema-supported, unlike `forwardingNumber`
    // (which lives on the agreement record only — see FulfilledSession). Absent on Enterprise,
    // upgrades, and pre-ship agreements, where the onboarding form collects it fresh.
    ...(agreement.receptionistMode ? { receptionistMode: agreement.receptionistMode } : {}),
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
  await persistAgreement(agreementId, email).catch((e) =>
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
          // JDD → the owner about their own account, so it rides the approved
          // ACCOUNT_NOTIFICATION campaign rather than any client's own campaign.
          lane: "account",
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

  return {
    slug,
    email,
    plan,
    ...(agreement.receptionistMode ? { receptionistMode: agreement.receptionistMode } : {}),
    ...(agreement.forwardingNumber ? { forwardingNumber: agreement.forwardingNumber } : {}),
    clientLegalName: agreement.clientLegalName,
    signerName: agreement.signerName,
    signerEmail: agreement.signerEmail,
  };
}

/**
 * Fulfil a session that paid for an operator order.
 *
 * The same outcome as self-serve — a pending site on the buyer's account, the agreement kept
 * past its TTL — with three differences, each from the order:
 *
 *   - the slug is the one locked at order time (`slugLocked`), not a `pending-…` placeholder, so
 *     the portal, the console's `clients/` folder and the A2P record all share it;
 *   - identity is the order's email, stated by the operator, since nobody signed in;
 *   - the client is invited to the portal (a Clerk invitation, never a password) and the
 *     welcome email carrying that invite is sent from here, by whichever caller gets here first.
 *     The invite link exists only in this call, so the send cannot be left to the webhook.
 *
 * Idempotent like the rest of this file: `createPendingSite` on `sessionId`, the order's own
 * status, and the welcome email's NX claim on the session id.
 */
async function provisionOperatorOrder(session: Stripe.Checkout.Session): Promise<FulfilledSession | null> {
  return fulfilOperatorPayment(session.metadata?.order_id ?? "", {
    ref: session.id,
    checkoutSessionId: session.id,
    ...(typeof session.customer === "string" ? { customerId: session.customer } : {}),
    ...(typeof session.subscription === "string" ? { subscriptionId: session.subscription } : {}),
    ...(session.amount_total != null ? { amountTotal: session.amount_total } : {}),
    tosAcceptedOnStripe: session.consent?.terms_of_service === "accepted",
  });
}

/**
 * A payment that settles an operator order, from whichever path took it.
 *
 * `ref` is the idempotency key for everything fulfilment writes once: the pending site's
 * `sessionId` (what `createPendingSite` short-circuits on) and the welcome-email claim. A
 * payment link uses its Checkout Session id, as it always has. The card path has no session, so
 * it uses `motoRef(subscriptionId)` (`moto:sub_…`): one subscription per order, and not shaped
 * like anything Stripe could be asked to retrieve.
 */
export interface OperatorPayment {
  ref: string;
  checkoutSessionId?: string;
  customerId?: string;
  subscriptionId?: string;
  amountTotal?: number;
  /** Only a payment link has Stripe's own ToS tick; the card path relies on the verbal one. */
  tosAcceptedOnStripe?: boolean;
  /**
   * Record the subscription on the site. The card path always knows it, and must: its `sessionId`
   * is not a Checkout Session, so the session fallbacks (`resolveSubscriptionId` and friends)
   * would find nothing. The link path is left as it was (plan O3).
   */
  recordSubscriptionOnSite?: boolean;
}

/**
 * Fulfil an operator order once its payment has cleared. Called by the Checkout path above, by
 * the card path's charge route, and by the `invoice.paid` webhook behind it; idempotent for all
 * of them on `payment.ref` and on the order's own status.
 */
export async function fulfilOperatorPayment(orderId: string, payment: OperatorPayment): Promise<FulfilledSession | null> {
  // One winner. A caller that arrives while another is running waits, then finds the order
  // fulfilled and changes nothing, so it can't send a second invitation.
  const deadline = Date.now() + FULFIL_WAIT_MS;
  while (!(await acquireFulfilLock(orderId))) {
    if (Date.now() > deadline) {
      console.error("[fulfillment] gave up waiting for another fulfilment", orderId, payment.ref);
      return null;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  try {
    return await fulfilHoldingLock(orderId, payment);
  } finally {
    await releaseFulfilLock(orderId).catch(() => {});
  }
}

const FULFIL_WAIT_MS = 15_000;

async function fulfilHoldingLock(orderId: string, payment: OperatorPayment): Promise<FulfilledSession | null> {
  const order = await getOrder(orderId);
  if (!order) {
    console.error("[fulfillment] operator order not found", orderId, payment.ref);
    return null;
  }
  const email = order.client.email;
  const result: FulfilledSession = {
    slug: order.siteSlug,
    email,
    plan: order.plan,
    ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
    ...(order.forwardingNumber ? { forwardingNumber: order.forwardingNumber } : {}),
    clientLegalName: order.client.legalName,
    signerName: order.client.contactName,
    signerEmail: email,
    welcomeSent: true,
  };
  if (order.status === "fulfilled") return result;

  const agreement = order.agreementId ? await getAgreement(order.agreementId) : null;
  if (!agreement) console.warn("[fulfillment] operator order has no agreement record", orderId, order.agreementId);

  await createPendingSite(email, {
    slug: order.siteSlug,
    slugLocked: true,
    orderId: order.id,
    name: order.client.dba || order.client.legalName,
    plan: order.plan,
    status: "pending-onboarding",
    sessionId: payment.ref,
    signerEmail: email,
    signerName: order.client.contactName,
    onboardingCompletedAt: null,
    addedAt: Date.now(),
    ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
    ...(order.agreementId ? { agreementId: order.agreementId } : {}),
    ...(agreement ? { agreementPdfUrl: agreement.pdfUrl, agreementVersion: agreement.agreementVersion } : {}),
    ...(payment.customerId ? { stripeCustomerId: payment.customerId } : {}),
    ...(payment.recordSubscriptionOnSite && payment.subscriptionId ? { stripeSubscriptionId: payment.subscriptionId } : {}),
  });
  console.log("[fulfillment] operator site created", email, order.siteSlug, order.plan);

  // The governing agreement, recorded on the account now that it has been paid for. A fresh
  // master for a new client; an addendum leaves the existing master where it is.
  if (agreement && order.agreementKind === "master") {
    const account = await getAccount(email);
    if (account && account.masterAgreement?.agreementId !== agreement.id) {
      await saveAccount({
        ...account,
        masterAgreement: {
          agreementId: agreement.id,
          version: agreement.agreementVersion,
          tierCeiling: order.plan,
          signedAt: Date.parse(agreement.audit.signedAt) || Date.now(),
        },
        updatedAt: Date.now(),
      });
    }
  }
  if (order.agreementId) {
    await persistAgreement(order.agreementId, email).catch((e) =>
      console.error("[fulfillment] could not persist agreement", order.agreementId, e),
    );
  }

  // Order → paid. A cancelled order that still got paid (a race with Cancel) is not refused:
  // the money moved, so the site above stands, and the order is left for a human to look at.
  let current = order;
  if (current.status === "awaiting-payment" || current.status === "expired") {
    current = await transitionOrder(current, "paid", { kind: "paid", text: "Payment received" }, {
      payment: {
        ...(current.payment ?? { method: "link" as const, stripeCustomerId: payment.customerId ?? "" }),
        ...(payment.checkoutSessionId ? { checkoutSessionId: payment.checkoutSessionId } : {}),
        ...(payment.subscriptionId ? { subscriptionId: payment.subscriptionId } : {}),
        ...(payment.amountTotal != null ? { amountTotal: payment.amountTotal } : {}),
        paidAt: Date.now(),
        ...(payment.tosAcceptedOnStripe != null ? { tosAcceptedOnStripe: payment.tosAcceptedOnStripe } : {}),
      },
    });
  } else if (current.status !== "paid") {
    console.error("[fulfillment] operator order paid while", current.status, "— needs a human", orderId, payment.ref);
    return result;
  }

  const invite = await invitePortalUser(email, order.siteSlug);
  current = await transitionOrder(
    current,
    "fulfilled",
    { kind: "invite", text: invite.kind === "invitation" ? "Portal invite sent" : "Site added to existing login" },
    {
      fulfilledAt: Date.now(),
      invite:
        invite.kind === "invitation"
          ? { kind: "invitation", invitationId: invite.invitationId, sentAt: Date.now() }
          : { kind: "existing-login", sentAt: Date.now() },
    },
  );

  if (await claimWelcomeEmailSend(payment.ref)) {
    try {
      await sendWelcomeEmail({
        signerEmail: email,
        signerName: order.client.contactName,
        clientLegalName: order.client.legalName,
        plan: order.plan,
        ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
        ...(order.forwardingNumber ? { forwardingNumber: order.forwardingNumber } : {}),
        siteSlug: order.siteSlug,
        ...(invite.kind === "invitation" ? { inviteUrl: invite.url } : { existingLogin: true }),
      });
    } catch (e) {
      // Release the claim so a retry can send it; the console's Resend invite is the backstop.
      await clearWelcomeEmailMark(payment.ref).catch(() => {});
      console.error("[fulfillment] operator welcome email failed", email, e);
    }
  }
  return result;
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
