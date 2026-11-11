/**
 * Which A2P campaign JDD's texts to business owners are written for. **One switch.**
 *
 * Every owner text (the end-of-call brief, the new-lead alert, the customer-replied alert) rides
 * JDD's `ACCOUNT_NOTIFICATION` campaign from `TWILIO_NOTIFICATION_NUMBER` inside
 * `TWILIO_MESSAGING_SERVICE_SID`. Carriers filter traffic the registered campaign does not
 * describe, so what we may send is decided by which campaign is live, and nothing else:
 *
 *   OWNER_TEXT_CAMPAIGN unset (or anything but "v2") → **v1**, the campaign approved today
 *     (read live 2026-11-10: VERIFIED, has_embedded_links=false). It describes end-of-call
 *     summaries ONLY, so:
 *       - the end-of-call brief goes out in the registered sample's exact format
 *         ("Juneau Digital Designs call alert" / Name / Status / Phone / About / STOP line);
 *       - the new-lead alert and the customer-replied alert are PAUSED (the lead and the message
 *         still land in the portal; only the owner's text stops);
 *       - no owner text carries a link, whatever OWNER_TEXT_LINKS says.
 *
 *   OWNER_TEXT_CAMPAIGN=v2 → the replacement campaign (samples approved by Xander 2026-11-08,
 *     "Account Campaign Replacement"). Set it only once Twilio has approved that campaign:
 *       - the brief, the new-lead alert and the customer-replied alert use the v2 samples;
 *       - links follow OWNER_TEXT_LINKS (exactly "on" adds the "View it:" line).
 *
 * The pause is folded into this switch on purpose. A separate "lead alerts on" flag could be
 * flipped under v1, sending a text the live campaign never declared; tying each text to the
 * campaign that describes it makes that combination impossible to configure.
 *
 * Cutting over is env only: OWNER_TEXT_CAMPAIGN=v2 (+ OWNER_TEXT_LINKS=on if the new campaign
 * declares links), and, if the new campaign lives on a different service or number,
 * TWILIO_MESSAGING_SERVICE_SID / TWILIO_NOTIFICATION_NUMBER. Nothing in code names either.
 *
 * Client-safe and dependency-free so `twilio.ts` can enforce the link rule at the send itself.
 */

export type OwnerTextCampaign = "v1" | "v2";

type Env = Record<string, string | undefined>;

/** Only the exact value "v2" selects the replacement; a typo stays on the approved campaign. */
export function ownerTextCampaign(env: Env = process.env): OwnerTextCampaign {
    return env.OWNER_TEXT_CAMPAIGN?.trim() === "v2" ? "v2" : "v1";
}

/** The raw OWNER_TEXT_LINKS flag. Exactly "on" counts. */
export function ownerTextLinksFlag(env: Env = process.env): boolean {
    return env.OWNER_TEXT_LINKS?.trim() === "on";
}

/** Whether an owner text may carry a link right now: only under v2, and only with the flag on. */
export function ownerTextLinksAllowed(env: Env = process.env): boolean {
    return ownerTextCampaign(env) === "v2" && ownerTextLinksFlag(env);
}

/** Texts the v1 campaign does not describe, so they only go out under v2. */
export function ownerLeadAlertsEnabled(env: Env = process.env): boolean {
    return ownerTextCampaign(env) === "v2";
}
export function ownerReplyAlertsEnabled(env: Env = process.env): boolean {
    return ownerTextCampaign(env) === "v2";
}

/* ── keyword auto-replies ─────────────────────────────────────────────────── */

/**
 * The keywords the inbound SMS webhook acts on, and what it answers, per campaign. Word for word
 * as registered (v1, read live from Twilio 2026-11-10) or as planned for the replacement (v2),
 * per Xander, 2026-11-11. Every opt-out keyword also records the revocation in our consent store;
 * the webhook answers an opt-out with silence, because Twilio's Advanced Opt-Out sends the
 * registered opt-out message itself.
 */
export interface SmsKeywordRules {
    optIn: ReadonlySet<string>;
    optOut: ReadonlySet<string>;
    help: ReadonlySet<string>;
    /** Sent when an opt-in keyword confirms (or re-grants) an existing consent. */
    optInReply: string;
    helpReply: string;
}

export const SMS_KEYWORD_RULES: Record<OwnerTextCampaign, SmsKeywordRules> = {
    v1: {
        optIn: new Set(["START", "YES", "UNSTOP"]),
        optOut: new Set(["CANCEL", "QUIT", "STOP", "OPTOUT", "UNSUBSCRIBE", "STOPALL", "REVOKE", "END"]),
        help: new Set(["HELP", "INFO"]),
        optInReply:
            "Juneau Digital Designs: You are now opted in to receive call summaries and service alerts by " +
            "text message. Message and data rates may apply. Message frequency varies based on call volume. " +
            "For help, reply HELP. To opt out, reply STOP.",
        helpReply: "Reply STOP to unsubscribe. Msg&Data Rates May Apply.",
    },
    v2: {
        optIn: new Set(["START", "YES", "UNSTOP"]),
        optOut: new Set(["STOP", "CANCEL", "QUIT", "OPTOUT", "UNSUBSCRIBE", "STOPALL", "REVOKE", "END"]),
        help: new Set(["HELP", "INFO"]),
        optInReply:
            "Juneau Digital Designs: You are opted in to account alerts about your calls, leads and service. " +
            "Msg & data rates may apply. Message frequency varies. Reply HELP for help, STOP to opt out.",
        helpReply:
            "Juneau Digital Designs account alerts: texts about your calls, leads and service. Msg & data " +
            "rates may apply. Reply STOP to opt out. Help: support@juneaudigitaldesigns.com",
    },
};

export function smsKeywordRules(env: Env = process.env): SmsKeywordRules {
    return SMS_KEYWORD_RULES[ownerTextCampaign(env)];
}

/**
 * Anything a carrier would read as a link: a scheme, `www.`, or a bare domain. Deliberately
 * broad (an e-mail address matches too), since the cost of a false positive is one held text
 * and the cost of a miss is undeclared campaign content.
 */
const LINK = /https?:\/\/|\bwww\.|\b[a-z0-9-]+\.(?:com|net|org|io|co|us|ly|gl|app|dev|ai|me|info|biz|link|site|xyz|online)\b/i;

export function carriesLink(body: string): boolean {
    return LINK.test(body);
}
