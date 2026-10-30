// @ts-check
/**
 * A2P registration record — the SIDs, and only the SIDs.
 *
 *   `jdd:a2p-registration:{slug}`   — durable, no TTL
 *
 * **Why a record of its own rather than fields on `PortalSite`.** The identity step alone
 * produces four SIDs, and the registration chain that follows it produces several more
 * (customer profile, trust product, brand, campaign). Hanging eight nullable strings off
 * `PortalSite` — which is read on the portal's hot path, validated by a zod schema and
 * mirrored by three consumers — would mean a `@jdd/schema` release per SID. The client-facing
 * summary stays where the portal already reads it (`PortalSite.a2pStatus`, in `@jdd/schema`
 * v1.30.0); the infra SIDs live here, where only the server looks.
 *
 * **What must never be in here.** The EIN, the representative's name, their direct email or
 * their mobile. Those exist for exactly one request (see `a2p-trusthub.mjs`) and reach no
 * store at all — not this one, not the onboarding draft, not `.env.local`, not `site.ts`.
 * `assertNoTaxId` enforces it on the way in rather than trusting that it stayed true.
 *
 * Plain ESM, injectable client: the retention test drives the real write path with a spy.
 * It therefore cannot `import "server-only"` — the guard is that nothing here is imported by
 * a client component, and the only importer is the route.
 */

import { Redis } from "@upstash/redis";
import { findTaxIdPaths } from "./a2p-identity.mjs";

/** @typedef {{ set: (key: string, value: unknown) => Promise<unknown>; get: <T>(key: string) => Promise<T | null> }} A2pRedisLike */

/** @type {A2pRedisLike | null} */
let _redis = null;

/** @returns {A2pRedisLike} */
function defaultRedis() {
  if (!_redis) {
    _redis = /** @type {A2pRedisLike} */ (/** @type {unknown} */ (Redis.fromEnv()));
  }
  return _redis;
}

/** @param {string} slug */
export const a2pRegistrationKey = (slug) => `jdd:a2p-registration:${slug}`;

/**
 * @typedef {object} A2pRegistrationRecord
 * @property {string} slug
 * @property {import("./a2p-identity.mjs").A2pRegistrationPath} registrationPath
 * @property {string} businessEndUserSid
 * @property {string} repEndUserSid
 * @property {string} addressSid
 * @property {string} addressDocSid
 * @property {number} submittedAt Epoch ms. The only thing resembling a record of the event.
 */

/**
 * Refuse to write anything tax-ID-shaped.
 *
 * A value-shape check, not a key denylist. The handoff rejects a denylist because one rename
 * defeats it; a shape check does not care what the key is called, which is the whole point —
 * it holds through every future refactor of the step above it.
 *
 * Throws rather than stripping: a silent strip would leave a half-written record and nobody
 * would ever know the invariant had broken.
 *
 * @param {unknown} value
 * @param {string} where Label for the message. Never a value.
 */
export function assertNoTaxId(value, where) {
  const paths = findTaxIdPaths(value);
  if (paths.length) {
    throw new Error(`${where}: refused to persist a tax-ID-shaped value at ${paths.join(", ")}`);
  }
}

/**
 * Persist the identity SIDs for a site.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {import("./a2p-identity.mjs").A2pRegistrationPath} args.registrationPath
 * @param {import("./a2p-trusthub.mjs").A2pIdentitySids} args.sids
 * @param {A2pRedisLike} [args.redis]
 * @returns {Promise<A2pRegistrationRecord>}
 */
export async function saveRegistrationIdentity({ slug, registrationPath, sids, redis = defaultRedis() }) {
  /** @type {A2pRegistrationRecord} */
  const record = {
    slug,
    registrationPath,
    businessEndUserSid: sids.businessEndUserSid,
    repEndUserSid: sids.repEndUserSid,
    addressSid: sids.addressSid,
    addressDocSid: sids.addressDocSid,
    submittedAt: Date.now(),
  };

  assertNoTaxId(record, "a2p-registration-store");
  // No TTL: this is durable state, like the account record and unlike the onboarding draft.
  await redis.set(a2pRegistrationKey(slug), record);
  return record;
}

/**
 * Read the record for a site, or null.
 *
 * @param {object} args
 * @param {string} args.slug
 * @param {A2pRedisLike} [args.redis]
 * @returns {Promise<A2pRegistrationRecord | null>}
 */
export async function readRegistrationIdentity({ slug, redis = defaultRedis() }) {
  const raw = await redis.get(a2pRegistrationKey(slug));
  return /** @type {A2pRegistrationRecord | null} */ (raw ?? null);
}
