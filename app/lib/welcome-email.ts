import "server-only";
import { Resend } from "resend";
import type { PortalPlan } from "@jdd/schema";
import type { ReceptionistMode } from "./agreement-types";
import { SCHEDULES, WEB_ONLY_SCHEDULE } from "./legal";
import type { PlanSlug } from "./agreement-types";
import { brandedEmailHtml } from "./email-template";
import { EMAIL, EMAIL_FONT } from "./email-tokens";

const SITE_URL = "https://juneaudigitaldesigns.com";

export interface WelcomeEmailData {
  /** Recipient — the signer on the agreement. */
  signerEmail: string;
  signerName: string;
  /** The client's business / legal name, used in the greeting. */
  clientLegalName: string;
  plan: PortalPlan;
  /** Absent on Enterprise (deferred to onboarding), upgrades, and pre-ship agreements. */
  receptionistMode?: ReceptionistMode;
  /** The line the client will forward, only present when `receptionistMode` is `forwarded`. */
  forwardingNumber?: string;
  /** The pending site's slug, for the onboarding deep link. */
  siteSlug: string;
}

/**
 * The plan name and monthly price, taken from Schedule A so the welcome email can never quote a
 * price the contract has moved past. Website-only is a Starter choice with its own schedule.
 */
function planLabel(plan: PortalPlan, webOnly: boolean): string {
  const schedule = webOnly ? WEB_ONLY_SCHEDULE : SCHEDULES[plan as PlanSlug];
  if (!schedule) return plan;
  return `${schedule.name} — $${schedule.monthlyPrice.toLocaleString("en-US")}/mo`;
}

/** A numbered next-step row: a teal circle, a heading, a line of copy, and a CTA button. */
function step(n: number, heading: string, body: string, href: string, label: string, filled: boolean): string {
  const button = filled
    ? `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:${EMAIL.accent};border-radius:8px;">
         <a href="${href}" style="display:inline-block;padding:11px 20px;color:${EMAIL.card};font-family:${EMAIL_FONT.body};font-size:13.5px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">${label} &rarr;</a>
       </td></tr></table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="border:1px solid ${EMAIL.accent};border-radius:8px;">
         <a href="${href}" style="display:inline-block;padding:10px 19px;color:${EMAIL.accent};font-family:${EMAIL_FONT.body};font-size:13.5px;font-weight:600;text-decoration:none;letter-spacing:0.01em;">${label} &rarr;</a>
       </td></tr></table>`;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr>
        <td width="38" valign="top">
          <div style="width:28px;height:28px;border-radius:50%;background:${EMAIL.accent};color:${EMAIL.card};font-family:${EMAIL_FONT.display};font-size:15px;font-weight:600;text-align:center;line-height:28px;">${n}</div>
        </td>
        <td valign="top" style="padding-left:12px;">
          <div style="font-weight:600;color:${EMAIL.ink};font-size:15px;">${heading}</div>
          <div style="color:${EMAIL.fg2};font-size:13.5px;line-height:1.55;margin:3px 0 10px;">${body}</div>
          ${button}
        </td>
      </tr>
    </table>`;
}

/**
 * Describes the client's phone choice for the summary panel, and whether a forwarding heads-up
 * is warranted. Mirrors the three signing-page options, with a neutral line for the deferred
 * Enterprise / unknown case.
 */
function phoneSummary(mode: ReceptionistMode | undefined, forwardingNumber?: string): string {
  switch (mode) {
    case "forwarded":
      return (
        `<strong style="color:${EMAIL.ink};">Phone setup:</strong> Forward your existing number<br/>` +
        (forwardingNumber
          ? `<strong style="color:${EMAIL.ink};">Number to forward:</strong> ${forwardingNumber}<br/>`
          : "")
      );
    case "published":
      return `<strong style="color:${EMAIL.ink};">Phone setup:</strong> Use a new number we provide<br/>`;
    case "declined":
      return `<strong style="color:${EMAIL.ink};">Phone setup:</strong> Website only — no AI receptionist<br/>`;
    default:
      return `<strong style="color:${EMAIL.ink};">Phone setup:</strong> We'll sort this out with you during onboarding<br/>`;
  }
}

