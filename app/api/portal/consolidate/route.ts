import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { growthSitesForConsolidation } from "@jdd/schema";
import { stripe } from "@/app/lib/stripe";
import { getAgreement } from "@/app/lib/kv";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import {
  enterprisePriceId,
  getConsolidation,
  pickHostCustomer,
  saveConsolidation,
  type ConsolidationRecord,
} from "@/app/lib/consolidation";

/**
 * Start a Growth → Enterprise consolidation: open the Checkout Session that pays for the
 * Enterprise bundle.
 *
 * Nothing is cancelled here. The Growth subscriptions are closed in the Stripe webhook once
 * payment has actually cleared — see `lib/consolidation.ts` for why that ordering matters.
 * All this route does is decide the terms of the move, write them down, and hand the client
 * to Stripe.
 */
export async function POST(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  const { account } = ctx;

  let agreementId: string | undefined;
  try {
    ({ agreement_id: agreementId } = (await request.json()) as { agreement_id?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!agreementId) {
    return NextResponse.json({ error: "Missing signed agreement" }, { status: 400 });
  }

  // The signature has to be for Enterprise and has to belong to this account's master.
  // Without both checks an agreement id is a bearer token for a plan change.
  const agreement = await getAgreement(agreementId);
  if (!agreement || agreement.plan !== "enterprise") {
    return NextResponse.json({ error: "Agreement not found or not for Enterprise" }, { status: 400 });
  }
  if (agreement.kind === "addendum") {
    const master = account.masterAgreement;
    if (!master?.agreementId || agreement.parentAgreementId !== master.agreementId) {
      return NextResponse.json({ error: "Agreement does not belong to this account" }, { status: 403 });
    }
  }

  const absorbing = growthSitesForConsolidation(account);
  if (absorbing.length === 0) {
    // Nothing to absorb means this is an ordinary Enterprise purchase, which /start handles.
    return NextResponse.json({ error: "No Growth sites to consolidate" }, { status: 409 });
  }

  const priceId = enterprisePriceId();
  if (!priceId) {
    console.error("[consolidate] STRIPE_PRICE_ENTERPRISE_MONTHLY is not configured");
    return NextResponse.json({ error: "Enterprise isn't configured for billing" }, { status: 500 });
  }

  /**
   * A consolidation already in flight is resumed, not restarted.
   *
   * Re-entering the flow after closing the Stripe tab is ordinary client behaviour, and
   * issuing a fresh id each time would let two Checkout Sessions complete and open two
   * Enterprise subscriptions. Anything past `awaiting-payment` has money attached and must
   * not be re-driven from here at all.
   */
  const existing = await getConsolidation(account.email);
  if (existing && existing.status !== "awaiting-payment" && existing.status !== "stalled") {
    return NextResponse.json(
      { error: "A consolidation is already being applied to this account." },
      { status: 409 },
    );
  }

  const hostCustomerId = existing?.hostCustomerId ?? (await pickHostCustomer(account));
  if (!hostCustomerId) {
    console.error("[consolidate] no Stripe customer found for", account.email);
    return NextResponse.json({ error: "No billing account on file" }, { status: 409 });
  }

  const record: ConsolidationRecord = {
    id: existing?.id ?? randomUUID(),
    accountEmail: account.email,
    hostCustomerId,
    absorbing: absorbing.map((s) => s.slug),
    agreementId,
    status: "awaiting-payment",
    startedAt: existing?.startedAt ?? Date.now(),
    cancelled: existing?.cancelled ?? [],
    updatedAt: Date.now(),
  };
  // Written before the redirect, so a client who pays and never returns is still recoverable.
  await saveConsolidation(record);

  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: hostCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/portal?consolidated=1`,
      cancel_url: `${origin}/portal`,
      // `consolidation_id` is what tells the webhook this is a migration rather than a new
      // site, so it cancels the Growth subscriptions instead of provisioning a pending one.
      metadata: {
        plan: "enterprise",
        agreement_id: agreementId,
        consolidation_id: record.id,
        account_email: account.email,
      },
      subscription_data: {
        metadata: {
          plan: "enterprise",
          agreement_id: agreementId,
          consolidation_id: record.id,
          account_email: account.email,
        },
      },
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Stripe error";
    console.error("[consolidate] checkout session create failed", account.email, e);
    await saveConsolidation({ ...record, status: "stalled", lastError: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
