import { NextResponse, after } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { generateSignedPdf, hashSubmission, stripLastPage } from "@/app/lib/pdf-signer";
import { auth } from "@clerk/nextjs/server";
import type { MasterAgreementRef } from "@jdd/schema";
import { hashAddendumForPlan, hashTermsForPlan } from "@/app/lib/legal/hash";
import { ADDENDUM_VERSION, TERMS_VERSION } from "@/app/lib/legal";
import { saveAgreement } from "@/app/lib/kv";
import { saveAccount } from "@/app/lib/account-store";
import { resolveAccountForUser } from "@/app/lib/portal-account";
import { hashConsentText, normalizeE164, savePendingConsent } from "@/app/lib/sms-consent";
import { SMS_CONSENT_TEXT_VERSION } from "@/app/lib/sms-consent-text";
import { sendClientAgreementEmail } from "@/app/lib/agreement-email";
import { acceptanceMethod, validateAgreementSubmission } from "@/app/lib/agreement-validate.mjs";
import type {
  AgreementAcceptance,
  AgreementAudit,
  AgreementRecord,
  AgreementSubmission,
} from "@/app/lib/agreement-types";

export const runtime = "nodejs";

/**
 * A master Starter agreement where the client declined the receptionist — the one case that
 * is signed against the Website-Only schedule rather than the standard plan terms. Centralised
 * so the hash, the PDF, and any future reader cannot disagree about what "web-only" means.
 */
function isWebOnlyMaster(body: AgreementSubmission): boolean {
  return body.kind !== "addendum" && body.plan === "starter" && body.receptionistMode === "declined";
}

