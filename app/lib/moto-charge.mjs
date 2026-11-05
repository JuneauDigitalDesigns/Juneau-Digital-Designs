import { addMonthsUtc } from "./billing-periods.mjs";

/**
 * The rules of the card path ("Enter card", Stripe's phone-payment MOTO entry), kept pure so the
 * test runs the same code the routes do.
 *
 * How the path works, as Stripe described it to Xander: the Customer is created first, the
 * operator types the card into that Customer's page in the Stripe Dashboard (so the card number
 * is only ever in Stripe), and the agency then creates the subscription against that Customer.
 * Nothing in our code sees a card number, only Stripe's PaymentMethod id, brand and last 4.
 */

/** What a MOTO site carries as `sessionId`: there is no Checkout Session, and this keys fulfilment. */
export const MOTO_REF_PREFIX = "moto:";

/**
 * The fulfilment key for a card-path payment. `createPendingSite` and the welcome-email claim
 * are idempotent on it, the way they are on a Checkout Session id. It is deliberately not shaped
 * like a Stripe id, so nothing mistakes it for a session it could retrieve.
 *
 * @param {string} subscriptionId
 */
export function motoRef(subscriptionId) {
  return `${MOTO_REF_PREFIX}${subscriptionId}`;
}

/**
 * The card to charge: the newest one added to the Customer after the operator chose "Enter card".
 *
 * A card that was already on the Customer (an existing client's) is never used: the client agreed
 * to the card read out on this call, not to whatever we happened to have on file.
 *
 * @param {{ id: string, created: number, card?: { brand?: string, last4?: string, exp_month?: number, exp_year?: number } | null }[]} paymentMethods
 *   Stripe PaymentMethods of type card; `created` is in epoch seconds, as Stripe returns it.
 * @param {number} startedAtMs  When "Enter card" was chosen, epoch ms.
 */
export function pickMotoCard(paymentMethods, startedAtMs) {
  // Stripe timestamps are whole seconds; allow the second the order was stamped in.
  const since = Math.floor(startedAtMs / 1000);
  const fresh = paymentMethods.filter((pm) => pm.created >= since).sort((a, b) => b.created - a.created);
  return fresh[0] ?? null;
}

/**
 * Whether a charge may go ahead, before anything is sent to Stripe.
 *
 * The amount is the order's, set by the server from Schedule A. The console sends back the
 * amount it showed the operator (the one read aloud), and Stripe's own preview of the first
 * invoice has to agree with both. Any difference means someone would be charged something other
 * than what they agreed to on the call, so the charge is refused.
 *
 * @param {{ status: string, method: string | undefined, expectedCents: number,
 *           requestedCents: unknown, previewCents: number | null }} input
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function chargeGate({ status, method, expectedCents, requestedCents, previewCents }) {
  if (status !== "awaiting-payment") {
    return { ok: false, code: "bad-status", message: `Can't charge while the order is ${status}.` };
  }
  if (method !== "dashboard-moto") {
    return { ok: false, code: "not-card", message: "This order is set up for a payment link, not a card." };
  }
  if (!Number.isInteger(expectedCents) || expectedCents <= 0) {
    return { ok: false, code: "no-amount", message: "The order has no amount to charge." };
  }
  if (requestedCents !== expectedCents) {
    return {
      ok: false,
      code: "amount-mismatch",
      message: "The amount on screen isn't the order's amount. Reload the order before charging.",
    };
  }
  if (previewCents !== expectedCents) {
    return {
      ok: false,
      code: "price-mismatch",
      message: "Stripe would charge a different amount from the order's, so nothing was charged.",
    };
  }
  return { ok: true };
}

/**
 * What a failed first payment means for the operator. `error_if_incomplete` makes Stripe refuse
 * to create the subscription at all when the first invoice can't be paid, so in every case
 * below nothing was charged.
 *
 * @param {{ type?: string, code?: string, decline_code?: string, message?: string } | null | undefined} err
 * @returns {"requires_action" | "declined" | "error"}
 */
export function classifyChargeError(err) {
  const code = `${err?.code ?? ""} ${err?.decline_code ?? ""}`;
  if (/authentication_required|requires_action/.test(code)) return "requires_action";
  if (err?.type === "StripeCardError" || /card_declined|insufficient_funds|expired_card|incorrect_cvc/.test(code)) {
    return "declined";
  }
  return "error";
}

/**
 * The idempotency key for creating the subscription. One per attempt: a double click (or a
 * retried request) reuses it and Stripe returns the first result instead of charging twice; a
 * definitive decline moves to the next attempt so a corrected card can be tried.
 *
 * @param {string} orderId
 * @param {number} attempt
 */
export function chargeIdempotencyKey(orderId, attempt) {
  return `jdd-order-charge:${orderId}:${attempt}`;
}

/**
 * The order a paid invoice belongs to, when it is the first invoice of a card-path subscription.
 * Reads both invoice shapes: the subscription's metadata moved under
 * `parent.subscription_details` in Stripe's 2025 API versions.
 *
 * Link payments also produce a `subscription_create` invoice with `order_id`, and are fulfilled
 * by `checkout.session.completed`; the `payment_method: "dashboard-moto"` marker is what keeps
 * this from fulfilling them a second time under a different key.
 *
 * @param {Record<string, any>} invoice
 * @returns {{ orderId: string, subscriptionId: string, customerId: string | null, amountPaid: number | null } | null}
 */
