/**
 * The billing-period rules, as pure functions.
 *
 * Plain ESM, not TypeScript, so the test suite (Node 22.0, no TS loader) runs the real rules.
 *
 * Every plan is month to month (Terms of Service, 2026-11-16). Annual prepay was removed: there
 * is one recurring price per plan, it bills monthly, and nothing here reads a yearly period. A
 * subscription that is somehow not monthly (a hand-made one in the Stripe Dashboard) is refused
 * by the plan-change code rather than guessed at, because swapping a yearly price for a monthly
 * one with proration credits the unused year.
 *
 * No credit, refund or proration of any kind, except the one thing the Terms allow: an upgrade
 * charges the difference between the two plans for the rest of the current month.
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
 * - `current`: the month the client is in now, which the 80%/100% warnings read. It is the
 *   subscription's billing period.
 * - `closed`: months that have ended and may still owe overage, oldest first, each billed once
 *   (the caller keys idempotency on `startMs`).
 *
 * `closed` carries the month just BEFORE the current period, when the subscription is old enough
 * to have one. Stripe moves the subscription to its new period the moment it renews, so the month
 * that just closed is never "current period, ended" for long: reading only the current period,
 * no month would ever be billed.
 *
 * @param {{ periodStartMs: number, periodEndMs: number, nowMs: number,
 *           subscriptionStartMs?: number }} input
 * @returns {{ current: MeteringWindow | null, closed: MeteringWindow[] }}
 */
