import type { PlanSlug } from "../agreement-types";
import type { PlanSchedule } from "./types";

/**
 * The plan summary: the per-plan facts (Schedule A until Terms of Service v6.0). This is the
 * single place plan pricing and allowances live. Anything in the Terms that varies by plan reads
 * from here rather than hardcoding a number in prose.
 *
 * The numbers are declared once as constants and then formatted into the `included` bullets and
 * `feeTable` rows. Both render into the accepted document, so a figure written twice by hand is a
 * figure that can eventually contradict itself inside the same document.
 *
 * Terms of Service v6.0 (approved by Xander word for word, 2026-11-16):
 *   - month to month only: the annual prepay price, row and constants are gone;
 *   - the site lines and the extra-pages row carry over MSA v5.5's approved wording (PR #113);
 *   - the text-alert line matches the live SMS campaign (v1); `TEXT_ALERT_LINE_V2` replaces it
 *     under `OWNER_TEXT_CAMPAIGN=v2` (Terms v6.2), swapped in by `getTermsForPlan`;
 *   - Google Analytics is gone; site statistics come from Vercel Analytics and Lighthouse;
 *   - new lines for the search-ready build and the domain.
 */
const STARTER_MINUTES = 100;
const GROWTH_MINUTES = 350;
const ENTERPRISE_MINUTES = 1050;
const OVERAGE_PER_MINUTE = 0.2;

const mins = (n: number) => n.toLocaleString("en-US");
const rate = (n: number) => `$${n.toFixed(2)}`;
const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const overageRow = (): [string, string] => [
  "Call-minute overage",
  `${rate(OVERAGE_PER_MINUTE)} per minute`,
];

const onboardingRow = (fee: number): [string, string] => [
  "One-time onboarding fee (charged once, at checkout)",
  money(fee),
];

const MINIMUM_TERM_ROW: [string, string] = ["Minimum term", "None"];
const EXTRA_PAGES_ROW: [string, string] = ["Additional pages beyond those included", "Quoted per request"];
const CHARGEBACK_ROW: [string, string] = ["Chargeback reimbursement", "The processor's fee"];

/** v6.0 (SMS campaign v1). Swapped for `TEXT_ALERT_LINE_V2` under the v2 campaign (v6.2). */
export const TEXT_ALERT_LINE =
  "A text summary from Juneau Digital Designs to the Client's mobile phone after each call the AI receptionist handles, if the Client opts in to text alerts";
export const TEXT_ALERT_LINE_V2 =
  "A text alert from Juneau Digital Designs to the Client's mobile phone whenever a new lead, from a call or the website contact form, is recorded in the client portal, if the Client opts in to text alerts";

const SITE_LINE =
  "One (1) custom website of four (4) or more pages (Home, Services, About, and Contact, plus individual service pages and town pages where the Client's information supports them) at a single domain, with an optional additional page available";
const SEARCH_LINE =
  "A search-ready build: page titles, descriptions and canonical addresses, a sitemap, structured data, and fast pages that work on phones";
const DOMAIN_LINE =
  "Domain name registration and renewals, in the Client's own Cloudflare account, once the domain is chosen with the Client after launch";
const STATS_LINE = "Site statistics through Vercel Analytics, and Lighthouse performance checks";

/** Shared by every tier: the receptionist bullets, which no longer vary by plan. */
const RECEPTIONIST_INCLUDED = [
  "One (1) dedicated business phone number",
  "One (1) AI receptionist answering inbound calls 24/7, which answers only when the Client's own line is not picked up",
  TEXT_ALERT_LINE,
  "A lead record for every call, with the caller's name, number, and reason for calling, delivered to the client portal",
  "Auto-generated call summaries and call metadata for every call, viewable in the client portal",
];

