/** Terms v7 §2.2: the first-month refund rules, and the four approved cancel-card versions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { REFUND_WINDOW_MS, formatRefundAmount, planLineOf, refundEligibility } from "../app/lib/first-month-refund-rules.mjs";

const PAID = Date.UTC(2026, 10, 1);
const base = { nowMs: PAID + 86_400_000, subscriptionActive: true, firstPaidAtMs: PAID, planLineCents: 9700, paidCents: 39400, refundedCents: 0, disputed: false, alreadyUsed: false, otherBilledSites: false };

test("only the plan line comes back: never onboarding, an add-on or a proration", () => {
  const plans = new Set(["price_web", "price_starter_197"]);
  assert.deepEqual(planLineOf([{ amount: 9700, priceId: "price_web" }, { amount: 29700, priceId: "price_onb" }], plans), { amountCents: 9700, priceId: "price_web" });
  assert.deepEqual(planLineOf([{ amount: 19700, priceId: "price_starter_197", discountCents: 2000 }], plans), { amountCents: 17700, priceId: "price_starter_197" });
  assert.equal(planLineOf([{ amount: 9700, priceId: "price_web", proration: true }], plans), null);
});

test("eligible inside 30 days; refused after, once used, on a second site, or after a chargeback", () => {
  assert.deepEqual(refundEligibility(base), { eligible: true, amountCents: 9700, windowEndsAt: PAID + REFUND_WINDOW_MS });
  assert.equal(refundEligibility({ ...base, nowMs: PAID + REFUND_WINDOW_MS }).reason, "outside-window");
  assert.equal(refundEligibility({ ...base, alreadyUsed: true }).reason, "already-used");
  assert.equal(refundEligibility({ ...base, otherBilledSites: true }).reason, "not-first-payment");
  assert.equal(refundEligibility({ ...base, disputed: true }).reason, "disputed");
  assert.equal(refundEligibility({ ...base, planLineCents: 0 }).reason, "no-plan-charge");
  assert.equal(refundEligibility({ ...base, paidCents: 5000 }).amountCents, 5000);
  assert.equal(formatRefundAmount(109700), "$1,097");
});

test("the cancel card and email have the four approved versions (E5, E6, B5)", async () => {
  const c = await import("../app/lib/plan-change-copy.ts");
  const refund = { amount: "$97" };
  assert.match(c.cancellationCardText({ periodEnd: "Dec 1", refund, hasMinutes: true }), /refund your first monthly fee of \$97 to your card, and your service ends today\. The onboarding fee isn't refunded, and any call-minute overage/);
  assert.match(c.cancellationCardText({ periodEnd: "Dec 1", refund, hasMinutes: false }), /The onboarding fee isn't refunded\.$/);
  assert.match(c.cancellationCardText({ periodEnd: "Dec 1", hasMinutes: false }), /You won't be charged again\. Your service stays on/);
  assert.match(c.cancellationCardText({ periodEnd: "Dec 1" }), /apart from any call-minute overage/);
  assert.match(c.cancelEmailAccess({ refund, hasMinutes: false }), /^We've refunded your first monthly fee of \$97 to your card\. Your service ended today\. The onboarding fee isn't refunded\.$/);
  assert.equal(c.cancelEmailAccess({ hasMinutes: true }), c.CANCEL_EMAIL_ACCESS);
});