export function meteringWindows({ periodStartMs, periodEndMs, nowMs, subscriptionStartMs }) {
  const period = { startMs: periodStartMs, endMs: periodEndMs };

  const closed = [];
  const previousStart = addMonthsUtc(periodStartMs, -1);
  if (subscriptionStartMs === undefined || previousStart >= subscriptionStartMs) {
    closed.push({ startMs: previousStart, endMs: periodStartMs });
  }
  if (period.endMs <= nowMs) closed.push(period);

  const current = period.startMs <= nowMs && nowMs < period.endMs ? period : null;
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
 * The Stripe parameters for a plan change that takes effect NOW, or null when the change must
 * not happen now.
 *
 * Only an upgrade takes effect now. It charges the difference for the rest of the current month
 * (`always_invoice`: the invoice nets the unused time on the old plan against the new one, so it
 * is always a charge, never a credit). `payment_behavior` is the other half: Stripe's default,
 * `allow_incomplete`, applies the new price even when that invoice fails; `error_if_incomplete`
 * answers 402 and leaves the subscription exactly as it was.
 *
 * A downgrade returns null. It takes effect at the end of the current month, with no credit, and
 * only through a subscription schedule (`downgradeSchedulePhases`). This used to return
 * `always_invoice` for a monthly downgrade, which is how the console's "Sync billing" could move
 * a client to a lower plan mid-month and credit the unused time to their balance.
 *
 * @param {{ fromPlan: keyof typeof PLAN_RANK | null, toPlan: keyof typeof PLAN_RANK }} input
 * @returns {{ proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" } | null}
 */
export function immediateChangeParams({ fromPlan, toPlan }) {
  if (planChangeKind(fromPlan, toPlan) === "downgrade") return null;
  return { proration_behavior: "always_invoice", payment_behavior: "error_if_incomplete" };
}

/**
 * The subscription's PLAN item: the one recurring item whose price is a plan price.
 *
 * A subscription can carry more than the plan: the Search add-on is a second recurring item on the
 * same subscription, and the onboarding fee is a one-time item on the first invoice. Everything
 * that reads or changes the plan goes through this, so an add-on is never mistaken for the plan
 * and never blocks a plan change. Null when there is no plan item, or more than one (made by hand
 * in the Dashboard), which callers refuse rather than guess at.
 *
 * @template {{ id?: string, price?: { id?: string, recurring?: unknown } | null }} T
 * @param {T[]} items
 * @param {Record<string, { monthly?: string | null }>} priceTable
 * @returns {T | null}
 */
export function planItemOf(items, priceTable) {
  const planPrices = new Set(Object.values(priceTable).map((p) => p.monthly).filter(Boolean));
  const plans = items.filter((i) => i.price && i.price.recurring != null && planPrices.has(i.price.id));
  return plans.length === 1 ? plans[0] : null;
}

/**
 * The subscription-schedule phases that move a subscription to a lower plan at the end of the
 * month the client has already paid for, with no credit or refund.
 *
 * Phase 1 is the current price, unchanged, up to the period end. Phase 2 is the lower price,
 * monthly; with `end_behavior: "release"` on the schedule the subscription simply carries on
 * there afterwards. Neither phase prorates, so nothing is credited and nothing is charged until
 * the renewal, which is billed at the lower price.
 *
 * Phase 2's metadata is copied onto the subscription by Stripe when the phase begins, which is
 * what lets the `customer.subscription.updated` webhook find the site and see the change.
 *
 * `carriedItems` are the subscription's other recurring items (the Search add-on), kept as they
 * are in both phases. A phase lists every item the subscription has during it, so an item left
 * out is removed: listing only the plan would drop the add-on the moment the schedule is made.
 *
 * @param {{ currentPhaseStart: number, periodEnd: number, currentPriceId: string,
 *           targetPriceId: string, carriedItems?: { price: string, quantity: number }[],
 *           metadata: Record<string, string> }} input  times in epoch seconds
 */
export function downgradeSchedulePhases({ currentPhaseStart, periodEnd, currentPriceId, targetPriceId, carriedItems = [], metadata }) {
  return [
    {
      items: [{ price: currentPriceId, quantity: 1 }, ...carriedItems],
      start_date: currentPhaseStart,
      end_date: periodEnd,
      proration_behavior: "none",
    },
    {
      items: [{ price: targetPriceId, quantity: 1 }, ...carriedItems],
      duration: { interval: "month", interval_count: 1 },
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
 * @param {Record<string, { monthly?: string | null }>} priceTable
 * @returns {string | null}
 */
export function planFromItems(items, priceTable) {
  const id = planItemOf(items, priceTable)?.price?.id;
  if (!id) return null;
  for (const [plan, prices] of Object.entries(priceTable)) {
    if (prices.monthly === id) return plan;
  }
  return null;
}

/**
 * Whether a Stripe recurring price bills once a month. Every price JDD sells does; anything else
 * was made by hand and is refused by the plan-change code rather than re-priced.
 *
 * @param {{ interval?: string | null, interval_count?: number | null } | null | undefined} recurring
 * @returns {boolean}
 */
export function isMonthly(recurring) {
  return recurring?.interval === "month" && (recurring.interval_count ?? 1) === 1;
}

/**
 * The Enterprise price a Growth → Enterprise consolidation moves the host subscription to.
 *
 * Refuses rather than guessing: when Enterprise has no price configured, and when any absorbed
 * subscription is not billed monthly (re-pricing a yearly subscription onto a monthly one with
 * proration would credit the unused year).
 *
 * @param {{ monthly: boolean[], priceId?: string | null }} input  one `monthly` entry per subscription
 * @returns {{ ok: true, priceId: string } | { ok: false, code: "not-monthly" | "no-price" }}
 */
export function consolidationPrice({ monthly, priceId }) {
  if (monthly.some((m) => !m)) return { ok: false, code: "not-monthly" };
  return priceId ? { ok: true, priceId } : { ok: false, code: "no-price" };
}

/**
 * The unused Growth minutes one site brings into the Enterprise pool when it moves onto
 * Enterprise (Xander, 2026-11-16: they "carry over just for the rest of the month").
 *
 * The pool counts every bundle site's calls from the start of the Enterprise month (the host
 * subscription's current period), so the site's own month and the pool's month can overlap or
 * not, and each call must count against exactly one allowance:
 *
 *   - `usedBeforePoolSeconds`: the site's calls in its own Growth month BEFORE the Enterprise month
 *     began. The pool doesn't count them, so they come off the Growth minutes the site brings.
 *   - `poolCountedEarlierSeconds`: calls the pool DOES count that belonged to the site's previous
 *     Growth month (its month began after the Enterprise month did). That month's allowance
 *     already covered them, so they are given back.
 *
 * Calls in the overlap are counted by the pool and drawn from the minutes brought, which is the
 * same as drawing them from the site's own Growth allowance. The host's own Growth month IS the
 * Enterprise month, so it brings all its Growth minutes and its calls so far are in the pool.
 *
 * @param {{ capMinutes: number, usedBeforePoolSeconds: number, poolCountedEarlierSeconds: number }} input
 * @returns {number} whole minutes, rounded down
 */
export function carriedMinutes({ capMinutes, usedBeforePoolSeconds, poolCountedEarlierSeconds }) {
  const leftSeconds = Math.max(0, capMinutes * 60 - usedBeforePoolSeconds);
  return Math.floor((leftSeconds + poolCountedEarlierSeconds) / 60);
}

/**
 * The allowance for one metering window: the plan's cap, plus minutes carried over from moved
 * Growth sites when the window is the one the move happened in. A carry-over not yet worked out
 * (`minutes` absent) adds nothing rather than guessing.
 *
 * @param {number} baseCap
 * @param {{ windowStartMs: number, minutes?: number } | null | undefined} carry
 * @param {number} windowStartMs
 * @returns {number}
 */
export function capForWindow(baseCap, carry, windowStartMs) {
  if (!carry || carry.windowStartMs !== windowStartMs || typeof carry.minutes !== "number") return baseCap;
  return baseCap + carry.minutes;
}
