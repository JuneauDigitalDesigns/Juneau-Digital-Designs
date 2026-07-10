import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Intake queue (producer side).
 *
 * When a client finishes onboarding, the mapped Intake envelope is pushed onto a
 * KV queue instead of only being emailed. The jdd-ops console (local-only) pulls
 * this queue over HTTPS REST to claim new signups. Namespaced under `jdd:intake:*`
 * so it never collides with `agreement:*` in the same Upstash instance.
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

const INTAKE_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, mirrors agreement TTL
const itemKey = (id: string) => `jdd:intake:item:${id}`;
const INDEX_KEY = "jdd:intake:index";

export interface QueuedIntake {
  id: string;
  receivedAt: number; // epoch ms — doubles as the sorted-set score
  status: "pending" | "imported";
  plan: string;
  brandName: string;
  slugGuess: string;
  sessionId: string;
  intake: unknown; // the full Intake envelope { plan, siteCount, sites }
}

/** Slugify a brand name into a safe default slug the console can accept or override. */
export function slugifyBrand(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}

/** Store the intake item and add it to the pending index (scored by arrival time). */
export async function enqueueIntake(rec: QueuedIntake): Promise<void> {
  const r = getRedis();
  await r.set(itemKey(rec.id), rec, { ex: INTAKE_TTL_SECONDS });
  await r.zadd(INDEX_KEY, { score: rec.receivedAt, member: rec.id });
}
