import { normalizeE164 } from "./phone";

/**
 * What a caller said on a recorded call about being texted, for one number.
 *
 * The agent closes every call by asking whether the business may text them "at that number". The
 * answer lands in the Call Log's `SMS consent` column, and until 2026-11-08 nothing read it: once
 * a client's texting went live, an owner could have texted someone who had just said no.
 *
 * "That number" is the one the agent just confirmed, so it is `Callback number` when the caller
 * gave one and `Caller number` otherwise. Told "no, use my cell" and then yes to texts, the caller
 * agreed about the cell.
 *
 *   granted  — covers the number they agreed about, and only that one.
 *   declined — covers both numbers on the call. Someone who said no has said no.
 *   unknown  — never asked, or the call ended first. Blocks, like the operator-approved contract
 *              in jdd-ops `lib/voice-consent.js`.
 *
 * The newest real answer wins, so a later yes lifts an earlier no, and a later call that never
 * reached the question (`unknown`) cannot lift anything. `null` means no call on record has this
 * number: a customer who came through a form or was added by hand. This does not apply to them.
 */
export type SpokenConsent = "granted" | "declined" | "unknown" | null;

/** The fields this reads, structural so the `server-only` call module stays out of the tests. */
export interface ConsentCall {
    date: string | null;
    callerNumber: string | null;
    callbackNumber: string | null;
    smsConsent: string | null;
}

const timeOf = (iso: string | null) => {
    const t = iso ? new Date(iso).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
};

export function spokenConsentFor(calls: ConsentCall[], e164: string | null): SpokenConsent {
    if (!e164) return null;
    let notAgreed = false;
    for (const call of [...calls].sort((a, b) => timeOf(b.date) - timeOf(a.date))) {
        const answer = call.smsConsent;
        if (answer !== "granted" && answer !== "declined" && answer !== "unknown") continue; // a row older than the column

        const caller = normalizeE164(call.callerNumber);
        const agreedAbout = normalizeE164(call.callbackNumber) ?? caller;
        if (agreedAbout !== e164 && caller !== e164) continue;

        if (answer === "declined") return "declined";
        if (answer === "granted" && agreedAbout === e164) return "granted";
        // Never answered, or a yes about their other number: nothing here covers this one.
        notAgreed = true;
    }
    return notAgreed ? "unknown" : null;
}

/** Why a text can't go, or null if it can. */
export function consentBlock(status: SpokenConsent): "declined" | "not-agreed" | null {
    if (status === "declined") return "declined";
    if (status === "unknown") return "not-agreed";
    return null;
}

/** Shown to the owner. Wording approved by Xander on 2026-11-08. */
export const NOT_AGREED_MESSAGE = "This customer hasn't agreed to texts, so we can't message them.";
