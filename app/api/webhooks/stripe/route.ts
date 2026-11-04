import { NextResponse, after } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { provisionPaidSession } from "@/app/lib/checkout-fulfillment";
import { getAccount, saveAccount } from "@/app/lib/account-store";
import { upsertSite } from "@jdd/schema";
import { getSlugBySubscription, removePublishedFeaturedSite } from "@/app/lib/cancel-kv";
import { claimWelcomeEmailSend, clearWelcomeEmailMark, getAgreement } from "@/app/lib/kv";
import { masterRefFor } from "@/app/lib/held-agreement";
import { sendWelcomeEmail } from "@/app/lib/welcome-email";
import { deletePayCode, getOrder, transitionOrder } from "@/app/lib/operator-orders";
import { planOfSubscription } from "@/app/lib/plan-billing";
import { getPlanChange, savePlanChange } from "@/app/lib/plan-change";
import { dropBillingCache } from "@/app/lib/portal-kv";
import type Stripe from "stripe";
import type { PortalPlan } from "@jdd/schema";

export const runtime = "nodejs";

const VALID_PLANS: PortalPlan[] = ["starter", "growth", "enterprise"];

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: "Missing signature config" }, { status: 400 });
  }

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "bad signature";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // An operator order's payment link lapsed unpaid (Checkout Sessions live 24 hours). The order
  // shows "Link expired" so a fresh one can be sent, and the short code stops resolving. The
  // Site ID stays claimed: a lapsed link is a client who hasn't paid yet, not one who said no —
  // only Cancel frees it.
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    if (orderId) {
      try {
        const order = await getOrder(orderId);
        if (order?.status === "awaiting-payment" && order.payment?.checkoutSessionId === session.id) {
          if (order.payment.shortCode) await deletePayCode(order.payment.shortCode);
          await transitionOrder(order, "expired", { kind: "expired", text: "Payment link expired" });
        }
      } catch (e) {
        console.error("[stripe webhook] could not expire order", orderId, session.id, e);
      }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    try {
      // Cancelled because its site moved onto Enterprise: the site lives on, so it keeps its
      // place on the homepage.
      const slug = sub.metadata?.consolidated_into ? null : await getSlugBySubscription(sub.id);
      if (slug) {
        await removePublishedFeaturedSite(slug);
        console.log("[stripe webhook] removed featured site on subscription delete", slug, sub.id);
      }
    } catch (e) {
      console.error("[stripe webhook] featured cleanup failed", sub.id, e);
    }
  }

  // A plan change: the upgrade and plan-sync routes write `plan` themselves the moment Stripe
  // accepts the change, and this reconciles. It is also the ONLY writer for a scheduled downgrade,
  // which takes effect at the period end when nobody is watching: Stripe moves the price as the
  // schedule's second phase begins and fires this event.
  //
  // The plan is read from the subscription's recurring PRICE, never from `metadata.plan`.
  // Metadata only says what the last change wrote, and every later event (a renewal, a card
  // update) re-asserted it, which could quietly revert an operator's change. The price is what
  // the client is actually paying for.
  //
  // Scoped to plan changes by requiring `site_slug` and `account_email`, which only the plan
  // change paths write. A first purchase must not be mistaken for a tier change here.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const slug = sub.metadata?.site_slug;
    const email = sub.metadata?.account_email;

    if (slug && email) {
      const plan = planOfSubscription(sub);
      try {
        const account = await getAccount(email);
        const current = account?.sites.find((s) => s.slug === slug);

        if (!plan || !VALID_PLANS.includes(plan)) {
          console.warn("[stripe webhook] subscription price is not a plan we sell", slug, sub.id);
        } else if (!account || !current) {
          console.warn("[stripe webhook] no site for plan change", email, slug, sub.id);
        } else if (
          sub.status === "canceled" ||
          (current.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id)
        ) {
          // Not the subscription this site is billed on now. A move to Enterprise updates and
          // then cancels each absorbed Growth subscription, and their events can arrive after
          // the site has been repointed at the Enterprise one: taking the plan from them would
          // put the site back on Growth.
          console.log("[stripe webhook] event for a subscription the site no longer bills on", slug, sub.id);
        } else if (current.plan === plan) {
          // Replayed event, or an update about something else entirely: this handler runs on
          // every subscription edit, including cancellations.
          console.log("[stripe webhook] plan already current, nothing to do", slug, plan);
        } else {
          await saveAccount(upsertSite(account, { slug, plan }, Date.now()));
          await dropBillingCache(account.email, slug);
          console.log("[stripe webhook] plan changed", email, slug, current.plan, "→", plan);
        }

        // A scheduled downgrade that has now landed is finished.
        if (plan) {
          const pending = await getPlanChange(email, slug);
          if (pending?.status === "scheduled" && pending.toPlan === plan) {
            // The Starter agreement the client accepted governs from now, so it becomes the
            // account's master here: not when it was accepted, nor when it was scheduled, so a
            // downgrade that is withdrawn first leaves the master the client still holds.
            const accepted = pending.agreementId ? await getAgreement(pending.agreementId) : null;
            const latest = accepted ? await getAccount(email) : null;
            if (accepted && latest) {
              await saveAccount({ ...latest, masterAgreement: masterRefFor(accepted), updatedAt: Date.now() });
            }
            await savePlanChange({ ...pending, status: "done" });
            console.log("[stripe webhook] scheduled plan change complete", slug, plan);
          }
        }
      } catch (e) {
        console.error("[stripe webhook] plan change failed", slug, sub.id, e);
      }
    }
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    /**
     * Fulfilment lives in `checkout-fulfillment.ts` because `/checkout/success` runs it too.
     *
     * This handler is authoritative but asynchronous, so the browser routinely gets back
     * before it fires and finds no site to be sent to. The success page is synchronous with
     * the client but only runs if they actually return. Running both, over one idempotent
     * function, is what makes the post-payment redirect deterministic.
     *
     * The try/catch stays here: a webhook that throws gets retried by Stripe, and a 500 on a
     * session that was already provisioned would be noise.
     */
    /**
     * A Growth → Enterprise move no longer goes through Checkout: it upgrades a subscription in
     * place (`/api/portal/consolidate`). A session still carrying `consolidation_id` is one
     * opened by the old flow. It must never provision a pending site (it does not add one), so
     * it is logged for a person to look at rather than fulfilled.
     */
    const consolidationId = session.metadata?.consolidation_id;
    if (consolidationId) {
      console.error(
        "[stripe webhook] Checkout session from the retired consolidation flow, not fulfilled",
        consolidationId,
        session.id,
      );
    } else {
      try {
        const fulfilled = await provisionPaidSession(session);

        /**
         * The welcome email. Sent from the webhook only — deliberately not from
         * `/checkout/success` — so a client who returns in the browser and a Stripe retry can't
         * both mail them. `provisionPaidSession` is idempotent and returns the same result on a
         * replay, so the once-only guarantee comes from `claimWelcomeEmailSend` (an NX marker
         * per session id), not from provisioning running once.
         *
         * Held when there is no phone choice on the record and the plan is not Enterprise: that
         * combination is a pre-ship agreement whose next steps we can't speak to. Enterprise has
         * no choice by design (deferred to onboarding) and still gets a welcome with neutral
         * phone copy.
         *
         * In `after()` so a slow Resend call never delays the 2xx Stripe needs. A failed send
         * releases the claim so the next retry re-attempts rather than the email being lost.
         */
        // Operator orders send their own welcome email, carrying the portal invite, from inside
        // fulfilment (see `provisionOperatorOrder`).
        if (fulfilled && !fulfilled.welcomeSent) {
          const canSend =fulfilled.receptionistMode != null || fulfilled.plan === "enterprise";
          if (canSend) {
            after(async () => {
              if (!(await claimWelcomeEmailSend(session.id))) return;
              try {
                await sendWelcomeEmail({
                  signerEmail: fulfilled.signerEmail,
                  signerName: fulfilled.signerName,
                  clientLegalName: fulfilled.clientLegalName,
                  plan: fulfilled.plan,
                  receptionistMode: fulfilled.receptionistMode,
                  forwardingNumber: fulfilled.forwardingNumber,
                  siteSlug: fulfilled.slug,
                });
              } catch (e) {
                await clearWelcomeEmailMark(session.id).catch(() => {});
                console.error("[stripe webhook] welcome email failed", session.id, e);
              }
            });
          } else {
            console.log(
              "[stripe webhook] welcome email held — no phone choice on record",
              fulfilled.slug,
            );
          }
        }
      } catch (e) {
        console.error("[stripe webhook] fulfilment failed", session.id, e);
      }
    }
  }

  return NextResponse.json({ received: true });
}

