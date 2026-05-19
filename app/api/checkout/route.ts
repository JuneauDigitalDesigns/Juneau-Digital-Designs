import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getPlan } from "@/app/lib/plans";
import { getAgreement } from "@/app/lib/kv";

export async function POST(req: Request) {
  const { plan, agreement_id } = (await req.json()) as {
    plan?: string;
    agreement_id?: string;
  };

  const cfg = plan ? getPlan(plan) : null;
  if (!cfg) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!agreement_id) {
    return NextResponse.json({ error: "Missing signed agreement" }, { status: 400 });
  }

  const agreement = await getAgreement(agreement_id);
  if (!agreement || agreement.plan !== cfg.slug) {
    return NextResponse.json(
      { error: "Agreement not found or does not match selected plan" },
      { status: 400 },
    );
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
    customer_email: agreement.signerEmail,
    success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    metadata: { plan: cfg.slug, agreement_id },
    subscription_data: { metadata: { plan: cfg.slug, agreement_id } },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
