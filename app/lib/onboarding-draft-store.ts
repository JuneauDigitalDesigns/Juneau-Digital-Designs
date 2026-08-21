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

/**
 * Scoped to a site, not just a user.
 *
 * A client can have several sites awaiting their wizard at once — buy two starters in a row
 * and both sit pending. Keyed on `clerkUserId` alone they shared one draft: opening the
 * second site showed the first one's answers, and the 800ms autosave then wrote them back
 * over the original.
 *
 * `siteRef` is optional so a caller without one still resolves to the old key rather than
 * `...:undefined`, which keeps drafts saved before this change readable.
 */
const draftKey = (clerkUserId: string, siteRef?: string) =>
  siteRef
    ? `jdd:onboarding-draft:${clerkUserId}:${siteRef}`
    : `jdd:onboarding-draft:${clerkUserId}`;

export interface PersistedDraft {
  data: Record<string, unknown>;
  savedAt: string; // ISO UTC
}

export async function saveDraft(
  clerkUserId: string,
  data: Record<string, unknown>,
  siteRef?: string,
): Promise<void> {
  const record: PersistedDraft = { data, savedAt: new Date().toISOString() };
  await getRedis().set(draftKey(clerkUserId, siteRef), record, { ex: DRAFT_TTL_SECONDS });
}

export async function getDraft(
  clerkUserId: string,
  siteRef?: string,
): Promise<PersistedDraft | null> {
  const scoped = await getRedis().get<PersistedDraft>(draftKey(clerkUserId, siteRef));
  if (scoped || !siteRef) return scoped;

  // Fall back to the pre-scoping key so a client mid-wizard when this shipped doesn't lose
  // their answers. Harmless once every open draft predates the change.
  return getRedis().get<PersistedDraft>(draftKey(clerkUserId));
}

export async function deleteDraft(clerkUserId: string, siteRef?: string): Promise<void> {
  await getRedis().del(draftKey(clerkUserId, siteRef));
}
