import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { linkClerkUser } from "@/app/lib/account-store";
import OnboardingPageClient from "@/app/components/onboarding/onboardingpageclient";

export const dynamic = "force-dynamic";

export default async function PortalOnboardingPage() {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in");

    const account = await resolveAccountForUser(userId);
    if (!account || account.sites.length === 0) {
        // No account yet — the webhook hasn't fired or agreement is missing.
        redirect("/portal");
    }

    const pendingSite = account.sites.find((s) => s.status === "pending-onboarding");
    if (!pendingSite) {
        // No pending site — either already completed or a live client.
        redirect("/portal");
    }

    // Bind the Clerk user to the account so the portal can resolve them later.
    if (account.clerkUserId !== userId) {
        await linkClerkUser(account, userId);
    }

    return (
        <OnboardingPageClient
            plan={pendingSite.plan}
            prefillEmail={pendingSite.signerEmail ?? ""}
            portalMode
            clerkUserId={userId}
        />
    );
}
