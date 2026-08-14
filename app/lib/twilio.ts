import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Twilio client.
 *
 * Deliberately not the `twilio` SDK: the site needs exactly two things from Twilio, both
 * of them a handful of lines, and pulling a full telephony SDK into a Next.js server
 * bundle to send one confirmation message is not a trade worth making. The provisioning
 * side (jdd-ops) uses the real SDK, where the surface area justifies it.
 */

const API_BASE = "https://api.twilio.com/2010-04-01";

/**
 * Verify an inbound webhook actually came from Twilio.
 *
 * Twilio's scheme: HMAC-SHA1, keyed on the account auth token, over the exact public URL
 * with every POST parameter appended in key-sorted order as `keyvalue`. Any drift in the
 * URL breaks it, which is why the URL is passed in rather than read off the request: behind
 * Vercel's proxy `request.url` can arrive as http on an internal hostname, and Twilio signed
 * the https one the world sees.
 */
export function validateTwilioSignature({
  url,
  params,
  signature,
  authToken = process.env.TWILIO_AUTH_TOKEN,
}: {
  url: string;
  params: Record<string, string>;
  signature: string | null;
  authToken?: string;
}): boolean {
  if (!signature || !authToken) return false;

  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);

  const expected = createHmac("sha1", authToken).update(Buffer.from(payload, "utf8")).digest();

  let given: Buffer;
  try {
    given = Buffer.from(signature, "base64");
  } catch {
    return false;
  }
  // timingSafeEqual throws on a length mismatch, which is itself an answer.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Reconstruct the public URL Twilio signed.
 *
 * SMS_WEBHOOK_URL wins when set, because a hand-configured value beats inference from
 * headers an attacker could influence.
 */
export function publicWebhookUrl(request: Request): string {
  const configured = process.env.SMS_WEBHOOK_URL;
  if (configured) return configured;

  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}${url.pathname}${url.search}`;
}

/**
 * Send one message through the A2P Messaging Service.
 *
 * Routed via MessagingServiceSid rather than a From number on purpose: the Messaging
 * Service is what carries the registered campaign and the Advanced Opt-Out behaviour, so
 * sending around it would produce exactly the unregistered-sender failure this whole
 * change exists to fix.
 */
export async function sendSms({ to, body }: { to: string; body: string }): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || !messagingServiceSid) {
    throw new Error(
      "Twilio is not configured — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and " +
        "TWILIO_MESSAGING_SERVICE_SID",
    );
  }

  const res = await fetch(`${API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, Body: body, MessagingServiceSid: messagingServiceSid }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio send failed (${res.status}): ${detail.slice(0, 300)}`);
  }
}
