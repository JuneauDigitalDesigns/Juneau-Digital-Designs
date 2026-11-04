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
 * How Stripe should prorate a change from `fromPlan` to `toPlan`.
 *
 * Annual (approved 2026-11-04): an upgrade takes effect now and the client pays the difference
 * for the rest of the paid year (`always_invoice`); a downgrade gives no credit for the year
 * already paid and the lower price starts at renewal (`none`).
 *
 * Monthly is unchanged: both directions prorate immediately, as they always have.
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
