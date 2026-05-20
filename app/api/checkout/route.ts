import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { getPlan } from "@/app/lib/plans";
import { getAgreement } from "@/app/lib/kv";

export async function POST(req: Request) {
  let plan: string | undefined;
  let agreement_id: string | undefined;
  try {
    ({ plan, agreement_id } = (await req.json()) as {
      plan?: string;
      agreement_id?: string;
    });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cfg = plan ? getPlan(plan) : null;
  if (!cfg) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }
  if (!agreement_id) {
    return NextResponse.json({ error: "Missing signed agreement" }, { status: 400 });
  }

  let agreement: Awaited<ReturnType<typeof getAgreement>>;
  try {
    agreement = await getAgreement(agreement_id);
  } catch (e) {
    console.error("[/api/checkout] KV lookup failed", e);
    return NextResponse.json({ error: "Could not retrieve agreement" }, { status: 500 });
  }

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

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      customer_email: agreement.signerEmail,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { plan: cfg.slug, agreement_id },
      subscription_data: { metadata: { plan: cfg.slug, agreement_id } },
      allow_promotion_codes: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.error("[/api/checkout] stripe.checkout.sessions.create failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
