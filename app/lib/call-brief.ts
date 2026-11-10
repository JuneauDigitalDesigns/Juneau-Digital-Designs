import "server-only";
import { Redis } from "@upstash/redis";
import { getAccount } from "./account-store";
import {
    leadAlertName,
    textAccountOwner,
    OWNER_TEXT_STOP_LINE,
    OWNER_TEXT_STOP_LINE_V2,
    type LeadAlertResult,
} from "./lead-alert";
import { ownerItemLink } from "./owner-links";
import { ownerTextCampaign } from "./owner-text-campaign";
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
 * ── The wording follows the live campaign (owner-text-campaign.ts) ──────────────────────────
 * v1 (default) is the approved campaign's registered sample, word for word (Xander, 2026-11-10):
 *
 *     Juneau Digital Designs call alert
 *     Name: Jane Smith
 *     Status: Urgent
 *     Phone: (555) 123-4567
 *     About: AC has been out for hours, kids at home
 *     Reply STOP to opt out, HELP for help
 *
 * v1 never carries a link: the campaign is registered has_embedded_links=false, so there is no
 * link variant of it at all.
 *
 * v2 is the replacement campaign's sample (approved 2026-11-08): "New call lead in your portal",
 * Name, Priority, an optional "View it:" link, and the branded STOP line.
 *
 * ── What a stranger can put in it ───────────────────────────────────────────────────────────
 * The name passes through `leadAlertName` (letters only), so a caller cannot put a link or a
 * number in front of the owner by saying it as their name. The About line is Retell's analysed
 * summary, which is model-written prose about what a stranger said, so `callBriefSummary` strips
 * URLs, domains, e-mail addresses and anything resembling a phone number, reduces it to plain
 * GSM-7 and caps it near 100 characters. The phone number is the one Make posts (`caller_number`,
 * the other party on the call), shown only when it parses as a real number.
 */

/** The two Priority choices the Call Log column accepts. Anything else is a callback. */
type Priority = "emergency" | "callback";

export function callBriefPriority(raw: string | null | undefined): Priority {
    return raw === "emergency" ? "emergency" : "callback";
}

/**
 * `leadAlertName`, with "Not given" in place of its web-form fallback. Capitalised like every
 * other value in the registered sample ("Urgent", "Callback"), and true: the caller did not give
 * a name the agent could extract. It is never "Unknown caller" or the like, which would read as
 * a fact about the caller rather than about what was said.
 */
export function callBriefName(raw: string | null | undefined): string {
    const name = leadAlertName(raw);
    return name === leadAlertName(null) ? "Not given" : name;
}

/** Twilio's stand-ins for a withheld caller ID. They parse as numbers, so they are named here. */
const WITHHELD_CALLER_IDS = new Set(["+266696687", "+86282452253", "+7378742833", "+2562533", "+8656696"]);

/** What the Phone line says when the call carried no number we can show. */
export const PHONE_NOT_AVAILABLE = "Not available";

/**
 * The Phone line's value: `(555) 123-4567` for a North American number, E.164 for any other real
 * number, "Not available" for a withheld, blank or unparseable one. Only digits and the format's
 * own punctuation ever come out, so the line can carry nothing but a number.
 */
export function callBriefPhone(raw: string | null | undefined): string {
    const trimmed = (raw ?? "").trim();
    // A phone field holding words is not a number, whatever digits are buried in it.
    if (!trimmed || /[A-Za-z]/.test(trimmed)) return PHONE_NOT_AVAILABLE;
    const e164 = normalizeE164(trimmed);
    if (!e164 || WITHHELD_CALLER_IDS.has(e164)) return PHONE_NOT_AVAILABLE;
    return e164.startsWith("+1") ? formatUsPhone(e164) : e164;
}

/** Roughly the sample's length: enough for a reason, short enough that the brief stays two segments. */
export const ABOUT_MAX = 100;

