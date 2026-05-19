import type { Metadata } from "next";
import AgreementClient from "../components/agreement/AgreementClient";
import type { PlanSlug } from "../lib/agreement-types";

export const metadata: Metadata = {
    title: "Sign Master Services Agreement | Juneau Digital Designs",
    description:
        "Review and sign the Juneau Digital Designs Master Services Agreement before completing your subscription payment.",
};

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];

export default async function AgreementPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string }>;
}) {
    const { plan } = await searchParams;
    const selectedPlan: PlanSlug = VALID_PLANS.includes(plan as PlanSlug)
        ? (plan as PlanSlug)
        : "starter";

    return <AgreementClient plan={selectedPlan} />;
}
