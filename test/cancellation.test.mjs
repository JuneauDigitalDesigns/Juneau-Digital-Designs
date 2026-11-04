/**
 * Cancellation, read against contract v5.3 (no notice period; ends at the end of the paid period).
 *
 * On the code before this change these fail:
 *   - The portal card told clients "Cancellations require 30 days written notice" (60 on
 *     Enterprise) and that they'd stay billed until a date at least 30 days out.
 *   - The confirmation email cited "Section 14" (Term is §15 on Enterprise) and a "0-day
 *     termination period".
 *   - Cancelling one Enterprise site ended the shared subscription but marked only that site.
 *   - A subscription with a scheduled downgrade was not released before `cancel_at`.
 *   - The usage emails said minutes reset "at the start of your next billing period": next year,
 *     on annual billing.
 *   - A monthly site's final month of overage was put on an invoice item for a subscription that
 *     had already ended.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("the cancellation wording is exactly what Xander approved", async () => {
  const copy = await import("../app/lib/plan-change-copy.ts");
  assert.equal(
    copy.cancellationCardText({ interval: "month", periodEnd: "December 1, 2026" }),
    "You can cancel at any time. There's no notice period and no fee. Your service stays on, and you won't be charged again, until the end of the month you've already paid for, on December 1, 2026.",
  );
  assert.equal(
    copy.cancellationCardText({ interval: "year", periodEnd: "November 1, 2027" }),
    "You can cancel at any time. There's no notice period and no fee. Your service stays on, and you won't be charged again, until the end of the year you've already paid for, on November 1, 2027. Annual fees aren't refunded for the months left in the year.",
  );
  assert.equal(
    copy.CANCEL_EMAIL_ACCESS,
    "You keep full access until that date, and you won't be charged again for this site apart from any call-minute overage from your final month.",
  );
  assert.equal(
    copy.CANCEL_EMAIL_NOTICE,
    "This email is your written confirmation of cancellation under your service agreement. No notice period applies. If you have questions, reply to this email.",
  );
  assert.equal(
    copy.cancelEmailFooter("2026-11-04"),
    "This email confirms cancellation under the Juneau Digital Designs Master Services Agreement. Cancellation request submitted 2026-11-04.",
  );
});

test("no notice period or section number is quoted to a cancelling client", () => {
  const card = read("app/components/portal/BillingSection.tsx");
  assert.doesNotMatch(card, /days written notice/);
  assert.doesNotMatch(card, /site\.plan === "enterprise" \? 60 : 30/);
  const route = read("app/api/portal/cancel/route.ts");
  assert.doesNotMatch(route, /Section 14/);
  assert.doesNotMatch(route, /\$\{noticeDays\}-day/);
});

test("cancelling an Enterprise site marks every site on that subscription", () => {
  const route = read("app/api/portal/cancel/route.ts");
  assert.match(route, /s\.plan === "enterprise" && s\.stripeSubscriptionId === subscriptionId/);
  assert.match(route, /for \(const s of ending\) \{\s*await writeCancelSignal/);
});

test("a scheduled downgrade is released before the cancellation is set", () => {
  const route = read("app/api/portal/cancel/route.ts");
  assert.ok(route.indexOf("releaseScheduledChange(subscriptionId)") > 0);
  assert.ok(route.indexOf("releaseScheduledChange(subscriptionId)") < route.indexOf("cancel_at: cancelAtS"));
  assert.match(route, /dropBillingCache\(/);
});

test("usage warnings speak of the month and give the reset date", () => {
  const src = read("app/lib/usage-billing.ts");
  assert.doesNotMatch(src, /call-minutes<\/strong> this billing period/);
  assert.doesNotMatch(src, /reset at the start of your next billing period/);
  assert.match(src, /Your included minutes reset on \$\{resetDate\}\./);
});

test("an ended subscription's final-month overage is invoiced on its own", () => {
  const src = read("app/lib/usage-billing.ts");
  assert.match(src, /if \(interval === "year" \|\| subscription\.status === "canceled"\)/);
});
