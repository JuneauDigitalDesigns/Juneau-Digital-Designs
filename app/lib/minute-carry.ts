import "server-only";
import { Redis } from "@upstash/redis";
import { ENTERPRISE_GROUP_REF, type PortalAccount } from "@jdd/schema";
import { getSchedule } from "./legal/schedules";
import { sumAgentSeconds, type MeteringGroup } from "./retell-usage";
import { carriedMinutes } from "./billing-periods.mjs";

/**
 * Unused Growth minutes carried into the Enterprise pool when Growth sites move onto Enterprise.
 *
 * Xander, 2026-11-16 (Q8): "When growth sites move on to enterprise, both unused time on the old
 * plan and the unused call minutes should carry over just for the rest of the month." The money
 * half is the prorated cancellation in `consolidation.ts`. This is the minutes half: for the month
 * the move happens in (the host subscription's current period), the Enterprise pool's allowance is
 * the Enterprise cap plus what each moved site hadn't used of its Growth minutes. The next month
 * is plain Enterprise.
 *
 * The move records only dates, so it never waits on Retell: which sites moved, the Enterprise
 * month, and where each site's own Growth month began. The minutes are worked out the first time
 * the billing cron or the portal meter needs them (`carriedMinutes` in billing-periods.mjs), from
 * calls that are all in the past by then, and saved so the figure never moves afterwards.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) _redis = Redis.fromEnv();
  return _redis;
}

const carryKey = (email: string) => `jdd:minute-carry:${email}`;
/** Kept well past the month it applies to, so a late overage run still reads it. */
const KEEP_AFTER_WINDOW_S = 60 * 60 * 24 * 90;

export interface MinuteCarryRecord {
  accountEmail: string;
  /** The Enterprise month the carried minutes count in, epoch ms. */
  windowStartMs: number;
  windowEndMs: number;
  movedAt: number;
  /** Every moved site, the host included, with the start of its own Growth month at the move. */
  sites: { slug: string; growthWindowStartMs: number }[];
  /** Worked out on first use; absent until then. */
  minutes?: number;
  computedAt?: number;
}

/** Called by the move. Rewriting it for the same month keeps a figure already worked out. */
export async function recordMinuteCarry(input: Omit<MinuteCarryRecord, "minutes" | "computedAt">): Promise<void> {
  const existing = await getRedis().get<MinuteCarryRecord>(carryKey(input.accountEmail));
  const keep = existing && existing.windowStartMs === input.windowStartMs ? existing : null;
  await save({ ...input, ...(keep?.minutes !== undefined ? { minutes: keep.minutes, computedAt: keep.computedAt } : {}) });
}

/**
 * The carry-over for this allowance, with its minutes worked out, or null when there is none.
 * Only the Enterprise pool ever has one. Throws if Retell can't be read: the caller must not bill
 * or warn against a guessed allowance, and the next run tries again.
 */
export async function carriedMinutesFor(
  account: PortalAccount,
  group: MeteringGroup,
  retellApiKey: string,
): Promise<{ windowStartMs: number; minutes: number } | null> {
  if (group.ref !== ENTERPRISE_GROUP_REF) return null;
  const rec = await getRedis().get<MinuteCarryRecord>(carryKey(account.email));
  if (!rec) return null;
  if (typeof rec.minutes === "number") return { windowStartMs: rec.windowStartMs, minutes: rec.minutes };

  const capMinutes = getSchedule("growth").callMinutes ?? 0;
  const eStart = rec.windowStartMs;
  let minutes = 0;
  for (const { slug, growthWindowStartMs: gStart } of rec.sites) {
    const site = account.sites.find((s) => s.slug === slug);
    const own = site ? [site] : [];
    const usedBeforePoolSeconds = gStart < eStart ? await sumAgentSeconds(retellApiKey, own, gStart, eStart) : 0;
    const poolCountedEarlierSeconds = gStart > eStart ? await sumAgentSeconds(retellApiKey, own, eStart, gStart) : 0;
    minutes += carriedMinutes({ capMinutes, usedBeforePoolSeconds, poolCountedEarlierSeconds });
  }

  await save({ ...rec, minutes, computedAt: Date.now() });
  return { windowStartMs: eStart, minutes };
}

async function save(rec: MinuteCarryRecord): Promise<void> {
  const ttl = Math.max(60, Math.ceil((rec.windowEndMs - Date.now()) / 1000) + KEEP_AFTER_WINDOW_S);
  await getRedis().set(carryKey(rec.accountEmail), rec, { ex: ttl });
}
