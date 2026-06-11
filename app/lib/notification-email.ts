import "server-only";
import { Resend } from "resend";
import type { AgreementRecord } from "./agreement-types";
import { brandedEmailHtml } from "./email-template";

export interface PaymentDetails {
  plan?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  amountTotal?: number | null;
  subscriptionId?: string | null;
  sessionId?: string | null;
}

export interface ClientCompleteNotificationData {
  brandName: string;
  email: string;
  phone: string;
  plan: string;
  websiteType: string;
  servicesCount: number;
  payloadJson: string;
  payment?: PaymentDetails | null;
  agreement?: AgreementRecord | null;
  agreementPdf?: Buffer | null;
}

function getCtx(): { resend: Resend; from: string; to: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const toEmail = process.env.QUOTE_TO_EMAIL;
  if (!apiKey || !toEmail) {
    console.warn("[notification-email] RESEND_API_KEY or QUOTE_TO_EMAIL not set — skipping");
    return null;
  }
  return {
    resend: new Resend(apiKey),
    from: process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev",
    to: toEmail,
  };
}

const row = (label: string, value: string) =>
  `<tr><td style="padding:6px 12px 6px 0;color:#555;font-size:13px;white-space:nowrap;vertical-align:top;">${label}</td><td style="padding:6px 0;font-size:13px;color:#111;word-break:break-all;">${value}</td></tr>`;

const section = (title: string, rows: string) => `
      <h3 style="margin:22px 0 6px;font-size:14px;font-weight:600;">${title}</h3>
      <div style="background:#f6f6f7;border-radius:8px;padding:14px 16px;">
        <table cellpadding="0" cellspacing="0" style="width:100%">${rows}</table>
      </div>`;

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
}

/**
 * The single operator email sent when a client completes onboarding.
 * Covers payment confirmation, the signed agreement (PDF attached when available),
 * and the onboarding intake (JSON attached).
 * Fire-and-forget safe — never throws.
 */
export async function sendClientCompleteNotification(
  data: ClientCompleteNotificationData,
): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;

  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.brandName.replace(/\W+/g, "_");
  const planLabel = capitalize(data.payment?.plan || data.plan);
  const subject = `[JDD Internal] New Client — ${planLabel} — ${data.brandName}`;

  const paymentRows = data.payment
    ? [
        row("Plan", planLabel),
        row("Customer", data.payment.customerName || data.payment.customerEmail || "—"),
        row("Email", data.payment.customerEmail || "—"),
        row(
          "Amount",
          data.payment.amountTotal != null
            ? `$${(data.payment.amountTotal / 100).toFixed(2)}`
            : "—",
        ),
        row("Subscription", data.payment.subscriptionId || "—"),
        row("Session", data.payment.sessionId || "—"),
      ].join("")
    : row("Status", "Payment details unavailable — check the Stripe dashboard.");

  const agreementRows = data.agreement
    ? [
        row("Business", data.agreement.clientLegalName),
        row("Signer", `${data.agreement.signerName} (${data.agreement.signerTitle})`),
        row("Signed at", data.agreement.audit.signedAt),
        row("Agreement ID", data.agreement.id),
        row("SHA-256", data.agreement.audit.payloadHash),
        row(
          "Signed PDF",
          data.agreementPdf
            ? "Attached (with audit trail)"
            : `<a href="${data.agreement.pdfUrl}" style="color:#0070f3;">View signed PDF</a>`,
        ),
      ].join("")
    : row("Status", "Agreement record unavailable.");

  const onboardingRows = [
    row("Brand", data.brandName),
    row("Email", data.email),
    row("Phone", data.phone),
    row("Website Type", data.websiteType),
    row("Services", String(data.servicesCount)),
  ].join("");

  const html = brandedEmailHtml({
    title: `New Client — ${data.brandName}`,
    subtitle: "Signed, paid, and onboarded.",
    body: `
      ${section("Payment", paymentRows)}
      ${section("Agreement", agreementRows)}
      ${section("Onboarding", onboardingRows)}
      <p style="color:#888;font-size:12px;margin-top:16px;">Full intake payload attached as JSON.</p>
    `,
  });

  const attachments: { filename: string; content: string }[] = [
    {
      filename: `onboarding-${safeName}-${date}.json`,
      content: Buffer.from(data.payloadJson).toString("base64"),
    },
  ];
  if (data.agreementPdf) {
    attachments.unshift({
      filename: `JDD_MSA_${safeName}_internal.pdf`,
      content: data.agreementPdf.toString("base64"),
    });
  }

  try {
    const result = await ctx.resend.emails.send({
      from: ctx.from,
      to: [ctx.to],
      subject,
      html,
      attachments,
    });
    if (result.error) {
      console.error("[notification-email] client-complete notification rejected", result.error);
    } else {
      console.log("[notification-email] client-complete notification sent", result.data?.id);
    }
  } catch (err) {
    console.error("[notification-email] client-complete notification threw", err);
  }
}