const SPELLED_TLDS = "com|net|org|io|co|us|info|biz|app|dev|ai|me|ly";

/**
 * The call summary as it may appear after "About:", or null if nothing usable is left.
 *
 * Retell writes it, from what a stranger said, and it goes out under JDD's name on a campaign
 * registered without links. So, in order: typographic punctuation becomes ASCII, accents are
 * dropped; e-mail addresses, URLs, bare domains ("bit.ly/x") and spelled-out ones ("deals dot com")
 * go; any run of 7+ digits with phone punctuation goes; whatever is outside plain GSM-7 letters,
 * digits and everyday punctuation becomes a space; whitespace collapses; and it is cut at a word
 * boundary with "..." if longer than ABOUT_MAX.
 */
export function callBriefSummary(raw: string | null | undefined): string | null {
    if (typeof raw !== "string") return null;
    let s = raw
        .normalize("NFKD")
        .replace(/\p{M}/gu, "")
        .replace(/[‘’‚′`´]/g, "'")
        .replace(/[“”„″]/g, '"')
        .replace(/[‐-―−]/g, "-")
        .replace(/…/g, "...");

    s = s
        .replace(/\S*@\S*/g, " ")
        .replace(/\S*(?:https?:\/\/|\bwww\.)\S*/gi, " ")
        .replace(/\S*\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}\b\S*/gi, " ")
        .replace(new RegExp(`\\b[a-z0-9-]+\\s+dot\\s+(?:${SPELLED_TLDS})\\b\\S*`, "gi"), " ")
        .replace(/\+?\(?\d[\d\s().-]{4,}\d/g, (m) => (m.replace(/\D/g, "").length >= 7 ? " " : m));

    s = s
        .replace(/[^A-Za-z0-9 .,;:!?'"()&%/$+-]/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .replace(/^[\s.,;:!?-]+/, "")
        .trim();

    if (!/[A-Za-z]/.test(s)) return null;
    if (s.length <= ABOUT_MAX) return s;

    const room = s.slice(0, ABOUT_MAX - 3);
    const space = room.lastIndexOf(" ");
    const cut = space > ABOUT_MAX / 2 ? room.slice(0, space) : room;
    return `${cut.replace(/[\s.,;:!?'"(&/+-]+$/, "")}...`;
}

/** v1's first line, from the registered sample. */
export const CALL_BRIEF_HEADER = "Juneau Digital Designs call alert";

const STATUS_LABEL: Record<Priority, string> = { emergency: "Urgent", callback: "Callback" };

/**
 * The v1 brief: the approved campaign's registered sample, line for line. The About line is
 * left out, rather than filled with a stand-in, when there is no usable summary: every line that
 * goes out is then a fact about the call.
 */
export function callBriefBody({
    callerName,
    priority,
    callerNumber,
    summary,
}: {
    callerName: string | null | undefined;
    priority: string | null | undefined;
    callerNumber: string | null | undefined;
    summary: string | null | undefined;
}): string {
    const about = callBriefSummary(summary);
    return [
        CALL_BRIEF_HEADER,
        `Name: ${callBriefName(callerName)}`,
        `Status: ${STATUS_LABEL[callBriefPriority(priority)]}`,
        `Phone: ${callBriefPhone(callerNumber)}`,
        ...(about ? [`About: ${about}`] : []),
        OWNER_TEXT_STOP_LINE,
    ].join("\n");
}

/** v2's first line, from the replacement campaign's sample. */
export const CALL_BRIEF_HEADER_V2 = "New call lead in your portal";

const PRIORITY_LABEL_V2: Record<Priority, string> = { emergency: "Emergency", callback: "Callback" };

/**
 * The v2 brief (replacement campaign, approved 2026-11-08). `url` is a minted owner link, or null
 * when links are off or nothing could be minted, in which case the "View it:" line is left out.
 */
export function callBriefBodyV2(
    { callerName, priority }: { callerName: string | null | undefined; priority: string | null | undefined },
    url: string | null,
): string {
    return [
        CALL_BRIEF_HEADER_V2,
        `Name: ${callBriefName(callerName)}`,
        `Priority: ${PRIORITY_LABEL_V2[callBriefPriority(priority)]}`,
        ...(url ? [`View it: ${url}`] : []),
        OWNER_TEXT_STOP_LINE_V2,
    ].join("\n");
}

/** An Airtable record id — the call's Inbox item id. Sent by Make as `airtable_record_id`. */
export const AIRTABLE_RECORD_ID = /^rec[A-Za-z0-9]{14}$/;

/* ── the summary, from Retell ─────────────────────────────────────────────── */

/** Make posts once the call is analysed, so Retell already holds the summary; never wait long. */
const RETELL_TIMEOUT_MS = 8000;

interface RetellCall {
    call_id?: string;
    agent_id?: string;
    call_analysis?: { call_summary?: unknown };
}

/**
 * Retell's summary of this call, or null. **Never throws**: a Retell problem costs the About
 * line, never the brief.
 *
 * The call is read from the master Retell account, which holds every client's calls, so the id
 * alone is not proof the call is this owner's. It must be on this site's own agent, as the
 * portal's account record names it; a site with no agent on record gets no summary at all.
 */
async function summaryFromRetell({ email, slug, callId }: { email: string; slug: string; callId: string }): Promise<string | null> {
    const apiKey = process.env.RETELL_API_KEY?.trim();
    if (!apiKey) return null;
    try {
        const account = await getAccount(email);
        const agentId = account?.sites.find((s) => s.slug === slug)?.retellAgentId ?? null;
        if (!agentId) return null;

        const res = await fetch(`https://api.retellai.com/v2/get-call/${encodeURIComponent(callId)}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            cache: "no-store",
            signal: AbortSignal.timeout(RETELL_TIMEOUT_MS),
        });
        if (!res.ok) {
            console.warn(`[call-brief] Retell get-call ${res.status} for ${slug}; sending without About`);
            return null;
        }
        const call = (await res.json()) as RetellCall | null;
        if (call?.call_id !== callId || call.agent_id !== agentId) {
            console.warn(`[call-brief] ${callId} is not on ${slug}'s agent; sending without About`);
            return null;
        }
        const summary = call.call_analysis?.call_summary;
        return typeof summary === "string" ? summary : null;
    } catch (e) {
        console.warn(`[call-brief] Retell lookup failed for ${slug}; sending without About`, e);
        return null;
    }
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
 *
 * The body is composed only once consent is confirmed, so an owner who has not opted in costs no
 * Retell request and no minted link.
 */
export async function notifyOwnerOfCall({
    acctScope,
    slug,
    callId,
    callerName,
    priority,
    callerNumber,
    recordId,
}: {
    acctScope: string;
    slug: string;
    callId: string;
    callerName: string | null;
    priority: string | null;
    /** The other party on the call, as Make posts it. v1's Phone line. */
    callerNumber: string | null;
    /** The call's Airtable record id = its Inbox item id. Only used for v2's link, when links are on. */
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

    const v2 = ownerTextCampaign() === "v2";
    const result = await textAccountOwner({
        acctScope,
        slug,
        tag: "call-brief",
        body: v2
            ? async () => {
                  const itemId = recordId && AIRTABLE_RECORD_ID.test(recordId) ? recordId : null;
                  return callBriefBodyV2({ callerName, priority }, await ownerItemLink({ acctScope, slug, itemId }));
              }
            : async ({ email }) =>
                  callBriefBody({
                      callerName,
                      priority,
                      callerNumber,
                      summary: await summaryFromRetell({ email, slug, callId }),
                  }),
    });
    if (!result.sent && result.reason === "failed") {
        await getRedis().del(key).catch(() => {});
    }
    return result;
}
