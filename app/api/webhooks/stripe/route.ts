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
    console.log(
      "[stripe webhook] checkout.session.completed",
      session.id,
      session.metadata?.plan,
      session.customer_details?.email,
    );

    // Portal access is no longer granted by a Clerk invitation here. After
    // onboarding, /api/onboarding attaches the site to an email-keyed account record,
    // the client self-serve signs up at /portal/sign-up, and the Clerk
    // user.created webhook (with a portal-load fallback) provisions their
    // "building" portal. Sending an invitation too would conflict with the
    // self-serve sign-up flow.
  }

  return NextResponse.json({ received: true });
}
