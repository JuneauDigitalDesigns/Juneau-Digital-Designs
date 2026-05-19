import "server-only";

export type PlanSlug = "starter" | "growth" | "enterprise";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  monthlyPriceId: string;
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
      };
    case "enterprise":
      return {
        slug: "enterprise",
        name: "Enterprise",
        monthlyPriceId: process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY!,
      };
    default:
      return null;
  }
}
