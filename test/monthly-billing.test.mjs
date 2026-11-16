/**
 * Month to month only, and no credit on any plan change (Terms of Service, 2026-11-16).
 *
 * Imports the real rules (`app/lib/billing-periods.mjs`) that `plan-billing.ts`,
 * `consolidation.ts` and `usage-billing.ts` run, and reads the sources that call them.
 *
 * On the code before this change these fail:
 *   - `immediateChangeParams` returned `always_invoice` for a monthly DOWNGRADE. The console's
 *     "Sync billing" (agency `/api/ops/plan-sync`) went through it, so an operator could move a
 *     client to a lower plan mid-month and Stripe credited the unused time to their balance.
 *   - Annual prepay was sold: checkout, `/start`, the pricing toggle, operator orders and the
 *     plan-change code all read a yearly price.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addMonthsUtc,
  consolidationPrice,
  downgradeSchedulePhases,
  immediateChangeParams,
  isMonthly,
  meteringWindows,
  planFromItems,
} from "../app/lib/billing-periods.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const day = (iso) => Date.parse(`${iso}T15:00:00.000Z`);

/* ── No credit on a plan change ─────────────────────────────────────────────────────────── */

test("a downgrade never takes effect now, so it can never be prorated into a credit", () => {
  assert.equal(immediateChangeParams({ fromPlan: "growth", toPlan: "starter" }), null);
  assert.equal(immediateChangeParams({ fromPlan: "enterprise", toPlan: "growth" }), null);
  assert.equal(immediateChangeParams({ fromPlan: "enterprise", toPlan: "starter" }), null);
});

test("an upgrade charges the difference now and refuses a declined card", () => {
  for (const [fromPlan, toPlan] of [
    ["starter", "growth"],
    ["growth", "enterprise"],
    [null, "starter"],
  ]) {
    assert.deepEqual(immediateChangeParams({ fromPlan, toPlan }), {
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
    });
  }
});

