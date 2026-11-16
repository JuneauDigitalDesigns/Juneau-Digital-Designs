import "server-only";

export type PlanSlug = "starter" | "growth" | "enterprise";

/**
 * The billing period, as the contract text in `app/lib/legal/` still types it.
 *
 * Every plan is month to month (Terms of Service, 2026-11-16), and nothing outside `legal/` ever
 * passes anything but "monthly". The wider type stays only so `legal/call-script.ts` and stored
 * acceptance records still type-check; the Terms of Service PR removes the yearly branches there.
 */
export type BillingPeriod = "monthly" | "annual";

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
