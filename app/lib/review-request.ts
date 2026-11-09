import "server-only";
import { normalizeE164 } from "./phone";
import { getReviewSend } from "./portal-crm";

/**
 * Google-review request SMS: composition and the one-per-number guard.
 *
 * ── Compliance (read before changing) ───────────────────────────────────────────────────────
 * A review request is a **single, transactional follow-up** to a customer who just called the
 * business — an established-business-relationship message, not a marketing campaign. The rules
 * this code enforces so it stays that way:
 *
 *   • Exactly ONE message per number, ever (`canSendReview` hard-blocks a second — see
 *     `ReviewSendRecord`, which has no delete path).
 *   • STOP / HELP are honoured: sends go through the A2P Messaging Service, whose Advanced
 *     Opt-Out blocks STOP at the carrier, and the inbound webhook mirrors STOP into our own
 *     records (`markReviewOptOut`). An opted-out number can never be sent to.
 *   • The message always carries "Reply STOP to opt out" — appended server-side, never trusted
 *     to the client-edited body.
 *   • No cadence, no re-sends, no bulk. There is deliberately no "send to all" path.
 *
 * The review link is admin-set (console / onboarding), never editable in the portal, so the
 * link a client's customers receive is one we vetted.
 */

const STOP_TAIL = "Reply STOP to opt out.";
/** The client-edited portion is capped; the link and STOP tail are always appended intact. */
const MAX_BODY = 320;

/** First name from a caller's full name, for the greeting. */
export function firstNameOf(name: string | null | undefined): string | null {
    if (!name) return null;
    const first = name.trim().split(/\s+/)[0];
    return first || null;
}

/**
 * Final message: the client-edited body, then the canonical review link, then the STOP tail.
 *
 * The link and tail are appended here rather than trusted from the client so they are always
 * present and correct — a client who deletes them from the editor cannot send a non-compliant
 * message or a broken link.
 */
export function composeReviewMessage(clientBody: string, reviewUrl: string): string {
    const body = (clientBody ?? "").trim().slice(0, MAX_BODY);
    return `${body}\n\n${reviewUrl}\n${STOP_TAIL}`;
}

export type ReviewBlockReason = "no-review-link" | "no-number" | "already-sent" | "opted-out" | "not-agreed";

/**
 * May we send a review request to this number? The feature's hard guard.
 *
 * Order matters: a missing review link or number is a configuration answer; already-sent and
 * opted-out are the permanent blocks that make this one-per-customer.
 */
export async function canSendReview(
    acctScope: string,
    e164: string | null,
    reviewUrl: string | null,
): Promise<{ allowed: true } | { allowed: false; reason: ReviewBlockReason }> {
    if (!reviewUrl) return { allowed: false, reason: "no-review-link" };
    if (!e164) return { allowed: false, reason: "no-number" };

    const existing = await getReviewSend(acctScope, e164);
    if (existing) {
        return { allowed: false, reason: existing.optedOut ? "opted-out" : "already-sent" };
    }
    return { allowed: true };
}

/**
 * The review link and sending number for a site.
 *
 * Both now live on `PortalSite` (`@jdd/schema` v1.29.0 / v1.30.0). `googleReviewUrl` is
 * admin-managed — set at onboarding or in the console, never editable in the client portal — so
 * the link a client's customers receive is one we vetted. A missing link blocks the send with
 * `no-review-link`, which the UI surfaces as "contact Juneau Digital Designs" rather than an
 * edit field.
 */
export function resolveReviewConfig(site: {
    googleReviewUrl?: string;
    twilioNumber?: string | null;
}): {
    reviewUrl: string | null;
    fromNumber: string | null;
} {
    const trimmed = site.googleReviewUrl?.trim();
    return {
        reviewUrl: trimmed ? trimmed : null,
        fromNumber: site.twilioNumber ? normalizeE164(site.twilioNumber) : null,
    };
}

/** True when a site could send a review request at all (link configured). For the UI gate. */
export function reviewLinkConfigured(site: { googleReviewUrl?: string }): boolean {
    return Boolean(site.googleReviewUrl?.trim());
}
