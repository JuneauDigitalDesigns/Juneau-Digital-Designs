import type { PlanSchedule } from "./legal/types";
import { SCHEDULES, WEB_ONLY_SCHEDULE } from "./legal/schedules";

/**
 * The two "from" prices the service pages print, read from the plan summary, never typed: a
 * number written into marketing copy is a number that can contradict the signed agreement.
 *
 * Xander (24 Nov 2026): build the pages with the prices in, because the new plans land soon.
 * The plan change adds a website-only plan with the id `website` ("Starter", $97) and renames
 * today's `starter` to "Starter + AI Receptionist" ($297). So:
 *
 *  - `WEBSITE_PLAN` is `SCHEDULES.website` once it exists, and until then today's website-only
 *    schedule. Both are the cheapest way to get the website, so the website and hosting pages'
 *    "from" price is right before and after the change.
 *  - `RECEPTIONIST_PLAN` is `starter`, the cheapest plan with the AI receptionist, before and
 *    after. The receptionist is never priced at the website-only plan's price.
 *
 * When the plan change removes `WEB_ONLY_SCHEDULE`, drop the fallback here and nothing else moves.
 */
export const WEBSITE_PLAN: PlanSchedule =
    (SCHEDULES as Partial<Record<string, PlanSchedule>>).website ?? WEB_ONLY_SCHEDULE;

export const RECEPTIONIST_PLAN: PlanSchedule = SCHEDULES.starter;
