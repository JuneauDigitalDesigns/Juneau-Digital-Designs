/**
 * The billing-period rules annual prepay needs, as pure functions.
 *
 * Plain ESM, not TypeScript, so the test suite (Node 22.0, no TS loader) runs the real rules.
 * `usage-billing.ts` and `plan-billing.ts` are the only callers.
 *
 * Why this exists: both paths used to read the Stripe subscription as if it were always monthly.
 *
 *   - Minutes were metered against the subscription's own billing period. On annual that period
 *     is a YEAR, so a Growth client's 350 included minutes covered twelve months, the 80%/100%
 *     warnings fired in the first weeks, and overage was only billed at renewal. The contract
 *     says the allowance is monthly, and Xander approved "allowances reset monthly, overage
 *     invoiced monthly" for annual clients (2026-11-04).
 *   - A plan change always swapped to the target plan's MONTHLY price, silently moving an annual
 *     client to monthly billing with the unused year credited.
 */

/** Plan order, for "is this an upgrade". */
export const PLAN_RANK = { starter: 0, growth: 1, enterprise: 2 };

/**
 * `anchorMs` moved by `n` calendar months, keeping the anchor's day and time of day, clamped to
 * the end of a shorter month (Jan 31 + 1 month = Feb 28/29), the way Stripe anchors a billing
 * cycle. Always computed from the anchor, never step by step, so a clamp in February doesn't
 * drag every later month to the 28th.
 *
 * @param {number} anchorMs
 * @param {number} n
 * @returns {number}
 */
export function addMonthsUtc(anchorMs, n) {
  const a = new Date(anchorMs);
  const total = a.getUTCMonth() + n;
  const year = a.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return Date.UTC(
    year,
    month,
    Math.min(a.getUTCDate(), lastDay),
    a.getUTCHours(),
    a.getUTCMinutes(),
    a.getUTCSeconds(),
    a.getUTCMilliseconds(),
  );
}

/**
 * @typedef {{ startMs: number, endMs: number }} MeteringWindow
 */

/**
 * The monthly allowance windows to meter, for one subscription at one moment.
 *
 * - `current`: the month the client is in now — what the 80%/100% warnings read.
 * - `closed`: months that have ended and may still owe overage, oldest first, each billed once
 *   (the caller keys idempotency on `startMs`).
 *
 * A monthly subscription's window IS its billing period. An annual one is cut into twelve
 * monthly windows anchored on the period's start.
 *
 * `closed` also carries the month just BEFORE the current period, when the subscription is old
 * enough to have one. Stripe moves the subscription to its new period the moment it renews, so
 * a month that closes at renewal is never "current period, ended" for long: reading only the
 * current period, the last month of every period — every month, on monthly billing — would
 * never be billed.
 *
 * @param {{ periodStartMs: number, periodEndMs: number, interval: "month" | "year",
 *           nowMs: number, subscriptionStartMs?: number }} input
 * @returns {{ current: MeteringWindow | null, closed: MeteringWindow[] }}
 */
export function meteringWindows({ periodStartMs, periodEndMs, interval, nowMs, subscriptionStartMs }) {
  /** @type {MeteringWindow[]} */
  const windows = [];
  if (interval === "year") {
    for (let k = 0; k < 12; k++) {
      const startMs = addMonthsUtc(periodStartMs, k);
      const endMs = k === 11 ? periodEndMs : Math.min(addMonthsUtc(periodStartMs, k + 1), periodEndMs);
      if (startMs >= periodEndMs) break;
      windows.push({ startMs, endMs });
    }
  } else {
    windows.push({ startMs: periodStartMs, endMs: periodEndMs });
  }

  const closed = [];
  const previousStart = addMonthsUtc(periodStartMs, -1);
  if (subscriptionStartMs === undefined || previousStart >= subscriptionStartMs) {
    closed.push({ startMs: previousStart, endMs: periodStartMs });
  }
  for (const w of windows) if (w.endMs <= nowMs) closed.push(w);

  const current = windows.find((w) => w.startMs <= nowMs && nowMs < w.endMs) ?? null;
  return { current, closed };
}

/**
 * Which way a plan change goes. A null `fromPlan` (a price we don't sell) is treated as an
 * upgrade, because the only safe thing to do with an unknown starting point is to charge for
 * the difference now and refuse if the card does not pay.
 *
 * @param {keyof typeof PLAN_RANK | null} fromPlan
 * @param {keyof typeof PLAN_RANK} toPlan
 * @returns {"upgrade" | "downgrade" | "none"}
 */
export function planChangeKind(fromPlan, toPlan) {
  if (fromPlan === null) return "upgrade";
  if (PLAN_RANK[toPlan] === PLAN_RANK[fromPlan]) return "none";
  return PLAN_RANK[toPlan] > PLAN_RANK[fromPlan] ? "upgrade" : "downgrade";
}

/**
 * The Stripe parameters for a plan change that takes effect NOW (an upgrade, or an operator
 * repairing billing drift).
 *
 * `payment_behavior` is the point. Stripe's default for a subscription update is
 * `allow_incomplete`: the new price is applied even when the proration invoice fails, and the
 * subscription goes `past_due`. A client whose card declined was therefore moved to Growth anyway,
 * and lost Starter too once the retries ran out. `error_if_incomplete` makes Stripe answer 402 and
 * leave the subscription exactly as it was.
 *
 * @param {{ interval: "month" | "year", fromPlan: keyof typeof PLAN_RANK | null,
 *           toPlan: keyof typeof PLAN_RANK }} input
 * @returns {{ proration_behavior: "always_invoice" | "none", payment_behavior: "error_if_incomplete" }}
 */
