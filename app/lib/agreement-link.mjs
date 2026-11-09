import { createHash, randomBytes } from "node:crypto";

/**
 * The rules of an order's private agreement link. Pure, so the test runs the same code the
 * routes do.
 *
 * The client reads the full agreement on their own device and agrees there. The page shows names,
 * an address and prices and can record a legal acceptance, so the code is ten characters: unlike
 * the six-character pay code, which only ever redirects to Stripe's own page.
 */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const AGREE_CODE = /^[A-Z2-9]{10}$/;

export function newAgreeCode() {
  return Array.from(randomBytes(10), (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Identifies the document this order would produce right now. A link is tied to it, so changing
 * the plan, the billing or the client's details after sending the link kills the link: nobody can
 * agree to a document that no longer matches the order.
 *
 * @param {{ plan: string, period: string, receptionistMode?: string,
 *           client: { legalName: string, entityType: string, address: string, contactName: string,
 *                     contactTitle: string, email: string } }} order
 * @param {string} termsHash
 */
export function orderDocFingerprint(order, termsHash) {
  const c = order.client;
  return createHash("sha256")
    .update(
      JSON.stringify([
        termsHash, order.plan, order.period, order.receptionistMode ?? "",
        c.legalName, c.entityType, c.address, c.contactName, c.contactTitle, c.email,
      ]),
    )
    .digest("hex");
}

/**
 * What a link shows. Accepted is checked first, because agreeing moves the order on and the
 * client may reload the page afterwards. Any other order that has left `draft` (Read aloud got
 * there first, or it was cancelled) is inactive.
 *
 * @param {{ link: { orderId: string, fingerprint: string, expiresAt: number, acceptedAt?: number } | null,
 *           order: { status: string } | null, fingerprint: string | null, nowMs: number }} input
 * @returns {"accepted" | "active" | "inactive"}
 */
export function agreementLinkState({ link, order, fingerprint, nowMs }) {
  if (!link || !order) return "inactive";
  if (link.acceptedAt) return "accepted";
  if (order.status !== "draft") return "inactive";
  if (link.expiresAt <= nowMs || link.fingerprint !== fingerprint) return "inactive";
  return "active";
}

/**
 * Why a submission can't be recorded, or null when it can. The scroll gate and the tick box are
 * enforced in the page too; the server must not trust that.
 *
 * @param {{ accepted?: unknown, termsHash?: unknown, pageOpenedAt?: unknown, scrollCompletedAt?: unknown }} body
 * @param {string} expectedTermsHash
 */
export function agreementSubmissionError(body, expectedTermsHash) {
  if (body?.accepted !== true) return "Please tick the box to agree to the Terms of Service.";
  if (body.termsHash !== expectedTermsHash) return "This agreement has changed. Reload the page to read the current version.";
  const valid = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
  if (!valid(body.pageOpenedAt)) return "Missing page open timestamp.";
  if (!valid(body.scrollCompletedAt)) return "Agreement was not read to the end.";
  return null;
}
