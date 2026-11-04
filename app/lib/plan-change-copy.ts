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

/* ── Growth → Enterprise consolidation (/portal/consolidate) ─────────────────────────────── */

/**
 * The closing paragraph. `others` is how many Growth subscriptions are cancelled alongside the
 * host's: the "other subscription" sentence is left out at 0, and plural at 2 or more.
 */
export function consolidationParagraph(input: {
    hostName: string;
    interval: "month" | "year";
    periodEnd: string;
    others: number;
}): string {
    const { hostName, interval, periodEnd, others } = input;
    const otherSentence =
        others === 0
            ? ""
            : others === 1
              ? " Your other Growth subscription is cancelled at the same time, and its unused part is credited to your account and taken off your next invoices."
              : " Your other Growth subscriptions are cancelled at the same time, and the unused part of each is credited to your account and taken off your next invoices.";
    return (
        `${hostName}'s Growth plan becomes Enterprise as soon as you accept, and you pay only the difference between the two plans for the rest of your current ${interval}, which ends on ${periodEnd}.` +
        otherSentence +
        ` You stay on ${interval === "year" ? "annual" : "monthly"} billing. There's no onboarding fee for moving your existing sites. You'll review and accept the Enterprise service agreement on the next screen before anything is charged.`
    );
}

/** "$994 a month" / "$9,940 a year". */
export function perPeriod(amount: number, interval: "month" | "year"): string {
    return `$${amount.toLocaleString("en-US")} a ${interval}`;
}

/** The sub-line under each price card. */
export function poolLine(input: { pools: number; minutes: number; shared: boolean }): string {
    const min = input.minutes.toLocaleString("en-US");
    if (input.shared) return `one shared pool of ${min} min a month`;
    return input.pools === 1 ? `one pool of ${min} min a month` : `${input.pools} separate pools of ${min} min a month`;
}

export const CONSOLIDATION_MIXED_PERIODS = `Your Growth sites are billed on different schedules, one monthly and one annual, so this move needs to be set up with us directly. Email ${CONTACT_EMAIL} and we'll sort it out.`;

export const CONSOLIDATION_DIFFERENT_CUSTOMERS = `Your Growth sites are billed separately, so this move needs to be set up with us directly. Email ${CONTACT_EMAIL} and we'll sort it out.`;

export function consolidationCancelPending(date: string): string {
    return `One of these sites is set to cancel on ${date}, so this move needs to be set up with us directly. Email ${CONTACT_EMAIL} and we'll sort it out.`;
}

/**
 * The move can't be offered for a technical reason: billing unreadable, a subscription past due,
 * or the Enterprise price not configured.
 */
export const CONSOLIDATION_UNAVAILABLE = `This move needs to be set up with us directly. Email ${CONTACT_EMAIL} and we'll sort it out.`;

/** What to show instead of the "Review and accept" button when the move can't be done here. */
export function consolidationRefusal(code: string, cancelDate?: string): string {
    if (code === "mixed-periods") return CONSOLIDATION_MIXED_PERIODS;
    if (code === "different-customers") return CONSOLIDATION_DIFFERENT_CUSTOMERS;
    if (code === "cancel-pending" && cancelDate) return consolidationCancelPending(cancelDate);
    return CONSOLIDATION_UNAVAILABLE;
}

/* ── Cancellation ─────────────────────────────────────────────────────────────────────── */

/**
 * The portal cancellation card. Replaces "Cancellations require 30 days written notice", which
 * v5.3 dropped on 2026-10-12: cancellation takes effect at the end of the period already paid for.
 */
export function cancellationCardText(input: { interval: "month" | "year"; periodEnd: string }): string {
    const base = `You can cancel at any time. There's no notice period and no fee. Your service stays on, and you won't be charged again, until the end of the ${input.interval} you've already paid for, on ${input.periodEnd}.`;
    return input.interval === "year" ? `${base} Annual fees aren't refunded for the months left in the year.` : base;
}

/** The cancellation confirmation email. */
export const CANCEL_EMAIL_ACCESS =
    "You keep full access until that date, and you won't be charged again for this site apart from any call-minute overage from your final month.";
export const CANCEL_EMAIL_NOTICE =
    "This email is your written confirmation of cancellation under your service agreement. No notice period applies. If you have questions, reply to this email.";
export function cancelEmailFooter(submittedOn: string): string {
    return `This email confirms cancellation under the Juneau Digital Designs Master Services Agreement. Cancellation request submitted ${submittedOn}.`;
}

/** A downgrade the client accepted that could not be scheduled, or a stale accept link. */
export const DOWNGRADE_FAILED = `We couldn't schedule your plan change, and nothing has changed. Email ${CONTACT_EMAIL} and we'll sort it out.`;
