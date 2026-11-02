import { NextResponse } from "next/server";
import {
  consentRequestContext,
  doubleOptInEnabled,
  getConsentState,
  normalizeE164,
  recordConsentEvent,
} from "@/app/lib/sms-consent";
import {
  appendMessage,
  findCustomerByPhone,
  getNumberOwner,
  getOwnerEmail,
  markReviewOptOut,
  type NumberOwner,
} from "@/app/lib/portal-crm";
import { publicWebhookUrl, sendSms, validateTwilioSignature } from "@/app/lib/twilio";
import { getConsentStateForAccount, isDeliverable } from "@/app/lib/sms-consent";

export const runtime = "nodejs";

/**
 * Inbound SMS keywords.
 *
 * BUILT BUT NOT WIRED. No purchased number has an `smsUrl` pointing here, so nothing
 * reaches this route today. It exists for two reasons:
 *
 *  1. Double opt-in (SMS_DOUBLE_OPTIN) needs somewhere for the confirming YES to land.
 *  2. Twilio's Advanced Opt-Out honours STOP at the Messaging Service, but tells our
 *     records nothing. Until a number points here, `sms:consent:state:*` can say "granted"
 *     for a number Twilio has already blocked. Pointing numbers at this route closes that
 *     gap without changing anything else.
 *
 * To enable: set the Messaging Service inbound webhook (or each number's smsUrl) to this
 * path and set SMS_WEBHOOK_URL to the same absolute URL so signature validation matches.
 */

const CONFIRM_WORDS = new Set(["YES", "START", "UNSTOP", "CONTINUE"]);
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);
const HELP_WORDS = new Set(["HELP", "INFO"]);

const HELP_REPLY =
  "Juneau Digital Designs Call Alerts: we text you a summary after each call your " +
  "receptionist handles. Msg & data rates may apply. Reply STOP to opt out. " +
  "Help: support@juneaudigitaldesigns.com";

export async function POST(request: Request) {
  const raw = await request.text();

  // Parse before validating: the signature is computed over these same parameters, so
  // there is no way to check it without first reading them.
  const params: Record<string, string> = {};
  for (const [key, value] of new URLSearchParams(raw)) params[key] = value;

  const valid = validateTwilioSignature({
    url: publicWebhookUrl(request),
    params,
    signature: request.headers.get("x-twilio-signature"),
  });
  if (!valid) {
    console.warn("[twilio-sms] rejected: bad or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const from = normalizeE164(params.From ?? "");
  const keyword = (params.Body ?? "").trim().toUpperCase();
  const messageBody = (params.Body ?? "").trim();
  // Which of our numbers they texted — the only thing identifying the client, since the
  // Messaging Service's inbound webhook is shared across every client.
  const to = normalizeE164(params.To ?? "");

  if (!from) {
    // Nothing to act on, but a non-200 makes Twilio retry a message we will never
    // understand any better the second time.
    return twiml();
  }

  const { ip, userAgent } = consentRequestContext(request);
  const owner = to ? await getNumberOwner(to) : null;

  if (to && !owner) {
    // Not a failure worth retrying — but it means a client's number is live and unmapped, so
    // their customers' replies are landing nowhere. Loud, and still a 200.
    console.error(
      `[twilio-sms] inbound to ${to} has no owner in portal:number-owner — reply dropped`,
    );
  }

  if (STOP_WORDS.has(keyword)) {
    const state = await getConsentState(from);
    // Only append a revocation to a consent that exists. A STOP from a stranger is noise,
    // and inventing a consent record to revoke would be worse than ignoring it.
    if (state && state.status !== "revoked") {
      await recordConsentEvent({
        phone: from,
        action: "revoked",
        source: "sms-keyword",
        ip,
        userAgent,
        accountEmail: state.accountEmail,
      });
      console.log("[twilio-sms] consent revoked by keyword", from);
    }
    // Independent of the owner-alert consent above: a customer is not the account owner and
    // has no consent record, so this is the only place their STOP is recorded in our books.
    // Blocks every future send to them — chat and review requests alike.
    if (owner) await markReviewOptOut(owner.acctScope, from);
    // No reply body: Advanced Opt-Out sends the confirmation itself, and a second message
    // to someone who just asked us to stop texting them is precisely the wrong answer.
    return twiml();
  }

  if (CONFIRM_WORDS.has(keyword)) {
    const state = await getConsentState(from);
    if (!state) return twiml();

    // Under double opt-in this is the reply that makes a pending grant deliverable. With
    // the flag off, START after a STOP is a fresh grant of a consent they already gave.
    await recordConsentEvent({
      phone: from,
      action: doubleOptInEnabled() ? "confirmed" : "granted",
      source: "sms-keyword",
      ip,
      userAgent,
      accountEmail: state.accountEmail,
      status: "granted",
    });
    console.log("[twilio-sms] consent confirmed by keyword", from);
    return twiml("You're set. Juneau Digital Designs will text you a summary after each call.");
  }

  if (HELP_WORDS.has(keyword)) {
    return twiml(HELP_REPLY);
  }

  // Not a keyword — so it is a customer replying to their tradesperson. Thread it.
  if (owner && messageBody) {
    const customer = await findCustomerByPhone(owner.acctScope, owner.slug, from);
    if (customer) {
      await appendMessage(owner.acctScope, owner.slug, customer.customerId, {
        direction: "in",
        body: messageBody.slice(0, 1600),
        at: new Date().toISOString(),
        messageSid: params.MessageSid ?? params.SmsSid ?? null,
        status: "received",
      });
      await notifyOwnerOfReply(owner, customer.name);
    } else {
      // A text from someone who is not a customer yet. Logged rather than auto-created: the
      // CRM is deliberately promotion-only, and silently inventing records from inbound SMS
      // would be the v1 mistake in a new place.
      console.log(`[twilio-sms] inbound from non-customer ${from} on ${owner.slug}`);
    }
  }

  // Never auto-reply to a conversational message. The client answers from the portal.
  return twiml();
}

/**
 * Tell the owner a customer replied — **the fact, not the message**.
 *
 * The portal is where they hold the conversation, so the alert's job is to get them there, not
 * to relay content to a second device. Keeping the body out also means a customer's words are
 * never forwarded somewhere the client did not expect.
 *
 * Account lane: JDD → the owner, on the already-approved notification campaign, so this works
 * day one and never waits on the client's own A2P registration. Honours the owner's existing
 * SMS consent; silent when they never opted in or have revoked.
 */
async function notifyOwnerOfReply(owner: NumberOwner, customerName: string | null): Promise<void> {
  try {
    const email = await getOwnerEmail(owner.acctScope);
    if (!email) return;

    const consent = await getConsentStateForAccount(email);
    if (!isDeliverable(consent)) return;

    const who = customerName?.trim() || "a customer";
    await sendSms({
      lane: "account",
      to: consent.phone,
      body: `You have a new message from ${who} in your portal: https://juneaudigitaldesigns.com/portal/customers`,
    });
  } catch (e) {
    // A failed notification must never fail the webhook — Twilio would retry and we would
    // thread the same inbound message twice.
    console.error("[twilio-sms] owner notification failed", e);
  }
}

/** Twilio expects TwiML, and an empty <Response/> means "say nothing back". */
function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, { headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
