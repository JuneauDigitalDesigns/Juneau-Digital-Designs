import "server-only";
import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import { stripe } from "./stripe";
import { voiceSitesOf, sumAgentMinutes } from "./retell-usage";
import { getSchedule } from "./legal/schedules";
import { brandedEmailHtml } from "./email-template";
import { EMAIL } from "./email-tokens";
import { listAccounts } from "./account-store";
import { resolveSubscriptionId } from "./plan-billing";
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
  minutesUsed: number;
  minutesCap: number;
  overageMinutes: number;
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
        minutesUsed: 0,
        minutesCap: 0,
        overageMinutes: 0,
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
    return { accountEmail: email, plan, minutesUsed: 0, minutesCap: cap, overageMinutes: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscriptionId = await resolveSubscriptionId(billedSite);
  if (!subscriptionId) {
    console.warn(`[usage-billing] ${email}: could not resolve subscriptionId — skipping`);
    return { accountEmail: email, plan, minutesUsed: 0, minutesCap: cap, overageMinutes: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  // The SDK's intersection type drops these in some TS configs — same cast
  // portal-billing-summary.ts and the cancel route use.
  const periods = subscription as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  if (!periods.current_period_start || !periods.current_period_end) {
    console.warn(`[usage-billing] ${email}: subscription has no billing period — skipping`);
    return { accountEmail: email, plan, minutesUsed: 0, minutesCap: cap, overageMinutes: 0, warned80: false, warned100: false, billed: false, skipped: true };
  }
  const periodStartMs = periods.current_period_start * 1000;
  const periodEndMs = periods.current_period_end * 1000;
  const now = Date.now();

  // Aggregate usage across all voice agents (enterprise pools minutes across sites).
  const queryEnd = Math.min(periodEndMs, now);
  const minutesUsed = await sumAgentMinutes(retellApiKey, voiceSites, periodStartMs, queryEnd);
  const pct = cap > 0 ? minutesUsed / cap : 0;

  // --- Warning emails (once per threshold per billing period) ---
  const warnKey = `jdd:usage-warn:${email}:${monthTag(periodStartMs)}`;
  const warnFlags = (await getRedis().get<{ sent80?: boolean; sent100?: boolean }>(warnKey)) ?? {};
  let warned80 = false;
  let warned100 = false;

  if (pct >= 1.0 && !warnFlags.sent100) {
    await sendUsageWarning(email, "100pct", minutesUsed, cap);
    await getRedis().set(warnKey, { sent80: true, sent100: true });
    warned80 = true;
    warned100 = true;
  } else if (pct >= 0.8 && !warnFlags.sent80) {
    await sendUsageWarning(email, "80pct", minutesUsed, cap);
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
      const closedMinutes = await sumAgentMinutes(
        retellApiKey,
        voiceSites,
        periodStartMs,
        periodEndMs,
      );
      const overage = Math.max(0, closedMinutes - cap);

      if (overage > 0) {
        await stripe.invoiceItems.create({
          customer: billedSite.stripeCustomerId!,
          amount: overage * OVERAGE_CENTS_PER_MINUTE,
          currency: "usd",
          description: `Voice AI overage — ${overage} min × $0.20 (${closedMinutes} used, ${cap} included)`,
          subscription: subscriptionId,
        });
        console.log(`[usage-billing] created invoice item for ${email}: ${overage} min overage`);
      } else {
        console.log(`[usage-billing] ${email}: period closed, no overage (${closedMinutes}/${cap} min)`);
      }

      // Mark billed regardless — "no overage" is a valid billed state that should not re-run.
      await getRedis().set(billKey, "1");
      billed = true;
    }
  }

  return {
    accountEmail: email,
    plan,
    minutesUsed,
    minutesCap: cap,
    overageMinutes: Math.max(0, minutesUsed - cap),
    warned80,
    warned100,
    billed,
  };
}

/** "2026-07" from an epoch-ms timestamp — used as the warning dedup key segment. */
function monthTag(epochMs: number): string {
  return new Date(epochMs).toISOString().slice(0, 7);
}

async function sendUsageWarning(
  email: string,
  type: "80pct" | "100pct",
  minutesUsed: number,
  minutesCap: number,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[usage-billing] RESEND_API_KEY not set — skipping warning email to", email);
    return;
  }
  const from = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const remaining = Math.max(0, minutesCap - minutesUsed);
  const overageMinutes = Math.max(0, minutesUsed - minutesCap);
  const overageCost = (overageMinutes * 0.2).toFixed(2);
  const is100 = type === "100pct";

  const title = is100
    ? "You've used all of your included call minutes"
    : "You're approaching your monthly call-minute limit";
  const subtitle = is100
    ? `Additional calls are billed at $0.20/min`
    : `${remaining} minutes remaining this period`;

  const bodyHtml = is100
    ? `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        Your account has used <strong>${minutesUsed.toLocaleString()} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period.
        Additional usage is charged at <strong>$0.20 per minute</strong> and will appear on your next invoice.
        The current projected overage is <strong>${overageMinutes} min ($${overageCost})</strong>.
      </p>
      <p style="color:${EMAIL.fg3};font-size:14px;margin:0;">
        Your included minutes reset at the start of your next billing period.
        If you expect to consistently exceed your limit, reply to this email to discuss your options.
      </p>`
    : `<p style="color:${EMAIL.fg3};font-size:15px;line-height:1.6;margin:0 0 18px;">
        Your account has used <strong>${minutesUsed.toLocaleString()} of ${minutesCap.toLocaleString()} included call-minutes</strong> this billing period,
        with <strong>${remaining} minutes</strong> remaining before overage charges apply.
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
