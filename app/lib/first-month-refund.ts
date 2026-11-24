import "server-only";
import type Stripe from "stripe";
import { Redis } from "@upstash/redis";
import { normalizeEmail, type PortalAccount, type PortalSite } from "@jdd/schema";
import { stripe } from "./stripe";
import { planPriceTable, releaseScheduledChange } from "./plan-billing";
import { formatRefundAmount, planLineOf, refundEligibility } from "./first-month-refund-rules.mjs";

/**
 * The first-month refund (Terms of Service v7 §2.2 and §1.2, approved word for word 2026-11-24):
 * cancel within 30 days of your first payment and the plan's first monthly fee is refunded to
 * your card, never the onboarding fee, and the Service ends that day.
 *
 * Three steps, in this order, each safe to repeat:
 *
 *   1. **Claim.** One record per account (`jdd:first-month-refund:v1:<email>`), written NX. It is
 *      both "once per business" and the resume point for a retry.
 *   2. **Refund** the first invoice's plan line, and only that. Before creating one, Stripe is
 *      asked whether this payment already carries our refund (metadata `jdd_kind`), and the
 *      create itself carries an idempotency key on the invoice id. So a retry, a double click or
 *      two tabs never refund twice: the KV claim stops a second run, and if the claim was lost
 *      the refund on the payment is found instead of made again.
 *   3. **End the subscription today**, with no proration and no new invoice. An overage already
 *      used is still billed: `usage-billing` invoices a cancelled subscription's final month on
 *      its own invoice once it has closed.
 *
 * Refund before cancel, deliberately: if the refund fails nothing has changed and the client can
 * try again; if the cancel fails after the refund, the claim says "refunded" and the next attempt
 * resumes at the cancel rather than refunding again.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const REFUND_KIND = "first-month-refund";
const claimKey = (email: string) => `jdd:first-month-refund:v1:${normalizeEmail(email)}`;

export interface RefundClaim {
    status: "started" | "refunded" | "done";
    subscriptionId: string;
    invoiceId: string;
    amountCents: number;
    siteSlug: string;
    refundId?: string;
    startedAt: number;
    refundedAt?: number;
    endedAt?: number;
}

export async function getRefundClaim(email: string): Promise<RefundClaim | null> {
    return (await getRedis().get<RefundClaim>(claimKey(email))) ?? null;
}

async function saveRefundClaim(email: string, claim: RefundClaim): Promise<void> {
    await getRedis().set(claimKey(email), claim);
}

/** What the card needs, and what the cancel acts on: read live from Stripe, never cached. */
export type RefundQuote =
    | {
          eligible: true;
          amountCents: number;
          amountText: string;
          windowEndsAt: number;
          invoiceId: string;
          payment: { paymentIntentId?: string; chargeId?: string };
      }
    | {
          eligible: false;
          reason: "outside-window" | "already-used" | "not-first-payment" | "disputed" | "no-plan-charge" | "not-active";
          windowEndsAt: number | null;
      };

/** Does any other site on the account bill on a different subscription? Then this isn't its first payment. */
function hasOtherBilledSite(account: PortalAccount, site: PortalSite, subscriptionId: string): boolean {
    return account.sites.some(
        (s) =>
            s.slug !== site.slug &&
            Boolean(s.stripeSubscriptionId || s.sessionId) &&
            s.stripeSubscriptionId !== subscriptionId,
    );
}

/** The subscription's first paid invoice: the one that opened it, else the earliest paid. */
async function firstPaidInvoice(subscriptionId: string): Promise<Stripe.Invoice | null> {
    const list = await stripe.invoices.list({ subscription: subscriptionId, status: "paid", limit: 100 });
    const paid = list.data.filter((i) => i.status_transitions?.paid_at);
    const opening = paid.find((i) => i.billing_reason === "subscription_create");
    if (opening) return opening;
    return paid.sort((a, b) => (a.status_transitions.paid_at ?? 0) - (b.status_transitions.paid_at ?? 0))[0] ?? null;
}