export function immediateChangeParams(input) {
  return { proration_behavior: planChangeProration(input), payment_behavior: "error_if_incomplete" };
}

/**
 * The subscription-schedule phases that move a subscription to a lower plan at the end of the
 * period the client has already paid for (contract v5.3 §15.4: "takes effect at the end of the
 * current billing period, and fees already paid for that period are not credited or refunded").
 *
 * Phase 1 is the current price, unchanged, up to the period end. Phase 2 is the lower price on
 * the same period; with `end_behavior: "release"` on the schedule the subscription simply carries
 * on there afterwards. Neither phase prorates, so nothing is credited and nothing is charged until
 * the renewal, which is billed at the lower price.
 *
 * Phase 2's metadata is copied onto the subscription by Stripe when the phase begins, which is
 * what lets the `customer.subscription.updated` webhook find the site and see the change.
 *
 * @param {{ currentPhaseStart: number, periodEnd: number, currentPriceId: string,
 *           targetPriceId: string, interval: "month" | "year",
 *           metadata: Record<string, string> }} input  times in epoch seconds
 */
export function downgradeSchedulePhases({ currentPhaseStart, periodEnd, currentPriceId, targetPriceId, interval, metadata }) {
  return [
    {
      items: [{ price: currentPriceId, quantity: 1 }],
      start_date: currentPhaseStart,
      end_date: periodEnd,
      proration_behavior: "none",
    },
    {
      items: [{ price: targetPriceId, quantity: 1 }],
      duration: { interval, interval_count: 1 },
      proration_behavior: "none",
      metadata,
    },
  ];
}

/**
 * Which plan a subscription is billed on, read from its recurring price.
 *
 * The webhook used to take the plan from `metadata.plan`, which only says what the last plan
 * change wrote. Any later subscription event (a renewal, a card update) re-asserted it, so an
 * operator's change could be silently reverted, and a downgrade scheduled for the period end
 * would never be seen. The price is what the client actually pays.
 *
 * @param {{ price?: { id?: string, recurring?: unknown } | null }[]} items
 * @param {Record<string, { monthly?: string | null, annual?: string | null }>} priceTable
 * @returns {string | null}
 */
export function planFromItems(items, priceTable) {
  const recurring = items.filter((i) => i.price && i.price.recurring != null);
  if (recurring.length !== 1) return null;
  const id = recurring[0].price?.id;
  if (!id) return null;
  for (const [plan, prices] of Object.entries(priceTable)) {
    if (prices.monthly === id || prices.annual === id) return plan;
  }
  return null;
}

/**
 * How Stripe should prorate a change from `fromPlan` to `toPlan` that takes effect now.
 *
 * Client downgrades no longer come through here; they are scheduled for the period end
 * (`downgradeSchedulePhases`). What remains is upgrades, and an operator correcting billing that
 * drifted from the plan on record:
 *
 * Annual (approved 2026-11-04): an upgrade takes effect now and the client pays the difference
 * for the rest of the paid year (`always_invoice`); a downgrade gives no credit for the year
 * already paid (`none`).
 *
 * Monthly: both directions prorate immediately. For an operator repair where the client was
 * being over-billed, the credit is the correction.
 *
 * @param {{ interval: "month" | "year", fromPlan: keyof typeof PLAN_RANK | null,
 *           toPlan: keyof typeof PLAN_RANK }} input
 * @returns {"always_invoice" | "none"}
 */
export function planChangeProration({ interval, fromPlan, toPlan }) {
  if (interval !== "year") return "always_invoice";
  const isDowngrade = fromPlan !== null && PLAN_RANK[toPlan] < PLAN_RANK[fromPlan];
  return isDowngrade ? "none" : "always_invoice";
}

/**
 * The billing period a Stripe recurring price bills on. Anything that isn't yearly is metered
 * and priced as monthly, which is every price JDD has ever sold.
 *
 * @param {{ interval?: string | null } | null | undefined} recurring
 * @returns {"month" | "year"}
 */
export function billingIntervalOf(recurring) {
  return recurring?.interval === "year" ? "year" : "month";
}

/**
 * The Enterprise price a Growth → Enterprise consolidation moves the host subscription to: the period the
 * absorbed Growth subscriptions already bill on. This used to be the Enterprise MONTHLY price
 * unconditionally, so a client prepaying Growth annually was moved onto monthly billing (with
 * the unused year credited back) by the act of upgrading.
 *
 * Refuses rather than guessing: when Enterprise has no price for that period (as
 * `changeSubscriptionPlan` does), and when the absorbed sites bill on different periods, so
 * there is no one period to keep.
 *
 * @param {{ intervals: ("month" | "year")[],
 *           prices: { monthly?: string | null, annual?: string | null } }} input
 * @returns {{ ok: true, interval: "month" | "year", priceId: string }
 *         | { ok: false, code: "mixed-periods" | "no-price", interval?: "month" | "year" }}
 */
export function consolidationPrice({ intervals, prices }) {
  const distinct = [...new Set(intervals)];
  if (distinct.length > 1) return { ok: false, code: "mixed-periods" };
  // No readable subscription to copy from is the monthly case, as it was before.
  const interval = distinct[0] === "year" ? "year" : "month";
  const priceId = interval === "year" ? prices.annual : prices.monthly;
  return priceId ? { ok: true, interval, priceId } : { ok: false, code: "no-price", interval };
}
