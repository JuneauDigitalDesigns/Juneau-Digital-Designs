import { PLAN_IDS } from "@jdd/schema";

/**
 * Is this one of the plans we sell? The one guard every plan that comes from outside (a query
 * string, Stripe metadata, a request body) goes through, so no list here can fall behind the
 * schema's `PLAN_IDS` again. Plain ESM, so the `.mjs` rules and the test suite share it.
 *
 * An unknown value is refused by every caller. None of them may default it to a plan: the old
 * lists defaulted to `starter`, which since v1.45.0 is the receptionist plan.
 *
 * @param {unknown} value
 * @returns {value is import("@jdd/schema").PortalPlan}
 */
export function isPlanSlug(value) {
  return typeof value === "string" && PLAN_IDS.includes(/** @type {never} */ (value));
}
