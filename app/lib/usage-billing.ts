import "server-only";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { stripe } from "./stripe";
import { meteringGroups, sumAgentSeconds, type MeteringGroup } from "./retell-usage";
import { duration } from "./duration";
import { brandedEmailHtml } from "./email-template";
import { EMAIL } from "./email-tokens";
import { listAccounts } from "./account-store";
import { resolveSubscriptionId, subscriptionPeriod } from "./plan-billing";
import type { PortalAccount } from "@jdd/schema";

// $0.20/min = 20 cents/min in Stripe's integer-cents currency
const OVERAGE_CENTS_PER_MINUTE = 20;

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export interface CycleResult {
  accountEmail: string;
  /**
   * Which allowance this row is about — a Growth site's slug, or `"enterprise"` for the
   * pooled bundle. An account with two Growth sites produces two rows.
   */
  groupRef: string;
  plan: string;
  secondsUsed: number;
  minutesCap: number;
  overageSeconds: number;
  warned80: boolean;
  warned100: boolean;
  billed: boolean;
  skipped?: boolean;
  error?: string;
}

/**
 * Main entry point for the billing cron.
 *
 * For every **allowance** on every account:
 *   1. Pulls Retell usage for that allowance's billing period (its Stripe subscription window).
 *   2. Sends email warnings at 80% and 100% of the included minutes (deduplicated in KV).
 *   3. Once the period has closed, creates a Stripe pending invoice item for any overage —
 *      collected automatically on the next renewal of that same subscription.
 *
 * An allowance is not an account. Growth is sold per site and each site has its own 350
 * minutes; only Enterprise pools, across the sites of its one bundle. See `meteringGroups`.
 *
 * This used to run once per account against a single cap taken from `voiceSites[0].plan`,
 * which for a two-Growth client merged the pools, capped them at 350 between them, metered
 * the second site against the first one's billing window, and collided on one idempotency
 * key so the second site's overage was never invoiced at all.
 */
export async function runUsageCycle(): Promise<CycleResult[]> {
  const retellKey = process.env.RETELL_API_KEY;
  if (!retellKey) throw new Error("RETELL_API_KEY not set");

  const accounts = await listAccounts();
  const results: CycleResult[] = [];

  for (const account of accounts) {
    for (const group of meteringGroups(account.sites)) {
      try {
        const result = await processGroup(account, group, retellKey);
        if (result) results.push(result);
      } catch (e) {
        console.error(`[usage-billing] ${account.email}/${group.ref} failed`, e);
        results.push({
          accountEmail: account.email,
          groupRef: group.ref,
          plan: group.plan,
          secondsUsed: 0,
          minutesCap: group.cap,
          overageSeconds: 0,
          warned80: false,
          warned100: false,
          billed: false,
          error: String(e),
        });
      }
    }
  }

  return results;
}

