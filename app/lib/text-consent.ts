import { createHash } from "node:crypto";
import { normalizeE164 } from "./phone";
import type { SpokenConsent } from "./spoken-consent";

/**
 * May the business text this customer? The rule, pure, so the tests run exactly what the routes do.
 * The I/O around it is `customer-text-consent.ts`.
 *
 * Xander, 2026-11-16: every portal text, review requests included, is gated on the customer's
 * consent being collected and attached to their record. Until then a customer with no call on
 * record, from the website form or added by hand, could be texted with no check at all.
 *
 * Consent is one of:
 *  - a clear yes on a recorded call, for this exact number (`spokenConsentFor`); or
 *  - the website form's SMS consent record on the lead the customer came from, for this number,
 *    naming the approved wording by version and hash.
 *
 * Fails closed: no evidence, or evidence that can't be read, is a refusal.
 */

/**
 * The website form's SMS consent wording, by version: `@jdd/ui` `LEAD_SMS_CONSENT_TEXT`
 * (approved 2026-11-02, v1.3.0 onwards; respelled "inquiry" as v2 in v1.9.0, 2026-11-20). The agency has no `@jdd/ui` dependency, so the words are
 * copied here and the hash is computed from them. A new wording in `@jdd/ui` needs a row here, or
 * its form leads can't be texted.
 */
const LEAD_SMS_CONSENT_TEXTS: Record<string, string> = {
    "lead-sms-consent-v1":
        "By giving us your number you agree we may text you about your enquiry. Message and data rates may apply. " +
        "Message frequency varies. Reply STOP to opt out, HELP for help.",
    // @jdd/ui v1.9.0 (2026-11-20): v1 respelled "inquiry", approved by Xander. Keep v1: leads already
    // stored carry it, and they must stay textable.
    "lead-sms-consent-v2":
        "By giving us your number you agree we may text you about your inquiry. Message and data rates may apply. " +
        "Message frequency varies. Reply STOP to opt out, HELP for help.",
};

/** SHA-256 of each canonical wording, as `@jdd/ui`'s `hashLeadSmsConsentText` computes it. */
export const LEAD_SMS_CONSENT_HASHES: Record<string, string> = Object.fromEntries(
    Object.entries(LEAD_SMS_CONSENT_TEXTS).map(([version, text]) => [
        version,
        createHash("sha256").update(text.replace(/\s+/g, " ").trim()).digest("hex"),
    ]),
);

/** The parts of a stored web lead this reads. The form's `consent` object is a JSON string in `fields`. */
export interface LeadForConsent {
    phone?: string | null;
    phoneRaw?: string | null;
    fields?: Record<string, string> | null;
}

/** Does this lead carry the form's SMS consent, for this number, in an approved wording? */
export function formConsentCovers(lead: LeadForConsent | null | undefined, e164: string | null): boolean {
    if (!lead || !e164) return false;
    if (normalizeE164(lead.phone ?? lead.phoneRaw ?? "") !== e164) return false;
    const raw = lead.fields?.consent;
    if (!raw) return false;
    let consent: unknown;
    try {
        consent = JSON.parse(raw);
    } catch {
        return false;
    }
    if (!consent || typeof consent !== "object") return false;
    const c = consent as { basis?: unknown; textVersion?: unknown; textHash?: unknown };
    if (c.basis !== "web-form" || typeof c.textVersion !== "string") return false;
    const expected = LEAD_SMS_CONSENT_HASHES[c.textVersion];
    return Boolean(expected) && c.textHash === expected;
}

export type TextConsentRefusal = "opted-out" | "declined" | "not-agreed" | "unavailable";
export type TextConsentDecision = { ok: true; basis: "call" | "web-form" } | { ok: false; reason: TextConsentRefusal };

/**
 * The decision. A "no" anywhere wins, as does not being able to read the call log (it might hold a
 * "no"). An unanswered ask blocks, as it did before. Then a yes on a call, then the form's record.
 * Nothing else is consent.
 */
export function decideTextConsent({
    optedOut,
    spoken,
    formCovers,
}: {
    optedOut: boolean;
    spoken: SpokenConsent | "unavailable";
    formCovers: boolean;
}): TextConsentDecision {
    if (optedOut) return { ok: false, reason: "opted-out" };
    if (spoken === "unavailable") return { ok: false, reason: "unavailable" };
    if (spoken === "declined") return { ok: false, reason: "declined" };
    if (spoken === "unknown") return { ok: false, reason: "not-agreed" };
    if (spoken === "granted") return { ok: true, basis: "call" };
    if (formCovers) return { ok: true, basis: "web-form" };
    return { ok: false, reason: "not-agreed" };
}
