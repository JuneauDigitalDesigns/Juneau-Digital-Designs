import "server-only";
import { Resend } from "resend";

export interface StripeNotificationData {
  plan?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  amountTotal?: number | null;
  subscriptionId?: string | null;
  agreementPdfUrl?: string | null;
  sessionId?: string | null;
}

export interface OnboardingNotificationData {
  brandName: string;
  email: string;
  phone: string;
  plan: string;
  websiteType: string;
  servicesCount: number;
  payloadJson: string;
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
  `<tr><td style="padding:6px 12px 6px 0;color:#555;font-size:13px;white-space:nowrap;">${label}</td><td style="padding:6px 0;font-size:13px;color:#111;">${value}</td></tr>`;

/**
 * Notify the JDD owner that a Stripe checkout completed.
 * Fire-and-forget safe — never throws.
 */
export async function sendStripeNotification(data: StripeNotificationData): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;

  const planLabel = data.plan
    ? data.plan.charAt(0).toUpperCase() + data.plan.slice(1)
    : "Unknown";
  const customerName = data.customerName || data.customerEmail || "Unknown Customer";
  const amount =
    data.amountTotal != null ? `$${(data.amountTotal / 100).toFixed(2)}` : "—";
  const subject = `New JDD Payment — ${planLabel} — ${customerName}`;
  const pdfLink = data.agreementPdfUrl
    ? `<a href="${data.agreementPdfUrl}" style="color:#0070f3;">View signed PDF</a>`
    : "—";

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;">
      <h2 style="margin:0 0 16px;font-weight:600;">New Payment Received</h2>
      <div style="background:#f6f6f7;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${row("Plan", planLabel)}
          ${row("Customer", customerName)}
          ${row("Email", data.customerEmail || "—")}
          ${row("Amount", amount)}
          ${row("Subscription", data.subscriptionId || "—")}
          ${row("Session", data.sessionId || "—")}
          ${row("Agreement PDF", pdfLink)}
        </table>
      </div>
    </div>
  `;

  try {
    const result = await ctx.resend.emails.send({
      from: ctx.from,
      to: [ctx.to],
      subject,
      html,
    });
    if (result.error) {
      console.error("[notification-email] stripe notification rejected", result.error);
    } else {
      console.log("[notification-email] stripe notification sent", result.data?.id);
    }
  } catch (err) {
    console.error("[notification-email] stripe notification threw", err);
  }
}

/**
 * Notify the JDD owner that an onboarding form was submitted.
 * Attaches the full intake payload as a JSON file.
 * Fire-and-forget safe — never throws.
 */
export async function sendOnboardingNotification(
  data: OnboardingNotificationData,
): Promise<void> {
  const ctx = getCtx();
  if (!ctx) return;

  const date = new Date().toISOString().slice(0, 10);
  const safeName = data.brandName.replace(/\W+/g, "_");
  const subject = `New JDD Onboarding — ${data.brandName}`;
  const attachmentFilename = `onboarding-${safeName}-${date}.json`;
  const planLabel = data.plan.charAt(0).toUpperCase() + data.plan.slice(1);

  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.55;max-width:560px;">
      <h2 style="margin:0 0 16px;font-weight:600;">New Onboarding Submission</h2>
      <div style="background:#f6f6f7;border-radius:8px;padding:14px 16px;margin:18px 0;">
        <table cellpadding="0" cellspacing="0" style="width:100%">
          ${row("Brand", data.brandName)}
          ${row("Email", data.email)}
          ${row("Phone", data.phone)}
          ${row("Plan", planLabel)}
          ${row("Website Type", data.websiteType)}
          ${row("Services", String(data.servicesCount))}
        </table>
      </div>
      <p style="color:#888;font-size:12px;margin-top:16px;">Full intake payload attached as JSON.</p>
    </div>
  `;

  try {
    const result = await ctx.resend.emails.send({
      from: ctx.from,
      to: [ctx.to],
      subject,
      html,
      attachments: [
        {
          filename: attachmentFilename,
          content: Buffer.from(data.payloadJson).toString("base64"),
        },
      ],
    });
    if (result.error) {
      console.error("[notification-email] onboarding notification rejected", result.error);
    } else {
      console.log("[notification-email] onboarding notification sent", result.data?.id);
    }
  } catch (err) {
    console.error("[notification-email] onboarding notification threw", err);
  }
}
