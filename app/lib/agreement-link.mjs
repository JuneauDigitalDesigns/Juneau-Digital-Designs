import { createHash, randomBytes } from "node:crypto";
import { ALERT_PHONE_UNTICKED_ERROR, alertPhoneProblem } from "./agreement-phone.mjs";
import { textAlertsChoiceError } from "./text-alerts-choice.mjs";

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
  if (body.termsHash !== expectedTermsHash) return "These terms have changed. Reload the page to read the current version.";
  const valid = (v) => typeof v === "string" && !Number.isNaN(Date.parse(v));
  if (!valid(body.pageOpenedAt)) return "Missing page open timestamp.";
  if (!valid(body.scrollCompletedAt)) return "The terms were not read to the end.";
  return null;
}

/**
 * Why the optional SMS opt-in can't be recorded, or null when it can (or wasn't given). The same
 * rules, and the same words, as the `/terms/accept` page's (`agreement-validate.mjs`): consent
 * needs a receptionist to text about, and a number to text, and anything typed in the number
 * box is a complete US number. Never a reason to refuse the agreement itself when the box is
 * left unticked and the number box blank.
 *
 * @param {{ smsConsent?: unknown, alertPhone?: unknown }} body
 * @param {{ plan?: string, receptionistMode?: string }} order
 */
export function agreementConsentError(body, order) {
  // D9 (2026-11-24): the website plan's owners get no texts, like a legacy website-only order.
  const noTexts = order?.plan === "website" || order?.receptionistMode === "declined";
  // The two-card choice (`text-alerts-choice.mjs`). A website-only order has no cards and nothing
  // to text about, so only a claim of consent is refused there, as before.
  if (body?.smsChoice !== undefined && !noTexts) {
    return textAlertsChoiceError({ choice: body.smsChoice, smsConsent: body.smsConsent, alertPhone: body.alertPhone });
  }
  if (noTexts && (body?.smsChoice === "yes" || body?.smsConsent === true)) {
    return "Text alerts require a receptionist";
  }
  // A page loaded before the cards shipped sends no choice: its box and number are checked as they
  // were (#137), so a client mid-signing across the deploy isn't turned away.
  // A number in the box is a complete US number whether or not the box is ticked: in Xander's
  // 2026-11-15 test this link accepted an agreement with "555" there (`agreement-phone.mjs`).
  // Blank and unticked always passes.
  const problem = alertPhoneProblem(body?.smsConsent === true, body?.alertPhone);
  if (body?.smsConsent !== true) return problem === "invalid-unticked" ? ALERT_PHONE_UNTICKED_ERROR : null;
  if (noTexts) return "Text alerts require a receptionist";
  if (problem) return "A valid mobile number is required to enable text alerts";
  return null;
}
