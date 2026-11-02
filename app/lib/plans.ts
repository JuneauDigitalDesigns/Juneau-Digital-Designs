import "server-only";

export type PlanSlug = "starter" | "growth" | "enterprise";
export type BillingPeriod = "monthly" | "annual";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  monthlyPriceId: string;
  /**
   * Annual prepay price: twelve months of service for ten months of money.
   *
   * Optional, unlike `monthlyPriceId`, because annual is a newer offer and a deployment that
   * has not had its annual prices created yet should fail *that* purchase explicitly rather
   * than fail to boot. `priceIdFor` turns an absent one into a refusal.
   */
  annualPriceId?: string;
  /**
   * The one-time onboarding charge, collected in the same Checkout Session as the first
   * period. Every tier carries one since the 2026-10-12 reprice; before that only Starter
   * did, which is why this was ever optional.
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
        annualPriceId: process.env.STRIPE_PRICE_STARTER_ANNUAL,
        onboardingPriceId: process.env.STRIPE_PRICE_STARTER_ONBOARDING,
      };
    case "growth":
      return {
        slug: "growth",
        name: "Growth",
        monthlyPriceId: process.env.STRIPE_PRICE_GROWTH_MONTHLY!,
        annualPriceId: process.env.STRIPE_PRICE_GROWTH_ANNUAL,
        onboardingPriceId: process.env.STRIPE_PRICE_GROWTH_ONBOARDING,
      };
    case "enterprise":
      return {
        slug: "enterprise",
        name: "Enterprise",
        monthlyPriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
        annualPriceId: process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL,
        onboardingPriceId: process.env.STRIPE_PRICE_ENTERPRISE_ONBOARDING,
      };
    default:
      return null;
  }
}

/**
 * The recurring price id for a plan and period, or null when it is not configured.
 *
 * Returns null rather than silently falling back to the monthly price. A client who chose
 * annual and got billed monthly is a support conversation; the reverse, or an unconfigured
 * price resolving to `undefined` and Stripe erroring mid-Session, is worse. The caller turns
 * null into a refusal before any money moves.
 */
export function priceIdFor(cfg: PlanConfig, period: BillingPeriod): string | null {
  const id = period === "annual" ? cfg.annualPriceId : cfg.monthlyPriceId;
  return id && id.trim() ? id : null;
}
