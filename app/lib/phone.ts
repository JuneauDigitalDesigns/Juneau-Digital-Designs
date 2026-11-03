/**
 * Phone normalization to E.164.
 *
 * The implementation lives in `phone.mjs` so the plain-Node test suite can import it; this file
 * keeps every existing `@/app/lib/phone` import working unchanged.
 */
export { normalizeE164, formatUsPhone } from "./phone.mjs";