export async function POST(req: Request) {
  /**
   * Signed-in clients only, checked before anything else.
   *
   * Everything below renders a branded agreement, stores it, and emails it to whatever address
   * the body names. Without this, a signed-out caller could make JDD do all three for anyone.
   * `/start` and `/agreement` already turn signed-out visitors away; this closes the API behind
   * them. `/start` creates the account before sending anyone to sign, so a login with no
   * account skipped the funnel and is refused here the same way `/api/checkout` refuses it.
   */
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  }
  let account: Awaited<ReturnType<typeof resolveAccountForUser>>;
  try {
    account = await resolveAccountForUser(userId);
  } catch (e) {
    console.error("[/api/agreement] account lookup failed", e);
    return NextResponse.json({ error: "Could not look up your account" }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json({ error: "No account for this login" }, { status: 403 });
  }

  let body: AgreementSubmission;
  try {
    body = (await req.json()) as AgreementSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // The rules live in agreement-validate.mjs so the test suite runs the same ones.
  const err = validateAgreementSubmission(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const id = randomUUID();
  const signedAt = new Date();
  const openedAt = new Date(body.pageOpenedAt);
  const isAddendum = body.kind === "addendum";

  /**
   * How the terms were accepted. A ticked box since 2026-11-03; a drawn signature only from a
   * page loaded before that shipped. The box records who ticked it, when, and from where — the
   * document itself is identified by `audit.termsHash` and `agreementVersion`, as before.
   */
  const acceptance: AgreementAcceptance =
    acceptanceMethod(body) === "clickwrap-self"
      ? {
          method: "clickwrap-self",
          checkedAt: signedAt.toISOString(),
          ip: clientIp(req),
          userAgent: req.headers.get("user-agent") || "unknown",
        }
      : { method: "drawn-signature" };
  // A drawn signature from a stale page is kept as it always was; a clickwrap submission
  // carries no image, and never stores a stray one.
  if (acceptance.method === "clickwrap-self") delete body.signatureDataUrl;

  const audit: AgreementAudit = {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") || "unknown",
    signedAt: signedAt.toISOString(),
    payloadHash: hashSubmission(body),
    scrollCompletedAt: new Date(body.scrollCompletedAt).toISOString(),
    // Derived from the two client timestamps rather than trusting a duration
    // the client computed for itself.
    dwellMs: Math.max(0, signedAt.getTime() - openedAt.getTime()),
    // Hash the document that was actually shown. Signing an addendum and recording the
    // master's hash would attest to words the client never saw — and a Starter client who
    // chose website-only saw the Web-Only schedule, so the hash has to cover that variant too.
    termsHash: isAddendum
      ? hashAddendumForPlan(body.plan)
      : hashTermsForPlan(body.plan, { webOnly: isWebOnlyMaster(body) }),
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateSignedPdf(body, audit, id, acceptance);
  } catch (e) {
    console.error("[/api/agreement] pdf generation failed", e);
    return NextResponse.json({ error: "Could not generate signed PDF" }, { status: 500 });
  }

  let pdfUrl: string;
  try {
    const filename = `agreements/${id}.pdf`;
    const uploaded = await put(filename, Buffer.from(pdfBytes), {
      access: "public",
      contentType: "application/pdf",
    });
    pdfUrl = uploaded.url;
  } catch (e) {
    console.error("[/api/agreement] blob upload failed", e);
    return NextResponse.json({ error: "Could not store signed PDF" }, { status: 500 });
  }

  const record: AgreementRecord = {
    id,
    plan: body.plan,
    clientLegalName: body.clientLegalName,
    clientEntityType: body.clientEntityType,
    clientAddress: body.clientAddress,
    signerName: body.signerName,
    signerTitle: body.signerTitle,
    signerEmail: body.signerEmail,
    additionalSites: body.additionalSites,
    // The phone-handling choice, carried onto the record so the Stripe webhook can tailor the
    // welcome email and the pending site can prefill the onboarding form from it. Omitted
    // rather than written as undefined when absent (Enterprise, upgrades, legacy links).
    ...(body.receptionistMode ? { receptionistMode: body.receptionistMode } : {}),
    ...(body.forwardingNumber ? { forwardingNumber: body.forwardingNumber.trim() } : {}),
    ...(body.billingPeriod ? { billingPeriod: body.billingPeriod } : {}),
    pdfUrl,
    audit,
    acceptance,
    // The addendum carries its own version. Stamping TERMS_VERSION on it would make a
    // client look as though they had re-signed the master when they had not — and
    // `masterNeedsResign` reads exactly this field to decide whether they still need to.
    agreementVersion: isAddendum ? ADDENDUM_VERSION : TERMS_VERSION,
    ...(isAddendum
      ? { kind: "addendum" as const, parentAgreementId: body.parentAgreementId }
      : { kind: "master" as const }),
    ...(body.upgradeSlug
      ? { pendingUpgrade: true, upgradeSlug: body.upgradeSlug.trim() }
      : {}),
    ...(body.downgradeSlug
      ? { pendingDowngrade: true, downgradeSlug: body.downgradeSlug.trim() }
      : {}),
  };

  try {
    await saveAgreement(record);
  } catch (e) {
    console.error("[/api/agreement] KV save failed", e);
    return NextResponse.json({ error: "Could not save agreement record" }, { status: 500 });
  }

  /**
   * Record the master on the account, so later purchases can take an addendum.
   *
   * Written at signature rather than at payment, deliberately. `masterNeedsResign` asks
   * "have these terms been agreed to", and the answer becomes yes the moment they sign — an
   * abandoned checkout does not un-sign an agreement, and making someone re-read the full
   * terms because their card was declined would be absurd.
   *
   * The ceiling is exactly the plan just signed — deliberately *not* carried over from a
   * previous master. Terms differ per plan, so a client re-signing at Starter level after a
   * version bump has only agreed to Starter terms at this version, and buying Enterprise
   * later should ask them again. Inflating the ceiling to whatever they once held would
   * silently authorise a tier under terms that never contemplated it.
   *
   * Best effort: the agreement itself is already stored, which is the artefact that must
   * survive. Losing this costs one extra full signature later, not the signature just given.
   */
  if (!isAddendum) {
    try {
      const master: MasterAgreementRef = {
        agreementId: id,
        version: TERMS_VERSION,
        tierCeiling: body.plan,
        signedAt: signedAt.getTime(),
      };
      await saveAccount({ ...account, masterAgreement: master, updatedAt: Date.now() });
    } catch (e) {
      console.error(`[/api/agreement] ${id} could not record master on account`, e);
    }
  }

  // SMS consent, if given, is held rather than activated: nobody gets texted for a
  // purchase that never happened. The Stripe webhook promotes it once payment clears, and
  // an abandoned checkout leaves it to expire on the same 30-day clock as the agreement.
  //
  // Written after the agreement is safely stored, and never allowed to fail the request.
  // A signature is the artefact that has to survive; losing one because a secondary write
  // errored would be a far worse outcome than a client having to re-tick a box.
  if (body.smsConsent) {
    const alertPhone = normalizeE164(body.alertPhone);
    if (alertPhone) {
      try {
        await savePendingConsent({
          agreementId: id,
          phone: alertPhone,
          capturedAt: audit.signedAt,
          // Reuses the audit's IP and user agent rather than re-reading the headers, so the
          // consent and the signature can never disagree about who was at the keyboard.
          ip: audit.ip,
          userAgent: audit.userAgent,
          consentTextHash: hashConsentText(),
          consentTextVersion: SMS_CONSENT_TEXT_VERSION,
          signerEmail: body.signerEmail,
        });
      } catch (e) {
        console.error(`[/api/agreement] ${id} SMS consent write failed, alerts will stay off`, e);
      }
    }
  }

  // Email runs after the response via after() — Vercel keeps the function alive
  // for it (a plain fire-and-forget promise gets killed when the lambda freezes).
  // Strip the audit-trail page before sending to the client.
  //
  // An upgrade signature is the exception: the client must not be sent a Growth agreement
  // until Stripe confirms they are actually on Growth. That used to happen here regardless,
  // so a failed plan change left them holding an agreement for a tier they were never moved
  // to. `/api/portal/upgrade` sends it on success and clears `pendingUpgrade`; a record still
  // flagged is an orphan for ops to chase.
  if (record.pendingUpgrade) {
    console.log(`[/api/agreement] ${id} held for upgrade confirmation (${record.upgradeSlug})`);
  } else if (record.pendingDowngrade) {
    // Same reason: the client gets the Starter agreement once the downgrade is scheduled.
    console.log(`[/api/agreement] ${id} held for downgrade confirmation (${record.downgradeSlug})`);
  } else {
    after(() =>
      stripLastPage(pdfBytes)
        .then((clientPdfBytes) => sendClientAgreementEmail(record, clientPdfBytes))
        .catch((e) => console.error("[/api/agreement] email failed", e)),
    );
  }

  return NextResponse.json({ agreement_id: id, pdf_url: pdfUrl });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
