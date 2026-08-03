import "server-only";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = Redis.fromEnv();
  }
  return _redis;
}

const DRAFT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
const draftKey = (clerkUserId: string) => `jdd:onboarding-draft:${clerkUserId}`;

export interface PersistedDraft {
  data: Record<string, unknown>;
  savedAt: string; // ISO UTC
}

export async function saveDraft(clerkUserId: string, data: Record<string, unknown>): Promise<void> {
  const record: PersistedDraft = { data, savedAt: new Date().toISOString() };
  await getRedis().set(draftKey(clerkUserId), record, { ex: DRAFT_TTL_SECONDS });
}

export async function getDraft(clerkUserId: string): Promise<PersistedDraft | null> {
  return getRedis().get<PersistedDraft>(draftKey(clerkUserId));
}

export async function deleteDraft(clerkUserId: string): Promise<void> {
  await getRedis().del(draftKey(clerkUserId));
}
