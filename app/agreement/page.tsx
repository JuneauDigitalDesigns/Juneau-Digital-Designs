import type { Metadata } from "next";
import AgreementClient from "../components/agreement/AgreementClient";
import { getTermsForPlan } from "../lib/legal";
import type { PlanSlug } from "../lib/agreement-types";

export const metadata: Metadata = {
    title: "Sign Service Agreement | Juneau Digital Designs",
    description:
        "Review and sign the Juneau Digital Designs Service Agreement before completing your subscription payment.",
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

    // Terms resolve on the server so the client never ships the full body of
    // all three plans, and so the text rendered here is the same text the
    // signed PDF is generated from.
    const { sections, version } = getTermsForPlan(selectedPlan);

    return <AgreementClient plan={selectedPlan} sections={sections} version={version} />;
}
