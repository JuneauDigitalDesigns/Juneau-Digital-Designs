import { NextResponse, after } from "next/server";
import { getAgreement, persistAgreement, saveAgreement } from "@/app/lib/kv";
import { sendStoredAgreementEmail } from "@/app/lib/agreement-email";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { scheduleDowngrade } from "@/app/lib/plan-billing";
import { getPlanChange, savePlanChange } from "@/app/lib/plan-change";
import { sendDowngradeConfirmedEmail } from "@/app/lib/plan-change-email";
import { DOWNGRADE_FAILED } from "@/app/lib/plan-change-copy";
import { acceptedBy } from "@/app/lib/held-agreement";
import { dropBillingCache } from "@/app/lib/portal-kv";
import { sendOpsNotice } from "@/app/lib/ops-notice";

export const runtime = "nodejs";

/**
 * The client has accepted the lower plan's terms: schedule the downgrade for the period end.
 *
 * Reached only from the signing page opened by the link Xander's console request emailed them
 * (`/api/ops/plan-change`). Nothing is charged or credited here. A Stripe subscription schedule
 * moves the price when the paid period ends, and the webhook moves `PortalSite.plan` then, so the
 * client keeps the higher plan until the date in the email (contract v5.3 §15.4).
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const { site, account } = ctx;

    const pending = await getPlanChange(account.email, site.slug);
    if (pending?.status === "scheduled") {
        // A double submit or a back-button replay. Already done; say so.
        return NextResponse.json({ ok: true, alreadyScheduled: true, effectiveAt: pending.effectiveAt });
    }
    if (pending?.status !== "awaiting-acceptance") {
        return NextResponse.json({ error: DOWNGRADE_FAILED }, { status: 409 });
    }

    let body: { agreement_id?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const agreementId = body.agreement_id?.trim();
    if (!agreementId) return NextResponse.json({ error: "Missing agreement." }, { status: 400 });

    // The agreement has to be for the plan being moved to, and has to be this account's own
    // (accepted while it was signed in). Without that check an agreement id is a bearer token
    // for someone else's plan change. It is NOT the account's master yet, and won't be until the
    // downgrade lands at the period end: the webhook records it then, so a downgrade withdrawn in
    // the meantime leaves the Growth master the client still holds.
    const agreement = await getAgreement(agreementId);
    if (
        !agreement ||
        agreement.plan !== pending.toPlan ||
        agreement.kind === "addendum" ||
        !acceptedBy(agreement, account)
    ) {
        return NextResponse.json({ error: "That agreement isn't for this change." }, { status: 400 });
    }

    const result = await scheduleDowngrade({
        slug: site.slug,
        accountEmail: account.email,
        site,
        targetPlan: pending.toPlan,
        agreementId,
    });
    if (!result.ok) {
        console.error(`[portal/downgrade] ${site.slug} failed (${result.code}): ${result.message}`);
        return NextResponse.json({ error: DOWNGRADE_FAILED }, { status: result.code === "stripe-error" ? 502 : 409 });
    }

    await savePlanChange({
        ...pending,
        status: "scheduled",
        effectiveAt: result.effectiveAt,
        interval: result.interval,
        subscriptionId: result.subscriptionId,
        scheduleId: result.scheduleId,
        agreementId,
        acceptedAt: Date.now(),
    });

    // The accepted agreement now governs from the change date, so it is kept past its 30-day TTL
    // and the client gets their copy, which the signing route held back until this succeeded.
    await dropBillingCache(account.email, site.slug);

    // Saved before persisting: `saveAgreement` sets the TTL again, so the other order would undo it.
    const settled = { ...agreement, pendingDowngrade: false };
    await saveAgreement(settled);
    await persistAgreement(agreementId, account.email).catch((e) =>
        console.error("[portal/downgrade] could not persist agreement", agreementId, e),
    );
    after(async () => {
        await sendStoredAgreementEmail(settled);
        await sendDowngradeConfirmedEmail({
            to: account.email,
            siteName: site.name ?? site.slug,
            fromPlan: pending.fromPlan,
            toPlan: pending.toPlan,
            effectiveAt: result.effectiveAt,
            interval: result.interval,
        });
        await sendOpsNotice(`[JDD] Downgrade scheduled: ${site.name ?? site.slug} → Starter`, [
            `${account.email} accepted the Starter terms for <strong>${site.slug}</strong>.`,
            `Stripe moves the price on ${new Date(result.effectiveAt).toISOString().slice(0, 10)}, and the portal record follows by webhook. On or after that date, run the console downgrade to turn LEAD_CALLBACK off and move site.ts to starter.`,
        ]);
    });

    return NextResponse.json({ ok: true, effectiveAt: result.effectiveAt });
}
