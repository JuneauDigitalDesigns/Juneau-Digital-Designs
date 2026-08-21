import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { provisionPaidSession } from "@/app/lib/checkout-fulfillment";
import { completeConsolidation, getConsolidation } from "@/app/lib/consolidation";
import { getAccount, saveAccount } from "@/app/lib/account-store";
import { upsertSite } from "@jdd/schema";
import { getSlugBySubscription, removePublishedFeaturedSite } from "@/app/lib/cancel-kv";
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

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    try {
      const slug = await getSlugBySubscription(sub.id);
      if (slug) {
        await removePublishedFeaturedSite(slug);
        console.log("[stripe webhook] removed featured site on subscription delete", slug, sub.id);
      }
    } catch (e) {
      console.error("[stripe webhook] featured cleanup failed", sub.id, e);
    }
  }

  // A plan change. Stripe is the source of truth for what someone pays for, so this — not
  // the upgrade route — is what writes `plan` onto the site record. If the proration invoice
  // fails, no event arrives and the record keeps saying Starter, which is the truth.
  //
  // Scoped to upgrades by requiring `site_slug` and `account_email`: only /api/portal/upgrade
  // sets those. A first purchase also puts `plan` in subscription metadata, and must not be
  // mistaken for a tier change here.
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object as Stripe.Subscription;
    const slug = sub.metadata?.site_slug;
    const email = sub.metadata?.account_email;
    const rawPlan = sub.metadata?.plan ?? "";

    if (slug && email && VALID_PLANS.includes(rawPlan as PortalPlan)) {
      const plan = rawPlan as PortalPlan;
      try {
        const account = await getAccount(email);
        const current = account?.sites.find((s) => s.slug === slug);

        if (!account || !current) {
          console.warn("[stripe webhook] no site for plan change", email, slug, sub.id);
        } else if (current.plan === plan) {
          // Replayed event, or an update about something else entirely — this handler runs
          // on every subscription edit, including cancellations.
          console.log("[stripe webhook] plan already current, nothing to do", slug, plan);
        } else {
          await saveAccount(upsertSite(account, { slug, plan }, Date.now()));
          console.log("[stripe webhook] plan changed", email, slug, current.plan, "→", plan);
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
     * A consolidation pays for a bundle that replaces subscriptions the client already has —
     * it does not add a site. Provisioning one here would leave them with an extra
     * `pending-onboarding` record and a wizard to fill in for a site that already exists.
     */
    const consolidationId = session.metadata?.consolidation_id;
    if (consolidationId) {
      try {
        await finishConsolidation(session, consolidationId);
      } catch (e) {
        console.error("[stripe webhook] consolidation failed", consolidationId, session.id, e);
      }
    } else {
      try {
        await provisionPaidSession(session);
      } catch (e) {
        console.error("[stripe webhook] fulfilment failed", session.id, e);
      }
    }
  }

  return NextResponse.json({ received: true });
}

/**
 * Payment for an Enterprise bundle has cleared — now close the Growth subscriptions it
 * replaces and repoint the sites.
 *
 * Guarded against redelivery on two levels: a record already `done` is left alone, and
 * `completeConsolidation` tracks each cancellation individually so a partial run resumes
 * instead of re-issuing cancels.
 */
async function finishConsolidation(
  session: Stripe.Checkout.Session,
  consolidationId: string,
): Promise<void> {
  if (session.payment_status !== "paid") {
    console.warn("[stripe webhook] consolidation session not paid", consolidationId, session.id);
    return;
  }

  const email = session.metadata?.account_email;
  if (!email) {
    console.error("[stripe webhook] consolidation has no account_email", consolidationId);
    return;
  }

  const record = await getConsolidation(email);
  if (!record || record.id !== consolidationId) {
    console.error("[stripe webhook] no matching consolidation record", consolidationId, email);
    return;
  }
  if (record.status === "done") {
    console.log("[stripe webhook] consolidation already applied, replay", consolidationId);
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    console.error("[stripe webhook] consolidation session has no subscription", session.id);
    return;
  }

  await completeConsolidation(record, subscriptionId);
}
