/**
 * The review request a client sends, before they edit it.
 *
 * Client-safe on purpose, unlike `review-request.ts`, which is `server-only` because it holds
 * the KV guard. The dialog seeds its editor from here and the server composes the final text
 * there, so the words a customer receives are decided in one place rather than typed twice.
 *
 * ── Never offer anything in return ──────────────────────────────────────────────────────────
 *
 * The default used to end "As a thank-you, show us your review for 10% off your next service."
 * Google prohibits incentivised reviews, and enforcement lands on the business rather than on
 * us: reviews get stripped and the profile can be flagged. It was the default, so it was on for
 * every client who never edited it — the worst place for that sentence to live.
 *
 * A discount, a prize draw, a free service, a "thank-you" conditional on leaving one: all the
 * same rule. Asking plainly is allowed; paying for it is not. The replacement gives a reason to
 * bother that costs nothing and is true — that it helps a small business.
 */

/** First name for the greeting, or a warm fallback when the caller never gave one. */
export function greetingName(name: string | null | undefined): string {
    if (!name) return "there";
    return name.trim().split(/\s+/)[0] || "there";
}

/**
 * What the editor opens with. The client may rewrite it; most will not, which is the point.
 *
 * Kept to two sentences: this arrives as a text message from a number the customer spoke to
 * hours ago, and the ask has to be over before the preview cuts off.
 */
export function defaultReviewMessage(
    customerName: string | null | undefined,
    businessName: string,
): string {
    return (
        `Hi ${greetingName(customerName)}, thanks for choosing ${businessName}! ` +
        `If we did a great job, would you mind leaving us a quick Google review? ` +
        `It only takes a minute and it genuinely helps a small business like ours.`
    );
}

/**
 * The timeline entry a sent review request leaves on the customer.
 *
 * Sending one was recorded against the phone number — which is what stops a client asking the
 * same person twice — and nowhere else, so the customer's own history never showed that they
 * had been asked. The timeline has always known how to draw a `review-request`; only the write
 * was missing, the same gap the originating call had.
 *
 * Phrased in the second person like every other entry: the history reads as a sequence of
 * things the client and the customer each did, and "Review requested" alone says neither.
 */
export function reviewRequestActivity(customerName: string | null | undefined): {
    kind: "review-request";
    summary: string;
    actor: "client";
} {
    const who = customerName?.trim() || "them";
    return {
        kind: "review-request",
        summary: `You asked ${who} for a Google review`,
        actor: "client",
    };
}
