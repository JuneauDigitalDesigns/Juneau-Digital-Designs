import "server-only";
import { Redis } from "@upstash/redis";
import { sendOpsNotice } from "./ops-notice";

/**
 * Limits on what a public lead form can make us do: place AI calls and text business owners.
 *
 * A client site's form is open to the internet, and before this every submission could place a
 * Retell call to whatever number it named and text the owner. The only brake was 30 requests a
 * minute per site, so one script could make 30 AI calls a minute to arbitrary numbers. That costs
 * money, it is a TCPA exposure, and it floods the owner's phone.
 *
 * **The rule (operator decision, 2026-11-09): never throttle a genuine lead.** Every limit here
 * holds back a CALL or a TEXT. None of them stops a lead from being recorded; the lead still
 * lands in the inbox. Refusing a submission outright is the human check's job (`lead-admit.ts`),
 * never a counter's.
 *
 * Counters are plain INCR/EXPIRE and SET NX, not `@upstash/ratelimit`. The one guarantee that
 * matters, "one call per number", has to be a single atomic claim that a burst of identical
 * submissions races on, and a fixed-window script cannot express that.
 *
 * Every number is an env var so a busy client can be given more without a deploy of every site.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const int = (name: string, fallback: number): number => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

/** Read at call time, so a test (or an env change on a warm instance) takes effect. */
export function gateLimits() {
    return {
        /** Placed AI calls to one number from one site, per window. Always 1: the point of it. */
        callbackNumberWindowSeconds: int("GATE_CALLBACK_NUMBER_WINDOW_SECONDS", DAY),
        /** Placed AI calls to one number from ALL our sites in 24 h. Stops a pile-on across sites. */
        callbackNumberAllSites: int("GATE_CALLBACK_NUMBER_ALL_SITES", 2),
        /** Placed AI calls per site per day. 100: room for a busy client (operator, 2026-11-09). */
        callbackSiteDaily: int("GATE_CALLBACK_SITE_DAILY", 100),
        /** Owner texts per site, per hour and per day (lead alerts and call briefs together). */
        ownerTextHourly: int("GATE_OWNER_TEXT_HOURLY", 6),
        ownerTextDaily: int("GATE_OWNER_TEXT_DAILY", 30),
    };
}

/** `YYYY-MM-DD` / `YYYY-MM-DDTHH` in UTC: fixed buckets for the daily and hourly caps. */
const dayBucket = (now: Date) => now.toISOString().slice(0, 10);
const hourBucket = (now: Date) => now.toISOString().slice(0, 13);

const site = (acctScope: string, slug: string) => `${acctScope}:${slug}`;

const K = {
    callbackNumberSite: (acct: string, slug: string, phone: string) =>
        `portal:gate:v1:cb:num:${site(acct, slug)}:${phone}`,
    callbackNumberAll: (phone: string) => `portal:gate:v1:cb:num-all:${phone}`,
    callbackSiteDay: (acct: string, slug: string, day: string) =>
        `portal:gate:v1:cb:day:${site(acct, slug)}:${day}`,
    callbackAllDay: (day: string) => `portal:gate:v1:cb:day-all:${day}`,
    /** Every site that has ever asked for a callback: the global cap scales with its size. */
    callbackSites: () => `portal:gate:v1:cb:sites`,
    ownerTextHour: (acct: string, slug: string, hour: string) =>
        `portal:gate:v1:text:hour:${site(acct, slug)}:${hour}`,
    ownerTextDay: (acct: string, slug: string, day: string) =>
        `portal:gate:v1:text:day:${site(acct, slug)}:${day}`,
    /** One ops email per cap per scope per day, not one per held call. */
    noticeOnce: (what: string, scope: string, day: string) => `portal:gate:v1:notice:${what}:${scope}:${day}`,
};

/**
 * Count one against a capped bucket. True when it fits. A refusal is taken back, so a bucket that
 * is full stays at its cap rather than drifting upward and holding back tomorrow's first call.
 */
async function takeOne(key: string, cap: number, ttlSeconds: number): Promise<boolean> {
    const redis = getRedis();
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, ttlSeconds);
    if (n <= cap) return true;
    await redis.decr(key);
    return false;
}

async function giveBack(key: string): Promise<void> {
    await getRedis().decr(key).catch(() => {});
}

async function noticeOnce(what: string, scope: string, subject: string, lines: string[]): Promise<void> {
    try {
        const key = K.noticeOnce(what, scope, dayBucket(new Date()));
        const first = await getRedis().set(key, 1, { nx: true, ex: 2 * DAY });
        if (first === "OK") await sendOpsNotice(subject, lines);
    } catch (e) {
        console.error(`[lead-gate] could not send the ${what} notice`, e);
    }
}

