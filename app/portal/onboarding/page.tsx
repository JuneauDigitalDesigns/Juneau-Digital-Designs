import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { linkClerkUser } from "@/app/lib/account-store";
import OnboardingPageClient from "@/app/components/onboarding/onboardingpageclient";

export const dynamic = "force-dynamic";

export default async function PortalOnboardingPage({
    searchParams,
}: {
    searchParams: Promise<{ site?: string }>;
}) {
    const { userId } = await auth();
    if (!userId) redirect("/portal/sign-in");

    const account = await resolveAccountForUser(userId);
    if (!account || account.sites.length === 0) {
        // No account yet — the webhook hasn't fired or the agreement is missing.
        redirect("/portal");
    }

    const requested = (await searchParams).site;

    /**
     * Resolve the target site by slug, and refuse anything else.
     *
     * Deliberately NOT `resolveSite`, which falls back to the account's first site when the
     * requested slug isn't found. That fallback is fine for the read-only tabs — showing the
     * wrong dashboard is a nuisance. Here it is destructive: submitting this form rewrites
     * the target site's slug, name and plan, so a stale or mistyped `?site=` would overwrite
     * a *different* site the client owns. Fail closed instead.
     */
    const pendingSite = requested
        ? account.sites.find((s) => s.slug === requested)
        : account.sites.find((s) => s.status === "pending-onboarding");

    if (requested && !pendingSite) notFound();

    if (!pendingSite) {
        // Nothing left to onboard — either already completed, or a long-standing client who
        // wandered in. The dashboard is the right place for both.
        redirect("/portal");
    }

    // Already onboarded. Not a 404: the client did nothing wrong, they most likely followed a
    // stale link or hit back after submitting, and their site does exist.
    if (pendingSite.status !== "pending-onboarding") {
        redirect(`/portal?site=${encodeURIComponent(pendingSite.slug)}`);
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
            siteRef={pendingSite.slug}
        />
    );
}
