import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getAgreement } from "@/app/lib/kv";
import { createPendingSite, getAccount, saveAccount } from "@/app/lib/account-store";
import { upsertSite } from "@jdd/schema";
import { getSlugBySubscription, removePublishedFeaturedSite } from "@/app/lib/cancel-kv";
import { doubleOptInEnabled, promotePendingConsent } from "@/app/lib/sms-consent";
import { sendSms } from "@/app/lib/twilio";
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

    if (session.payment_status === "paid") {
      const agreementId = session.metadata?.agreement_id;
      const rawPlan = session.metadata?.plan ?? "";
      const plan: PortalPlan = VALID_PLANS.includes(rawPlan as PortalPlan)
        ? (rawPlan as PortalPlan)
        : "starter";

      if (agreementId) {
        try {
          const agreement = await getAgreement(agreementId);
          if (agreement) {
            const email = agreement.signerEmail;

            /**
             * A placeholder, deliberately. The real slug is assigned by the wizard.
             *
             * This used to be `slugifyBrand(agreement.clientLegalName)`, which is stable per
             * legal entity — so a returning client buying a second site produced the *same*
             * slug as their first, and `upsertSite` merged the new purchase into their
             * existing live site: status flipped back to `pending-onboarding`, `sessionId`
             * and `name` overwritten, and the old `stripeSubscriptionId` left in place while
             * the subscription they had just paid for was orphaned. Silent, and it destroyed
             * the record of a working site.
             *
             * Derived from the checkout session because that is what identifies this
             * purchase and nothing else. `upsertSiteBySessionId` relocates the site by that
             * same id when the wizard submits, at which point it takes a real slug from the
             * brand name — so nothing downstream ever sees this string for long.
             */
            const slug = `pending-${session.id.slice(-8)}`;
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
            });
            console.log("[stripe webhook] pending site created", email, slug, plan);

            // Payment cleared, so any consent held since signing becomes real. Its own
            // try/catch: a client who paid must still get their site record even if the
            // consent promotion fails, and the failure is recoverable by hand from the
            // pending key. Idempotent, which matters because this handler is replayed.
            try {
              const promoted = await promotePendingConsent(agreementId, email);
              if (promoted) {
                console.log("[stripe webhook] sms consent activated", email, promoted.phone);

                // With double opt-in on, promotion leaves the consent pending-confirmation
                // and this message is what lets them complete it. Its own catch: a failed
                // send is recoverable from the portal, a thrown error here is not.
                if (doubleOptInEnabled()) {
                  await sendSms({
                    to: promoted.phone,
                    body:
                      "Juneau Digital Designs: reply YES to confirm you want a text summary " +
                      "after each call. Msg & data rates may apply. Reply STOP to opt out, " +
                      "HELP for help.",
                  }).catch((e) =>
                    console.error("[stripe webhook] confirmation send failed", promoted.phone, e),
                  );
                }
              }
            } catch (e) {
              console.error("[stripe webhook] sms consent promotion failed", agreementId, e);
            }
          } else {
            console.warn("[stripe webhook] agreement not found", agreementId);
          }
        } catch (e) {
          console.error("[stripe webhook] createPendingSite failed", session.id, e);
        }
      } else {
        console.warn("[stripe webhook] no agreement_id in session metadata", session.id);
      }
    }
  }

  return NextResponse.json({ received: true });
}
