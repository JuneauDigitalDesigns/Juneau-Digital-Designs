import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { canAddPlan, createAccount, masterNeedsResign, legacyMasterFrom } from "@jdd/schema";
import { getAccount, saveAccount, linkClerkUser } from "@/app/lib/account-store";
import { verifiedEmailOf, resolveAccountForUser } from "@/app/lib/portal-account";
import { planLimits } from "@/app/lib/plan-limits";
import { TERMS_VERSION } from "@/app/lib/legal";
import UpsellEnterprise from "@/app/components/pricing/UpsellEnterprise";
import VerifyEmailNotice from "@/app/components/pricing/VerifyEmailNotice";
import type { PlanSlug } from "@/app/lib/agreement-types";

export const metadata: Metadata = {
    title: "Start your plan | Juneau Digital Designs",
    robots: { index: false },
};

export const dynamic = "force-dynamic";

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];

/**
 * The purchase gate. Everything on /pricing routes here, and nothing gets past it unsigned-in.
 *
 * This page exists because identity used to be established *after* payment, by whatever email
 * the buyer typed into an anonymous agreement form. That address became the KV account key,
 * so a typo — or signing with one address and creating a Clerk login with another — produced
 * a paid account nobody could reach. Worse, a returning client was indistinguishable from a
 * new one, so their second purchase either collided with their first site or vanished into a
 * portal that never mentioned it.
 *
 * Authenticating first fixes all of that at the root, and buys one more thing: with the
 * account in hand *before* the agreement, we can tell a client they cannot buy a third Growth
 * site before they read and sign for one, rather than after.
 *
 * Deliberately server-only, and deliberately not in the middleware's protected matcher.
 * `auth.protect()` sends people to sign-IN, and a first-time buyer needs sign-UP; the
 * middleware still runs on this route, so `auth()` resolves either way. There is also no
 * `ClerkProvider` outside `/portal`, so nothing here may be a client component that touches
 * Clerk.
 */
export default async function StartPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string }>;
}) {
    const { plan: rawPlan } = await searchParams;
    const plan: PlanSlug = VALID_PLANS.includes(rawPlan as PlanSlug)
        ? (rawPlan as PlanSlug)
        : "starter";

    const { userId } = await auth();
    if (!userId) {
        // Sign-UP, not sign-in: most people arriving from /pricing do not have a login yet,
        // and the page offers a "already have an account?" link for the ones who do. The
        // return trip is validated on the way back out — see `safeRedirectPath`.
        const back = encodeURIComponent(`/start?plan=${plan}`);
        redirect(`/portal/sign-up?redirect_url=${back}`);
    }

    const account = await ensureAccount(userId);
    if (!account) return <VerifyEmailNotice />;

    // One definition, shared with the portal's "add a site" CTA and the in-place upgrade
    // route, so the three can never disagree about who is allowed to buy what.
    const block = canAddPlan(account, plan, planLimits());
    if (block) {
        return <UpsellEnterprise account={account} requestedPlan={plan} reason={block} />;
    }

    /**
     * Full terms, or an addendum against the master they already signed?
     *
     * Only two things force a fresh master: the terms changed, or they are buying above the
     * tier their master covers. Notably *not* a different legal entity — that is precisely
     * what the addendum is for, since a client's second site is often bought by another LLC
     * and re-signing the master would overwrite the first entity's contracting details.
     */
    const master = account.masterAgreement ?? legacyMasterFrom(account.sites);
    const kind = masterNeedsResign(master, TERMS_VERSION, plan) ? "master" : "addendum";

    redirect(`/agreement?plan=${plan}&kind=${kind}`);
}

/**
 * The account record for a signed-in buyer, creating it if this is their first purchase.
 *
 * Created *here* rather than in the Clerk `user.created` webhook, for two reasons. The
 * webhook bails when the payload carries no verified email — a guard that exists so an
 * unverified signup cannot claim a paid client's portal by asserting their address — and
 * depending on the signup method that is the state it arrives in. And creating the record at
 * purchase intent rather than at signup keeps a truer line: signing up is not becoming a
 * client, and nothing downstream should think otherwise.
 *
 * Empty accounts are invisible to the ops console, which discovers clients from the
 * `clients/` directory and the pending-onboard index, never by scanning accounts. Payment
 * remains the only event that makes someone a client there.
 *
 * Returns null when there is no verified email to key on. Creating a record under an
 * unverified address is exactly the hijack the webhook's guard is about.
 */
async function ensureAccount(userId: string) {
    const existing = await resolveAccountForUser(userId);
    if (existing) return existing;

    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = verifiedEmailOf(user);
    if (!email) return null;

    // Re-check by email: a client who paid before ever signing up already has a record keyed
    // on their address, and this is the moment it gets bound to their new login.
    const byEmail = await getAccount(email);
    if (byEmail) return linkClerkUser(byEmail, userId);

    const created = createAccount(email);
    await saveAccount(created);
    return linkClerkUser(created, userId);
}
