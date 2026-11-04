/**
 * Growth → Enterprise consolidation, in place (option C3, approved by Xander 2026-11-04).
 *
 * On the code before this change these fail. The move opened a Checkout Session for a brand-new
 * Enterprise subscription, which charged a full new period and restarted the billing date. Its
 * Growth cancellations (`prorate` without `invoice_now`) left the credit as pending invoice items
 * that never reduced that charge. Every refusal (mixed periods and the rest) came only after the
 * client had accepted and been emailed the Enterprise agreement. And the page said "/mo" to annual
 * clients and promised "a short addendum", when the client accepts the full Enterprise agreement.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the host subscription is upgraded in place; no Checkout Session is opened", () => {
  const route = read("app/api/portal/consolidate/route.ts");
  assert.doesNotMatch(route, /checkout\.sessions\.create/);
  assert.match(route, /changeSubscriptionPlan\(\{[\s\S]*?targetPlan: "enterprise"/);
  // Payment is settled before anything is cancelled.
  assert.ok(route.indexOf("changeSubscriptionPlan(") < route.indexOf("cancelAbsorbedSubscription("));
});

test("absorbed Growth subscriptions are cancelled with the credit invoiced to the balance", () => {
  const lib = read("app/lib/consolidation.ts");
  assert.match(lib, /subscriptions\.cancel\(subscriptionId, \{ prorate: true, invoice_now: true \}\)/);
  assert.match(lib, /consolidated_into/);
});

test("refusals are decided before the client is offered the agreement", () => {
  const page = read("app/portal/consolidate/page.tsx");
  assert.match(page, /await planConsolidation\(account\)/);
  // The accept button only exists when the move can be made.
  assert.match(page, /\{move\.ok && \(\s*<Link href="\/agreement\?plan=enterprise&consolidate=1"/);
  const agreement = read("app/agreement/page.tsx");
  assert.match(agreement, /if \(!move\?\.ok\) redirect\("\/portal\/consolidate"\)/);
});

test("the Enterprise agreement for a move states the period the Growth sites bill on", () => {
  const agreement = read("app/agreement/page.tsx");
  assert.match(agreement, /billingPeriod = move\.interval === "year" \? "annual" : "monthly"/);
});

test("the consolidation page wording is exactly what Xander approved", async () => {
  const copy = await import("../app/lib/plan-change-copy.ts");
  const base = { hostName: "Acme Plumbing", interval: "month", periodEnd: "December 1, 2026" };
  assert.equal(
    copy.consolidationParagraph({ ...base, others: 1 }),
    "Acme Plumbing's Growth plan becomes Enterprise as soon as you accept, and you pay only the difference between the two plans for the rest of your current month, which ends on December 1, 2026. Your other Growth subscription is cancelled at the same time, and its unused part is credited to your account and taken off your next invoices. You stay on monthly billing. There's no onboarding fee for moving your existing sites. You'll review and accept the Enterprise service agreement on the next screen before anything is charged.",
  );
  assert.equal(
    copy.consolidationParagraph({ ...base, interval: "year", others: 0 }),
    "Acme Plumbing's Growth plan becomes Enterprise as soon as you accept, and you pay only the difference between the two plans for the rest of your current year, which ends on December 1, 2026. You stay on annual billing. There's no onboarding fee for moving your existing sites. You'll review and accept the Enterprise service agreement on the next screen before anything is charged.",
  );
  assert.match(
    copy.consolidationParagraph({ ...base, others: 2 }),
    / Your other Growth subscriptions are cancelled at the same time, and the unused part of each is credited to your account and taken off your next invoices\. /,
  );
  assert.equal(copy.perPeriod(994, "month"), "$994 a month");
  assert.equal(copy.perPeriod(10970, "year"), "$10,970 a year");
  assert.equal(copy.poolLine({ pools: 2, minutes: 350, shared: false }), "2 separate pools of 350 min a month");
  assert.equal(copy.poolLine({ pools: 1, minutes: 1050, shared: true }), "one shared pool of 1,050 min a month");
  assert.equal(copy.poolLine({ pools: 1, minutes: 350, shared: false }), "one pool of 350 min a month");
  assert.equal(
    copy.consolidationRefusal("unreadable"),
    "This move needs to be set up with us directly. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
  assert.equal(
    copy.consolidationRefusal("mixed-periods"),
    "Your Growth sites are billed on different schedules, one monthly and one annual, so this move needs to be set up with us directly. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
  assert.equal(
    copy.consolidationRefusal("different-customers"),
    "Your Growth sites are billed separately, so this move needs to be set up with us directly. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
  assert.equal(
    copy.consolidationRefusal("cancel-pending", "December 1, 2026"),
    "One of these sites is set to cancel on December 1, 2026, so this move needs to be set up with us directly. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
});

test("the page no longer promises an addendum or says 'sign'", () => {
  const page = read("app/portal/consolidate/page.tsx");
  assert.doesNotMatch(page, /addendum/i);
  assert.doesNotMatch(page, /Review and sign/);
  assert.doesNotMatch(page, /\/mo\b/);
  assert.match(page, /Review and accept/);
});

test("the Enterprise agreement is emailed only once the move has gone through", () => {
  const agreement = read("app/api/agreement/route.ts");
  assert.match(agreement, /pendingConsolidation: true/);
  const route = read("app/api/portal/consolidate/route.ts");
  assert.match(route, /sendStoredAgreementEmail\(settled\)/);
  assert.match(route, /persistAgreement\(agreementId\)/);
});