export type CallbackDecision =
    | { ok: true }
    | {
          ok: false;
          reason: "number-recent" | "number-all-sites" | "site-daily" | "all-sites-daily" | "store";
      };

/**
 * Claim the right to place ONE AI callback to `phone` from this site.
 *
 * The claim is made before the call and **kept even if Retell then refuses it**, so a resubmitted
 * form never dials the same number twice in the window: a burst of twenty identical submissions
 * races on one SET NX, and exactly one wins.
 *
 * A refusal for any other reason (a cap) gives everything back, because no call was placed.
 * When the store can't be reached the answer is no: a call we can't count is a call we don't make.
 */
export async function claimCallback(acctScope: string, slug: string, phone: string): Promise<CallbackDecision> {
    const L = gateLimits();
    const now = new Date();
    const day = dayBucket(now);
    const numberKey = K.callbackNumberSite(acctScope, slug, phone);
    const redis = getRedis();

    try {
        const claimed = await redis.set(numberKey, now.toISOString(), {
            nx: true,
            ex: Math.max(1, L.callbackNumberWindowSeconds),
        });
        if (claimed !== "OK") return { ok: false, reason: "number-recent" };

        const allKey = K.callbackNumberAll(phone);
        if (!(await takeOne(allKey, L.callbackNumberAllSites, DAY))) {
            await redis.del(numberKey);
            return { ok: false, reason: "number-all-sites" };
        }

        const siteDayKey = K.callbackSiteDay(acctScope, slug, day);
        if (!(await takeOne(siteDayKey, L.callbackSiteDaily, 2 * DAY))) {
            await Promise.all([redis.del(numberKey), giveBack(allKey)]);
            await noticeOnce("cb-site-daily", site(acctScope, slug), `[JDD] AI callbacks held for ${slug}`, [
                `${slug} reached ${L.callbackSiteDaily} AI callbacks today. Further form leads are going to the inbox without a call until midnight UTC.`,
                `If this site is genuinely that busy, raise GATE_CALLBACK_SITE_DAILY on the agency project.`,
            ]);
            return { ok: false, reason: "site-daily" };
        }

        // Scales with sites (operator, 2026-11-09): 100 a day for each site that takes callbacks.
        // Each site is already held to its own cap, so this binds only if the per-site cap is
        // raised for one site and not reflected here. It is the backstop, not the working limit.
        await redis.sadd(K.callbackSites(), site(acctScope, slug));
        const sites = Math.max(1, Number(await redis.scard(K.callbackSites())) || 1);
        const allDayKey = K.callbackAllDay(day);
        if (!(await takeOne(allDayKey, L.callbackSiteDaily * sites, 2 * DAY))) {
            await Promise.all([redis.del(numberKey), giveBack(allKey), giveBack(siteDayKey)]);
            await noticeOnce("cb-all-daily", "all", "[JDD] AI callbacks held on every site", [
                `All sites together reached ${L.callbackSiteDaily * sites} AI callbacks today. Form leads are going to inboxes without a call until midnight UTC.`,
            ]);
            return { ok: false, reason: "all-sites-daily" };
        }
        return { ok: true };
    } catch (e) {
        console.error(`[lead-gate] callback claim failed for ${slug}; not calling`, e);
        return { ok: false, reason: "store" };
    }
}

/**
 * May we text this site's owner now? Counts one when yes.
 *
 * Held texts never hold back the lead: it is in the inbox either way. The store being down means
 * yes, because a text that goes out is better than an owner who never hears about a real lead,
 * and these caps exist for floods, which a store outage doesn't create.
 */
export async function takeOwnerText(acctScope: string, slug: string): Promise<boolean> {
    const L = gateLimits();
    const now = new Date();
    const hourKey = K.ownerTextHour(acctScope, slug, hourBucket(now));
    const dayKey = K.ownerTextDay(acctScope, slug, dayBucket(now));
    try {
        if (!(await takeOne(hourKey, L.ownerTextHourly, 2 * HOUR))) {
            await noticeOnce("text-hourly", site(acctScope, slug), `[JDD] Owner texts held for ${slug}`, [
                `${slug} reached ${L.ownerTextHourly} owner texts this hour. New leads are still landing in the inbox; the owner isn't being texted about them until the hour turns.`,
            ]);
            return false;
        }
        if (!(await takeOne(dayKey, L.ownerTextDaily, 2 * DAY))) {
            await giveBack(hourKey);
            await noticeOnce("text-daily", site(acctScope, slug), `[JDD] Owner texts held for ${slug}`, [
                `${slug} reached ${L.ownerTextDaily} owner texts today. New leads are still landing in the inbox; the owner isn't being texted about them until midnight UTC.`,
            ]);
            return false;
        }
        return true;
    } catch (e) {
        console.error(`[lead-gate] owner-text count failed for ${slug}; texting anyway`, e);
        return true;
    }
}
