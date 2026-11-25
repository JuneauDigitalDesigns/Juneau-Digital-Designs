/**
 * Plan changes after the first purchase: upgrades refuse a declined card, downgrades wait for the
 * end of the paid period, and the record follows the price the client actually pays.
 *
 * On the code before this change these fail:
 *   - `changeSubscriptionPlan` sent no `payment_behavior`, so Stripe's default (`allow_incomplete`)
 *     applied the upgrade even when the proration invoice failed, and the route then wrote Growth
 *     onto the record. There was no `immediateChangeParams`.
 *   - A monthly downgrade prorated at once (`always_invoice`): the client was credited the unused
 *     time and lost the higher plan on the day of the change. There was no schedule.
 *   - The webhook wrote whatever `metadata.plan` said, on every subscription event.
 *   - An upgrade's signing page took its billing period from a query string the upgrade link never
 *     set, so an annual client accepted the monthly price.
 *   - Upgrade agreements were never persisted, so they expired 30 days later.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import {
  downgradeSchedulePhases,
  immediateChangeParams,
  planChangeKind,
  planFromItems,
} from "../app/lib/billing-periods.mjs";

register("./server-only-hook.mjs", import.meta.url);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("plan changes are classified by tier, and an unknown starting price is refused, not upgraded", () => {
  assert.equal(planChangeKind("starter", "growth"), "upgrade");
  assert.equal(planChangeKind("growth", "enterprise"), "upgrade");
  assert.equal(planChangeKind("growth", "starter"), "downgrade");
  assert.equal(planChangeKind("growth", "growth"), "none");
  // v1.45.0: website 0 < starter 1 < growth 2 < enterprise 3.
  assert.equal(planChangeKind("website", "starter"), "upgrade");
  assert.equal(planChangeKind("website", "growth"), "upgrade");
  assert.equal(planChangeKind("starter", "website"), "downgrade");
  // Trap 4: a price we don't sell used to read as an upgrade. Every caller refuses "unknown".
  assert.equal(planChangeKind(null, "starter"), "unknown");
  assert.equal(planChangeKind(undefined, "website"), "unknown");
  assert.equal(planChangeKind("mystery", "growth"), "unknown");
  assert.equal(planChangeKind("starter", "mystery"), "unknown");
});

test("a grandfathered price still maps to its plan, and an add-on never does", () => {
  const table = {
    website: { monthly: "price_web" },
    starter: { monthly: "price_starter_297", legacy: ["price_starter_197", "price_starter_197_test"] },
    growth: { monthly: "price_growth" },
    enterprise: { monthly: null },
  };
  const item = (id) => ({ price: { id, recurring: { interval: "month" } } });
  assert.equal(planFromItems([item("price_starter_197")], table), "starter");
  assert.equal(planFromItems([item("price_starter_197_test")], table), "starter");
  assert.equal(planFromItems([item("price_starter_297")], table), "starter");
  assert.equal(planFromItems([item("price_web")], table), "website");
  assert.equal(planFromItems([item("price_search_addon")], table), null);
  assert.equal(planFromItems([item("price_starter_197"), item("price_search_addon")], table), "starter");
});

test("an immediate change refuses to apply when the card does not pay", () => {
  const params = immediateChangeParams({ fromPlan: "starter", toPlan: "growth" });
  assert.equal(params.payment_behavior, "error_if_incomplete");
  assert.equal(params.proration_behavior, "always_invoice");
});

test("changeSubscriptionPlan uses those parameters rather than Stripe's allow_incomplete default", () => {
  const src = read("app/lib/plan-billing.ts");
  assert.match(src, /\.\.\.params,/);
  assert.match(src, /immediateChangeParams\(/);
  assert.doesNotMatch(src, /proration_behavior:\s*planChangeProration\(/);
  assert.match(src, /code: "payment-failed"/);
});

test("a downgrade is two phases: the current price to the period end, then the lower price, nothing prorated", () => {
  const phases = downgradeSchedulePhases({
    currentPhaseStart: 1_793_491_200, // 2026-11-01
    periodEnd: 1_796_083_200, // 2026-12-01
    currentPriceId: "price_growth_m",
    targetPriceId: "price_starter_m",
    metadata: { plan: "starter", site_slug: "acme", account_email: "a@b.c" },
  });
  assert.equal(phases.length, 2);
  assert.deepEqual(phases[0].items, [{ price: "price_growth_m", quantity: 1 }]);
  assert.equal(phases[0].start_date, 1_793_491_200);
  assert.equal(phases[0].end_date, 1_796_083_200);
  assert.deepEqual(phases[1].items, [{ price: "price_starter_m", quantity: 1 }]);
  assert.deepEqual(phases[1].duration, { interval: "month", interval_count: 1 });
  // No credit for the period already paid, and no charge now (contract v5.3 §15.4).
  assert.equal(phases[0].proration_behavior, "none");
  assert.equal(phases[1].proration_behavior, "none");
  // Copied onto the subscription when the phase begins, so the webhook can find the site.
  assert.equal(phases[1].metadata.site_slug, "acme");
});

test("the plan is read from the recurring price, ignoring one-time items", () => {
  const table = {
    starter: { monthly: "s_m" },
    growth: { monthly: "g_m" },
    enterprise: { monthly: "e_m" },
  };
  assert.equal(planFromItems([{ price: { id: "g_m", recurring: { interval: "month" } } }], table), "growth");
  assert.equal(
    planFromItems(
      [
        { price: { id: "onboarding", recurring: null } },
        { price: { id: "s_m", recurring: { interval: "month" } } },
      ],
      table,
    ),
    "starter",
  );
  assert.equal(planFromItems([{ price: { id: "price_other", recurring: {} } }], table), null);
  assert.equal(planFromItems([], table), null);
});

test("the webhook writes the plan from the price, not from metadata.plan", () => {
  const src = read("app/api/webhooks/stripe/route.ts");
  assert.match(src, /const plan = planOfSubscription\(sub\)/);
  assert.doesNotMatch(src, /sub\.metadata\?\.plan/);
});

test("downgrades are scheduled, not applied: the console request emails a link, acceptance schedules", () => {
  const ops = read("app/api/ops/plan-change/route.ts");
  assert.match(ops, /sendDowngradeAcceptEmail/);
  assert.doesNotMatch(ops, /changeSubscriptionPlan/);
  const portal = read("app/api/portal/downgrade/route.ts");
  assert.match(portal, /scheduleDowngrade\(/);
  assert.match(portal, /!acceptedBy\(agreement, account\)/);
});

test("an upgrade keeps its agreement, binds it to the account, and words a declined card plainly", () => {
  const src = read("app/api/portal/upgrade/route.ts");
  assert.match(src, /persistAgreement\(agreementId, account\.email\)/);
  assert.match(src, /!acceptedBy\(agreement, account\)/);
  assert.match(src, /CARD_DECLINED/);
  assert.match(src, /upgradeCancelPending\(/);
});

test("the signing page states the monthly price on every plan change", () => {
  const src = read("app/terms/accept/page.tsx");
  assert.match(src, /const billingPeriod = "monthly" as const;/);
  // Nothing later reassigns it (it used to be re-read from the subscription or the query string).
  assert.doesNotMatch(src, /\bbillingPeriod = (?!"monthly")/);
});

test("client wording is exactly what Xander approved (2026-11-04)", async () => {
  const copy = await import("../app/lib/plan-change-copy.ts");
  assert.equal(
    copy.CARD_DECLINED,
    "Your card was declined, so your plan hasn't changed and nothing was charged. Email hello@juneaudigitaldesigns.com and we'll help you update it.",
  );
  assert.equal(
    copy.upgradeCancelPending("December 1, 2026"),
    "This site is set to cancel on December 1, 2026, so it can't be upgraded. Email hello@juneaudigitaldesigns.com if you'd like to keep it and move to Growth.",
  );
  assert.equal(
    copy.downgradeTile({ toName: "Starter", fromName: "Growth", date: "December 1, 2026" }),
    "Your plan changes to Starter on December 1, 2026. You keep everything on Growth until then.",
  );
});

test("the downgrade emails say exactly what Xander approved", async () => {
  const email = await import("../app/lib/plan-change-email.ts");
  const base = {
    to: "a@b.c",
    siteName: "Acme Plumbing",
    fromPlan: "growth",
    toPlan: "starter",
    effectiveAt: Date.UTC(2026, 11, 1),
    interval: "month",
  };
  const accept = email.downgradeAcceptEmail({ ...base, acceptUrl: "https://x.test/agreement" });
  // B4 (2026-11-24): the same sentences, with the plan's new name and price.
  assert.equal(accept.subject, "Your move to Starter + AI Receptionist: please accept the terms");
  assert.ok(
    accept.html.includes(
      "You asked to move Acme Plumbing from Growth to Starter + AI Receptionist. Before we make the change, please read and accept the Terms of Service for the Starter + AI Receptionist plan.",
    ),
  );
  assert.ok(accept.html.includes(">Review and accept</a>"));
  assert.ok(
    accept.html.includes(
      "Once you accept, your plan changes on December 1, 2026, at the end of the month you've already paid for. Nothing changes before then. If you didn't ask for this, reply to this email and we'll leave your plan as it is.",
    ),
  );

  const done = email.downgradeConfirmedEmail(base);
  assert.equal(done.subject, "Your plan change to Starter + AI Receptionist");
  assert.ok(
    done.html.includes(
      "Your plan changes from Growth to Starter + AI Receptionist on December 1, 2026, at the end of the month you've already paid for. Until then nothing changes. From December 1, 2026 you're billed $297 a month. Your number, receptionist and call history all stay. Questions? Reply to this email.",
    ),
  );
  assert.equal(email.pricePerPeriod("starter", "month"), "$297 a month");

  // B4: Starter + AI Receptionist → Starter (the website plan, operator-initiated only, D7).
  const toWebsite = email.downgradeConfirmedEmail({ ...base, fromPlan: "starter", toPlan: "website" });
  assert.equal(toWebsite.subject, "Your plan change to Starter");
  assert.ok(
    toWebsite.html.includes(
      "Your plan changes from Starter + AI Receptionist to Starter on December 1, 2026, at the end of the month you've already paid for. Until then nothing changes. From December 1, 2026 you're billed $97 a month and your AI receptionist stops answering calls. The number it used is released 30 days later, unless you ask us to port it out. Your website and your web inquiries stay as they are, and your past calls stay readable in your portal. Questions? Reply to this email.",
    ),
  );
  assert.ok(!toWebsite.html.includes("call history all stay"));
});

/**
 * Stripe test run F1 (2026-11-04): a declined upgrade left `account.masterAgreement` pointing at
 * the Growth agreement, which was never persisted, while the client stayed on Starter. A held
 * plan-change agreement now leaves the master alone until the change succeeds.
 */
