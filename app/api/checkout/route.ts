import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getPlan } from "@/app/lib/plans";

export async function POST(req: Request) {
  const { plan } = (await req.json()) as { plan?: string };
  const cfg = plan ? getPlan(plan) : null;
  if (!cfg) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const line_items: { price: string; quantity: number }[] = [
    { price: cfg.monthlyPriceId, quantity: 1 },
  ];
  if (cfg.onboardingPriceId) {
    line_items.push({ price: cfg.onboardingPriceId, quantity: 1 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    metadata: { plan: cfg.slug },
    subscription_data: { metadata: { plan: cfg.slug } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
