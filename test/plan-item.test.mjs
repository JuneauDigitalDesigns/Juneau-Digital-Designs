/**
 * A subscription may carry more than the plan: the Search add-on is a second recurring item on the
 * same subscription (agreed with the Search Console session, 2026-11-16). Every money path must
 * find THE PLAN's item, leave the add-on alone, and never drop it.
 *
 * On the code before this change these fail:
 *   - `planFromItems` returned null unless there was exactly one recurring item, so the webhook
 *     read a plan + add-on subscription as "not a plan we sell" and stopped mirroring plan changes;
 *   - `changeSubscriptionPlan` and the downgrade checks refused it as "ambiguous-items";
 *   - a scheduled downgrade listed only the plan price in its phases, which removes every other
 *     item, so the add-on would have been dropped at once;
 *   - the portal Billing tab and the Overview summary showed `items.data[0]`, which may be the add-on.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { downgradeSchedulePhases, planFromItems, planItemOf } from "../app/lib/billing-periods.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const TABLE = { starter: { monthly: "s_m" }, growth: { monthly: "g_m" }, enterprise: { monthly: "e_m" } };
const plan = (id, extra = {}) => ({ id: `si_${id}`, quantity: 1, price: { id, recurring: { interval: "month" } }, ...extra });
const ADDON = { id: "si_search", quantity: 1, price: { id: "price_search", recurring: { interval: "month" } } };
const ONBOARDING = { id: "si_onb", quantity: 1, price: { id: "price_onb", recurring: null } };

test("the plan item is the one recurring item on a plan price, whatever else is on the subscription", () => {
  assert.equal(planItemOf([plan("g_m")], TABLE)?.id, "si_g_m");
  assert.equal(planItemOf([ADDON, plan("g_m")], TABLE)?.id, "si_g_m");
  assert.equal(planItemOf([ONBOARDING, plan("s_m"), ADDON], TABLE)?.id, "si_s_m");
});

test("no plan item, or two of them, is not guessed at", () => {
  assert.equal(planItemOf([ADDON], TABLE), null);
  assert.equal(planItemOf([], TABLE), null);
  assert.equal(planItemOf([plan("s_m"), plan("g_m")], TABLE), null);
});

test("the plan is read from the plan item even with an add-on beside it", () => {
  assert.equal(planFromItems([ADDON, plan("g_m")], TABLE), "growth");
  assert.equal(planFromItems([ADDON], TABLE), null);
});

test("a scheduled downgrade carries every other item through both phases", () => {
  const phases = downgradeSchedulePhases({
    currentPhaseStart: 1,
    periodEnd: 2,
    currentPriceId: "g_m",
    targetPriceId: "s_m",
    carriedItems: [{ price: "price_search", quantity: 2 }],
    metadata: {},
  });
  assert.deepEqual(phases[0].items, [{ price: "g_m", quantity: 1 }, { price: "price_search", quantity: 2 }]);
  assert.deepEqual(phases[1].items, [{ price: "s_m", quantity: 1 }, { price: "price_search", quantity: 2 }]);
  // Nothing else to carry still works as before.
  const bare = downgradeSchedulePhases({ currentPhaseStart: 1, periodEnd: 2, currentPriceId: "g_m", targetPriceId: "s_m", metadata: {} });
  assert.deepEqual(bare[1].items, [{ price: "s_m", quantity: 1 }]);
});

test("plan changes, the downgrade and the billing reads all go through the plan item", () => {
  const billing = read("app/lib/plan-billing.ts");
  assert.match(billing, /export function planItemOfSubscription\(/);
  // The single-recurring-item filter is gone from the money paths.
  assert.doesNotMatch(billing, /recurring\.length !== 1/);
  assert.match(billing, /carriedItems/);
  for (const f of ["app/api/portal/billing/route.ts", "app/lib/portal-billing-summary.ts"]) {
    const src = read(f);
    assert.doesNotMatch(src, /items\.data\[0\]/, f);
    assert.match(src, /planItemOfSubscription\(/, f);
  }
});

test("consolidation refuses a subscription carrying an add-on until merging add-ons is built", () => {
  const src = read("app/lib/consolidation.ts");
  assert.match(src, /code: "has-addon"/);
});