/** The payment that settled an invoice, and the charge behind it. */
async function paymentOf(invoice: Stripe.Invoice): Promise<{
    paymentIntentId?: string;
    chargeId?: string;
    charge: Stripe.Charge | null;
}> {
    const payments = await stripe.invoicePayments.list({ invoice: invoice.id!, limit: 10 });
    const paid = payments.data.find((p) => p.status === "paid") ?? payments.data[0];
    const pi = paid?.payment?.payment_intent;
    const ch = paid?.payment?.charge;
    const paymentIntentId = typeof pi === "string" ? pi : pi?.id;
    const chargeId = typeof ch === "string" ? ch : ch?.id;

    if (paymentIntentId) {
        const intent = await stripe.paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge"] });
        const latest = intent.latest_charge;
        const charge = latest && typeof latest === "object" ? latest : null;
        return { paymentIntentId, ...(charge ? { chargeId: charge.id } : {}), charge };
    }
    if (chargeId) return { chargeId, charge: await stripe.charges.retrieve(chargeId) };
    return { charge: null };
}

function planPriceIds(): Set<string> {
    return new Set(
        Object.values(planPriceTable()).flatMap((p) => [p.monthly, ...p.legacy].filter((x): x is string => Boolean(x))),
    );
}

/**
 * May this site's cancellation take the first-month refund right now, and of how much?
 *
 * Read-only. The GET behind the cancel card and the POST that acts both come here, so the card
 * can never promise what the cancel then won't do (the POST also re-checks the card's `expect`).
 */
export async function quoteFirstMonthRefund(
    account: PortalAccount,
    site: PortalSite,
    subscription: Stripe.Subscription,
    nowMs = Date.now(),
): Promise<RefundQuote> {
    const claim = await getRefundClaim(account.email);
    // A claim still in progress for THIS subscription is a refund to finish, not "already used".
    const resuming = claim && claim.status !== "done" && claim.subscriptionId === subscription.id;

    const invoice = await firstPaidInvoice(subscription.id);
    const firstPaidAtMs = invoice?.status_transitions?.paid_at ? invoice.status_transitions.paid_at * 1000 : null;

    const lines = (invoice?.lines?.data ?? []).map((l) => {
        const price = l.pricing?.price_details?.price;
        return {
            amount: l.amount,
            proration: Boolean(
                l.parent?.subscription_item_details?.proration ?? l.parent?.invoice_item_details?.proration,
            ),
            priceId: typeof price === "string" ? price : price?.id ?? null,
            discountCents: (l.discount_amounts ?? []).reduce((sum, d) => sum + d.amount, 0),
        };
    });
    const planLine = planLineOf(lines, planPriceIds());

    const payment = invoice ? await paymentOf(invoice) : { charge: null };
    const charge = payment.charge;

    const verdict = refundEligibility({
        nowMs,
        subscriptionActive: subscription.status === "active" || subscription.status === "trialing" || Boolean(resuming),
        firstPaidAtMs,
        planLineCents: resuming ? claim.amountCents : planLine?.amountCents ?? null,
        paidCents: charge?.amount ?? invoice?.amount_paid ?? 0,
        // A refund we already made is counted back in when resuming, so finishing it isn't refused.
        refundedCents: resuming ? 0 : charge?.amount_refunded ?? 0,
        disputed: Boolean(charge?.disputed),
        alreadyUsed: Boolean(claim) && !resuming,
        otherBilledSites: hasOtherBilledSite(account, site, subscription.id),
    });

    if (!verdict.eligible || !invoice?.id) {
        return verdict.eligible
            ? { eligible: false, reason: "no-plan-charge", windowEndsAt: verdict.windowEndsAt }
            : verdict;
    }
    return {
        eligible: true,
        amountCents: verdict.amountCents,
        amountText: formatRefundAmount(verdict.amountCents),
        windowEndsAt: verdict.windowEndsAt,
        invoiceId: invoice.id,
        payment: {
            ...(payment.paymentIntentId ? { paymentIntentId: payment.paymentIntentId } : {}),
            ...(payment.chargeId ? { chargeId: payment.chargeId } : {}),
        },
    };
}

export type RefundCancelResult =
    | { ok: true; refundId: string; amountCents: number; amountText: string; endedAt: number }
    | { ok: false; code: "claimed" | "refund-failed" | "cancel-failed"; message: string };