/**
 * The branded welcome email, sent from the Stripe webhook once a new-site purchase is paid.
 *
 * Tailored to the phone choice: a forwarding client gets an up-front heads-up that their carrier
 * will need to make a change (but no exact instructions yet — the JDD number isn't provisioned
 * at payment time), while a website-only client sees no phone steps at all.
 *
 * Throws on a failed send, by design: the caller holds the once-only claim and releases it on a
 * throw so a Stripe retry can re-attempt, rather than the marker swallowing a lost email. The
 * caller is responsible for keeping the throw off the webhook's response path.
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[welcome-email] RESEND_API_KEY not set — skipping email");
    return;
  }
  const fromAddress = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";
  const replyTo = process.env.QUOTE_TO_EMAIL;

  const resend = new Resend(apiKey);

  const webOnly = data.plan === "starter" && data.receptionistMode === "declined";
  const isForwarding = data.receptionistMode === "forwarded";
  const label = planLabel(data.plan, webOnly);

  const onboardingUrl = `${SITE_URL}/portal/onboarding?site=${encodeURIComponent(data.siteSlug)}`;
  const portalUrl = `${SITE_URL}/portal`;

  // No em-dash in a subject line a client reads.
  const subject = "Welcome to Juneau Digital Designs — let's get you set up";

  const forwardingHeadsUp = isForwarding
    ? `
      <div style="background:${EMAIL.panelInset};border:1px dashed ${EMAIL.rule};border-radius:10px;padding:16px 18px;margin:22px 0 4px;">
        <div style="font-family:${EMAIL_FONT.display};font-size:16px;font-weight:600;color:${EMAIL.ink};margin-bottom:6px;">Heads-up: you'll set up call forwarding</div>
        <p style="margin:0;color:${EMAIL.fg2};font-size:13.5px;line-height:1.6;">You chose to <strong style="color:${EMAIL.ink};">keep your existing number</strong> and forward calls to your new AI receptionist. Your phone carrier has to make that change — it's quick, but only you can authorize it on your line.</p>
        <p style="margin:10px 0 0;color:${EMAIL.fg2};font-size:13.5px;line-height:1.6;"><strong style="color:${EMAIL.ink};">Nothing to do yet.</strong> Once your site and receptionist are ready, we'll email you the exact number to forward to and step-by-step instructions for your carrier.</p>
      </div>`
    : "";

  const innerHtml = `
    <p style="margin:0 0 20px;">Thanks for signing on with Juneau Digital Designs. We've got your signed agreement and your first payment. Before we start building, here's what we need from you.</p>

    ${step(
      1,
      "Finish your onboarding form",
      "This is where you tell us about your business, services, and the look you want. It takes about 10 minutes and it's what we build your site from.",
      onboardingUrl,
      "Finish onboarding",
      true,
    )}

    ${step(
      2,
      "Log into your client portal",
      "Track your build progress, watch your call log, and see your site's health — all in one place. Use the email you signed up with.",
      portalUrl,
      "Open my portal",
      false,
    )}

    ${forwardingHeadsUp}

    <div style="background:${EMAIL.panelInset};border-left:3px solid ${EMAIL.accent};border-radius:8px;padding:14px 16px;margin:22px 0 4px;">
      <div style="font-size:13px;line-height:1.85;color:${EMAIL.fg2};">
        <strong style="color:${EMAIL.ink};">Plan:</strong> ${label}<br/>
        ${phoneSummary(data.receptionistMode, data.forwardingNumber)}
      </div>
    </div>

    <p style="margin:22px 0 0;color:${EMAIL.fg2};font-size:13.5px;line-height:1.6;"><strong style="color:${EMAIL.ink};">What happens next:</strong> once your onboarding form is in, we start building. You'll see progress in your portal, and we'll reach out if we need anything. Questions? Just reply to this email.</p>
  `;

  const html = brandedEmailHtml({
    title: `Welcome aboard, ${data.clientLegalName}.`,
    subtitle: `Your ${webOnly ? "Starter" : SCHEDULES[data.plan as PlanSlug]?.name ?? data.plan} plan is active. Here's how to get set up.`,
    body: innerHtml,
  });

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [data.signerEmail],
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    if (result.error) {
      console.error("[welcome-email] send rejected by Resend", data.signerEmail, result.error);
      throw new Error("Resend rejected the welcome email");
    }
    console.log("[welcome-email] sent", data.signerEmail, result.data?.id);
  } catch (err) {
    console.error("[welcome-email] send threw", data.signerEmail, err);
    throw err;
  }
}
