import { WEB_ONLY_SCHEDULE } from "@/app/lib/legal/schedules";
import type { PlanSchedule } from "@/app/lib/legal/types";

/**
 * The $97 website-only Starter's schedule, for the marketing pages (/pricing and its FAQ).
 *
 * One place on purpose. Until the website-plan billing change merges, the website-only plan
 * exists only as `WEB_ONLY_SCHEDULE`, an off-menu Starter variant still priced at $197. That
 * change adds it to `SCHEDULES` as `website` ($97 + $297 setup); when it lands, this becomes
 * `SCHEDULES.website` and every price on these pages follows.
 */
export const WEBSITE_PLAN: PlanSchedule = WEB_ONLY_SCHEDULE;
