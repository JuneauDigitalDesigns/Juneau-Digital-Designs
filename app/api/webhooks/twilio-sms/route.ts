import { NextResponse } from "next/server";
import {
  consentRequestContext,
  doubleOptInEnabled,
  getConsentState,
  normalizeE164,
  recordConsentEvent,
} from "@/app/lib/sms-consent";
import { publicWebhookUrl, validateTwilioSignature } from "@/app/lib/twilio";

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

  if (!from) {
    // Nothing to act on, but a non-200 makes Twilio retry a message we will never
    // understand any better the second time.
    return twiml();
  }

  const { ip, userAgent } = consentRequestContext(request);

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

  return twiml();
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
