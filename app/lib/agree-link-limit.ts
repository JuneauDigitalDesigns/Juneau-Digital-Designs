import "server-only";
import { Redis } from "@upstash/redis";
import { resolveAgreementLink } from "./agreement-link";
import { AGREE_CODE } from "./agreement-link.mjs";

/**
 * The private terms link (`/terms/[code]` and `/api/agree/[code]`) can't be guessed at from one IP
 * (Xander, 2026-11-19: "Yes, add a limit").
 *
 * There is no login: the 10-character code is the credential. What is counted is lookups of
 * codes that **don't exist**, per IP. A real client only ever opens their own code, so however
 * often they reload they never come near the limit, and nothing they see changes. Past it, every
 * code from that IP, real or not, shows as "no longer active": the page and answer a wrong code
 * already gets, so a guesser learns nothing and there are no new words.
 *
 * Fail open: if the store that counts is down, the link is looked up as normal. A client signing
 * their terms matters more than a guesser getting a few more tries.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

const int = (name: string, fallback: number): number => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export function agreeLinkLimits() {
    return {
        /** Codes that don't exist, looked up from one IP. */
        missHourly: int("AGREE_LINK_MISS_HOURLY", 10),
        missDaily: int("AGREE_LINK_MISS_DAILY", 30),
    };
}

const missKey = (window: string, ip: string) => `jdd:agree:miss:v1:${window}:${ip}`;

function windows(now = new Date()) {
    const iso = now.toISOString();
    return { hour: `h:${iso.slice(0, 13)}`, day: `d:${iso.slice(0, 10)}` };
}

type View = Awaited<ReturnType<typeof resolveAgreementLink>>;

/** The link's state for this visitor: `resolveAgreementLink`, behind the limit. */
export async function lookupAgreementLink(code: string, ip: string | null): Promise<View> {
    const normalized = code.trim().toUpperCase();
    if (!AGREE_CODE.test(normalized)) return { state: "inactive" };
    const who = (ip || "unknown").slice(0, 64);
    const L = agreeLinkLimits();
    const w = windows();

    try {
        const [h, d] = await getRedis().mget<(number | string | null)[]>(missKey(w.hour, who), missKey(w.day, who));
        if (Number(h ?? 0) >= L.missHourly || Number(d ?? 0) >= L.missDaily) {
            console.warn(`[agree-link] ${who} is past the limit of unknown codes: shown as inactive`);
            return { state: "inactive" };
        }
    } catch (e) {
        console.error("[agree-link] limit store unreachable; looking up without it", e);
    }

    const view = await resolveAgreementLink(normalized);
    if (view.state === "inactive" && view.unknown) await countMiss(w, who);
    return view;
}

async function countMiss(w: ReturnType<typeof windows>, who: string): Promise<void> {
    try {
        const r = getRedis();
        if ((await r.incr(missKey(w.hour, who))) === 1) await r.expire(missKey(w.hour, who), 2 * HOUR);
        if ((await r.incr(missKey(w.day, who))) === 1) await r.expire(missKey(w.day, who), 2 * DAY);
    } catch (e) {
        console.error("[agree-link] could not count an unknown code", e);
    }
}