export function motoInvoiceOrder(invoice) {
  if (invoice?.billing_reason !== "subscription_create") return null;
  const details = invoice.parent?.subscription_details ?? invoice.subscription_details ?? null;
  const meta = details?.metadata ?? {};
  if (!meta.order_id || meta.payment_method !== "dashboard-moto") return null;
  const sub = details?.subscription ?? invoice.subscription;
  const subscriptionId = typeof sub === "string" ? sub : sub?.id;
  if (!subscriptionId) return null;
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
  return {
    orderId: meta.order_id,
    subscriptionId,
    customerId: customer,
    amountPaid: typeof invoice.amount_paid === "number" ? invoice.amount_paid : null,
  };
}

/**
 * The Stripe Dashboard page for a Customer, where the operator adds the card. Test-mode keys open
 * the test Dashboard, so a test run can never land on a live Customer.
 *
 * @param {string} customerId
 * @param {string | undefined} secretKey
 */
export function dashboardCustomerUrl(customerId, secretKey) {
  const test = /^(sk|rk)_test_/.test(secretKey ?? "");
  return `https://dashboard.stripe.com/${test ? "test/" : ""}customers/${encodeURIComponent(customerId)}`;
}

/**
 * When the second payment falls, for the checkout's "Then $497.00 per month, starting …".
 * Stripe anchors a new subscription's cycle at the moment it is created, so the next charge is
 * one month (or one year) on from the charge, on the same day: v5.3 §3.1.
 *
 * @param {number} chargeMs
 * @param {"monthly" | "annual"} period
 */
export function nextPaymentAt(chargeMs, period) {
  return addMonthsUtc(chargeMs, period === "annual" ? 12 : 1);
}

/**
 * The receipt the confirmation screen shows, read from the subscription Stripe returned
 * (`latest_invoice` and `default_payment_method` expanded). Every figure is Stripe's: what was
 * actually paid, the invoice number the emailed receipt carries, and the next charge as the
 * subscription itself has it.
 *
 * @param {Record<string, any>} sub
 */
export function chargeReceipt(sub) {
  const invoice = sub?.latest_invoice && typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
  const pm = sub?.default_payment_method && typeof sub.default_payment_method === "object" ? sub.default_payment_method : null;
  const item = sub?.items?.data?.[0];
  const paidSeconds = invoice?.status_transitions?.paid_at ?? invoice?.created ?? null;
  return {
    amountPaidCents: typeof invoice?.amount_paid === "number" ? invoice.amount_paid : null,
    paidAt: paidSeconds ? paidSeconds * 1000 : null,
    invoiceNumber: invoice?.number ?? null,
    card: pm?.card ? { brand: pm.card.brand ?? "card", last4: pm.card.last4 ?? "" } : null,
    nextPaymentAt: item?.current_period_end ? item.current_period_end * 1000 : null,
    nextAmountCents: typeof item?.price?.unit_amount === "number" ? item.price.unit_amount : null,
  };
}

/**
 * The SetupIntent that saves a card typed into the wizard's Stripe card field, as a phone order.
 *
 * The console turns the card field into a PaymentMethod in the browser (Stripe.js; the number
 * goes straight to Stripe), and sends only its `pm_…` id. This attaches it to the order's
 * Customer, confirmed server-side with `moto: true`: the cardholder isn't present, they read the
 * card out on the call, so no 3-D Secure challenge is sent to their phone. `off_session` because
 * the subscription will charge it again at every renewal.
 *
 * @param {{ customerId: string, paymentMethodId: string, orderId: string }} input
 */
export function motoSetupParams({ customerId, paymentMethodId, orderId }) {
  return {
    customer: customerId,
    payment_method: paymentMethodId,
    payment_method_types: ["card"],
    payment_method_options: { card: { moto: true } },
    usage: "off_session",
    confirm: true,
    metadata: { order_id: orderId, payment_method: "dashboard-moto", entry: "wizard-card-field" },
  };
}

/**
 * Stripe's answer when phone-order entry isn't enabled for the account's API: it doesn't treat
 * `moto` as a parameter at all. Recorded from this account on 2026-11-04, in test mode:
 * `StripeInvalidRequestError parameter_unknown - Received unknown parameter:
 * payment_method_options[card][moto]`. The wizard falls back to Dashboard entry when it sees it.
 *
 * @param {{ type?: string, code?: string, param?: string, message?: string } | null | undefined} err
 */
export function isMotoUnavailableError(err) {
  return err?.code === "parameter_unknown" && /\bmoto\b/.test(`${err?.param ?? ""} ${err?.message ?? ""}`);
}

/** A PaymentMethod id as Stripe.js returns it. Anything else is refused before reaching Stripe. */
export function isPaymentMethodId(v) {
  return typeof v === "string" && /^pm_[A-Za-z0-9]{8,}$/.test(v);
}
