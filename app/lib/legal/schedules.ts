import type { PlanSlug } from "../agreement-types";
import type { PlanSchedule } from "./types";

/**
 * Schedule A — the per-plan facts. This is the single place plan pricing,
 * allowances, and notice periods live. Anything in terms-v5.ts that varies by
 * plan should read from here rather than hardcode a number in prose.
 *
 * The numbers below are declared once as constants and then formatted into the
 * `included` bullets and `feeTable` rows. Both of those render into the signed
 * agreement, so a figure written twice by hand is a figure that can eventually
 * contradict itself *inside the same contract*.
 *
 * Repriced 2026-10-12. Three things changed shape, not just value:
 *   1. **Every tier includes the AI receptionist.** Starter is no longer website-only, so it
 *      carries `hasVoiceAgent: true` and its own 100 included minutes. Tiers differentiate by
 *      capability now: Starter reports the call, Growth also acts on the web lead.
 *   2. **No minimum term.** `cancellationNoticeDays` is `0` everywhere. See the field's doc.
 *   3. **The onboarding fee is charged at signing on every tier** and is covered by a
 *      first-month guarantee rather than being non-refundable.
 */
const STARTER_MINUTES = 100;
const GROWTH_MINUTES = 350;
const ENTERPRISE_MINUTES = 1050;
const OVERAGE_PER_MINUTE = 0.2;

/** The guarantee threshold. Fewer than this many qualified leads in 30 days refunds the fee. */
const GUARANTEE_MIN_LEADS = 3;
const GUARANTEE_WINDOW_DAYS = 30;

/**
 * Months charged on an annual prepay: twelve months of service for ten months of money.
 *
 * Every annual figure derives from this, so "two months free" and the actual discount cannot
 * disagree. Changing a monthly price automatically keeps the annual one honest.
 */
const ANNUAL_MONTHS_CHARGED = 10;
const annual = (monthly: number) => monthly * ANNUAL_MONTHS_CHARGED;

const mins = (n: number) => n.toLocaleString("en-US");
const rate = (n: number) => `$${n.toFixed(2)}`;
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const overageRow = (): [string, string] => [
  "Call-minute overage",
  `${rate(OVERAGE_PER_MINUTE)} per minute`,
];

/**
 * The onboarding-fee row, stated with its guarantee attached.
 *
 * The fee and the promise that refunds it belong on the same line. Quoting the charge in the
 * fee table and burying the remedy elsewhere is how a client ends up believing the fee is
 * simply non-refundable, which is what the old wording actually said.
 */
const onboardingRow = (fee: number): [string, string] => [
  "One-time onboarding fee (charged at signing)",
  `${money(fee)}, refundable under the first-month guarantee`,
];

/** Shared by every tier: the receptionist bullets, which no longer vary by plan. */
const RECEPTIONIST_INCLUDED = [
  "One (1) dedicated business phone number",
  "One (1) AI receptionist answering inbound calls 24/7, which answers only when the Client's own line is not picked up",
  "A post-call text brief to the Client's phone after every call",
  "A lead email with the caller's name, number, and reason for calling",
  "Auto-generated call summaries and call metadata for every call, viewable in the client portal",
];

