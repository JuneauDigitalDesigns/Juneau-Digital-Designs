import type { PlanSlug } from "../agreement-types";
import type { PlanSchedule } from "./types";

/**
 * Schedule A — the per-plan facts. This is the single place plan pricing,
 * allowances, and notice periods live. Anything in terms-v4.ts that varies by
 * plan should read from here rather than hardcode a number in prose.
 *
 * The numbers below are declared once as constants and then formatted into the
 * `included` bullets and `feeTable` rows. Both of those render into the signed
 * agreement, so a figure written twice by hand is a figure that can eventually
 * contradict itself *inside the same contract*.
 */
const GROWTH_MINUTES = 350;
const ENTERPRISE_MINUTES = 1050;
const OVERAGE_PER_MINUTE = 0.2;

const mins = (n: number) => n.toLocaleString("en-US");
const rate = (n: number) => `$${n.toFixed(2)}`;
const overageRow = (): [string, string] => [
  "Call-minute overage",
  `${rate(OVERAGE_PER_MINUTE)} per minute`,
];

export const SCHEDULES: Record<PlanSlug, PlanSchedule> = {
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyPrice: 117,
    onboardingFee: 100,
    siteLabel: "one (1) website",
    maxSites: 1,
    hasVoiceAgent: false,
    callMinutes: null,
    overagePerMinute: null,
    editAllowance: "two (2) content edits per month",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 30,
    includesSeo: false,
    included: [
      "One (1) custom one-page website at a single domain",
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
      ["Monthly subscription", "$117 per month"],
      ["One-time onboarding fee", "$100"],
      ["Content edits included", "2 per month (copy and colors only)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond the one-page site", "Quoted per request"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Cancellation notice period", "30 days"],
    ],
  },

  growth: {
    slug: "growth",
    name: "Growth",
    monthlyPrice: 297,
    onboardingFee: 0,
    siteLabel: "one (1) website",
    maxSites: 1,
    hasVoiceAgent: true,
    callMinutes: GROWTH_MINUTES,
    overagePerMinute: OVERAGE_PER_MINUTE,
    editAllowance: "two (2) content edits per month",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 30,
    includesSeo: true,
    included: [
      "Everything included in the Starter plan",
      "One (1) dedicated business phone number",
      "One (1) AI voice agent answering inbound calls 24/7",
      "AI outbound callbacks to website form submissions, typically within sixty (60) seconds",
      `Up to ${mins(GROWTH_MINUTES)} call-minutes per month`,
      "Auto-generated call summaries and call metadata for every call, viewable in the client portal",
      "Ongoing technical on-page SEO",
      "Client portal access for website health and the call log",
      "Support response within one (1) business day",
    ],
    feeTable: [
      ["Monthly subscription", "$297 per month"],
      ["One-time onboarding fee", "$0"],
      ["Call-minutes included", `${mins(GROWTH_MINUTES)} per month`],
      overageRow(),
      ["Content edits included", "2 per month (copy and colors only)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond the one-page site", "Quoted per request"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Phone number port-out (on termination)", "$50 per number"],
      ["Cancellation notice period", "30 days"],
    ],
  },

  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    monthlyPrice: 697,
    onboardingFee: 0,
    siteLabel: "up to three (3) websites",
    maxSites: 3,
    hasVoiceAgent: true,
    callMinutes: ENTERPRISE_MINUTES,
    overagePerMinute: OVERAGE_PER_MINUTE,
    editAllowance: "two (2) content edits per month, per site (up to six (6) total)",
    supportResponse: "one (1) business day",
    cancellationNoticeDays: 60,
    includesSeo: true,
    included: [
      "Everything included in the Growth plan",
      "Up to three (3) custom one-page websites, each at its own domain",
      "One (1) dedicated business phone number per site (up to three total)",
      "One (1) AI voice agent per site (up to three total), each tuned to that site's business",
      `Up to ${mins(ENTERPRISE_MINUTES)} call-minutes per month, pooled across all sites`,
      "Two (2) content edit requests per month per site (up to six total)",
      "Priority support, with a response within one (1) business day",
      "Consolidated client portal view covering all sites under this Agreement",
    ],
    feeTable: [
      ["Monthly subscription", "$697 per month"],
      ["One-time onboarding fee", "$0"],
      ["Websites covered", "Up to 3"],
      ["Call-minutes included", `${mins(ENTERPRISE_MINUTES)} per month, pooled across all sites`],
      overageRow(),
      ["Content edits included", "2 per month per site (up to 6 total)"],
      ["Additional edits, layout, or design changes", "Quoted per request"],
      ["Additional pages beyond the one-page site", "Quoted per request"],
      ["Site swap fee (maximum 2 per 12-month period)", "$200 per swap"],
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      ["Chargeback reimbursement", "$15-$25 per occurrence"],
      ["Phone number port-out (on termination)", "$50 per number (up to $150 for all three)"],
      ["Cancellation notice period", "60 days"],
    ],
  },
};

export function getSchedule(plan: PlanSlug): PlanSchedule {
  return SCHEDULES[plan];
}
