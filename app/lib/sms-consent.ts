import "server-only";
import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "node:crypto";
import type { SmsAlerts } from "@jdd/schema";
import { SMS_CONSENT_TEXT, SMS_CONSENT_TEXT_VERSION } from "./sms-consent-text";
import { normalizeE164 } from "./phone";

/**
 * SMS consent records for the post-call alert program.
 *
 * Separate from lib/kv.ts on purpose. Agreement records expire after 30 days because they
 * only need to outlive the checkout they unlock; a consent record is the answer to "prove
 * this person asked for these texts", which can be asked years later by a carrier, a
 * client, or a regulator. So nothing here carries a TTL except the pre-payment holding pen.
 *
 * The log is append-only. Revoking does not edit the grant, it appends a revocation, and
 * the current state is a separate key derived from those events. History that can be
 * rewritten is not evidence.
 */

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
      throw new Error(
        "Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN " +
          "(provision Upstash Redis via Vercel Dashboard → Storage)",
      );
    }
    _redis = Redis.fromEnv();
  }
  return _redis;
}

/** Matches the agreement TTL: a pending consent is meaningless once its agreement is gone. */
const PENDING_TTL_SECONDS = 60 * 60 * 24 * 30;

const pendingKey = (agreementId: string) => `sms:consent:pending:${agreementId}`;
const logKey = (phone: string) => `sms:consent:log:${phone}`;
const stateKey = (phone: string) => `sms:consent:state:${phone}`;
const accountKey = (email: string) => `sms:consent:account:${email.trim().toLowerCase()}`;

export type ConsentAction = "granted" | "revoked" | "confirmed";
export type ConsentSource = "agreement" | "portal-settings" | "sms-keyword";
export type ConsentStatus = "granted" | "revoked" | "pending-confirmation";

/**
 * One immutable fact about one number at one moment.
 *
 * Every field a carrier or a court would ask about is on the event itself rather than
 * looked up from somewhere else, so a single row out of the log stands on its own even if
 * the account, the agreement, and the wording have all changed since.
 */
export interface ConsentEvent {
  id: string;
  phone: string;
  action: ConsentAction;
  source: ConsentSource;
  occurredAt: string;
  ip: string;
  userAgent: string;
  consentTextHash: string;
  consentTextVersion: string;
  agreementId?: string;
  accountEmail?: string;
}

export interface ConsentState {
  phone: string;
  status: ConsentStatus;
  updatedAt: string;
  accountEmail?: string;
}

/** Consent captured at signing, not yet paid for. Never texted while in this state. */
export interface PendingConsent {
  agreementId: string;
  phone: string;
  capturedAt: string;
  ip: string;
  userAgent: string;
  consentTextHash: string;
  consentTextVersion: string;
  signerEmail: string;
}

/**
 * SHA-256 of the exact wording shown. Canonical whitespace so a reflow of the source
 * string can't change the hash of words nobody edited.
 */
export function hashConsentText(text: string = SMS_CONSENT_TEXT): string {
  const canon = text.replace(/\s+/g, " ").trim();
  return createHash("sha256").update(canon, "utf8").digest("hex");
}

export { normalizeE164 };

/**
 * The who-and-where half of a consent event, pulled from the request.
 *
 * Every surface that can grant or revoke consent needs the same two fields recorded the
 * same way. The agreement route is the exception that proves it: there they come from the
 * ESIGN audit record instead, so the signature and the consent can never disagree.
 */
export function consentRequestContext(req: Request): { ip: string; userAgent: string } {
  const fwd = req.headers.get("x-forwarded-for");
  return {
    ip: fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip") || "unknown",
    userAgent: req.headers.get("user-agent") || "unknown",
  };
}

/** Double opt-in is built but off. See the A7 note in the plan. */
export function doubleOptInEnabled(): boolean {
  return process.env.SMS_DOUBLE_OPTIN === "true";
}

/* ── pre-payment holding pen ──────────────────────────────── */

export async function savePendingConsent(pending: PendingConsent): Promise<void> {
  await getRedis().set(pendingKey(pending.agreementId), pending, { ex: PENDING_TTL_SECONDS });
}

export async function getPendingConsent(agreementId: string): Promise<PendingConsent | null> {
  return getRedis().get<PendingConsent>(pendingKey(agreementId));
}

/**
 * Payment cleared, so the consent becomes real.
 *
 * Idempotent by construction: the pending key is read and deleted in one operation, so a
 * replayed Stripe webhook finds nothing and returns null rather than appending a second
 * grant. Returns null just as harmlessly when consent was never given.
 */
