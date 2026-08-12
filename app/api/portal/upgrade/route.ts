import { NextResponse, after } from "next/server";
import { getAgreement, saveAgreement } from "@/app/lib/kv";
import { sendStoredAgreementEmail } from "@/app/lib/agreement-email";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeSubToSlug } from "@/app/lib/cancel-kv";
import { changeSubscriptionPlan, upgradeBlockReason } from "@/app/lib/plan-billing";
import { upsertSite } from "@jdd/schema";

export const runtime = "nodejs";

/**
 * Client-initiated upgrade: a live Starter site moves to Growth.
 *
 * This is the second half of the upgrade; the first half is the agreement. Growth is a
 * materially different schedule — a voice agent, 350 call minutes, overage at $0.20/min — so
 * the client re-signs before anything is charged, and this route refuses without a signed
 * Growth agreement to point at.
 *
 * The Stripe work itself lives in `lib/plan-billing.ts`, shared with the operator route. This
 * file owns only the things specific to a *client* doing it: their session, their agreement,
 * and the guard against upgrading a site that isn't ready for it.
 *
 * It deliberately does **not** provision. The receptionist's number, agent and call base are
 * created by `onboard.js` out of band, so straight after this succeeds the client's call
 * feature moves from `not-on-plan` to `connecting` (or `pending-build`), not to `ready`. Do
 * not tell them the Call Log is available; it isn't until someone runs the script. The
 * Overview's `GrowthProvisioning` tracker is what covers that gap for the client.
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const { site, account } = ctx;

    // Idempotent: a double submit, a retry or a back-button replay must not charge twice.
    // Already-upgraded is a success, not an error.
    if (site.plan === "growth" || site.plan === "enterprise") {
        return NextResponse.json({ ok: true, alreadyUpgraded: true });
    }
    // One shared predicate with the CTA and the agreement page, so the three layers can't
    // disagree about who may upgrade. A building site is explicitly allowed: billing and
    // provisioning are independent, and refusing meant a client who wanted Growth before
    // launch had no way to buy it.
    const block = upgradeBlockReason(site);
    if (block === "not-starter") {
        return NextResponse.json({ error: "This site cannot be upgraded." }, { status: 400 });
    }
    if (block === "pending-onboarding") {
        return NextResponse.json(
            { error: "Finish your onboarding form first, then you can add Growth." },
            { status: 409 },
        );
    }
    if (block === "no-billing-link") {
        return NextResponse.json(
            { error: "We couldn't find your subscription. Please contact us and we'll sort it out." },
            { status: 409 },
        );
    }

    let body: { agreement_id?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const agreementId = body.agreement_id?.trim();
    if (!agreementId) {
        return NextResponse.json({ error: "Missing agreement." }, { status: 400 });
    }

    const agreement = await getAgreement(agreementId);
    if (!agreement) {
        return NextResponse.json({ error: "We couldn't find that agreement." }, { status: 400 });
    }
    if (agreement.plan !== "growth") {
        return NextResponse.json(
            { error: "That agreement isn't for the Growth plan." },
            { status: 400 },
        );
    }

    const result = await changeSubscriptionPlan({
        slug: site.slug,
        accountEmail: account.email,
        site,
        targetPlan: "growth",
        agreementId,
        initiatedBy: "client",
    });

    if (!result.ok) {
        // Client-facing wording: the library's messages are written for an operator.
        const message =
            result.code === "no-subscription"
                ? "We couldn't find your subscription. Please contact us and we'll sort it out."
                : "We couldn't complete the upgrade. You have not been charged.";

        // The agreement stays saved and stays flagged `pendingUpgrade`, so `audit-billing`
        // surfaces it as an orphan. Deliberately no email: the client has signed, but their
        // plan has not moved, and telling them otherwise is the failure mode this replaced.
        console.error(
            `[portal/upgrade] ${site.slug} failed (${result.code}); agreement ${agreementId} ` +
                `left pending. ${result.message}`,
        );
        return NextResponse.json({ error: message }, { status: result.code === "stripe-error" ? 502 : 409 });
    }

    // Write the plan and the subscription id together, now that Stripe has confirmed the
    // change.
    //
    // This used to leave `plan` to the webhook, on the reasoning that Stripe is the source of
    // truth for what someone pays for. That conflated two things: a successful
    // `subscriptions.update` *is* Stripe confirming the tier moved, while whether the
    // proration invoice later collects is a separate question with its own events. The cost
    // of the old reading was real — the client is redirected to the portal immediately, long
    // before a webhook can land, so they arrived to "You're on Growth" sitting next to an
    // "Upgrade to Growth" button, and a missed webhook made that permanent.
    //
    // The webhook still runs and still reconciles; it no-ops when the plan already matches,
    // and remains the path for changes made outside the portal.
    const subscriptionId = result.subscriptionId;
    const now = Date.now();
    await saveAccount(
        upsertSite(
            account,
            { slug: site.slug, plan: "growth", stripeSubscriptionId: subscriptionId },
            now,
        ),
    );

    // Keep the reverse index in step with the cancel route's, so a subscription lookup by id
    // works for upgraded clients and not only cancelled ones.
    try {
        await writeSubToSlug(subscriptionId, site.slug);
    } catch (e) {
        console.error("[portal/upgrade] sub-to-slug index write failed", subscriptionId, e);
    }

    // Now — and only now — the client gets their copy. The signing route held it back so a
    // failed plan change couldn't email someone an agreement for a tier they aren't on.
    // Clearing the flag first means an email failure doesn't leave the record looking like an
    // orphaned upgrade; `sendStoredAgreementEmail` never throws, and logs its own failures.
    if (agreement.pendingUpgrade) {
        await saveAgreement({ ...agreement, pendingUpgrade: false });
        after(() => sendStoredAgreementEmail({ ...agreement, pendingUpgrade: false }));
    }

    return NextResponse.json({ ok: true });
}
