import { defaultReviewMessage, greetingName } from "./review-message";

/**
 * A client's own review message (2026-11-19, Xander: "there needs to be a place in more in
 * order to set it"), and how it becomes the text one customer receives.
 *
 * Client-safe, like `review-message.ts`: the More screen previews with it and the server sends
 * with it, so the words are decided in one place.
 *
 * The message is stored with a `[first name]` token where the greeting goes. The default is the
 * existing `defaultReviewMessage` with the token in place of the name, so a client who never
 * customises it sends exactly what they always did. The Google link and the STOP line are not
 * part of it: `composeReviewMessage` appends both on the server, every time.
 */
export const FIRST_NAME_TOKEN = "[first name]";

/** Longest message a client may save; matches the server's cap on the composed body. */
export const REVIEW_TEMPLATE_MAX = 320;

const SENTINEL = "\u0000NAME\u0000";

/** The default, with the token where the customer's first name goes. */
export function defaultReviewTemplate(businessName: string): string {
    return defaultReviewMessage(SENTINEL, businessName).replace(SENTINEL, FIRST_NAME_TOKEN);
}

/** One customer's text: the token becomes their first name, or "there" when we have none. */
export function renderReviewTemplate(template: string, customerName: string | null | undefined): string {
    return template.split(FIRST_NAME_TOKEN).join(greetingName(customerName)).trim();
}

/** What may be saved: trimmed, capped, and never empty (empty means "use the default"). */
export function cleanReviewTemplate(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const t = raw.replace(/\r\n/g, "\n").trim().slice(0, REVIEW_TEMPLATE_MAX);
    return t.length > 0 ? t : null;
}
