/**
 * Settings › Plan & billing: what a client's subscription is doing, in the words Xander approved
 * (monthly billing review, 2026-11-16, Q1 to Q6 and §5 word for word, with his two changes).
 *
 * CLIENT-SAFE: no Stripe, no server-only imports. The billing route sends raw Stripe facts and the
 * page turns them into a status and sentences here, so the mapping has one definition and a test.
 *
 * Don't reword any string in this file without Xander's sign-off.
 */

/** The five statuses the tab shows (§5.2). */
export type BillingStatusKind = "active" | "cancelling" | "cancelled" | "overdue" | "inactive";

export interface BillingStatus {
    kind: BillingStatusKind;
    /** For "cancelling": when the service ends (epoch ms). */
    endsAt?: number;
}

/**
 * Stripe's subscription status, plus the cancellation facts, to one of the five statuses.
 *
 * - `active` / `trialing` → Active, or Cancelling when Stripe is set to stop
 *   (`cancel_at` / `cancel_at_period_end`) or the portal record holds a cancellation request.
 *   Either source is enough, so the state holds on every visit, device and cache.
 * - `canceled` → Cancelled.
 * - `past_due` / `unpaid` → Payment overdue (Q3). "Inactive" would tell a client whose service
 *   is still on that it's off.
 * - anything else (`incomplete`, `incomplete_expired`, `paused`) → Inactive.
 */
export function billingStatus(input: {
    status: string | null | undefined;
    /** Stripe `cancel_at`, epoch ms. */
    cancelAt?: number | null;
    cancelAtPeriodEnd?: boolean | null;
    /** The current period's end, epoch ms: when `cancel_at_period_end` stops it. */
    periodEnd?: number | null;
    /** The portal record's `cancelEffectiveAt`, epoch ms. */
    requestedEndsAt?: number | null;
}): BillingStatus {
    const { status, cancelAt, cancelAtPeriodEnd, periodEnd, requestedEndsAt } = input;
    if (status === "canceled") return { kind: "cancelled" };
    if (status === "past_due" || status === "unpaid") return { kind: "overdue" };
    if (status === "active" || status === "trialing") {
        // Every cancellation has a date: `cancel_at`, or the period end that `cancel_at_period_end`
        // stops at, or the date the portal recorded. Without one there is nothing true to say,
        // and "Cancelling on" with no date isn't approved wording.
        const endsAt = cancelAt ?? (cancelAtPeriodEnd ? periodEnd : null) ?? requestedEndsAt ?? null;
        return endsAt ? { kind: "cancelling", endsAt } : { kind: "active" };
    }
    return { kind: "inactive" };
}

/** "December 14, 2026". UTC, so a client west of UTC never sees the day before the boundary. */
export function billingDate(ms: number | null | undefined): string {
    if (!ms) return "";
    return new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

/** 1 → "1st", 2 → "2nd", 14 → "14th", 22 → "22nd". */
export function ordinal(n: number): string {
    const teen = n % 100 >= 11 && n % 100 <= 13;
    const suffix = teen ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th";
    return `${n}${suffix}`;
}

/** The approved wording, word for word. */
export const BILLING_COPY = {
    // §5.1 tiles and the Subscription card.
    statusLabel: "Status",
    nextPaymentLabel: "Next payment",
    nextPaymentOn: (date: string) => `on ${date}`,
    subscriptionTitle: "Subscription",
    currentTermLabel: "Current term",
    currentTerm: (start: string, end: string) => `${start} to ${end}`,
    renewsLabel: "Renews",
    renewsMonthly: (dayOfMonth: number) => `Monthly, on the ${ordinal(dayOfMonth)}`,
    sitesOnPlanLabel: "Sites on this plan",
    invoiceView: "View",

    // §5.2 statuses.
    status: {
        active: "Active",
        cancelling: (date: string) => `Cancelling on ${date}`,
        cancelled: "Cancelled",
        overdue: "Payment overdue",
        inactive: "Inactive",
    },

    // §5.3 confirm step.
    confirmHeading: "Cancel your subscription?",
    confirmAfter: "We'll email you a confirmation, and this page will show the date your service ends.",
    confirmField: (name: string) => `Type "${name}" to confirm`,
    keepButton: "Keep my subscription",
    cancelButton: "Request cancellation",

    // §5.4 cancelling state. The Renews line is Xander's change: "Doesn't renew." was dropped.
    cancellingBanner: (date: string) => `Your subscription is still active and cancels on ${date}.`,
    cancellingBannerAfter: "You keep full access until then, and a confirmation was sent to your account email.",
    nextPaymentNone: "None",
    nextPaymentNoneHint: "apart from any call-minute overage from this month",
    renewsEnding: (date: string) => `Your service ends on ${date}.`,

    // §5.5 other states.
    cancelledBanner: (date: string) => `Your subscription ended on ${date}.`,
    cancelledBannerAfter: "You won't be charged again. Email hello@juneaudigitaldesigns.com if you'd like to start again.",
    overdueBanner: "Your last payment didn't go through.",
    overdueBannerAfter: "Update your card, or email hello@juneaudigitaldesigns.com and we'll help.",
    /** Q4's "no" variant: shown when the card page isn't set up, so the line never offers a button that isn't there. */
    overdueBannerAfterNoCardPage: "Email hello@juneaudigitaldesigns.com and we'll help you update your card.",
    overdueHint: "due now",
    inactiveBanner: "This subscription isn't active.",
    inactiveBannerAfter: "Email hello@juneaudigitaldesigns.com and we'll sort it out.",

    // §5.6 Update card (Q4). The line is Xander's own words.
    updateCardButton: "Update card",
    updateCardLine: "Open Stripe to change your card.",
} as const;

/** The Status tile's text for a status. */
export function statusText(s: BillingStatus): string {
    if (s.kind === "cancelling") return BILLING_COPY.status.cancelling(billingDate(s.endsAt));
    return BILLING_COPY.status[s.kind];
}

/** Which day of the month the subscription renews on, from the period end (UTC). */
export function renewalDay(periodEndMs: number): number {
    return new Date(periodEndMs).getUTCDate();
}
