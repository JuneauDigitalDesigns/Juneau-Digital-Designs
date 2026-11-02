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
import type {
  AgreementAudit,
  AgreementRecord,
  AgreementSubmission,
  PlanSlug,
  ReceptionistMode,
} from "@/app/lib/agreement-types";

export const runtime = "nodejs";

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];
const VALID_RECEPTIONIST_MODES: ReceptionistMode[] = ["forwarded", "published", "declined"];

/**
 * A master Starter agreement where the client declined the receptionist — the one case that
 * is signed against the Website-Only schedule rather than the standard plan terms. Centralised
 * so the hash, the PDF, and any future reader cannot disagree about what "web-only" means.
 */
function isWebOnlyMaster(body: AgreementSubmission): boolean {
  return body.kind !== "addendum" && body.plan === "starter" && body.receptionistMode === "declined";
}

export async function POST(req: Request) {
  let body: AgreementSubmission;
  try {
    body = (await req.json()) as AgreementSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const id = randomUUID();
  const signedAt = new Date();
  const openedAt = new Date(body.pageOpenedAt);
  const isAddendum = body.kind === "addendum";

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
    pdfBytes = await generateSignedPdf(body, audit, id);
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
    pdfUrl,
    audit,
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
      const { userId } = await auth();
      const account = userId ? await resolveAccountForUser(userId) : null;
      if (account) {
        const master: MasterAgreementRef = {
          agreementId: id,
          version: TERMS_VERSION,
          tierCeiling: body.plan,
          signedAt: signedAt.getTime(),
        };
        await saveAccount({ ...account, masterAgreement: master, updatedAt: Date.now() });
      }
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

function validate(body: AgreementSubmission): string | null {
  if (!VALID_PLANS.includes(body.plan)) return "Invalid plan";
  if (body.kind && body.kind !== "master" && body.kind !== "addendum") {
    return "Invalid agreement kind";
  }
  // An addendum with no master to adopt is not an addendum. `/start` always supplies this;
  // its absence means the client reached the signing form some other way.
  if (body.kind === "addendum" && !nonEmpty(body.parentAgreementId)) {
    return "Missing parent agreement";
  }
  if (!nonEmpty(body.clientLegalName)) return "Missing client legal name";
  if (!nonEmpty(body.clientEntityType)) return "Missing entity type";
  if (!nonEmpty(body.clientAddress)) return "Missing client address";
  if (!nonEmpty(body.signerName)) return "Missing signer name";
  if (!nonEmpty(body.signerTitle)) return "Missing signer title";
  if (!validEmail(body.signerEmail)) return "Invalid signer email";
  if (!body.signatureDataUrl?.startsWith("data:image/png;base64,")) {
    return "Missing or invalid signature";
  }
  // The scroll gate is enforced in the UI, but a submission that never reached
  // the end of the terms must not be accepted just because it skipped the UI.
  if (!validTimestamp(body.pageOpenedAt)) return "Missing page open timestamp";
  if (!validTimestamp(body.scrollCompletedAt)) {
    return "Agreement was not read to the end";
  }
  // Only on a master. The Enterprise master is where the client commits to the site list, so
  // it has to be named there. An addendum adding a site to an existing Enterprise bundle
  // derives its sites from `account.sites` instead — the account record is the truth about
  // what they own by then, and asking them to retype it invites the two to disagree.
  if (body.plan === "enterprise" && body.kind !== "addendum") {
    const sites = (body.additionalSites || []).filter(nonEmpty);
    if (sites.length < 2) return "Enterprise requires at least 2 site names";
  }
  // Phone handling. Captured at signing for a new Starter/Growth purchase, so the welcome
  // email can speak to the client's actual choice and the onboarding form opens prefilled.
  // Skipped for upgrades (the client already has a phone setup) and for Enterprise (the
  // per-site choice is deferred to the onboarding form). The UI enforces this too; the server
  // must not trust it to.
  const needsPhoneChoice = !body.upgradeSlug && (body.plan === "starter" || body.plan === "growth");
  if (body.receptionistMode && !VALID_RECEPTIONIST_MODES.includes(body.receptionistMode)) {
    return "Invalid phone option";
  }
  if (needsPhoneChoice && !body.receptionistMode) {
    return "Please choose how your phone should be handled";
  }
  // Website-only is a Starter concession, not a Growth or Enterprise option: those are
  // receptionist plans with no web-only schedule to sign against.
  if (body.receptionistMode === "declined" && body.plan !== "starter") {
    return "Website-only is only available on the Starter plan";
  }
  // Forwarding needs a number to forward from. A choice of "forward" with nothing to forward
  // is not a usable instruction.
  if (body.receptionistMode === "forwarded" && !normalizeE164(body.forwardingNumber)) {
    return "A valid number to forward is required";
  }

  // A website-only site produces no calls, so there is nothing to text a summary about.
  // Replaces the old Starter-wide block: since the 2026-10-12 reprice every plan includes the
  // receptionist, and the one case with no calls is the website-only choice, not the tier.
  if (body.smsConsent && body.receptionistMode === "declined") {
    return "Call alert texts require a receptionist";
  }
  // Consent without a reachable number is not consent to anything. Checked in the UI too,
  // but a record claiming permission to text an unparseable string is worse than no record.
  if (body.smsConsent && !normalizeE164(body.alertPhone)) {
    return "A valid mobile number is required to enable call alert texts";
  }
  return null;
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function validEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function validTimestamp(s: unknown): s is string {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}
