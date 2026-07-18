import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Pending-client store (email-keyed).
 *
 * When a client finishes onboarding we stash a lightweight record keyed by their
 * checkout email. When they then self-serve sign up for Clerk, the user.created
 * webhook (and a portal-load fallback) look this up to grant portal access
 * immediately — showing the "we're building your site" state — instead of
 * waiting for jdd-ops to provision the real site. Namespaced under
 * `jdd:pending-client:*` so it never collides with `agreement:*` / `jdd:intake:*`.
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

const PENDING_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days, mirrors agreement/intake TTL
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const key = (email: string) => `jdd:pending-client:${normalizeEmail(email)}`;

export type PlanSlug = "starter" | "growth" | "enterprise";

export interface PendingClient {
  email: string;
  brandName: string;
  plan: PlanSlug;
  slug: string;
  status: "building";
  sessionId: string;
  createdAt: number; // epoch ms
}

/** Store (or overwrite) the pending record for this email. */
export async function savePendingClient(rec: PendingClient): Promise<void> {
  await getRedis().set(key(rec.email), rec, { ex: PENDING_TTL_SECONDS });
}

/** Look up the pending record for an email, or null if none. */
export async function getPendingClient(email: string): Promise<PendingClient | null> {
  return getRedis().get<PendingClient>(key(email));
}

/** Remove the pending record once it has been consumed. */
export async function deletePendingClient(email: string): Promise<void> {
  await getRedis().del(key(email));
}
