import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AgreementClient from "../components/agreement/AgreementClient";
import UpgradeUnavailable from "../components/agreement/UpgradeUnavailable";
import { getAddendumForPlan, getSchedule, getTermsForPlan } from "../lib/legal";
import { getAgreement } from "../lib/kv";
import { legacyMasterFrom } from "@jdd/schema";
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
    searchParams: Promise<{ plan?: string; upgrade?: string; kind?: string }>;
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
    searchParams: Promise<{ plan?: string; upgrade?: string; kind?: string }>;
}) {
    const { plan, upgrade, kind } = await searchParams;
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

    /**
     * Master or addendum.
     *
     * `/start` decides which, having compared the account's recorded master against the
     * current terms version and the tier being bought, and says so in `?kind=`. It is not
     * trusted blind: the account is re-read here and an addendum is only honoured if a master
     * actually exists to hang it off. A stale or hand-edited link asking for the short form
     * when there is no master falls back to the full terms, which is the safe direction —
     * the failure mode is a client reading more than they had to, not less.
     */
    const account = await resolveAccountForUser(userId);
    const master = account?.masterAgreement ?? legacyMasterFrom(account?.sites ?? []);
    const wantsAddendum = kind === "addendum";
    const isAddendum = wantsAddendum && Boolean(master?.agreementId);

    if (wantsAddendum && !isAddendum) {
        console.warn(
            `[agreement] addendum requested with no master on file (${account?.email ?? "no account"}) — serving full terms`,
        );
    }

    // Resolved on the server so the client never ships the full body of all three plans, and
    // so the text rendered here is the text the signed PDF is generated from.
    const { sections, version } = isAddendum
        ? getAddendumForPlan(getSchedule(selectedPlan))
        : getTermsForPlan(selectedPlan);

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
            kind={isAddendum ? "addendum" : "master"}
            parentAgreementId={isAddendum ? master?.agreementId ?? undefined : undefined}
            /*
             * Prefilled, not fixed. A returning client usually contracts as the same entity,
             * so retyping it is friction — but a second site bought by a different LLC is
             * exactly the case the addendum exists for, so every field stays editable.
             *
             * Taken from the master agreement record rather than the account profile, because
             * that record holds the *contracting* entity — legal name, entity type, registered
             * address — which the profile does not. Paid agreements no longer expire, so it
             * is still there to read.
             */
            prefill={isAddendum ? await masterPrefill(master?.agreementId) : undefined}
        />
    );
}

/**
 * The contracting details from the client's master, to prefill the addendum's entity block.
 *
 * Returns undefined rather than throwing when the master has gone — an agreement signed
 * before paid records stopped expiring may simply not be there. An addendum with a blank
 * entity block is still perfectly signable; the client just types it.
 */
async function masterPrefill(agreementId: string | null | undefined) {
    if (!agreementId) return undefined;
    try {
        const master = await getAgreement(agreementId);
        if (!master) return undefined;
        return {
            clientLegalName: master.clientLegalName,
            clientEntityType: master.clientEntityType,
            clientAddress: master.clientAddress,
            signerName: master.signerName,
            signerTitle: master.signerTitle,
            signerEmail: master.signerEmail,
        };
    } catch (e) {
        console.error("[agreement] could not read master for prefill", agreementId, e);
        return undefined;
    }
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
