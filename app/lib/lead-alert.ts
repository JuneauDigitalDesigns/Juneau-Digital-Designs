import "server-only";
import { findAccountEmailByScope } from "./account-store";
import { getOwnerEmail, setOwnerEmail } from "./portal-crm";
import { getConsentStateForAccount, isDeliverable } from "./sms-consent";
import { sendSms } from "./twilio";
import { takeOwnerText } from "./lead-gate";
import { OWNER_TEXT_ORIGIN, ownerItemLink } from "./owner-links";
import {
    carriesLink,
    ownerLeadAlertsEnabled,
    ownerReplyAlertsEnabled,
    ownerTextLinksAllowed,
} from "./owner-text-campaign";

/**
 * JDD's texts to a business owner, other than the end-of-call brief (`call-brief.ts`), and the
 * one path every owner text goes through.
 *
 * Account lane: JDD → the account holder, on JDD's `ACCOUNT_NOTIFICATION` campaign from the JDD
 * notification number. It never touches a customer, so it never waits on the client's own A2P
 * registration, and the client's number stays free to join *their* Messaging Service.
 *
 * ── Which of these may go out depends on the live campaign (owner-text-campaign.ts) ─────────
 * The campaign approved today (v1, the default) describes end-of-call summaries only. The
 * new-lead alert and the customer-replied alert are not in it, so under v1 both are PAUSED: the
 * lead and the message still reach the portal exactly as before, and the call returns
 * `{ sent: false, reason: "paused" }`. `OWNER_TEXT_CAMPAIGN=v2` turns both on, in the replacement
 * campaign's approved wording, once that campaign is approved.
 *
 * **The fact, not the lead.** The portal is where they read and answer it, so these texts only
 * get them there. Nothing a stranger typed is relayed beyond a filtered name.
 */

export type LeadAlertResult =
    | { sent: true; sid: string | null }
    | {
          sent: false;
          reason:
              | "no-owner-email"
              | "no-consent"
              | "throttled"
              | "failed"
              /** The live campaign (v1) does not describe this text, so it is held. */
              | "paused"
              /** The body carried a link while links are not allowed; refused before Twilio. */
              | "has-link";
      };

/**
 * Long enough for a full name, short enough for one segment. 36 keeps the longest name inside
 * the shortest message it appears in.
 */
const NAME_MAX = 36;

/**
 * A name (a web-form visitor's, a caller's, a customer's) as it may appear in a text from JDD's
 * number.
 *
 * The name is whatever a stranger typed or said, and this message goes out from JDD's own
 * notification number. Letting a URL or a phone number through would turn the lead form into a
 * way to put a link in front of the owner under our name, and carriers filter campaigns whose
 * traffic carries links the campaign never declared. So only letters survive (plus the
 * apostrophes, hyphens and spaces real names use); a name with nothing left falls back to a
 * neutral phrase.
 */