export async function promotePendingConsent(
  agreementId: string,
  accountEmail?: string,
): Promise<ConsentEvent | null> {
  const pending = await getRedis().getdel<PendingConsent>(pendingKey(agreementId));
  if (!pending) return null;

  return recordConsentEvent({
    phone: pending.phone,
    // With double opt-in on, the grant is provisional until they reply. The event is still
    // "granted" — that is what happened — but the state it produces is not deliverable.
    action: "granted",
    source: "agreement",
    ip: pending.ip,
    userAgent: pending.userAgent,
    consentTextHash: pending.consentTextHash,
    consentTextVersion: pending.consentTextVersion,
    agreementId,
    accountEmail: accountEmail ?? pending.signerEmail,
    occurredAt: pending.capturedAt,
    status: doubleOptInEnabled() ? "pending-confirmation" : "granted",
  });
}

/** Nothing was paid for, so nothing should linger. Used by the ops tooling, not the flow. */
export async function discardPendingConsent(agreementId: string): Promise<void> {
  await getRedis().del(pendingKey(agreementId));
}

/* ── the permanent record ─────────────────────────────────── */

export async function recordConsentEvent(input: {
  phone: string;
  action: ConsentAction;
  source: ConsentSource;
  ip: string;
  userAgent: string;
  consentTextHash?: string;
  consentTextVersion?: string;
  agreementId?: string;
  accountEmail?: string;
  occurredAt?: string;
  /** Overrides the status this event implies. Only double opt-in needs it. */
  status?: ConsentStatus;
}): Promise<ConsentEvent> {
  const phone = normalizeE164(input.phone);
  if (!phone) throw new Error(`recordConsentEvent: not an E.164 number: ${input.phone}`);

  const event: ConsentEvent = {
    id: randomUUID(),
    phone,
    action: input.action,
    source: input.source,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    ip: input.ip,
    userAgent: input.userAgent,
    consentTextHash: input.consentTextHash ?? hashConsentText(),
    consentTextVersion: input.consentTextVersion ?? SMS_CONSENT_TEXT_VERSION,
    ...(input.agreementId ? { agreementId: input.agreementId } : {}),
    ...(input.accountEmail ? { accountEmail: input.accountEmail } : {}),
  };

  const status: ConsentStatus =
    input.status ?? (input.action === "revoked" ? "revoked" : "granted");

  const state: ConsentState = {
    phone,
    status,
    updatedAt: event.occurredAt,
    ...(input.accountEmail ? { accountEmail: input.accountEmail } : {}),
  };

  const redis = getRedis();
  // Log first. If the state write fails, the record of what happened still exists and the
  // state can be rebuilt from it; the reverse would leave a claim with no evidence.
  await redis.rpush(logKey(phone), event);
  await redis.set(stateKey(phone), state);

  if (input.accountEmail) {
    // Points at the number currently consented for this account, so onboarding and the
    // portal can find it without knowing the number in advance. A revocation clears it.
    if (status === "revoked") {
      const current = await redis.get<string>(accountKey(input.accountEmail));
      if (current === phone) await redis.del(accountKey(input.accountEmail));
    } else {
      await redis.set(accountKey(input.accountEmail), phone);
    }
  }

  return event;
}

export async function getConsentState(phone: string): Promise<ConsentState | null> {
  const e164 = normalizeE164(phone);
  if (!e164) return null;
  return getRedis().get<ConsentState>(stateKey(e164));
}

export async function getConsentStateForAccount(email: string): Promise<ConsentState | null> {
  const phone = await getRedis().get<string>(accountKey(email));
  return phone ? getConsentState(phone) : null;
}

/** Full history for a number, oldest first. */
export async function getConsentLog(phone: string): Promise<ConsentEvent[]> {
  const e164 = normalizeE164(phone);
  if (!e164) return [];
  return (await getRedis().lrange<ConsentEvent>(logKey(e164), 0, -1)) ?? [];
}

/**
 * The only question the sending pipeline should ask.
 *
 * `pending-confirmation` is deliberately not deliverable: under double opt-in the client
 * has asked for texts but has not confirmed from the handset, and that gap is exactly what
 * double opt-in exists to close.
 */
export function isDeliverable(state: ConsentState | null): state is ConsentState {
  return state?.status === "granted";
}

/**
 * Consent as it stands right now, in the shape the intake envelope carries to onboard.js.
 *
 * A snapshot, not a source of truth. It can be stale by the time provisioning runs, which
 * is why onboard.js skipping the Twilio module on `consented: false` is the safe direction
 * of error: the worst case is a client who has to turn alerts on from the portal, not one
 * who gets texted without permission.
 */
export function smsAlertsSnapshot(state: ConsentState | null): SmsAlerts {
  return isDeliverable(state)
    ? { consented: true, phone: state.phone, consentedAt: state.updatedAt }
    : { consented: false, phone: null, consentedAt: null };
}
