import "server-only";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { stripe } from "./stripe";
import { voiceSitesOf, sumAgentSeconds } from "./retell-usage";
import { duration } from "./duration";
import { getSchedule } from "./legal/schedules";
import { brandedEmailHtml } from "./email-template";
import { EMAIL } from "./email-tokens";
import { listAccounts } from "./account-store";
import { resolveSubscriptionId, subscriptionPeriod } from "./plan-billing";
import type { PortalSite } from "@jdd/schema";

// $0.20/min = 20 cents/min in Stripe's integer-cents currency
const OVERAGE_CENTS_PER_MINUTE = 20;

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

export interface CycleResult {
  accountEmail: string;
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
 * For every growth/enterprise account:
 *   1. Pulls Retell usage for the current billing period (Stripe subscription window).
 *   2. Sends email warnings at 80% and 100% of the included minute cap (deduplicated in KV).
 *   3. When the billing period has ended, creates a Stripe pending invoice item for any
 *      overage — collected automatically on the client's next subscription renewal.
 *
 * Enterprise accounts pool their agents' minutes. Both billing and warnings key on the
 * account email, not individual site slugs, so a 3-site enterprise client is treated as
 * one unit against the 1,050-minute cap.
 */
export async function runUsageCycle(): Promise<CycleResult[]> {
  const retellKey = process.env.RETELL_API_KEY;
  if (!retellKey) throw new Error("RETELL_API_KEY not set");

  const accounts = await listAccounts();
  const results: CycleResult[] = [];

  for (const account of accounts) {
    try {
      const result = await processAccount(account.email, account.sites, retellKey);
      if (result) results.push(result);
    } catch (e) {
      console.error(`[usage-billing] ${account.email} failed`, e);
      results.push({
        accountEmail: account.email,
        plan: "unknown",
        secondsUsed: 0,
        minutesCap: 0,
        overageSeconds: 0,
        warned80: false,
        warned100: false,
        billed: false,
        error: String(e),
      });
    }
  }

  return results;
}

async function processAccount(
  email: string,
  sites: PortalSite[],
  retellApiKey: string,
): Promise<CycleResult | null> {
  const voiceSites = voiceSitesOf(sites);
  if (voiceSites.length === 0) return null;

  // All voice sites in one account share the same plan tier and the same cap.
  const plan = voiceSites[0].plan as "growth" | "enterprise";
  const cap = getSchedule(plan).callMinutes;
  if (!cap) return null;

  // Resolve the Stripe subscription — enterprise sites share one subscription, so the
  // first site with any billing pointer is authoritative for the period dates.
  const billedSite = voiceSites.find((s) => s.stripeSubscriptionId || s.sessionId);
  if (!billedSite?.stripeCustomerId) {
    console.warn(`[usage-billing] ${email}: no stripeCustomerId — skipping`);
    return { accountEmail: email, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscriptionId = await resolveSubscriptionId(billedSite);
  if (!subscriptionId) {
    console.warn(`[usage-billing] ${email}: could not resolve subscriptionId — skipping`);
    return { accountEmail: email, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const period = subscriptionPeriod(subscription);
  if (!period) {
    console.warn(`[usage-billing] ${email}: subscription has no billing period — skipping`);
    return { accountEmail: email, plan, secondsUsed: 0, minutesCap: cap, overageSeconds: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }
  const periodStartMs = period.start * 1000;
  const periodEndMs = period.end * 1000;
  const now = Date.now();

  // Aggregate usage across all voice agents (enterprise pools minutes across sites).
  const queryEnd = Math.min(periodEndMs, now);
  const secondsUsed = await sumAgentSeconds(retellApiKey, voiceSites, periodStartMs, queryEnd);
  const capSeconds = cap * 60;
  const pct = capSeconds > 0 ? secondsUsed / capSeconds : 0;

  // --- Warning emails (once per threshold per billing period) ---
  // Keyed on the exact period start, matching billKey below. This used to key on the calendar
  // month, so a mid-cycle plan change starting two periods inside one month would silently
  // suppress the second period's warnings entirely.
  const warnKey = `jdd:usage-warn:${email}:${periodStartMs}`;
  const warnFlags = (await getRedis().get<{ sent80?: boolean; sent100?: boolean }>(warnKey)) ?? {};
  let warned80 = false;
  let warned100 = false;

  if (pct >= 1.0 && !warnFlags.sent100) {
    await sendUsageWarning(email, "100pct", secondsUsed, cap);
    await getRedis().set(warnKey, { sent80: true, sent100: true });
    warned80 = true;
    warned100 = true;
  } else if (pct >= 0.8 && !warnFlags.sent80) {
    await sendUsageWarning(email, "80pct", secondsUsed, cap);
    await getRedis().set(warnKey, { ...warnFlags, sent80: true });
    warned80 = true;
  }

  // --- Overage billing (only once the billing period has fully closed) ---
  let billed = false;
  if (now >= periodEndMs) {
    const billKey = `jdd:usage-billed:${email}:${periodStartMs}`;
    const alreadyBilled = await getRedis().get<string>(billKey);

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
          customer: billedSite.stripeCustomerId!,
          amount,
          currency: "usd",
          description: `Voice AI overage: ${duration(overageSeconds)} at $0.20/min (${duration(closedSeconds)} used, ${cap} min included)`,
          subscription: subscriptionId,
        });
        console.log(`[usage-billing] created invoice item for ${email}: ${duration(overageSeconds)} overage, ${amount}c`);
      } else {
        console.log(`[usage-billing] ${email}: period closed, no billable overage (${duration(closedSeconds)} of ${cap} min)`);
      }

      // Mark billed regardless — "no overage" is a valid billed state that should not re-run.
      await getRedis().set(billKey, "1");
      billed = true;
    }
  }

  return {
    accountEmail: email,
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
    ? "You've used all of your included call minutes"
    : "You're approaching your monthly call-minute limit";
  const subtitle = is100
    ? `Additional calls are billed at $0.20/min`
    : `${remaining} remaining this period`;

  const bodyHtml = is100
    ? `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        Your account has used <strong>${usedLabel} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period.
        Additional usage is charged at <strong>$0.20 per minute</strong> and will appear on your next invoice.
        The current projected overage is <strong>${overageLabel} ($${overageCost})</strong>.
      </p>
      <p style="color:${EMAIL.fg3};font-size:14px;margin:0;">
        Your included minutes reset at the start of your next billing period.
        If you expect to consistently exceed your limit, reply to this email to discuss your options.
      </p>`
    : `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        Your account has used <strong>${usedLabel} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period,
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
