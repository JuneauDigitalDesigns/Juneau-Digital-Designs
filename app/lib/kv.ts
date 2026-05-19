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
