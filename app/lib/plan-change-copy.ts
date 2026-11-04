/**
 * Client-facing wording for plan changes, in one place so the routes, the portal and the tests
 * read the same strings. Approved word for word by Xander on 2026-11-04 unless marked otherwise;
 * change any of it only with his OK.
 *
 * No `server-only`: the portal's Billing tile (a client component) renders `downgradeTile`.
 */

export const CONTACT_EMAIL = "hello@juneaudigitaldesigns.com";

/** An upgrade (or consolidation) refused because the proration invoice could not be paid. */
export const CARD_DECLINED = `Your card was declined, so your plan hasn't changed and nothing was charged. Email ${CONTACT_EMAIL} and we'll help you update it.`;

/** An upgrade refused because the site is already set to cancel. `date` is "December 1, 2026". */
export function upgradeCancelPending(date: string): string {
    return `This site is set to cancel on ${date}, so it can't be upgraded. Email ${CONTACT_EMAIL} if you'd like to keep it and move to Growth.`;
}

/** The portal Billing tile while a downgrade is scheduled. */
export function downgradeTile(input: { toName: string; fromName: string; date: string }): string {
    return `Your plan changes to ${input.toName} on ${input.date}. You keep everything on ${input.fromName} until then.`;
}

/** A downgrade the client accepted that could not be scheduled, or a stale accept link. */
export const DOWNGRADE_FAILED = `We couldn't schedule your plan change, and nothing has changed. Email ${CONTACT_EMAIL} and we'll sort it out.`;
