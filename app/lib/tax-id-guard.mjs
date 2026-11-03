// @ts-check
/**
 * The tax-ID tripwire — what is left of `a2p-identity.mjs` after A2P registration moved to the
 * operator console (`jdd-ops`, `PLAN-console-a2p-registration.md`).
 *
 * This site no longer collects an EIN or any registration detail: the operator types them in the
 * console, one request per Twilio call, and nothing here talks to Twilio's Trust Hub at all. The
 * enums, payload builders, scrubber and vendor calls went with that work.
 *
 * What stays is the guard both draft writers run before they persist anything — the wizard's
 * localStorage autosave and `/api/portal/onboarding/draft` (Redis, 30-day TTL). There is no EIN
 * field left for a value to come from, and that is exactly when a guard is cheapest to keep: a
 * future field, a pasted note, or a stale cached bundle from before this change would otherwise
 * be written for 30 days with nothing to notice.
 *
 * Plain ESM with `@ts-check`, so `node --test` imports it untranspiled.
 */

/**
 * Deliberately the hyphenated form only, with digit boundaries on both sides. The looser
 * `\d{2}-?\d{7}` matches inside every 10-digit phone number (`4075551234` is `40` + `7555123`),
 * and a wizard draft is full of phone numbers. A tripwire that fires on ordinary data is a
 * tripwire somebody switches off.
 *
 * `\d{5}-\d{4}` (ZIP+4) and `\d{3}-\d{4}` (local phone) do not match this shape, and a
 * boundary-anchored `NN-NNNNNNN` has no other ordinary meaning in a wizard draft.
 */
const TAX_ID_SHAPE = /(?<!\d)\d{2}-\d{7}(?!\d)/;

/** @param {unknown} value */
export function looksLikeTaxId(value) {
  return typeof value === "string" && TAX_ID_SHAPE.test(value);
}

/**
 * Walk any JSON-ish value and return the **paths** of every string that looks like a tax ID.
 *
 * Paths, never values: this feeds log lines and error messages, which is precisely where a leak
 * would end up. A caller refusing a write needs to know *where* the value is, never the value.
 *
 * @param {unknown} value
 * @param {string} [path]
 * @returns {string[]}
 */
export function findTaxIdPaths(value, path = "$") {
  if (looksLikeTaxId(value)) return [path];
  if (Array.isArray(value)) {
    return value.flatMap((entry, i) => findTaxIdPaths(entry, `${path}[${i}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entry]) => findTaxIdPaths(entry, `${path}.${key}`));
  }
  return [];
}
