import { NextResponse, after } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { clerkClient } from "@clerk/nextjs/server";
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

    // Invite customer to the Clerk portal. Runs via after() so the lambda
    // isn't frozen mid-flight; the result is logged because ignoreExisting
    // silently skips sending when the email already has a user/invitation.
    const customerEmail = session.customer_details?.email;
    if (customerEmail) {
      after(async () => {
        try {
          const client = await clerkClient();
          const invitation = await client.invitations.createInvitation({
            emailAddress: customerEmail,
            ignoreExisting: true,
          });
          console.log(
            "[stripe webhook] clerk invite",
            invitation.id,
            invitation.status,
            customerEmail,
          );
        } catch (e) {
          console.error("[stripe webhook] clerk invite failed", customerEmail, e);
        }
      });
    }
  }

  return NextResponse.json({ received: true });
}
