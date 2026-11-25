import "server-only";
import { PLAN_IDS, PLAN_LABELS } from "@jdd/schema";
import { isPlanSlug } from "./plan-ids.mjs";

export { isPlanSlug };

/**
 * The plans this app sells, cheapest first. The ids, names and order come from `@jdd/schema`
 * (v1.45.0): `website` is shown as "Starter", and `starter` as "Starter + AI Receptionist". No
 * code here builds a plan name from the id.
 */
export type PlanSlug = (typeof PLAN_IDS)[number];

/**
 * The billing period. Every plan is month to month (Terms of Service v6.0, 2026-11-16). Stored
 * acceptance records keep their own wider type in `agreement-types.ts`, since older ones may name
 * the yearly period.
 */
export type BillingPeriod = "monthly";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  monthlyPriceId: string;
  /**
   * The one-time onboarding charge, collected in the same Checkout Session as the first month,
   * when a site is bought. Never charged again, including on a plan change.
   */
  onboardingPriceId?: string;
}

/** The env names that hold each plan's Stripe prices. Names only: the ids are Xander's to set. */
const PRICE_ENV: Record<PlanSlug, { monthly: string; onboarding: string }> = {
  website: { monthly: "STRIPE_PRICE_WEBSITE_MONTHLY", onboarding: "STRIPE_PRICE_WEBSITE_ONBOARDING" },
  starter: { monthly: "STRIPE_PRICE_STARTER_MONTHLY", onboarding: "STRIPE_PRICE_STARTER_ONBOARDING" },
  growth: { monthly: "STRIPE_PRICE_GROWTH_MONTHLY", onboarding: "STRIPE_PRICE_GROWTH_ONBOARDING" },
  enterprise: { monthly: "STRIPE_PRICE_ENTERPRISE_MONTHLY", onboarding: "STRIPE_PRICE_ENTERPRISE_ONBOARDING" },
};

/**
 * Grandfathered monthly prices, per plan: prices we no longer sell but still bill (D3,
 * 2026-11-24). Starter + AI Receptionist moved from $197 to $297; every subscription still on the
 * $197 price stays there, and must still read as `starter`, never as "no plan".
 *
 * A comma list, so a test-mode and a later legacy price can sit side by side.
 */
const LEGACY_PRICE_ENV: Partial<Record<PlanSlug, string>> = {
  starter: "STRIPE_PRICE_STARTER_MONTHLY_LEGACY",
};

export function getPlan(slug: string): PlanConfig | null {
  if (!isPlanSlug(slug)) return null;
  const env = PRICE_ENV[slug];
  return {
    slug,
    name: PLAN_LABELS[slug].name,
    monthlyPriceId: process.env[env.monthly] ?? "",
    onboardingPriceId: process.env[env.onboarding] || undefined,
  };
}

/** The plan's grandfathered monthly price ids, never sold, still billed. Empty when none. */
export function legacyMonthlyPriceIds(slug: PlanSlug): string[] {
  const name = LEGACY_PRICE_ENV[slug];
  const raw = name ? process.env[name] : undefined;
  return (raw ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * The plan's monthly price id, or null when it is not configured. The caller turns null into a
 * refusal before any money moves, rather than letting an `undefined` price error mid-Session.
 */
export function monthlyPriceIdFor(cfg: PlanConfig): string | null {
  const id = cfg.monthlyPriceId;
  return id && id.trim() ? id : null;
}