/**
 * Refund the first monthly fee and end the subscription today. `quote` must come from
 * `quoteFirstMonthRefund` in the same request and be eligible.
 */
export async function refundFirstMonthAndEnd(input: {
    account: PortalAccount;
    site: PortalSite;
    subscription: Stripe.Subscription;
    quote: Extract<RefundQuote, { eligible: true }>;
}): Promise<RefundCancelResult> {
    const { account, site, subscription, quote } = input;
    const email = account.email;
    const now = Date.now();

    // 1. Claim, once per business. A claim for this subscription that isn't done is resumed.
    let claim: RefundClaim = {
        status: "started",
        subscriptionId: subscription.id,
        invoiceId: quote.invoiceId,
        amountCents: quote.amountCents,
        siteSlug: site.slug,
        startedAt: now,
    };
    const won = (await getRedis().set(claimKey(email), claim, { nx: true })) === "OK";
    if (!won) {
        const existing = await getRefundClaim(email);
        if (!existing || existing.subscriptionId !== subscription.id) {
            return { ok: false, code: "claimed", message: "The first-month refund has already been used on this account." };
        }
        if (existing.status === "done" && existing.refundId && existing.endedAt) {
            return {
                ok: true,
                refundId: existing.refundId,
                amountCents: existing.amountCents,
                amountText: formatRefundAmount(existing.amountCents),
                endedAt: existing.endedAt,
            };
        }
        claim = existing;
    }

    // 2. Refund the plan line of the first invoice, once.
    let refundId = claim.refundId;
    if (!refundId) {
        try {
            const target = quote.payment.paymentIntentId
                ? { payment_intent: quote.payment.paymentIntentId }
                : quote.payment.chargeId
                  ? { charge: quote.payment.chargeId }
                  : null;
            if (!target) throw new Error("no payment on the first invoice");

            const prior = await stripe.refunds.list({ ...target, limit: 100 });
            const ours = prior.data.find((r) => r.metadata?.jdd_kind === REFUND_KIND && r.status !== "failed" && r.status !== "canceled");
            const refund =
                ours ??
                (await stripe.refunds.create(
                    {
                        ...target,
                        amount: claim.amountCents,
                        reason: "requested_by_customer",
                        metadata: {
                            jdd_kind: REFUND_KIND,
                            invoice_id: claim.invoiceId,
                            subscription_id: subscription.id,
                            site_slug: site.slug,
                            account_email: email,
                        },
                    },
                    { idempotencyKey: `jdd-${REFUND_KIND}-${claim.invoiceId}` },
                ));
            refundId = refund.id;
            claim = { ...claim, status: "refunded", refundId, refundedAt: Date.now() };
            await saveRefundClaim(email, claim);
        } catch (e) {
            console.error("[first-month-refund] refund failed", email, subscription.id, e);
            // Nothing was refunded, so the claim is released and the client can try again.
            if (claim.status === "started") await getRedis().del(claimKey(email)).catch(() => {});
            return { ok: false, code: "refund-failed", message: "We couldn't issue the refund, and nothing has changed." };
        }
    }

    // 3. End the subscription today. No proration, no closing invoice.
    try {
        const current = await stripe.subscriptions.retrieve(subscription.id);
        if (current.status !== "canceled") {
            if (current.schedule) await releaseScheduledChange(subscription.id);
            await stripe.subscriptions.cancel(subscription.id, { prorate: false, invoice_now: false });
        }
    } catch (e) {
        console.error("[first-month-refund] refunded but the subscription didn't end; retry resumes here", email, subscription.id, refundId, e);
        return {
            ok: false,
            code: "cancel-failed",
            message: "Your refund went through, but we couldn't finish ending your service. Please try again.",
        };
    }

    const endedAt = Date.now();
    claim = { ...claim, status: "done", refundId, endedAt };
    await saveRefundClaim(email, claim);
    console.log("[first-month-refund] refunded and ended", email, site.slug, subscription.id, refundId, claim.amountCents);
    return { ok: true, refundId, amountCents: claim.amountCents, amountText: formatRefundAmount(claim.amountCents), endedAt };
}
