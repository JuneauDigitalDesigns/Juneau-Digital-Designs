import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getAgreement } from "@/app/lib/kv";
import { clerkClient } from "@clerk/nextjs/server";
import { sendStripeNotification } from "@/app/lib/notification-email";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json(
      { error: "Missing signature config" },
      { status: 400 },
    );
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
    const agreementId = session.metadata?.agreement_id;

    let pdfUrl: string | undefined;
    if (agreementId) {
      try {
        const agreement = await getAgreement(agreementId);
        pdfUrl = agreement?.pdfUrl;
      } catch (e) {
        console.error("[stripe webhook] agreement lookup failed", e);
      }
    }

    // Notify owner via Resend
    sendStripeNotification({
      plan: session.metadata?.plan,
      customerName: session.customer_details?.name,
      customerEmail: session.customer_details?.email,
      amountTotal: session.amount_total,
      subscriptionId:
        typeof session.subscription === "string" ? session.subscription : undefined,
      agreementPdfUrl: pdfUrl,
      sessionId: session.id,
    }).catch((e) => console.error("[stripe webhook] notification email failed", e));

    // Invite customer to Clerk portal
    const customerEmail = session.customer_details?.email;
    if (customerEmail) {
      clerkClient()
        .then((client) =>
          client.invitations.createInvitation({
            emailAddress: customerEmail,
            ignoreExisting: true,
          }),
        )
        .catch((e) => console.error("[stripe webhook] clerk invite failed", e));
    }
  }

  return NextResponse.json({ received: true });
}
