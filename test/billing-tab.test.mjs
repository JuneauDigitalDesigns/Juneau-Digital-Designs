/**
 * Settings › Plan & billing, the month-to-month review (Xander, 2026-11-16: Q1 to Q6 as
 * recommended, §5 wording word for word, "Open Stripe to change your card." and the cancelling
 * Renews line "Your service ends on {date}.").
 *
 * On the code before this change these fail:
 * - the tab had no status, so a past_due client saw nothing wrong, and a cancellation showed
 *   only in the browser session that made it;
 * - a card on the Customer (not the subscription) read "No card is shown";
 * - a client whose site was still being built could not cancel ("Site is not active");
 * - the cancel set a computed `cancel_at` instead of Stripe's own period end;
 * - the tab showed the plan's list price as the next charge, hiding overage;
 * - the email to JDD listed one slug, not every site the subscription pays for.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const tab = await import("../app/lib/billing-tab.ts");
const card = await import("../app/lib/billing-card.ts");
const copy = await import("../app/lib/plan-change-copy.ts");

const DEC14 = Date.UTC(2026, 11, 14);

test("Stripe's statuses map to the five approved ones; a failed payment is overdue, not inactive (Q3)", () => {
  const s = (status, extra = {}) => tab.billingStatus({ status, ...extra }).kind;
  assert.equal(s("active"), "active");
  assert.equal(s("trialing"), "active");
  assert.equal(s("past_due"), "overdue");
  assert.equal(s("unpaid"), "overdue");
  assert.equal(s("canceled"), "cancelled");
  for (const x of ["incomplete", "incomplete_expired", "paused", null]) assert.equal(s(x), "inactive", String(x));
});

test("a cancellation shows on every visit, from Stripe or from the portal record", () => {
  // Stripe's own "cancel at period end" (what the cancel route now sets): ends at the period end.
  assert.deepEqual(tab.billingStatus({ status: "active", cancelAtPeriodEnd: true, periodEnd: DEC14 }), {
    kind: "cancelling",
    endsAt: DEC14,
  });
  // A `cancel_at` set by hand or by the older route.
  assert.equal(tab.billingStatus({ status: "active", cancelAt: DEC14 }).endsAt, DEC14);
  // The portal record alone, before Stripe's change is read back.
  assert.equal(tab.billingStatus({ status: "active", requestedEndsAt: DEC14 }).kind, "cancelling");
  assert.equal(tab.statusText({ kind: "cancelling", endsAt: DEC14 }), "Cancelling on December 14, 2026");
});

test("the approved wording, word for word, with Xander's two changes", () => {
  const C = tab.BILLING_COPY;
  assert.equal(C.updateCardLine, "Open Stripe to change your card.");
  assert.equal(C.renewsEnding("December 14, 2026"), "Your service ends on December 14, 2026.");
  assert.equal(C.renewsMonthly(14), "Monthly, on the 14th");
  assert.equal(C.renewsMonthly(2), "Monthly, on the 2nd");
  assert.equal(C.renewsMonthly(22), "Monthly, on the 22nd");
  assert.equal(C.renewsMonthly(11), "Monthly, on the 11th");
  assert.equal(C.currentTerm("November 14, 2026", "December 14, 2026"), "November 14, 2026 to December 14, 2026");
  assert.equal(C.cancellingBanner("December 14, 2026"), "Your subscription is still active and cancels on December 14, 2026.");
  assert.equal(C.nextPaymentNoneHint, "apart from any call-minute overage from this month");
  assert.equal(C.confirmHeading, "Cancel your subscription?");
  assert.equal(C.confirmAfter, "We'll email you a confirmation, and this page will show the date your service ends.");
  assert.equal(C.keepButton, "Keep my subscription");
  assert.equal(C.cancelledBanner("December 14, 2026"), "Your subscription ended on December 14, 2026.");
  assert.equal(C.cancelledBannerAfter, "You won't be charged again. Email hello@juneaudigitaldesigns.com if you'd like to start again.");
  assert.equal(C.overdueBanner, "Your last payment didn't go through.");
  assert.equal(C.overdueBannerAfter, "Update your card, or email hello@juneaudigitaldesigns.com and we'll help.");
  assert.equal(C.inactiveBannerAfter, "Email hello@juneaudigitaldesigns.com and we'll sort it out.");
  assert.deepEqual(Object.values(C.status).map((v) => (typeof v === "function" ? v("{date}") : v)), [
    "Active",
    "Cancelling on {date}",
    "Cancelled",
    "Payment overdue",
    "Inactive",
  ]);

  const ui = read("app/components/portal/BillingSection.tsx");
  // The wording before his changes is gone.
  assert.doesNotMatch(ui, /Opens a secure Stripe page/);
  assert.doesNotMatch(ui, /Doesn't renew/);
  // The UI takes its words from the one module.
  assert.match(ui, /from "@\/app\/lib\/billing-tab"/);
});

test("the card shown is the one Stripe charges: the subscription's, else the Customer's", () => {
  const visa = { id: "pm_1", card: { brand: "visa", last4: "4242", exp_month: 8, exp_year: 2028 } };
  const mc = { id: "pm_2", card: { brand: "mastercard", last4: "4444", exp_month: 1, exp_year: 2030 } };
  assert.equal(card.cardOnFile({ id: "sub", status: "active", default_payment_method: visa, customer: { invoice_settings: { default_payment_method: mc } } }).last4, "4242");
  // The old route said "No card is shown" here.
  assert.equal(card.cardOnFile({ id: "sub", status: "active", default_payment_method: null, customer: { invoice_settings: { default_payment_method: mc } } }).last4, "4444");
  assert.equal(card.cardOnFile({ id: "sub", status: "active", default_payment_method: null, customer: "cus_1" }), null);
});

test("after a card change, every subscription still billing on another card moves to the new one", () => {
  const subs = [
    { id: "a", status: "active", default_payment_method: "pm_old" },
    { id: "b", status: "past_due", default_payment_method: { id: "pm_old" } },
    { id: "c", status: "active", default_payment_method: "pm_new" },
    { id: "d", status: "active", default_payment_method: null }, // already falls back to the Customer
    { id: "e", status: "canceled", default_payment_method: "pm_old" },
  ];
  assert.deepEqual(card.subscriptionsToRepoint(subs, "pm_new"), ["a", "b"]);
});

test("any site with a subscription can cancel (Q5), and Stripe stops at its own period end (Q1)", () => {
  const route = read("app/api/portal/cancel/route.ts");
  assert.doesNotMatch(route, /ctx\.site\.status !== "live"/);
  assert.doesNotMatch(route, /Site is not active/);
  assert.match(route, /cancelAtS === period\.end\s*\?\s*\{ cancel_at_period_end: true \}/);
  // Neither path can prorate.
  assert.match(route, /cancel_at: cancelAtS, proration_behavior: "none"/);
  assert.ok(route.indexOf("releaseScheduledChange(subscriptionId)") < route.indexOf("cancel_at_period_end: true"));

  const ui = read("app/components/portal/BillingSection.tsx");
  assert.doesNotMatch(ui, /site\.status === "live" && \(\s*<CancellationCard/);
});

test("a site being built shows its subscription; only a site with none gets the 'once live' note", () => {
  const route = read("app/api/portal/billing/route.ts");
  assert.match(route, /if \(!subscriptionId && ctx\.site\.status !== "live"\)/);
  assert.doesNotMatch(route, /if \(ctx\.site\.status !== "live"\) \{\s*return NextResponse\.json\(\{ state: "pending-build"/);
});

test("Next payment is Stripe's preview of the next invoice, so overage waiting to be billed shows", () => {
  const route = read("app/api/portal/billing/route.ts");
  assert.match(route, /stripe\.invoices\.createPreview\(\{ subscription: sub\.id \}\)/);
  assert.match(route, /"customer\.invoice_settings\.default_payment_method"/);
});

test("the email to JDD names every site and the day Stripe stops billing (§5.8)", () => {
  const ops = copy.cancelOpsEmail({
    business: "Coastal Air Co.",
    accountEmail: "owner@example.com",
    sites: ["Coastal Air · Orlando", "Coastal Air · Kissimmee"],
    plan: "enterprise",
    subscriptionId: "sub_123",
    termEnds: "December 2, 2026",
    requested: "November 16, 2026",
  });
  assert.equal(ops.subject, "[JDD] Cancellation request: Coastal Air Co.");
  assert.deepEqual(ops.rows.map(([k]) => k), ["Client", "Account", "Sites", "Plan", "Subscription", "Term ends", "Requested"]);
  assert.equal(ops.rows[2][1], "Coastal Air · Orlando, Coastal Air · Kissimmee");
  assert.equal(ops.rows[3][1], "Enterprise");
  assert.equal(ops.footer, "Stripe stops billing on December 2, 2026. Run the teardown from the console once that date passes.");
  assert.match(read("app/api/portal/cancel/route.ts"), /cancelOpsEmail\(\{/);
});

test("Update card opens Stripe's card form only: never the default portal, which allows cancelling", () => {
  const lib = read("app/lib/billing-portal.ts");
  assert.match(lib, /type: "payment_method_update"/);
  assert.match(lib, /configuration,/);
  assert.match(lib, /if \(!configuration\) throw/);
  const script = read("scripts/create-billing-portal-config.mjs");
  for (const off of ["customer_update", "invoice_history", "subscription_cancel", "subscription_update"]) {
    assert.match(script, new RegExp(`${off}: \\{ enabled: false \\}`), off);
  }
  assert.match(script, /payment_method_update: \{ enabled: true \}/);
  assert.match(script, /Pass --live only with Xander's explicit OK/);
  // The backstop for a client who closes the tab instead of coming back.
  assert.match(read("app/api/webhooks/stripe/route.ts"), /event\.type === "customer\.updated"[\s\S]*syncCardToSubscriptions\(customer\.id\)/);
});
