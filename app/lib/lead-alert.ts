import "server-only";
import { findAccountEmailByScope } from "./account-store";
import { getOwnerEmail, setOwnerEmail } from "./portal-crm";
import { getConsentStateForAccount, isDeliverable } from "./sms-consent";
import { sendSms } from "./twilio";

/**
 * Text the business owner that a web-form lead has landed in their portal.
 *
 * **The fact, not the lead.** The portal is where they read and answer it, so the text's only
 * job is to get them there — same rule as the inbound-reply alert. Keeping the visitor's
 * message out also means nothing a stranger typed is relayed to the owner's phone.
 *
 * Account lane: JDD → the account holder, on the already-approved `ACCOUNT_NOTIFICATION`
 * campaign from the JDD notification number. That is why it works on every tier, web-only
 * included — it never touches a customer, so it never waits on the client's own A2P
 * registration, and the client's number stays free to join *their* Messaging Service.
 */

export type LeadAlertResult =
    | { sent: true; sid: string | null }
    | { sent: false; reason: "no-owner-email" | "no-consent" | "failed" };

/**
 * Long enough for a full name, short enough for one segment. The em dash is outside GSM-7, so
 * every one of these goes as UCS-2, where a segment is 70 characters: 34 of fixed text leaves 36.
 */
const NAME_MAX = 36;

/**
 * The visitor's name as it may appear in a text from JDD's number.
 *
 * The name is whatever a stranger typed into a public form, and this message goes out from
 * JDD's own notification number. Letting a URL or a phone number
 * through would turn the lead form into a way to put a link in front of the owner under our
 * name, and carriers filter campaigns whose traffic carries links the campaign never declared.
 * So only letters survive (plus the apostrophes, hyphens and spaces real names use); a name
 * with nothing left falls back to a neutral phrase.
 */
export function leadAlertName(raw: string | null | undefined): string {
    const cleaned = (raw ?? "")
        .replace(/[^\p{L}\p{M}' -]/gu, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, NAME_MAX)
        .trim();
    return /\p{L}/u.test(cleaned) ? cleaned : "a website visitor";
}

export function leadAlertBody(name: string | null | undefined): string {
    return `New lead from ${leadAlertName(name)} — open your portal.`;
}

/**
 * Resolve the owner, check their consent, send. **Never throws.**
 *
 * Called only after the lead is persisted. A failure here costs the owner a heads-up, never
 * the lead: the ingest response must not depend on Twilio, because a 502 makes the visitor's
 * form say "that didn't send" about a lead we already hold, and they resubmit it.
 */
export async function notifyOwnerOfLead({
    acctScope,
    slug,
    name,
}: {
    acctScope: string;
    slug: string;
    name: string | null;
}): Promise<LeadAlertResult> {
    return textAccountOwner({ acctScope, slug, body: leadAlertBody(name), tag: "lead-alert" });
}

/**
 * The one way JDD texts a business owner: resolve the account, check consent, send on the
 * account lane. **Never throws.** Shared by the new-lead alert and the end-of-call brief
 * (`call-brief.ts`) so the consent rule exists exactly once — a second copy is a second place
 * for "absent", "revoked" or "awaiting YES" to be read as permission.
 *
 * `body` must already be safe to send under JDD's name: no stranger's free text, no links.
 */
export async function textAccountOwner({
    acctScope,
    slug,
    body,
    tag,
}: {
    acctScope: string;
    slug: string;
    body: string;
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

        const { sid } = await sendSms({ lane: "account", to: consent.phone, body });
        return { sent: true, sid };
    } catch (e) {
        console.error(`[${tag}] owner notification failed for ${slug}`, e);
        return { sent: false, reason: "failed" };
    }
}
