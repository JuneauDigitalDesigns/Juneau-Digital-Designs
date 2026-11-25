import { SCHEDULES } from "@/app/lib/legal/schedules";
import type { PlanSchedule } from "@/app/lib/legal/types";

/**
 * The $97 website-only Starter's schedule, for the marketing pages (/pricing and its FAQ).
 *
 * One place on purpose. The website-plan billing change has landed, adding the plan to
 * `SCHEDULES` as `website` ($97 + $297 setup), so every price on these pages reads from there.
 */
export const WEBSITE_PLAN: PlanSchedule = SCHEDULES.website;