test("a held plan-change agreement does not become the account's master at acceptance", async () => {
  const held = await import("../app/lib/held-agreement.ts");
  const base = {
    id: "a1",
    plan: "growth",
    agreementVersion: "v5.3",
    audit: { signedAt: "2026-11-04T10:00:00.000Z" },
    accountEmail: "Ann@Acme.test",
  };
  assert.equal(held.isHeldForPlanChange({ ...base, pendingUpgrade: true }), true);
  assert.equal(held.isHeldForPlanChange({ ...base, pendingDowngrade: true }), true);
  assert.equal(held.isHeldForPlanChange(base), false);
  assert.equal(held.acceptedBy(base, { email: "ann@acme.test" }), true);
  assert.equal(held.acceptedBy(base, { email: "someone@else.test" }), false);
  assert.equal(held.acceptedBy({ ...base, accountEmail: undefined }, { email: "ann@acme.test" }), false);
  assert.deepEqual(held.masterRefFor(base), {
    agreementId: "a1",
    version: "v5.3",
    tierCeiling: "growth",
    signedAt: Date.parse("2026-11-04T10:00:00.000Z"),
  });

  const route = read("app/api/agreement/route.ts");
  assert.match(route, /if \(!isAddendum && !isHeldForPlanChange\(record\)\)/);
  assert.match(route, /accountEmail: account\.email/);
});

test("the upgrade records the new master only after Stripe accepts the change", () => {
  const src = read("app/api/portal/upgrade/route.ts");
  assert.ok(src.indexOf("changeSubscriptionPlan(") < src.indexOf("masterAgreement: masterRefFor(agreement)"));
  const hook = read("app/api/webhooks/stripe/route.ts");
  assert.match(hook, /masterAgreement: masterRefFor\(accepted\)/);
});
