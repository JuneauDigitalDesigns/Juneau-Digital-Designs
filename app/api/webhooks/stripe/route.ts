import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getAgreement } from "@/app/lib/kv";
import { createPendingSite } from "@/app/lib/account-store";
import { slugifyBrand } from "@/app/lib/intake-queue";
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
            const slug = slugifyBrand(agreement.clientLegalName || agreement.signerName || email);
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
