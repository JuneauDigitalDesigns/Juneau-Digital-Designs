import "server-only";

/**
 * Proof that the consent gate (`customer-text-consent.ts`) cleared one number. `sendSms` refuses a
 * customer-lane text without one, so any future path that texts a customer has to go through the
 * gate, and a look-alike object is not a pass: only tokens issued here count.
 *
 * `issueTextConsentToken` is for the gate alone; `test/customer-text-consent.test.mjs` holds it to that.
 */

export interface CustomerTextConsent {
    readonly phone: string;
    readonly basis: "call" | "web-form";
}

const issued = new WeakSet<object>();

export function issueTextConsentToken(phone: string, basis: CustomerTextConsent["basis"]): CustomerTextConsent {
    const token = Object.freeze({ phone, basis });
    issued.add(token);
    return token;
}

/** Was this issued by the gate, for this number? */
export function isIssuedTextConsent(token: unknown, to: string): boolean {
    return (
        typeof token === "object" &&
        token !== null &&
        issued.has(token) &&
        (token as CustomerTextConsent).phone === to
    );
}
