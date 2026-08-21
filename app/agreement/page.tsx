import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AgreementClient from "../components/agreement/AgreementClient";
import UpgradeUnavailable from "../components/agreement/UpgradeUnavailable";
import { getTermsForPlan } from "../lib/legal";
import { resolveAccountForUser } from "../lib/portal-account";
import { upgradeBlockReason } from "../lib/plan-billing";
import type { PlanSlug } from "../lib/agreement-types";

const SIGNING_METADATA: Metadata = {
    title: "Sign Service Agreement | Juneau Digital Designs",
    description:
        "Review and sign the Juneau Digital Designs Service Agreement before completing your subscription payment.",
};

/**
 * The title has to follow the branch: "Sign Service Agreement" on a page that refuses to let
 * you sign reads as a bug. `canUpgrade` is wrapped in React `cache()`, so this and the page
 * body share one evaluation per request rather than each hitting Clerk and KV.
 */
export async function generateMetadata({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string; upgrade?: string }>;
}): Promise<Metadata> {
    const { upgrade } = await searchParams;
    const slug = upgrade?.trim();
    if (slug && !(await canUpgrade(slug))) {
        return { title: "Upgrade | Juneau Digital Designs", robots: { index: false } };
    }
    return SIGNING_METADATA;
}

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];

export default async function AgreementPage({
    searchParams,
}: {
    searchParams: Promise<{ plan?: string; upgrade?: string }>;
}) {
    const { plan, upgrade } = await searchParams;
    const selectedPlan: PlanSlug = VALID_PLANS.includes(plan as PlanSlug)
        ? (plan as PlanSlug)
        : "starter";

    /**
     * Nobody signs anonymously any more.
     *
     * `/start` is the front door and authenticates before sending anyone here, but this page
     * is a plain URL and people bookmark and share those. Without the guard a signed-out
     * visitor could read the terms, sign them, and only *then* be refused by `/api/checkout`
     * — having produced a legally signed agreement, and an emailed copy of it, for a purchase
     * that can never complete.
     *
     * Bounced through `/start` rather than straight to sign-in, so they rejoin the funnel at
     * the entitlement check: a client whose account already rules this purchase out should
     * meet the upsell, not the signature form.
     */
    const { userId } = await auth();
    if (!userId) redirect(`/start?plan=${selectedPlan}`);

    // Terms resolve on the server so the client never ships the full body of
    // all three plans, and so the text rendered here is the same text the
    // signed PDF is generated from.
    const { sections, version } = getTermsForPlan(selectedPlan);

    const upgradeSlug = upgrade?.trim() || null;

    // `?upgrade=<slug>` marks this as an existing client moving up a tier rather than a first
    // purchase. Same terms, same signature, different ending: the upgrade endpoint modifies
    // their live subscription instead of opening a second one.
    //
    // The slug still isn't *trusted* here — the endpoint re-resolves it against the signed-in
    // account, which remains the authorization boundary. What this adds is a feasibility
    // check, because the endpoint's verdict arrives too late to be useful: the client has
    // already signed and been emailed the agreement by the time it runs. Anything that makes
    // the upgrade impossible should stop them before the signature, not after it.
    //
    // Only reached when `?upgrade=` is present, so an anonymous first-time buyer never hits
    // Clerk or KV and the purchase path is unchanged.
    if (upgradeSlug && !(await canUpgrade(upgradeSlug))) {
        return <UpgradeUnavailable />;
    }

    return (
        <AgreementClient
            plan={selectedPlan}
            sections={sections}
            version={version}
            upgradeSlug={upgradeSlug}
        />
    );
}

/**
 * Can this caller actually complete an upgrade for this slug?
 *
 * Fails closed: any missing piece — signed out, no account, slug not theirs, not a live
 * starter, no subscription on file — means no signing form. `resolveAccountForUser` is the
 * same lookup the portal routes use, so "not theirs" is decided by the account record rather
 * than by the URL.
 */
const canUpgrade = cache(async function canUpgrade(slug: string): Promise<boolean> {
    const { userId } = await auth();
    if (!userId) return false;

    const account = await resolveAccountForUser(userId);
    const site = account?.sites.find((s) => s.slug === slug);
    if (!site) return false;

    // Same predicate the CTA and the upgrade route use, so a link can never reach a signature
    // the endpoint would then refuse.
    const block = upgradeBlockReason(site);
    if (block === "no-billing-link") {
        // A client with no subscription on file is a data problem, not a plan state.
        console.error(
            `[agreement] upgrade blocked: ${slug} is on starter with no stripeSubscriptionId ` +
                `or sessionId. Client cannot self-serve upgrade.`,
        );
    }
    return block === null;
});
