import "server-only";
import { Redis } from "@upstash/redis";
import type { PortalPlan } from "@jdd/schema";

/**
 * A plan change that has been asked for but has not taken effect yet: today, only a downgrade.
 *
 * Contract v5.3 §15.4: a change to a lower-priced plan takes effect at the end of the current
 * billing period, with no credit. So a downgrade has three moments, and this record is what
 * carries it between them:
 *
 *   1. `awaiting-acceptance`: Xander has scheduled it from the console, on the client's written
 *      request, and the client has been emailed a link to accept the Starter terms (§15.2: the
 *      client accepts a new agreement for the new plan). Nothing has changed in Stripe yet.
 *   2. `scheduled`: the client accepted. A Stripe subscription schedule moves the price at
 *      `effectiveAt`. The site is still on the higher plan and keeps everything it paid for.
 *   3. `done`: the schedule's second phase began, Stripe fired `customer.subscription.updated`
 *      with the lower price, and the webhook moved `PortalSite.plan`.
 *
 * `cancelled` is an operator withdrawing it before it took effect.
 *
 * Kept in the agency's KV rather than on `PortalSite` so the shared schema doesn't change for a
 * state that only this app reads. The Stripe schedule is the source of truth for the money; this
 * record is for the portal tile, the console and the emails.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

/** Long enough to outlive an annual period with room to debug, then it tidies itself up. */
const PLAN_CHANGE_TTL = 60 * 60 * 24 * 400;
const planChangeKey = (email: string, slug: string) => `jdd:plan-change:${email}:${slug}`;

export type PlanChangeStatus = "awaiting-acceptance" | "scheduled" | "done" | "cancelled";

export interface PlanChangeRecord {
  accountEmail: string;
  slug: string;
  fromPlan: PortalPlan;
  toPlan: PortalPlan;
  status: PlanChangeStatus;
  /** When the lower plan starts: the end of the period already paid for, epoch ms. */
  effectiveAt: number;
  /** "month" or "year", the period that carries over to the new plan. */
  interval: "month" | "year";
  subscriptionId: string;
  requestedAt: number;
  requestedBy: "operator";
  agreementId?: string;
  scheduleId?: string;
  acceptedAt?: number;
  updatedAt: number;
}

export async function getPlanChange(email: string, slug: string): Promise<PlanChangeRecord | null> {
  return getRedis().get<PlanChangeRecord>(planChangeKey(email, slug));
}

export async function savePlanChange(rec: PlanChangeRecord): Promise<void> {
  await getRedis().set(
    planChangeKey(rec.accountEmail, rec.slug),
    { ...rec, updatedAt: Date.now() },
    { ex: PLAN_CHANGE_TTL },
  );
}

/** A change that is still going to happen: asked for, or accepted and scheduled. */
export function isPendingPlanChange(rec: PlanChangeRecord | null): rec is PlanChangeRecord {
  return rec?.status === "awaiting-acceptance" || rec?.status === "scheduled";
}
