import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OnboardingPageClient from "../components/onboarding/onboardingpageclient";
import { stripe } from "../lib/stripe";
import { getAgreement } from "../lib/kv";

export const metadata: Metadata = {
    title: "Start Onboarding | Juneau Digital Designs",
    description: "Complete your onboarding form to get started with your selected plan.",
};

type PlanSlug = "starter" | "growth" | "enterprise";

const validPlans: PlanSlug[] = ["starter", "growth", "enterprise"];

export const dynamic = "force-dynamic";

export default async function OnboardingPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string; session_id?: string }>;
}) {
    const { plan, session_id } = await searchParams;

    // Gate: only paid customers who have a signed agreement can fill the form.
    if (!session_id) redirect("/pricing");

    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== "paid") redirect("/pricing");

    const agreement_id = session.metadata?.agreement_id;
    if (!agreement_id) redirect("/pricing");

    const agreement = await getAgreement(agreement_id);
    if (!agreement) redirect("/pricing");

    const verifiedPlan = (session.metadata?.plan as PlanSlug | undefined)
        ?? (validPlans.includes(plan as PlanSlug) ? (plan as PlanSlug) : "starter");

    const prefillEmail = agreement.signerEmail || session.customer_details?.email || "";

    return <OnboardingPageClient plan={verifiedPlan} prefillEmail={prefillEmail} />;
}
