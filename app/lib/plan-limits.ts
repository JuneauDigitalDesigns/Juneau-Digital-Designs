import "server-only";
import type { PlanLimits } from "@jdd/schema";
import { getSchedule } from "./legal/schedules";

/**
 * The account-level purchase limits, assembled from the contract where the contract has an
 * opinion.
 *
 * `enterpriseSites` comes from Schedule A's `maxSites`, because that is the number the client
 * actually signs for — "up to three (3) websites" is a term of the agreement, not a product
 * setting, and a second copy of `3` in the entitlement code would be free to drift away from
 * the document.
 *
 * `growthSitesPerAccount` has no such home. No agreement says anything about how many
 * *separate* Growth agreements one account may hold; each Growth contract covers exactly one
 * site (`maxSites: 1`) and is silent on the rest. Two is a commercial decision about when
 * Enterprise becomes the better deal for both sides, so it is stated once, here, rather than
 * pretending to derive from a document that never mentions it.
 */
export function planLimits(): PlanLimits {
  return {
    growthSitesPerAccount: 2,
    enterpriseSites: getSchedule("enterprise").maxSites,
  };
}
