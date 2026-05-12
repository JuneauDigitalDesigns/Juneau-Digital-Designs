import type { Metadata } from "next";
import OnboardingPageClient from "../components/onboarding/onboardingpageclient";

export const metadata: Metadata = {
    title: "Start Onboarding | Juneau Digital Designs",
    description: "Complete your onboarding form to get started with your selected plan.",
};

type PlanSlug = "starter" | "growth" | "premium";

const validPlans: PlanSlug[] = ["starter", "growth", "premium"];

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string }>;
}) {
    const { plan } = await searchParams;
    const selectedPlan: PlanSlug = validPlans.includes(plan as PlanSlug)
        ? (plan as PlanSlug)
        : "starter";

    return <OnboardingPageClient plan={selectedPlan} />;
}