async function processGroup(
  account: PortalAccount,
  group: MeteringGroup,
  retellApiKey: string,
): Promise<CycleResult | null> {
  const email = account.email;
  const { ref: groupRef, plan, cap, sites: voiceSites } = group;

  // The subscription backing THIS allowance. Enterprise's sites share one; each Growth site
  // has its own, so billing the wrong one puts a site's overage on another site's invoice.
  const billedSite = voiceSites.find((s) => s.stripeSubscriptionId || s.sessionId);

  // Account-level customer first: `customer_email` at checkout minted a new Customer per
  // purchase, so the per-site id is missing on most records and its absence used to skip
  // overage billing for nearly every client.
  const customerId = account.stripeCustomerId ?? billedSite?.stripeCustomerId;
  if (!billedSite || !customerId) {
    console.warn(`[usage-billing] ${email}/${groupRef}: no stripeCustomerId — skipping`);
    return { accountEmail: email, groupRef, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscriptionId = await resolveSubscriptionId(billedSite);
  if (!subscriptionId) {
    console.warn(`[usage-billing] ${email}/${groupRef}: could not resolve subscriptionId — skipping`);
    return { accountEmail: email, groupRef, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const period = subscriptionPeriod(subscription);
  if (!period) {
    console.warn(`[usage-billing] ${email}/${groupRef}: subscription has no billing period — skipping`);
    return { accountEmail: email, groupRef, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }
  const periodStartMs = period.start * 1000;
  const periodEndMs = period.end * 1000;
  const now = Date.now();

  // Usage for THIS allowance only — one site on Growth, the whole bundle on Enterprise.
  const queryEnd = Math.min(periodEndMs, now);
  const secondsUsed = await sumAgentSeconds(retellApiKey, voiceSites, periodStartMs, queryEnd);
  const capSeconds = cap * 60;
  const pct = capSeconds > 0 ? secondsUsed / capSeconds : 0;

  /**
   * What the client should be told this warning is about.
   *
   * "You've used 80% of your minutes" is not actionable for someone with two Growth sites,
   * and it is the *only* thing they'd receive twice.
   */
  const groupLabel =
    plan === "enterprise"
      ? "your Enterprise sites"
      : billedSite.name ?? billedSite.slug;

  // --- Warning emails (once per threshold per billing period, per allowance) ---
  // Keyed on the exact period start, matching billKey below. This used to key on the calendar
  // month, so a mid-cycle plan change starting two periods inside one month would silently
  // suppress the second period's warnings entirely.
  const warnKey = `jdd:usage-warn:${email}:${groupRef}:${periodStartMs}`;
  const warnFlags = (await getRedis().get<{ sent80?: boolean; sent100?: boolean }>(warnKey)) ?? {};
  let warned80 = false;
  let warned100 = false;

  if (pct >= 1.0 && !warnFlags.sent100) {
    await sendUsageWarning(email, "100pct", secondsUsed, cap, groupLabel);
    await getRedis().set(warnKey, { sent80: true, sent100: true });
    warned80 = true;
    warned100 = true;
  } else if (pct >= 0.8 && !warnFlags.sent80) {
    await sendUsageWarning(email, "80pct", secondsUsed, cap, groupLabel);
    await getRedis().set(warnKey, { ...warnFlags, sent80: true });
    warned80 = true;
  }

  // --- Overage billing (only once the billing period has fully closed) ---
  let billed = false;
  if (now >= periodEndMs) {
    const billKey = `jdd:usage-billed:${email}:${groupRef}:${periodStartMs}`;

    /**
     * The bill key gained a `groupRef` segment, so a period already settled under the old
     * account-scoped shape would look unbilled and invoice a second time. Check the legacy
     * key as a fallback.
     *
     * For a two-Growth account mid-cutover this deliberately under-bills one period: the old
     * code raised a single merged invoice and set one key, and both groups now match it, so
     * neither re-bills. That is the correct direction to be wrong in — the alternative is
     * charging a client twice for minutes they already paid for, and the amount at stake is
     * one period of one client's overage.
     *
     * Safe to delete one release after this ships: by then every open period will have been
     * opened under the new shape.
     */
    const legacyBillKey = `jdd:usage-billed:${email}:${periodStartMs}`;
    const alreadyBilled =
      (await getRedis().get<string>(billKey)) ??
      (await getRedis().get<string>(legacyBillKey));

    if (!alreadyBilled) {
      // Re-fetch with the exact closed window so we don't include calls from the next period.
      const closedSeconds = await sumAgentSeconds(
        retellApiKey,
        voiceSites,
        periodStartMs,
        periodEndMs,
      );
      const overageSeconds = Math.max(0, closedSeconds - capSeconds);

      // Prorated to the second, rounded once to the nearest cent. Billing whole minutes meant
      // a client who ran 30 seconds over paid for a full minute they never used, and it broke
      // the rule that the figure shown equals the figure billed.
      const amount = Math.round((overageSeconds / 60) * OVERAGE_CENTS_PER_MINUTE);

      if (amount > 0) {
        await stripe.invoiceItems.create({
          // This allowance's own customer and subscription, so a Growth site's overage lands
          // on that site's next invoice rather than a sibling's.
          customer: customerId,
          amount,
          currency: "usd",
          description: `Voice AI overage — ${groupLabel}: ${duration(overageSeconds)} at $0.20/min (${duration(closedSeconds)} used, ${cap} min included)`,
          subscription: subscriptionId,
        });
        console.log(`[usage-billing] created invoice item for ${email}/${groupRef}: ${duration(overageSeconds)} overage, ${amount}c`);
      } else {
        console.log(`[usage-billing] ${email}/${groupRef}: period closed, no billable overage (${duration(closedSeconds)} of ${cap} min)`);
      }

      // Mark billed regardless — "no overage" is a valid billed state that should not re-run.
      await getRedis().set(billKey, "1");
      billed = true;
    }
  }

  return {
    accountEmail: email,
    groupRef,
    plan,
    secondsUsed,
    minutesCap: cap,
    overageSeconds: Math.max(0, secondsUsed - capSeconds),
    warned80,
    warned100,
    billed,
  };
}

async function sendUsageWarning(
  email: string,
  type: "80pct" | "100pct",
  secondsUsed: number,
  minutesCap: number,
  /**
   * Which allowance this is about — a site name on Growth, "your Enterprise sites" on the
   * pooled bundle. A client with two Growth sites gets two of these emails, and without a
   * name they are indistinguishable and neither is actionable.
   */
  groupLabel: string,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[usage-billing] RESEND_API_KEY not set — skipping warning email to", email);
    return;
  }
  const from = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const capSeconds = minutesCap * 60;
  const usedLabel = duration(secondsUsed) ?? "0s";
  const remaining = duration(Math.max(0, capSeconds - secondsUsed)) ?? "0s";
  const overageSeconds = Math.max(0, secondsUsed - capSeconds);
  const overageLabel = duration(overageSeconds) ?? "0s";
  // Same proration the invoice uses, so the email can never quote a different number.
  const overageCost = (Math.round((overageSeconds / 60) * OVERAGE_CENTS_PER_MINUTE) / 100).toFixed(2);
  const is100 = type === "100pct";

  const title = is100
    ? `${groupLabel} has used all of its included call minutes`
    : `${groupLabel} is approaching its monthly call-minute limit`;
  const subtitle = is100
    ? `Additional calls are billed at $0.20/min`
    : `${remaining} remaining this period`;

  const bodyHtml = is100
    ? `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        <strong>${groupLabel}</strong> has used <strong>${usedLabel} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period.
        Additional usage is charged at <strong>$0.20 per minute</strong> and will appear on your next invoice.
        The current projected overage is <strong>${overageLabel} ($${overageCost})</strong>.
      </p>
      <p style="color:${EMAIL.fg3};font-size:14px;margin:0;">
        Your included minutes reset at the start of your next billing period.
        If you expect to consistently exceed your limit, reply to this email to discuss your options.
      </p>`
    : `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        <strong>${groupLabel}</strong> has used <strong>${usedLabel} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period,
        with <strong>${remaining}</strong> remaining before overage charges apply.
        Additional minutes are billed at <strong>$0.20/min</strong> on your next invoice.
      </p>
      <p style="color:${EMAIL.fg3};font-size:14px;margin:0;">
        Your included minutes reset at the start of your next billing period.
        Reply to this email with any questions.
      </p>`;

  const html = brandedEmailHtml({ title, subtitle, body: bodyHtml });

  try {
    const { error } = await resend.emails.send({
      from,
      to: [email],
      subject: is100
        ? "Call-minute limit reached — overages now apply"
        : "You've used 80% of your monthly call minutes",
      html,
    });
    if (error) {
      console.error("[usage-billing] warning email rejected", email, error);
    } else {
      console.log(`[usage-billing] sent ${type} warning to ${email}`);
    }
  } catch (e) {
    console.error("[usage-billing] warning email threw", email, e);
  }
}
