import { NextResponse, after } from "next/server";
import { isWebOnly, upsertSite } from "@jdd/schema";
import { getAgreement, persistAgreement, saveAgreement } from "@/app/lib/kv";
import { sendStoredAgreementEmail } from "@/app/lib/agreement-email";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { sendOpsNotice } from "@/app/lib/ops-notice";
import { RECEPTIONIST_FAILED } from "@/app/lib/plan-change-copy";
import { acceptedBy, masterRefFor } from "@/app/lib/held-agreement";

export const runtime = "nodejs";

/**
 * A website-only Starter client switches the AI receptionist on (D7, approved 2026-11-04).
 *
 * Website-only is Starter at the same price with the receptionist declined, accepted against the
 * Web-Only schedule. Switching it on is accepting the standard Starter terms with a phone choice.
 * Nothing is charged: same plan, same price, and contract v5.3 §15.4 (Starter) says adding the
 * receptionist to a website-only arrangement carries no onboarding fee.
 *
 * This records the choice on the site, which takes it out of `isWebOnly`, and tells Xander to
 * provision the number and agent with onboard.js. Until he does, the portal shows the receptionist
 * as setting up, as it does for any paid-but-unprovisioned site.
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const { site, account } = ctx;

    if (!isWebOnly(site)) {
        // Already on, or not a Starter site. Nothing to switch on here.
        return NextResponse.json({ error: RECEPTIONIST_FAILED }, { status: 409 });
    }

    let body: { agreement_id?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const agreementId = body.agreement_id?.trim();
    if (!agreementId) return NextResponse.json({ error: "Missing agreement." }, { status: 400 });

    // The standard Starter master, accepted by this account (it is held, so it isn't the
    // account's master yet), with a receptionist chosen.
    const agreement = await getAgreement(agreementId);
    const mode = agreement?.receptionistMode;
    if (
        !agreement ||
        agreement.plan !== "starter" ||
        agreement.kind === "addendum" ||
        !acceptedBy(agreement, account) ||
        (mode !== "forwarded" && mode !== "published")
    ) {
        return NextResponse.json({ error: RECEPTIONIST_FAILED }, { status: 400 });
    }

    // It becomes the account's master in the same save that records the change.
    await saveAccount({
        ...upsertSite(
            account,
            { slug: site.slug, receptionistMode: mode, agreementId, agreementVersion: agreement.agreementVersion, agreementPdfUrl: agreement.pdfUrl },
            Date.now(),
        ),
        masterAgreement: masterRefFor(agreement),
    });

    // Saved before persisting: `saveAgreement` sets the TTL again.
    const settled = { ...agreement, pendingReceptionist: false };
    await saveAgreement(settled);
    await persistAgreement(agreementId, account.email).catch((e) =>
        console.error("[portal/receptionist] could not persist agreement", agreementId, e),
    );

    after(async () => {
        await sendStoredAgreementEmail(settled);
        await sendOpsNotice(`[JDD] Add receptionist: ${site.name ?? site.slug}`, [
            `${account.email} switched the AI receptionist on for <strong>${site.slug}</strong> (was website-only). Nothing is charged: same Starter plan, no onboarding fee.`,
            `Phone choice: <strong>${mode}</strong>${agreement.forwardingNumber ? `, forwarding ${agreement.forwardingNumber}` : ""}.`,
            `Provision it: npm run onboard -- --schema clients/${site.slug}/site.ts --receptionist ${mode}`,
        ]);
    });

    console.log("[portal/receptionist] switched on", account.email, site.slug, mode);
    return NextResponse.json({ ok: true });
}
