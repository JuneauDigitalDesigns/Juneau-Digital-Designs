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
  markReviewOptOut,
  type NumberOwner,
} from "@/app/lib/portal-crm";
import { publicWebhookUrl, validateTwilioSignature } from "@/app/lib/twilio";
import { notifyOwnerOfCustomerReply } from "@/app/lib/lead-alert";
import { smsKeywordRules } from "@/app/lib/owner-text-campaign";

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

/*
 * Keywords and replies come from the live campaign (`OWNER_TEXT_CAMPAIGN`, see
 * owner-text-campaign.ts): v1 answers in the approved campaign's registered words, v2 in the
 * replacement plan's. Read per request, so a cutover is an env edit plus a redeploy.
 */

export async function POST(request: Request) {
  const rules = smsKeywordRules();
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

  if (rules.optOut.has(keyword)) {
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

  if (rules.optIn.has(keyword)) {
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
    return twiml(rules.optInReply);
  }

  if (rules.help.has(keyword)) {
    return twiml(rules.helpReply);
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
 * The text itself lives in `lead-alert.ts` with the other owner texts, because what it may say
 * depends on the live campaign: under v1 (today's approved campaign, which describes only
 * end-of-call summaries) it is paused; under `OWNER_TEXT_CAMPAIGN=v2` it is the replacement
 * campaign's "New message in your portal" sample. Never throws, so a failed notification can't
 * fail the webhook — Twilio would retry and we would thread the same inbound message twice.
 */
async function notifyOwnerOfReply(owner: NumberOwner, customerName: string | null): Promise<void> {
  await notifyOwnerOfCustomerReply({ acctScope: owner.acctScope, slug: owner.slug, customerName });
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
