import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import AgreementClient from "../components/agreement/AgreementClient";
import UpgradeUnavailable from "../components/agreement/UpgradeUnavailable";
import { getAddendumForPlan, getSchedule, getTermsForPlan } from "../lib/legal";
import { getAgreement } from "../lib/kv";
import { isWebOnly, legacyMasterFrom } from "@jdd/schema";
import { resolveAccountForUser } from "../lib/portal-account";
import { billingPeriodOfSite, upgradeBlockReason } from "../lib/plan-billing";
import { getPlanChange } from "../lib/plan-change";
import { planConsolidation } from "../lib/consolidation";
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
    searchParams: Promise<{ plan?: string; upgrade?: string; kind?: string; consolidate?: string; period?: string; downgrade?: string; receptionist?: string }>;
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
    searchParams: Promise<{ plan?: string; upgrade?: string; kind?: string; consolidate?: string; period?: string; downgrade?: string; receptionist?: string }>;
}) {
    const { plan, upgrade, kind, consolidate, period, downgrade, receptionist } = await searchParams;
    const downgradeSlug = downgrade?.trim() || null;
    const receptionistSlug = receptionist?.trim() || null;
    let selectedPlan: PlanSlug = VALID_PLANS.includes(plan as PlanSlug)
        ? (plan as PlanSlug)
        : "starter";
    // Anything but an exact "annual" is monthly. Same reasoning as `/start`: a tampered or
    // stale link must not be able to escalate a monthly intent into a yearly charge.
    //
    // For a first purchase only. An in-place plan change (`?upgrade=`, `?downgrade=`) keeps the
    // period the client already bills on, so it is read from their subscription below and the
    // query string is ignored: the upgrade link never carried one, and every annual client who
    // upgraded was shown, and accepted, the monthly price.
    let billingPeriod: "monthly" | "annual" = period === "annual" ? "annual" : "monthly";

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
    const upgradeSlug = upgrade?.trim() || null;
    if (!userId) {
        // A plan change link (an upgrade CTA, or the downgrade email) belongs to an existing
        // client. Sending them into `/start` would put them in the purchase funnel; sign them
        // in and bring them straight back instead.
        if (upgradeSlug || downgradeSlug || receptionistSlug) {
            const back = upgradeSlug
                ? `/agreement?plan=growth&upgrade=${encodeURIComponent(upgradeSlug)}`
                : downgradeSlug
                  ? `/agreement?plan=${selectedPlan}&downgrade=${encodeURIComponent(downgradeSlug)}`
                  : `/agreement?plan=starter&receptionist=${encodeURIComponent(receptionistSlug!)}`;
            redirect(`/portal/sign-in?redirect_url=${encodeURIComponent(back)}`);
        }
        redirect(`/start?plan=${selectedPlan}&period=${billingPeriod}`);
    }

    // A Growth → Enterprise move: the period is the one the Growth sites bill on, and the site
    // list starts with them. A move that can't be done here goes back to its page, which says
    // why, so nothing is accepted for a move that would then be refused.
    let prefillSites: string[] | undefined;
    if (consolidate === "1") {
        const account = await resolveAccountForUser(userId);
        const move = account ? await planConsolidation(account) : null;
        if (!move?.ok) redirect("/portal/consolidate");
        selectedPlan = "enterprise";
        billingPeriod = move.interval === "year" ? "annual" : "monthly";
        prefillSites = [move.host, ...move.others].map(({ site }) => site.name ?? site.slug);
    }

    if (downgradeSlug) {
        const change = await downgradeFor(downgradeSlug);
        // No pending request for this site on this account: the link is stale, already used,
        // or not theirs. Nothing to accept, so back to the portal.
        if (!change) redirect("/portal");
        selectedPlan = change.toPlan;
        billingPeriod = change.interval === "year" ? "annual" : "monthly";
    }

    // A website-only site switching the receptionist on: the standard Starter terms, on the
    // period it already bills on. Any other site has nothing to switch on here.
    if (receptionistSlug) {
        const owner = await resolveAccountForUser(userId);
        const site = owner?.sites.find((s) => s.slug === receptionistSlug);
        if (!site || !isWebOnly(site)) redirect("/portal");
        const sitePeriod = await billingPeriodOfSite(site);
        if (!sitePeriod) redirect("/portal");
        selectedPlan = "starter";
        billingPeriod = sitePeriod;
    }

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

    /**
     * The Website-Only variant, resolved alongside the standard terms for a Starter master.
     *
     * A Starter client can choose "website only, no receptionist" on the signing page, which is
     * a different contract — it drops the receptionist clauses and call-volume terms. Rather
     * than round-trip to the server when they pick it, both documents are sent down and the
     * client swaps which one the reader shows. Only Starter has this variant, and only a master
     * can be signed web-only, so every other path sends `undefined`.
     */
    // Not offered on a downgrade (the client keeps the receptionist they have) or when switching
    // the receptionist on: the document is the standard Starter terms.
    const webOnly =
        selectedPlan === "starter" && !isAddendum && !downgradeSlug && !receptionistSlug
            ? getTermsForPlan("starter", { webOnly: true })
            : null;

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
    // A website-only site upgrading to Growth has no phone setup to keep, so the phone choice is
    // asked for as on a first purchase. It used to be hidden on every upgrade, leaving the site on
    // Growth with the receptionist still "declined", which onboard.js can't provision.
    let askPhoneChoice = Boolean(receptionistSlug);
    if (upgradeSlug) {
        const site = await upgradableSite(upgradeSlug);
        if (!site) return <UpgradeUnavailable />;
        askPhoneChoice = isWebOnly(site);
        // The period the upgrade keeps, read from the live subscription. Unreadable means we
        // can't say what they are agreeing to pay, so no form.
        const sitePeriod = await billingPeriodOfSite(site);
        if (!sitePeriod) {
            console.error(`[agreement] upgrade blocked: could not read the billing period for ${upgradeSlug}`);
            return <UpgradeUnavailable />;
        }
        billingPeriod = sitePeriod;
    }

    return (
        <AgreementClient
            plan={selectedPlan}
            billingPeriod={billingPeriod}
            sections={sections}
            version={version}
            webOnlySections={webOnly?.sections}
            webOnlyVersion={webOnly?.version}
            upgradeSlug={upgradeSlug}
            downgradeSlug={downgradeSlug}
            receptionistSlug={receptionistSlug}
            askPhoneChoice={askPhoneChoice}
            kind={isAddendum ? "addendum" : "master"}
            consolidate={consolidate === "1"}
            prefillSites={prefillSites}
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
    return (await upgradableSite(slug)) !== null;
});

/** The site behind `canUpgrade`, or null. Cached, so the metadata and the page share one read. */
const upgradableSite = cache(async function upgradableSite(slug: string) {
    const { userId } = await auth();
    if (!userId) return null;

    const account = await resolveAccountForUser(userId);
    const site = account?.sites.find((s) => s.slug === slug);
    if (!site) return null;

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
    return block === null ? site : null;
});

/**
 * The downgrade this signed-in client has been asked to accept for `slug`, or null.
 *
 * Only a request still awaiting acceptance qualifies: one already scheduled, done or withdrawn
 * has nothing left to sign. Read from the account the session resolves to, so a forwarded link
 * opens nothing for anyone else.
 */
async function downgradeFor(slug: string) {
    const { userId } = await auth();
    if (!userId) return null;
    const account = await resolveAccountForUser(userId);
    if (!account?.sites.some((s) => s.slug === slug)) return null;
    const change = await getPlanChange(account.email, slug);
    return change?.status === "awaiting-acceptance" ? change : null;
}
