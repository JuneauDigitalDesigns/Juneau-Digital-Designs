import "server-only";

export type PlanSlug = "starter" | "growth" | "enterprise";

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

export function getPlan(slug: string): PlanConfig | null {
  switch (slug) {
    case "starter":
      return {
        slug: "starter",
        name: "Starter",
        monthlyPriceId: process.env.STRIPE_PRICE_STARTER_MONTHLY!,
        onboardingPriceId: process.env.STRIPE_PRICE_STARTER_ONBOARDING,
      };
    case "growth":
      return {
        slug: "growth",
        name: "Growth",
        monthlyPriceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY!,
        onboardingPriceId: process.env.STRIPE_PRICE_GROWTH_ONBOARDING,
      };
    case "enterprise":
      return {
        slug: "enterprise",
        name: "Enterprise",
        monthlyPriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
        onboardingPriceId: process.env.STRIPE_PRICE_ENTERPRISE_ONBOARDING,
      };
    default:
      return null;
  }
}

/**
 * The plan's monthly price id, or null when it is not configured. The caller turns null into a
 * refusal before any money moves, rather than letting an `undefined` price error mid-Session.
 */
export function monthlyPriceIdFor(cfg: PlanConfig): string | null {
  const id = cfg.monthlyPriceId;
  return id && id.trim() ? id : null;
}