test("changeSubscriptionPlan refuses a downgrade and a subscription that isn't monthly", () => {
  const src = read("app/lib/plan-billing.ts");
  assert.match(src, /code: "downgrade"/);
  assert.match(src, /code: "not-monthly"/);
  // The parameters come from the one rule above, and a null from it stops the change.
  assert.match(src, /immediateChangeParams\(/);
  assert.match(src, /if \(!params\)/);
});

test("plan-sync (the console's Sync billing) answers a downgrade with a refusal, not a Stripe call", () => {
  const src = read("app/api/ops/plan-sync/route.ts");
  assert.match(src, /changeSubscriptionPlan\(/);
  assert.match(src, /result\.code/);
  // The refusal reaches the console as a 409 carrying the code, so it can say why.
  assert.match(src, /status: 409/);
});

test("a downgrade is two phases: the current price to the month end, then the lower price, nothing prorated", () => {
  const phases = downgradeSchedulePhases({
    currentPhaseStart: 1_793_491_200, // 2026-11-01
    periodEnd: 1_796_083_200, // 2026-12-01
    currentPriceId: "price_growth_m",
    targetPriceId: "price_starter_m",
    metadata: { plan: "starter", site_slug: "acme", account_email: "a@b.c" },
  });
  assert.equal(phases.length, 2);
  assert.equal(phases[0].end_date, 1_796_083_200);
  assert.deepEqual(phases[1].duration, { interval: "month", interval_count: 1 });
  assert.equal(phases[0].proration_behavior, "none");
  assert.equal(phases[1].proration_behavior, "none");
  assert.equal(phases[1].metadata.site_slug, "acme");
});

test("consolidation cancels nothing prorated into a credit it can't find, and refuses non-monthly billing", () => {
  assert.deepEqual(consolidationPrice({ monthly: [true, true], priceId: "price_ent_m" }), {
    ok: true,
    priceId: "price_ent_m",
  });
  assert.deepEqual(consolidationPrice({ monthly: [true, false], priceId: "price_ent_m" }), {
    ok: false,
    code: "not-monthly",
  });
  assert.deepEqual(consolidationPrice({ monthly: [true], priceId: null }), { ok: false, code: "no-price" });
});

test("only a once-a-month Stripe price counts as monthly", () => {
  assert.equal(isMonthly({ interval: "month" }), true);
  assert.equal(isMonthly({ interval: "month", interval_count: 1 }), true);
  assert.equal(isMonthly({ interval: "month", interval_count: 3 }), false);
  assert.equal(isMonthly({ interval: "year" }), false);
  assert.equal(isMonthly(null), false);
});

/* ── Monthly metering ───────────────────────────────────────────────────────────────────── */

test("the allowance window is the billing month", () => {
  const { current, closed } = meteringWindows({
    periodStartMs: day("2026-11-04"),
    periodEndMs: day("2026-12-04"),
    nowMs: day("2026-11-20"),
    subscriptionStartMs: day("2026-11-04"),
  });
  assert.deepEqual(current, { startMs: day("2026-11-04"), endMs: day("2026-12-04") });
  // A brand-new subscription has no previous month to bill.
  assert.deepEqual(closed, []);
});

test("the month that closes at renewal is still billed after Stripe moves the period on", () => {
  const { closed } = meteringWindows({
    periodStartMs: day("2026-12-04"),
    periodEndMs: day("2027-01-04"),
    nowMs: day("2026-12-06"),
    subscriptionStartMs: day("2026-11-04"),
  });
  assert.deepEqual(closed, [{ startMs: day("2026-11-04"), endMs: day("2026-12-04") }]);
});

test("month windows anchored on the 31st clamp the way Stripe does, without drifting", () => {
  assert.equal(addMonthsUtc(day("2027-01-31"), 1), day("2027-02-28"));
  assert.equal(addMonthsUtc(day("2027-01-31"), 2), day("2027-03-31"));
  assert.equal(addMonthsUtc(day("2027-01-31"), -2), day("2026-11-30"));
});

test("the plan is read from the monthly price, ignoring one-time items", () => {
  const table = { starter: { monthly: "s_m" }, growth: { monthly: "g_m" }, enterprise: { monthly: "e_m" } };
  assert.equal(
    planFromItems(
      [
        { price: { id: "onboarding", recurring: null } },
        { price: { id: "g_m", recurring: { interval: "month" } } },
      ],
      table,
    ),
    "growth",
  );
  assert.equal(planFromItems([{ price: { id: "price_other", recurring: {} } }], table), null);
});

/* ── Annual prepay is gone ──────────────────────────────────────────────────────────────── */

/**
 * Every source file outside `app/lib/legal/`. The contract text there is the Terms of Service
 * session's, and its PR deletes the annual rows once nothing reads them.
 */
function sources(dir = join(ROOT, "app")) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (relative(ROOT, p).split(sep).join("/") === "app/lib/legal") continue;
      out.push(...sources(p));
    } else if (/\.(ts|tsx|mjs|js)$/.test(name)) {
      out.push(p);
    }
  }
  return out;
}

test("nothing outside the contract text sells, prices or reads annual billing", () => {
  const banned = [
    /annualPriceId/,
    /STRIPE_PRICE_[A-Z]+_ANNUAL/,
    /annualPrice\b/,
    /\bANNUAL\b/,
    /["']annual["']/,
    /monthsFree/,
    /billed yearly/i,
    /price of 10/,
  ];
  // Two type unions stay on purpose: `BillingPeriod` (still taken by the contract text in
  // legal/) and the stored acceptance record's `billingPeriod`, which older records may carry.
  // Nothing creates a yearly value; the agreement validator refuses one.
  const LEGACY_TYPE = { "app/lib/plans.ts": true, "app/lib/agreement-types.ts": true };
  const hits = [];
  for (const file of sources()) {
    const rel = relative(ROOT, file).split(sep).join("/");
    let src = readFileSync(file, "utf8");
    if (LEGACY_TYPE[rel]) src = src.replaceAll('"monthly" | "annual"', "");
    for (const re of banned) {
      if (re.test(src)) hits.push(`${relative(ROOT, file)}: ${re}`);
    }
  }
  assert.deepEqual(hits, []);
});

test("checkout and /start no longer carry a billing period", () => {
  assert.doesNotMatch(read("app/api/checkout/route.ts"), /\bperiod\b/);
  assert.doesNotMatch(read("app/start/page.tsx"), /period=/);
});

test(".env.example lists no annual price", () => {
  assert.doesNotMatch(read(".env.example"), /_ANNUAL/);
});
