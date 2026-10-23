import "server-only";
import { Redis } from "@upstash/redis";
import type { AgreementRecord } from "./agreement-types";

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

const AGREEMENT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const key = (id: string) => `agreement:${id}`;

export async function saveAgreement(record: AgreementRecord): Promise<void> {
  await getRedis().set(key(record.id), record, { ex: AGREEMENT_TTL_SECONDS });
}

export async function getAgreement(id: string): Promise<AgreementRecord | null> {
  return getRedis().get<AgreementRecord>(key(id));
}

/**
 * Drop the expiry once the agreement has been paid for.
 *
 * The 30-day TTL is sized for the gap between signing and checkout: an agreement nobody paid
 * for is an abandoned draft, and letting it expire is the right outcome. One that *was* paid
 * for is something else — the audit trail behind a live site, and the master that later
 * addenda are written against. Neither can survive on a month's lease.
 *
 * A signature alone does not qualify. Payment is the event that turns a draft into a record
 * worth keeping, which is why this is called from the webhook rather than the signing route.
 */
export async function persistAgreement(id: string): Promise<void> {
  await getRedis().persist(key(id));
}

const welcomeKey = (sessionId: string) => `welcome-sent:${sessionId}`;
const WELCOME_MARK_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — long past any Stripe retry window

/**
 * Claim the right to send the welcome email for a checkout session, exactly once.
 *
 * The welcome email fires from the Stripe webhook, and Stripe redelivers
 * `checkout.session.completed` on any non-2xx or timeout. An unconditional send would mail a
 * client twice. This sets a marker with `NX`, so only the first caller wins: it returns true
 * for the call that should send, false for every retry after it.
 *
 * Paired with `clearWelcomeEmailMark` — a send that throws releases the claim so the next
 * retry can try again rather than the email being lost to a marker set before a failure.
 */
export async function claimWelcomeEmailSend(sessionId: string): Promise<boolean> {
  const res = await getRedis().set(welcomeKey(sessionId), Date.now(), {
    nx: true,
    ex: WELCOME_MARK_TTL_SECONDS,
  });
  return res === "OK";
}

/** Release a welcome-email claim after a failed send, so a Stripe retry can re-attempt it. */
export async function clearWelcomeEmailMark(sessionId: string): Promise<void> {
  await getRedis().del(welcomeKey(sessionId));
}