export const SCHEDULES: Record<PlanSlug, PlanSchedule> = {
  starter: {
    slug: "starter",
    name: "Starter",
    monthlyPrice: 197,
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
      SITE_LINE,
      SEARCH_LINE,
      "Hosting on enterprise-grade infrastructure (Vercel)",
      "SSL certificate and secure HTTPS delivery",
      "Daily backups and uptime monitoring",
      DOMAIN_LINE,
      ...RECEPTIONIST_INCLUDED,
      "Website contact form submissions recorded as leads in the client portal",
      "Two (2) content edit requests per month (copy and colors only)",
      STATS_LINE,
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
      EXTRA_PAGES_ROW,
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      CHARGEBACK_ROW,
      ["Phone number port-out (when you leave)", "$50 per number"],
      MINIMUM_TERM_ROW,
    ],
  },

  growth: {
    slug: "growth",
    name: "Growth",
    monthlyPrice: 497,
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
      "A customer relationship management (CRM) pipeline in the client portal, for tracking each lead from first contact to a won or lost job, with notes, job value, and tags",
      "AI lead qualification, including answers to common questions drawn from the Client's intake",
      "Searchable call log with call summaries and call recordings",
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
      EXTRA_PAGES_ROW,
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      CHARGEBACK_ROW,
      ["Phone number port-out (when you leave)", "$50 per number"],
      MINIMUM_TERM_ROW,
    ],
  },

  enterprise: {
    slug: "enterprise",
    name: "Enterprise",
    monthlyPrice: 1097,
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
      "Two (2) to three (3) custom websites of four (4) or more pages each (Home, Services, About, and Contact, plus individual service pages and town pages where the Client's information supports them), each at its own domain, with an optional additional page per site",
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
      EXTRA_PAGES_ROW,
      ["Late fee (invoice unpaid more than 15 days)", "$25"],
      CHARGEBACK_ROW,
      ["Phone number port-out (when you leave)", "$50 per number (up to $150 for all three)"],
      MINIMUM_TERM_ROW,
    ],
  },
};

/**
 * The off-menu website-only plan, for a prospect who refuses to have AI on their phone line.
 *
 * **Never priced or listed as a public tier.** It is a sales concession, priced identically to
 * Starter on purpose so it is never the economically attractive choice.
 *
 * Deliberately not a member of `SCHEDULES`, and `slug` stays `"starter"`: web-only is a property
 * of a Starter site (`receptionistMode: "declined"`), not a product of its own. Only the Terms
 * renderer consumes this. It is the one schedule where `hasVoiceAgent: false`.
 */
export const WEB_ONLY_SCHEDULE: PlanSchedule = {
  slug: "starter",
  name: "Starter (Website Only)",
  monthlyPrice: 197,
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
    SITE_LINE,
    SEARCH_LINE,
    "Hosting on enterprise-grade infrastructure (Vercel)",
    "SSL certificate and secure HTTPS delivery",
    "Daily backups and uptime monitoring",
    DOMAIN_LINE,
    "Website contact form submissions recorded as leads in the client portal",
    "Two (2) content edit requests per month (copy and colors only)",
    STATS_LINE,
    "Client portal access for website health and site status",
    "Support response within one (1) business day",
  ],
  feeTable: [
    ["Monthly subscription", "$197 per month"],
    onboardingRow(297),
    ["AI receptionist", "Not included on this plan"],
    ["Content edits included", "2 per month (copy and colors only)"],
    ["Additional edits, layout, or design changes", "Quoted per request"],
    EXTRA_PAGES_ROW,
    ["Late fee (invoice unpaid more than 15 days)", "$25"],
    CHARGEBACK_ROW,
    MINIMUM_TERM_ROW,
  ],
};

export function getSchedule(plan: PlanSlug): PlanSchedule {
  return SCHEDULES[plan];
}

/** Included minutes per tier, for the one place that injects metering caps. */
export const MINUTES = {
  starter: STARTER_MINUTES,
  growth: GROWTH_MINUTES,
  enterprise: ENTERPRISE_MINUTES,
} as const;
