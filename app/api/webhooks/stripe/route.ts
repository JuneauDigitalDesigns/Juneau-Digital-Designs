import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
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
    const makeUrl = process.env.MAKE_WEBHOOK_URL;
    if (makeUrl) {
      fetch(makeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "stripe.checkout.completed",
          plan: session.metadata?.plan,
          email: session.customer_details?.email,
          customer: session.customer,
          subscription: session.subscription,
          amount_total: session.amount_total,
          session_id: session.id,
        }),
      }).catch((e) =>
        console.error("[stripe webhook] make.com forward failed", e),
      );
    }
  }

  return NextResponse.json({ received: true });
}
