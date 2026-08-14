import { NextResponse, after } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { generateSignedPdf, hashSubmission, stripLastPage } from "@/app/lib/pdf-signer";
import { hashTermsForPlan } from "@/app/lib/legal/hash";
import { TERMS_VERSION } from "@/app/lib/legal";
import { saveAgreement } from "@/app/lib/kv";
import { hashConsentText, normalizeE164, savePendingConsent } from "@/app/lib/sms-consent";
import { SMS_CONSENT_TEXT_VERSION } from "@/app/lib/sms-consent-text";
import { sendClientAgreementEmail } from "@/app/lib/agreement-email";
import type {
  AgreementAudit,
  AgreementRecord,
  AgreementSubmission,
  PlanSlug,
} from "@/app/lib/agreement-types";

export const runtime = "nodejs";

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];

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

  const audit: AgreementAudit = {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") || "unknown",
    signedAt: signedAt.toISOString(),
    payloadHash: hashSubmission(body),
    scrollCompletedAt: new Date(body.scrollCompletedAt).toISOString(),
    // Derived from the two client timestamps rather than trusting a duration
    // the client computed for itself.
    dwellMs: Math.max(0, signedAt.getTime() - openedAt.getTime()),
    termsHash: hashTermsForPlan(body.plan),
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
    pdfUrl,
    audit,
    agreementVersion: TERMS_VERSION,
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
  if (body.plan === "enterprise") {
    const sites = (body.additionalSites || []).filter(nonEmpty);
    if (sites.length < 2) return "Enterprise requires at least 2 site names";
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
