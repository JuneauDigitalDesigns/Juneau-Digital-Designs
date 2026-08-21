import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { stripe } from "@/app/lib/stripe";
import { getPlan } from "@/app/lib/plans";
import { getAgreement } from "@/app/lib/kv";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { getOrCreateCustomerId } from "@/app/lib/plan-billing";
import { savePurchaseIntent } from "@/app/lib/purchase-intent";

/**
 * Open a Stripe Checkout Session for a purchase the caller is already signed in for.
 *
 * Authenticated, which it was not before. The whole point of moving the Clerk gate ahead of
 * the agreement is that by the time money is involved we know exactly who is buying — so the
 * account this purchase lands on is decided here, from the session, and written to a
 * purchase intent. The webhook reads that decision rather than re-deriving it from an email
 * the client typed.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }

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

  const account = await resolveAccountForUser(userId);
  if (!account) {
    // /start creates the account before it hands off to the agreement, so reaching checkout
    // without one means the funnel was skipped rather than followed.
    return NextResponse.json({ error: "No account for this login" }, { status: 403 });
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

  /**
   * An addendum only authorises a purchase if it hangs off *this account's* master.
   *
   * Without the check, an addendum id is a bearer token: it names no account, so one
   * client's could be replayed by another to buy under terms they never signed. The plan
   * match above does not catch that — both documents can be for the same tier.
   */
  if (agreement.kind === "addendum") {
    const master = account.masterAgreement;
    if (!master?.agreementId || agreement.parentAgreementId !== master.agreementId) {
      console.error(
        "[/api/checkout] addendum parent does not match the account's master",
        account.email,
        agreement.id,
        agreement.parentAgreementId,
      );
      return NextResponse.json({ error: "Agreement does not belong to this account" }, { status: 403 });
    }
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  const line_items: { price: string; quantity: number }[] = [
    { price: cfg.monthlyPriceId, quantity: 1 },
  ];
  if (cfg.onboardingPriceId) {
    line_items.push({ price: cfg.onboardingPriceId, quantity: 1 });
  }

  let customerId: string;
  try {
    customerId = await getOrCreateCustomerId(account);
  } catch (e) {
    console.error("[/api/checkout] customer resolution failed", account.email, e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  // Written before the redirect, so the record exists no matter how the session ends. An
  // intent that is never consumed is an abandoned checkout, which is worth knowing about.
  const purchaseId = randomUUID();
  try {
    await savePurchaseIntent({
      id: purchaseId,
      clerkUserId: userId,
      accountEmail: account.email,
      plan: cfg.slug,
      agreementId: agreement_id,
      createdAt: Date.now(),
    });
  } catch (e) {
    console.error("[/api/checkout] could not record purchase intent", e);
    return NextResponse.json({ error: "Could not start checkout" }, { status: 500 });
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items,
      // `customer`, never `customer_email`: the latter creates a new Customer every time, so
      // a returning client would get a second one and could not pay with the card already on
      // file. Stripe rejects both together.
      customer: customerId,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
      metadata: { plan: cfg.slug, agreement_id, purchase_id: purchaseId },
      subscription_data: {
        metadata: { plan: cfg.slug, agreement_id, purchase_id: purchaseId },
      },
      allow_promotion_codes: true,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.error("[/api/checkout] stripe.checkout.sessions.create failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