export const SCHEDULES: Record<PlanSlug, PlanSchedule> = {
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyPrice: 197,
    annualPrice: annual(197),
    onboardingFee: 297,
    siteLabel: "one (1) website",
    maxSites: 1,
    hasVoiceAgent: true,
    callMinutes: STARTER_MINUTES,
    overagePerMinute: OVERAGE_PER_MINUTE,
    editAllowance: "two (2) content edits per month",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 0,
    included: [
      "One (1) custom four-page website (Home, Services, About, and Contact) at a single domain, with an optional fifth page available",
      "Hosting on enterprise-grade infrastructure (Vercel)",
      "SSL certificate and secure HTTPS delivery",
      "Daily backups and uptime monitoring",
      ...RECEPTIONIST_INCLUDED,
      "Email lead capture from the website contact form",
      "Two (2) content edit requests per month (copy and colors only)",
      "One Google Analytics 4 property setup",
      "Client portal access for website health, site status, and the call log",
      "Support response within one (1) business day",
      `Up to ${mins(STARTER_MINUTES)} call-minutes per month`,
    ],
    feeTable: [
      ["Monthly subscription", "$197 per month"],
      onboardingRow(297),
      ["Call-minutes included", `${mins(STARTER_MINUTES)} per month`],
      overageRow(),
      ["Content edits included", "2 per month (copy and colors only)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond five", "Quoted per request"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Phone number port-out (on termination)", "$50 per number"],
      ["Minimum term", "None. Month to month."],
    ],
  },

  growth: {
    slug: "growth",
    name: "Growth",
    monthlyPrice: 497,
    annualPrice: annual(497),
    onboardingFee: 297,
    siteLabel: "one (1) website",
    maxSites: 1,
    hasVoiceAgent: true,
    callMinutes: GROWTH_MINUTES,
    overagePerMinute: OVERAGE_PER_MINUTE,
    editAllowance: "two (2) content edits per month",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 0,
    included: [
      "Everything included in the Starter plan",
      "AI outbound callbacks to website form submissions, typically within sixty (60) seconds",
      "AI lead qualification, including answers to common questions drawn from the Client's intake",
      "Searchable call log with full call transcripts",
      "Urgency and caller-name extraction on every call",
      "Client portal access for website health and the searchable call log",
      "Support response within one (1) business day",
      `Up to ${mins(GROWTH_MINUTES)} call-minutes per month`,
    ],
    feeTable: [
      ["Monthly subscription", "$497 per month"],
      onboardingRow(297),
      ["Call-minutes included", `${mins(GROWTH_MINUTES)} per month`],
      overageRow(),
      ["Content edits included", "2 per month (copy and colors only)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond five", "Quoted per request"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Phone number port-out (on termination)", "$50 per number"],
      ["Minimum term", "None. Month to month."],
    ],
  },

  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    monthlyPrice: 1097,
    annualPrice: annual(1097),
    onboardingFee: 697,
    siteLabel: "two (2) to three (3) websites",
    maxSites: 3,
    hasVoiceAgent: true,
    callMinutes: ENTERPRISE_MINUTES,
    overagePerMinute: OVERAGE_PER_MINUTE,
    editAllowance: "two (2) content edits per month, per site (up to six (6) total)",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 0,
    included: [
      "Everything included in the Growth plan",
      "Two (2) to three (3) custom four-page websites (Home, Services, About, and Contact), each at its own domain, with an optional fifth page per site",
      "One (1) dedicated business phone number per site",
      "One (1) AI receptionist per site, each tuned to that site's business",
      "One shared call log covering every site under this Agreement",
      `Up to ${mins(ENTERPRISE_MINUTES)} call-minutes per month, pooled across all sites`,
      "Two (2) content edit requests per month per site (up to six total)",
      "Priority support, with a response within one (1) business day",
      "Consolidated client portal view covering all sites under this Agreement",
    ],
    feeTable: [
      ["Monthly subscription", "$1,097 per month"],
      onboardingRow(697),
      ["Websites covered", "2 to 3"],
      ["Call-minutes included", `${mins(ENTERPRISE_MINUTES)} per month, pooled across all sites`],
      overageRow(),
      ["Content edits included", "2 per month per site (up to 6 total)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond five", "Quoted per request"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Phone number port-out (on termination)", "$50 per number (up to $150 for all three)"],
      ["Minimum term", "None. Month to month."],
    ],
  },
};

/**
 * The off-menu website-only plan, for a prospect who refuses to have AI on their phone line.
 *
 * **Never shown on public pricing.** It is a sales concession, and it is priced identically to
 * Starter on purpose so it is never the economically attractive choice.
 *
 * Deliberately not a member of `SCHEDULES`, and `slug` stays `"starter"`: `PlanSlug` is a
 * union consumed by the portal account record, the entitlement gate, metering and the console,
 * and widening it for a variant that bills exactly like Starter would ripple through all of
 * them. Web-only is a property of a Starter site (`receptionistMode: "declined"`), not a
 * product of its own. Only the agreement renderer consumes this.
 *
 * This is also the one schedule where `hasVoiceAgent: false`, which is why those branches in
 * terms-v5.ts must stay. See `PlanSchedule.hasVoiceAgent`.
 */
export const WEB_ONLY_SCHEDULE: PlanSchedule = {
  slug: "starter",
  name: "Starter (Website Only)",
  monthlyPrice: 197,
  annualPrice: annual(197),
  onboardingFee: 297,
  siteLabel: "one (1) website",
  maxSites: 1,
  hasVoiceAgent: false,
  callMinutes: null,
  overagePerMinute: null,
  editAllowance: "two (2) content edits per month",
  supportResponse: "one (1) business day",
  cancellationNoticeDays: 0,
  included: [
    "One (1) custom four-page website (Home, Services, About, and Contact) at a single domain, with an optional fifth page available",
    "Hosting on enterprise-grade infrastructure (Vercel)",
    "SSL certificate and secure HTTPS delivery",
    "Daily backups and uptime monitoring",
    "Email lead capture from the website contact form",
    "Two (2) content edit requests per month (copy and colors only)",
    "One Google Analytics 4 property setup",
    "Client portal access for website health and site status",
    "Support response within one (1) business day",
  ],
  feeTable: [
    ["Monthly subscription", "$197 per month"],
    onboardingRow(297),
    ["AI receptionist", "Not included on this plan"],
    ["Content edits included", "2 per month (copy and colors only)"],
    ["Additional edits, layout, or design changes", "Quoted per request"],
    ["Additional pages beyond five", "Quoted per request"],
    ["Late fee (invoice unpaid more than 15 days)", "$25"],
    ["Chargeback reimbursement", "$15-$25 per occurrence"],
    ["Minimum term", "None. Month to month."],
  ],
};

export function getSchedule(plan: PlanSlug): PlanSchedule {
  return SCHEDULES[plan];
}

/** The first-month guarantee's terms, shared by the agreement and the pricing page. */
export const GUARANTEE = {
  minQualifiedLeads: GUARANTEE_MIN_LEADS,
  windowDays: GUARANTEE_WINDOW_DAYS,
} as const;

/** Annual prepay terms, shared by the pricing page's toggle and the billing layer. */
export const ANNUAL = {
  monthsCharged: ANNUAL_MONTHS_CHARGED,
  monthsFree: 12 - ANNUAL_MONTHS_CHARGED,
} as const;

/** Included minutes per tier, for the one place that injects metering caps. */
export const MINUTES = {
  starter: STARTER_MINUTES,
  growth: GROWTH_MINUTES,
  enterprise: ENTERPRISE_MINUTES,
} as const;
