import "server-only";
import { Redis } from "@upstash/redis";
import { leadAlertName, textAccountOwner, OWNER_TEXT_STOP_LINE, type LeadAlertResult } from "./lead-alert";
import { ownerItemLink } from "./owner-links";

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
 * The wording is Xander's (see callBriefBody). Make's old `About: {summary}` line
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

/** First line of every brief, so the owner knows who is texting before reading the rest. */
export const CALL_BRIEF_HEADER = "JDD Notification Service";

const PRIORITY_LABEL: Record<Priority, string> = { emergency: "Emergency", callback: "Callback" };

/**
 * Xander's wording (2026-11-03): who it's from, the caller's name, the priority, and where the
 * rest is. No phone number and no summary — the full lead is one tap away in the portal.
 */
export function callBriefBody({
    callerName,
    priority,
}: {
    callerName: string | null | undefined;
    priority: string | null | undefined;
}): string {
    return [
        CALL_BRIEF_HEADER,
        `Name: ${callBriefName(callerName)}`,
        `Priority: ${PRIORITY_LABEL[callBriefPriority(priority)]}`,
        "The full lead is in your portal.",
        // Added with the campaign samples (Xander, 2026-11-03): every owner text says how to stop.
        OWNER_TEXT_STOP_LINE,
    ].join("\n");
}

/**
 * The brief WITH a link, in the registered samples' exact form
 * (jdd-ops/TWILIO-SUPPORT-campaign-update.md). Only when `OWNER_TEXT_LINKS=on` and a link was
 * minted; otherwise `callBriefBody` goes out unchanged.
 */
export function callBriefBodyWithLink(
    { callerName, priority }: { callerName: string | null | undefined; priority: string | null | undefined },
    url: string,
): string {
    return [
        CALL_BRIEF_HEADER,
        `Name: ${callBriefName(callerName)}`,
        `Priority: ${PRIORITY_LABEL[callBriefPriority(priority)]}`,
        `The full lead is in your portal: ${url}`,
        OWNER_TEXT_STOP_LINE,
    ].join("\n");
}

/** An Airtable record id — the call's Inbox item id. Sent by Make as `airtable_record_id`. */
export const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

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
    recordId,
}: {
    acctScope: string;
    slug: string;
    callId: string;
    callerName: string | null;
    priority: string | null;
    /** Accepted from Make but not texted: the number is in the portal with the rest of the lead. */
    callerNumber: string | null;
    /** The call's Airtable record id = its Inbox item id. Only used when owner-text links are on. */
    recordId?: string | null;
}): Promise<CallBriefResult> {
    const key = briefKey(acctScope, callId);
    try {
        const claimed = await getRedis().set(key, Date.now(), { nx: true, ex: BRIEF_MARK_TTL_SECONDS });
        if (claimed !== "OK") return { sent: false, reason: "duplicate" };
    } catch (e) {
        console.error(`[call-brief] could not claim ${callId} for ${slug}`, e);
        return { sent: false, reason: "failed" };
    }

    // Minted only after the claim, so a Make redelivery never mints a second, orphaned link.
    const url = await ownerItemLink({ acctScope, slug, itemId: recordId && AIRTABLE_RECORD_ID.test(recordId) ? recordId : null });
    const result = await textAccountOwner({
        acctScope,
        slug,
        body: url ? callBriefBodyWithLink({ callerName, priority }, url) : callBriefBody({ callerName, priority }),
        tag: "call-brief",
    });
    if (!result.sent && result.reason === "failed") {
        await getRedis().del(key).catch(() => {});
    }
    return result;
}