export function leadAlertName(raw: string | null | undefined, fallback = "a website visitor"): string {
    const cleaned = (raw ?? "")
        .replace(/[^\p{L}\p{M}' -]/gu, " ")
        // What is left of a URL's scheme is no one's name, and "http" in an owner text reads as
        // a link to a reviewer whatever follows it.
        .replace(/(^|\s)(?:https?|www)(?=\s|$)/giu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, NAME_MAX)
        .trim();
    return /\p{L}/u.test(cleaned) ? cleaned : fallback;
}

/** v1's STOP line: the last line of the approved campaign's registered samples. */
export const OWNER_TEXT_STOP_LINE = "Reply STOP to opt out, HELP for help";
/** v2's STOP line: the last line of every replacement-campaign sample (approved 2026-11-08). */
export const OWNER_TEXT_STOP_LINE_V2 = "Juneau Digital Designs: Reply STOP to opt out, HELP for help";

/**
 * v2 new-lead text (replacement campaign sample, 2026-11-08). `url` is a minted owner link or
 * null; with null the "View it:" line is left out.
 */
export function leadAlertBodyV2(name: string | null | undefined, url: string | null): string {
    return [
        "New lead in your portal",
        `From: ${leadAlertName(name)}`,
        ...(url ? [`View it: ${url}`] : []),
        OWNER_TEXT_STOP_LINE_V2,
    ].join("\n");
}

/** Where the customer-replied alert points: the Customers page, on `www` (the apex redirects). */
export const CUSTOMERS_URL = `${OWNER_TEXT_ORIGIN}/portal/customers`;

/**
 * v2 customer-replied text (replacement campaign sample, 2026-11-08). The link is the fixed
 * Customers page, so it is included exactly when links are allowed.
 */
export function replyAlertBodyV2(customerName: string | null | undefined, withLink: boolean): string {
    return [
        "New message in your portal",
        `From: ${leadAlertName(customerName, "a customer")}`,
        ...(withLink ? [`View it: ${CUSTOMERS_URL}`] : []),
        OWNER_TEXT_STOP_LINE_V2,
    ].join("\n");
}

/**
 * Text the business owner that a web-form lead has landed in their portal. **Never throws.**
 *
 * Paused under v1 (see the header). Called only after the lead is persisted, so a pause or a
 * failure here costs the owner a heads-up, never the lead: the ingest response must not depend on
 * Twilio, because a 502 makes the visitor's form say "that didn't send" about a lead we already
 * hold, and they resubmit it.
 */
export async function notifyOwnerOfLead({
    acctScope,
    slug,
    name,
    leadId,
}: {
    acctScope: string;
    slug: string;
    name: string | null;
    /** The stored lead — its Inbox id is `lead:<leadId>`. Only used when owner-text links are on. */
    leadId?: string | null;
}): Promise<LeadAlertResult> {
    if (!ownerLeadAlertsEnabled()) {
        console.log(`[lead-alert] paused for ${slug}: the live campaign (OWNER_TEXT_CAMPAIGN=v1) does not describe it; the lead is in the portal`);
        return { sent: false, reason: "paused" };
    }
    return textAccountOwner({
        acctScope,
        slug,
        tag: "lead-alert",
        body: async () =>
            leadAlertBodyV2(name, await ownerItemLink({ acctScope, slug, itemId: leadId ? `lead:${leadId}` : null })),
    });
}

/**
 * Tell the owner a customer replied by text — **the fact, not the message**. **Never throws.**
 *
 * Paused under v1 (see the header). The inbound message is threaded into the portal either way;
 * only this text is held.
 *
 * Kept on its own consent path, as before this change: the owner-email index it reads is written
 * when the owner sends a portal message, which every customer conversation starts with, and it is
 * not counted against the per-site owner-text budget, so a busy conversation can't starve the
 * call briefs.
 */
export async function notifyOwnerOfCustomerReply({
    acctScope,
    slug,
    customerName,
}: {
    acctScope: string;
    slug: string;
    customerName: string | null;
}): Promise<LeadAlertResult> {
    if (!ownerReplyAlertsEnabled()) {
        console.log(`[reply-alert] paused for ${slug}: the live campaign (OWNER_TEXT_CAMPAIGN=v1) does not describe it; the message is in the portal`);
        return { sent: false, reason: "paused" };
    }
    try {
        const email = await getOwnerEmail(acctScope);
        if (!email) return { sent: false, reason: "no-owner-email" };

        const consent = await getConsentStateForAccount(email);
        if (!isDeliverable(consent)) return { sent: false, reason: "no-consent" };

        const { sid } = await sendSms({
            lane: "account",
            to: consent.phone,
            body: replyAlertBodyV2(customerName, ownerTextLinksAllowed()),
        });
        return { sent: true, sid };
    } catch (e) {
        console.error(`[reply-alert] owner notification failed for ${slug}`, e);
        return { sent: false, reason: "failed" };
    }
}

/**
 * The one way JDD texts a business owner about a call or a lead: resolve the account, check
 * consent, send on the account lane. **Never throws.** Shared by the new-lead alert and the
 * end-of-call brief (`call-brief.ts`) so the consent rule exists exactly once — a second copy is
 * a second place for "absent", "revoked" or "awaiting YES" to be read as permission.
 *
 * `body` is the text, or a function that composes it once consent is confirmed (so a vendor
 * lookup or a minted link is only spent on a text that will go out). It must already be safe to
 * send under JDD's name: no stranger's free text, and no link unless links are allowed, which is
 * checked here as well as in `sendSms`.
 */
export async function textAccountOwner({
    acctScope,
    slug,
    body,
    tag,
}: {
    acctScope: string;
    slug: string;
    body: string | ((owner: { email: string }) => Promise<string>);
    /** Log prefix, so a failure says which alert it was. */
    tag: string;
}): Promise<LeadAlertResult> {
    try {
        let email = await getOwnerEmail(acctScope);
        if (!email) {
            email = await findAccountEmailByScope(acctScope);
            // Cached in the same index the reply alert reads, so the scan runs once per account.
            if (email) await setOwnerEmail(acctScope, email).catch(() => {});
        }
        if (!email) {
            console.warn(`[${tag}] no account email for ${slug}; owner not notified`);
            return { sent: false, reason: "no-owner-email" };
        }

        // The same check every owner text makes: absent, revoked, or awaiting a double-opt-in
        // YES all mean silence.
        const consent = await getConsentStateForAccount(email);
        if (!isDeliverable(consent)) return { sent: false, reason: "no-consent" };

        const text = typeof body === "string" ? body : await body({ email });
        if (carriesLink(text) && !ownerTextLinksAllowed()) {
            console.error(`[${tag}] refused for ${slug}: the text carries a link and the live campaign declares none`);
            return { sent: false, reason: "has-link" };
        }

        // Counted only for a text that would actually go out, so an owner without consent never
        // uses up the budget. Held means the lead is in the inbox and only the text waits.
        if (!(await takeOwnerText(acctScope, slug))) return { sent: false, reason: "throttled" };

        const { sid } = await sendSms({ lane: "account", to: consent.phone, body: text });
        return { sent: true, sid };
    } catch (e) {
        console.error(`[${tag}] owner notification failed for ${slug}`, e);
        return { sent: false, reason: "failed" };
    }
}
