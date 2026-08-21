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
