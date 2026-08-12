import "server-only";
import { Resend } from "resend";
import type { AgreementRecord } from "./agreement-types";
import { stripLastPage } from "./pdf-signer";
import { brandedEmailHtml } from "./email-template";
import { EMAIL } from "./email-tokens";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter ($117/mo + $100 setup)",
  growth: "Growth ($297/mo)",
  enterprise: "Enterprise ($697/mo)",
};

/**
 * Send a stored agreement to its signer, fetching the PDF back from blob storage.
 *
 * For the upgrade flow, the email is deliberately *not* sent when the signature is taken —
 * it waits until Stripe confirms the plan actually changed. By then the signing request's
 * PDF bytes are long gone, so they're re-read from `record.pdfUrl`.
 *
 * Never throws. The plan change has already succeeded by the time this runs, and a mail
 * failure must not turn a completed upgrade into an error for the client.
 */
export async function sendStoredAgreementEmail(record: AgreementRecord): Promise<void> {
  try {
    const res = await fetch(record.pdfUrl);
    if (!res.ok) throw new Error(`PDF fetch failed (${res.status})`);
    const full = new Uint8Array(await res.arrayBuffer());
    await sendClientAgreementEmail(record, await stripLastPage(full));
  } catch (e) {
    console.error("[agreement-email] deferred send failed", record.id, e);
  }
}

/**
 * Email the signed PDF to the client signer (no audit page). The owner copy is
 * delivered later as part of the combined client-complete notification.
 * Failures are logged but don't throw — the agreement is already stored.
 */
export async function sendClientAgreementEmail(
  record: AgreementRecord,
  clientPdfBuffer: Uint8Array,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[agreement-email] RESEND_API_KEY not set — skipping email");
    return;
  }
  const fromAddress = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";

  const resend = new Resend(apiKey);

  const planLabel = PLAN_LABEL[record.plan] ?? record.plan;
  const subject = `Signed MSA — ${record.clientLegalName}`;
  const innerHtml = `
    <p style="margin:0 0 18px;">Thanks for signing your agreement with Juneau Digital Designs. A copy of your signed PDF is attached to this email.</p>
    <div style="background:${EMAIL.panelInset};border-left:3px solid ${EMAIL.accent};border-radius:8px;padding:14px 16px;margin:0 0 18px;">
      <div style="font-size:13px;line-height:1.7;">
        <strong>Plan:</strong> ${planLabel}<br/>
        <strong>Signer:</strong> ${record.signerName} (${record.signerTitle})<br/>
        <strong>Business:</strong> ${record.clientLegalName}<br/>
        <strong>Signed at:</strong> ${record.audit.signedAt}
      </div>
    </div>
    <p style="margin:0;">Next step: complete payment through Stripe Checkout (you should have been redirected automatically). If you weren't, return to <a href="https://juneaudigitaldesigns.com/pricing" style="color:${EMAIL.accent};font-weight:500;text-decoration:underline;">juneaudigitaldesigns.com/pricing</a>.</p>
  `;
  const html = brandedEmailHtml({
    title: "Service Agreement — Signed",
    body: innerHtml,
    footerNote: `Agreement ID: ${record.id} · SHA-256: ${record.audit.payloadHash} · Signed via electronic signature in compliance with ESIGN Act / UETA.`,
  });

  const filename = `MSA-${record.clientLegalName.replace(/\W+/g, "_")}.pdf`;

  // Client email — no audit trail
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [record.signerEmail],
      subject,
      html,
      attachments: [{ filename, content: Buffer.from(clientPdfBuffer).toString("base64") }],
    });
    if (result.error) {
      console.error("[agreement-email] client send rejected by Resend", record.signerEmail, result.error);
    } else {
      console.log("[agreement-email] client send ok", record.signerEmail, result.data?.id);
    }
  } catch (err) {
    console.error("[agreement-email] client send threw", record.signerEmail, err);
  }
}
