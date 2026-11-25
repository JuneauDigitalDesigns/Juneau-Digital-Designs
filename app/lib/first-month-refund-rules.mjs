/**
 * The first-month refund rules (Terms of Service v7 §2.2, approved word for word 2026-11-24), as
 * pure functions. Plain ESM so the test suite runs the real rules.
 *
 * "If you cancel within thirty (30) days of your first payment, we refund your plan's first
 * monthly fee to the payment method you paid with. The onboarding fee is never refunded, and
 * neither is anything else charged in that time, such as an add-on or call-minute overage. This
 * refund is available once per business, and not when the Service ends for breach under Section
 * 12 or after you have filed a chargeback."
 *
 * And §1.2: the Service ends on the day the refund is issued (Xander: "service ends on the refund
 * day").
 *
 * What each rule here stands for:
 *   - the window: 30 days from the moment the subscription's first invoice was paid;
 *   - "your first payment": the account's first, so a second site on an account that already had
 *     one doesn't open a new window (once per business);
 *   - "your plan's first monthly fee": the plan line of that first invoice only, net of any
 *     discount on it. Never the onboarding line, never the Search add-on, never a proration;
 *   - a dispute on that payment (a chargeback) closes it;
 *   - a refund already recorded for the account closes it.
 *
 * Breach (§12) is not decided here: a client cancelling from the portal is not being ended for
 * breach, and an operator ending a client for breach never goes through the portal's cancel.
 */

export const REFUND_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * @typedef {"outside-window" | "already-used" | "not-first-payment" | "disputed" | "no-plan-charge" | "not-active"} RefundRefusal
 */

/**
 * The plan line of the first invoice: the one recurring plan price on it that isn't a proration.
 * Its amount is net of discounts on that line, because what comes back is what was paid for it.
 *
 * @param {{ amount: number, proration?: boolean, priceId?: string | null, discountCents?: number }[]} lines
 * @param {Set<string>} planPriceIds every plan price, current and grandfathered
 * @returns {{ amountCents: number, priceId: string } | null} null when there is not exactly one
 */
export function planLineOf(lines, planPriceIds) {
  const plan = lines.filter((l) => !l.proration && l.priceId && planPriceIds.has(l.priceId));
  if (plan.length !== 1) return null;
  const [line] = plan;
  const amountCents = Math.max(0, line.amount - (line.discountCents ?? 0));
  return { amountCents, priceId: /** @type {string} */ (line.priceId) };
}

/**
 * May this cancellation take the first-month refund, and of how much?
 *
 * @param {{
 *   nowMs: number,
 *   subscriptionActive: boolean,
 *   firstPaidAtMs: number | null,
 *   planLineCents: number | null,
 *   paidCents: number,
 *   refundedCents: number,
 *   disputed: boolean,
 *   alreadyUsed: boolean,
 *   otherBilledSites: boolean,
 * }} input
 * @returns {{ eligible: true, amountCents: number, windowEndsAt: number }
 *         | { eligible: false, reason: RefundRefusal, windowEndsAt: number | null }}
 */
export function refundEligibility(input) {
  const windowEndsAt = input.firstPaidAtMs == null ? null : input.firstPaidAtMs + REFUND_WINDOW_MS;
  /** @param {RefundRefusal} reason */
  const no = (reason) => ({ eligible: /** @type {const} */ (false), reason, windowEndsAt });

  if (!input.subscriptionActive) return no("not-active");
  if (input.alreadyUsed) return no("already-used");
  if (input.otherBilledSites) return no("not-first-payment");
  if (windowEndsAt == null || input.nowMs >= windowEndsAt) return no("outside-window");
  if (input.disputed) return no("disputed");

  // Never more than is still refundable on that payment (a partial refund by hand, say).
  const refundable = Math.max(0, input.paidCents - input.refundedCents);
  const amountCents = Math.min(input.planLineCents ?? 0, refundable);
  if (amountCents <= 0) return no("no-plan-charge");

  return { eligible: true, amountCents, windowEndsAt };
}

/** "$97", "$1,097", "$96.50": the refund as the card and the email state it. @param {number} cents */
export function formatRefundAmount(cents) {
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
