import "server-only";
import { Redis } from "@upstash/redis";
import { leadAlertName, textAccountOwner, type LeadAlertResult } from "./lead-alert";
import { formatUsPhone, normalizeE164 } from "./phone";

/**
 * The owner's end-of-call brief: one text to the business owner after the receptionist has
 * handled a call, sent from JDD's notification number on the account lane.
 *
 * ── Why it is sent from here and not from Make ──────────────────────────────────────────────
 * It used to be a Twilio module inside each client's cloned Make scenario, with the owner's
 * number and the decision to text at all stamped in at onboarding and never re-read. Owner
 * opt-in now lives in the portal (`sms:consent:*`), so an owner who opted in after onboarding was
 * never texted, and one who revoked kept being texted. Make now posts the call here, and this
 * reads consent at send time through the same `textAccountOwner` every owner text uses.
 *
 * ── The wording ─────────────────────────────────────────────────────────────────────────────
 * The labels are the ones Make sent (`Name:` / `Status:` / `Phone:`). Its `About: {summary}` line
 * is gone on purpose: the summary is model-written prose about what a stranger said, and nothing
 * a stranger controls goes out under JDD's name. The summary is in the portal, which is where the
 * text points. The name passes through `leadAlertName`, the same filter the lead alert uses, so a
 * caller cannot put a link or a number in front of the owner by saying it as their name.
 *
 * Every character here is GSM-7, so the brief is one plain segment unless a caller's name brings
 * in a letter outside it.
 */

/** The two Priority choices the Call Log column accepts. Anything else is a callback. */
type Priority = "emergency" | "callback";

export function callBriefPriority(raw: string | null | undefined): Priority {
    return raw === "emergency" ? "emergency" : "callback";
}

/** `leadAlertName`, with "not given" in place of its web-form fallback. */
export function callBriefName(raw: string | null | undefined): string {
    const name = leadAlertName(raw);
    return name === leadAlertName(null) ? "not given" : name;
}

export function callBriefBody({
    callerName,
    priority,
    callerNumber,
}: {
    callerName: string | null | undefined;
    priority: string | null | undefined;
    callerNumber: string | null | undefined;
}): string {
    // Only a number that normalizes is shown; anything else would be a stranger-controlled string.
    const e164 = normalizeE164(callerNumber ?? null);
    return [
        `Name:${callBriefName(callerName)}`,
        `Status:${callBriefPriority(priority)}`,
        ...(e164 ? [`Phone: ${formatUsPhone(e164)}`] : []),
        "Call summary is in your portal.",
    ].join("\n");
}

/* ── once per call ────────────────────────────────────────────────────────── */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error("Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
        }
        _redis = Redis.fromEnv();
    }
    return _redis;
}

/** Retell call ids are `call_` + hex; anything outside this shape is not one. */
export const CALL_ID = /^[A-Za-z0-9_-]{8,128}$/;

const briefKey = (acctScope: string, callId: string) => `portal:call-brief:v1:${acctScope}:${callId}`;
/** Well past any Make retry, short enough that the key space does not grow forever. */
const BRIEF_MARK_TTL_SECONDS = 60 * 60 * 24 * 14;

export type CallBriefResult = LeadAlertResult | { sent: false; reason: "duplicate" };

/**
 * Text the owner about one finished call, at most once per Retell `call_id`. **Never throws.**
 *
 * Make retries a webhook on a timeout or a non-2xx, so the same call can arrive more than once.
 * The claim is an `NX` marker scoped to the account. A send that fails releases it, so a later
 * redelivery can still reach the owner rather than the brief being lost to a marker set before a
 * failure — the same pairing as the welcome email's claim.
 */
export async function notifyOwnerOfCall({
    acctScope,
    slug,
    callId,
    callerName,
    priority,
    callerNumber,
}: {
    acctScope: string;
    slug: string;
    callId: string;
    callerName: string | null;
    priority: string | null;
    callerNumber: string | null;
}): Promise<CallBriefResult> {
    const key = briefKey(acctScope, callId);
    try {
        const claimed = await getRedis().set(key, Date.now(), { nx: true, ex: BRIEF_MARK_TTL_SECONDS });
        if (claimed !== "OK") return { sent: false, reason: "duplicate" };
    } catch (e) {
        console.error(`[call-brief] could not claim ${callId} for ${slug}`, e);
        return { sent: false, reason: "failed" };
    }

    const result = await textAccountOwner({
        acctScope,
        slug,
        body: callBriefBody({ callerName, priority, callerNumber }),
        tag: "call-brief",
    });
    if (!result.sent && result.reason === "failed") {
        await getRedis().del(key).catch(() => {});
    }
    return result;
}
