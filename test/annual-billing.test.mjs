/**
 * Annual prepay billing: allowances reset monthly, and a plan change keeps the client annual.
 *
 * Imports the real rules (`app/lib/billing-periods.mjs`) that `usage-billing.ts` and
 * `plan-billing.ts` run. Before this change both read every subscription as monthly: an annual
 * client's minute allowance covered the whole year, overage waited for renewal, and an upgrade
 * moved them to monthly billing. On that code these fail — there was no monthly window inside a
 * year, and every change prorated the same way.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonthsUtc,
  billingIntervalOf,
  consolidationPrice,
  meteringWindows,
  planChangeProration,
} from "../app/lib/billing-periods.mjs";

const day = (iso) => Date.parse(`${iso}T15:00:00.000Z`);

test("an annual period is metered month by month, not as one year", () => {
  const { current, closed } = meteringWindows({
    periodStartMs: day("2026-11-04"),
    periodEndMs: day("2027-11-04"),
    interval: "year",
    nowMs: day("2027-01-20"),
    subscriptionStartMs: day("2026-11-04"),
  });
  // The client is in their third month: Jan 4 → Feb 4, not Nov 4 → Nov 4.
  assert.deepEqual(current, { startMs: day("2027-01-04"), endMs: day("2027-02-04") });
  // Two months have closed and are billable now, not at renewal.
  assert.deepEqual(closed, [
    { startMs: day("2026-11-04"), endMs: day("2026-12-04") },
    { startMs: day("2026-12-04"), endMs: day("2027-01-04") },
  ]);
});

test("a monthly subscription's window is still its billing period", () => {
  const { current } = meteringWindows({
    periodStartMs: day("2026-11-04"),
    periodEndMs: day("2026-12-04"),
    interval: "month",
    nowMs: day("2026-11-20"),
    subscriptionStartMs: day("2026-11-04"),
  });
  assert.deepEqual(current, { startMs: day("2026-11-04"), endMs: day("2026-12-04") });
});

test("the month that closes at renewal is still billed after Stripe moves the period on", () => {
  // Stripe advances the subscription's period the instant it renews, so the month that just
  // ended is no longer in the current period. It has to be found as the previous window.
  const { closed } = meteringWindows({
    periodStartMs: day("2027-11-04"),
    periodEndMs: day("2028-11-04"),
    interval: "year",
    nowMs: day("2027-11-06"),
    subscriptionStartMs: day("2026-11-04"),
  });
  assert.deepEqual(closed, [{ startMs: day("2027-10-04"), endMs: day("2027-11-04") }]);
  // A brand-new subscription has no previous month to bill.
  const fresh = meteringWindows({
    periodStartMs: day("2026-11-04"),
    periodEndMs: day("2027-11-04"),
    interval: "year",
    nowMs: day("2026-11-10"),
    subscriptionStartMs: day("2026-11-04"),
  });
  assert.deepEqual(fresh.closed, []);
});

test("month windows anchored on the 31st clamp the way Stripe does, without drifting", () => {
  assert.equal(addMonthsUtc(day("2027-01-31"), 1), day("2027-02-28"));
  assert.equal(addMonthsUtc(day("2027-01-31"), 2), day("2027-03-31"));
  assert.equal(addMonthsUtc(day("2027-01-31"), -2), day("2026-11-30"));
});

test("an annual upgrade prorates now; an annual downgrade gives no credit", () => {
  assert.equal(planChangeProration({ interval: "year", fromPlan: "starter", toPlan: "growth" }), "always_invoice");
  assert.equal(planChangeProration({ interval: "year", fromPlan: "growth", toPlan: "starter" }), "none");
  // Monthly behaviour is unchanged in both directions.
  assert.equal(planChangeProration({ interval: "month", fromPlan: "growth", toPlan: "starter" }), "always_invoice");
  assert.equal(planChangeProration({ interval: "month", fromPlan: "starter", toPlan: "growth" }), "always_invoice");
});

test("only a yearly Stripe price counts as annual", () => {
  assert.equal(billingIntervalOf({ interval: "year" }), "year");
  assert.equal(billingIntervalOf({ interval: "month" }), "month");
  assert.equal(billingIntervalOf(null), "month");
});

// Growth → Enterprise consolidation checked out on the Enterprise MONTHLY price for everyone,
// so a client prepaying Growth annually was moved to monthly billing by upgrading. On that code
// there was no period-aware rule at all: every case below got the monthly price.
const ENTERPRISE = { monthly: "price_ent_m", annual: "price_ent_y" };

test("an annual Growth client consolidates onto Enterprise annual", () => {
  assert.deepEqual(consolidationPrice({ intervals: ["year", "year"], prices: ENTERPRISE }), {
    ok: true,
    interval: "year",
    priceId: "price_ent_y",
  });
  // Monthly stays monthly, as before.
  assert.deepEqual(consolidationPrice({ intervals: ["month", "month"], prices: ENTERPRISE }), {
    ok: true,
    interval: "month",
    priceId: "price_ent_m",
  });
});

test("consolidation refuses rather than changing how often the client pays", () => {
  // No Enterprise annual price: refused, the same as changeSubscriptionPlan, never monthly.
  assert.deepEqual(consolidationPrice({ intervals: ["year"], prices: { monthly: "price_ent_m" } }), {
    ok: false,
    code: "no-price",
    interval: "year",
  });
  // One site monthly, one annual: there is no single period to keep.
  assert.equal(consolidationPrice({ intervals: ["month", "year"], prices: ENTERPRISE }).ok, false);
});
