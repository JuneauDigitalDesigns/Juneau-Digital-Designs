import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { carriesLink, ownerTextLinksAllowed } from "./owner-text-campaign";

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
  return reconstructPublicUrl(request);
}

/**
 * Rebuild the public URL from forwarded headers, with no env override.
 *
 * Separate from `publicWebhookUrl` because a second webhook (the review status callback) signs
 * against its *own* URL — reusing `publicWebhookUrl` there would wrongly return `SMS_WEBHOOK_URL`
 * (the inbound route) and break signature validation. That route passes its own configured URL
 * and falls back to this.
 */
export function reconstructPublicUrl(request: Request): string {
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
 *
 * `from` pins the sender *within* the service — Twilio accepts `From` + `MessagingServiceSid`
 * together, and the number still inherits the registered campaign and Advanced Opt-Out. The
 * review-request flow uses it so a caller sees the business's own number. Both lanes always
 * pin it — see the account branch below for what happened when one did not.
 *
 * `statusCallback` asks Twilio to POST delivery updates to our webhook, used by the review
 * flow to track delivered/failed per recipient.
 */
/**
 * Which campaign a message belongs to. **Required, never defaulted.**
 *
 * The two lanes have different senders, different campaigns and different readiness dates:
 *
 *  - `account` — JDD → the business owner (post-call briefs, new-lead alerts, portal
 *    notifications). Rides JDD's approved `ACCOUNT_NOTIFICATION` campaign from a dedicated JDD
 *    notification number. Works day one on every tier.
 *  - `customer` — the business → its own customer (lead replies, review requests). Rides the
 *    *client's own* `CUSTOMER_CARE` campaign from their provisioned number, and only once their
 *    A2P registration verifies.
 *
 * Making this an explicit argument rather than an optional override is deliberate: a forgotten
 * parameter would silently send customer traffic on the account campaign, which produces no
 * error and surfaces weeks later as carrier filtering.
 */
export type SmsLane =
  | { lane: "account" }
  | { lane: "customer"; messagingServiceSid: string; from: string };

export async function sendSms({
  to,
  body,
  statusCallback,
  ...laneOpts
}: {
  to: string;
  body: string;
  statusCallback?: string;
} & SmsLane): Promise<{ sid: string | null }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error("Twilio is not configured — set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN");
  }

  let serviceSid: string;
  let from: string | undefined;

  if (laneOpts.lane === "customer") {
    serviceSid = laneOpts.messagingServiceSid;
    from = laneOpts.from;
  } else {
    // The last stop for every owner text. The approved campaign (v1) is registered without
    // links, so a body with one is refused here whatever built it; a throw is "not sent" to
    // every account-lane caller. See owner-text-campaign.ts.
    if (carriesLink(body) && !ownerTextLinksAllowed()) {
      throw new Error(
        "Account-lane SMS refused: the body carries a link and the live campaign declares none " +
          "(OWNER_TEXT_CAMPAIGN=v2 with OWNER_TEXT_LINKS=on is the only mode that allows one)",
      );
    }
    const master = process.env.TWILIO_MESSAGING_SERVICE_SID;
    if (!master) {
      throw new Error("Account-lane SMS needs TWILIO_MESSAGING_SERVICE_SID");
    }
    serviceSid = master;
    // Required, not optional. Without a `From`, Twilio picks any sender in the master pool,
    // and that pool still holds client numbers — so an owner alert could go out from a
    // client's own line, on JDD's campaign, with nothing logged. Refusing is the only safe answer:
    // every account-lane caller already treats a throw as "not sent" and carries on.
    from = process.env.TWILIO_NOTIFICATION_NUMBER?.trim();
    if (!from) {
      throw new Error(
        "Account-lane SMS needs TWILIO_NOTIFICATION_NUMBER — refusing to let the Messaging " +
          "Service pick a sender, because its pool contains client numbers",
      );
    }
  }

  const params = new URLSearchParams({
    To: to,
    Body: body,
    MessagingServiceSid: serviceSid,
  });
  if (from) params.set("From", from);
  if (statusCallback) params.set("StatusCallback", statusCallback);

  const res = await fetch(`${API_BASE}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Twilio send failed (${res.status}): ${detail.slice(0, 300)}`);
  }

  const json = (await res.json().catch(() => null)) as { sid?: string } | null;
  return { sid: json?.sid ?? null };
}
