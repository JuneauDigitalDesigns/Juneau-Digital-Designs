import "server-only";
import { Resend } from "resend";
import type { AgreementRecord } from "./agreement-types";

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter ($117/mo + $100 setup)",
  growth: "Growth ($297/mo)",
  enterprise: "Enterprise ($697/mo)",
};

/**
 * Email the signed PDF to both the client and JDD's QUOTE_TO_EMAIL inbox.
 * Failures are logged but don't throw — the agreement is already stored.
 */
export async function sendSignedAgreementEmails(
  record: AgreementRecord,
  fullPdfBuffer: Uint8Array,
  clientPdfBuffer: Uint8Array,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[agreement-email] RESEND_API_KEY not set — skipping email");
    return;
  }
  const fromAddress = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
  const jddInbox = process.env.QUOTE_TO_EMAIL;

  const resend = new Resend(apiKey);

  const planLabel = PLAN_LABEL[record.plan] ?? record.plan;
  const subject = `Signed MSA — ${record.clientLegalName}`;
  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; color: #111; line-height: 1.55; max-width: 560px;">
      <h2 style="margin: 0 0 16px; font-weight: 600;">Master Services Agreement — Signed</h2>
      <p>Thanks for signing your agreement with Juneau Digital Designs. A copy of your signed PDF is attached to this email.</p>
      <div style="background:#f6f6f7;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <div style="font-size:13px;line-height:1.7;">
          <strong>Plan:</strong> ${planLabel}<br/>
          <strong>Signer:</strong> ${record.signerName} (${record.signerTitle})<br/>
          <strong>Business:</strong> ${record.clientLegalName}<br/>
          <strong>Signed at:</strong> ${record.audit.signedAt}
        </div>
      </div>
      <p>Next step: complete payment through Stripe Checkout (you should have been redirected automatically). If you weren't, return to <a href="https://juneaudigitaldesigns.com/pricing">juneaudigitaldesigns.com/pricing</a>.</p>
      <p style="color:#888;font-size:11px;margin-top:28px;border-top:1px solid #eee;padding-top:12px;">
        Agreement ID: ${record.id}<br/>
        Document SHA-256: ${record.audit.payloadHash}<br/>
        Signed via electronic signature in compliance with ESIGN Act / UETA.
      </p>
    </div>
  `;

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

  // JDD internal email — full PDF including audit trail
  if (!jddInbox) {
    console.warn("[agreement-email] QUOTE_TO_EMAIL not set — skipping JDD internal copy");
    return;
  }
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [jddInbox],
      subject,
      html,
      attachments: [{ filename, content: Buffer.from(fullPdfBuffer).toString("base64") }],
    });
    if (result.error) {
      console.error("[agreement-email] JDD send rejected by Resend", jddInbox, result.error);
    } else {
      console.log("[agreement-email] JDD send ok", jddInbox, result.data?.id);
    }
  } catch (err) {
    console.error("[agreement-email] JDD send threw", jddInbox, err);
  }
}
