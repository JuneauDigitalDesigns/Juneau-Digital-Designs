import { normalizeE164 } from "./phone.mjs";

/**
 * The rules a self-serve agreement submission must pass before anything is stored.
 *
 * Plain ESM, out of `/api/agreement/route.ts`, so the test suite (Node 22.0, no TypeScript
 * loader) runs the real rules rather than a copy. The route calls this and nothing else decides
 * whether a submission is acceptable.
 *
 * **Acceptance is a ticked box, not a drawn signature** (Xander, 2026-11-03: "most businesses just
 * use a checkbox saying they've read and agree to the terms of service"). `termsAccepted: true` is
 * required. A drawn signature from a page loaded before this shipped is still accepted, so a
 * client mid-signing across the deploy isn't turned away, and every stored signed agreement
 * stays exactly as valid as it was.
 *
 * The optional SMS opt-in is unchanged and stays separate from acceptance: never required, never
 * implied by the terms box, and refused only when it would record consent pointing at nothing.
 */

const VALID_PLANS = ["starter", "growth", "enterprise"];
const VALID_RECEPTIONIST_MODES = ["forwarded", "published", "declined"];

/** @param {unknown} s @returns {s is string} */
function nonEmpty(s) {
  return typeof s === "string" && s.trim().length > 0;
}

/** @param {unknown} s */
function validEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

/** @param {unknown} s */
function validTimestamp(s) {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}

/** A drawn signature as the pre-clickwrap page sent it. @param {unknown} s */
export function hasDrawnSignature(s) {
  return typeof s === "string" && s.startsWith("data:image/png;base64,");
}

/**
 * Which way this submission accepted the terms, or null if it didn't.
 *
 * @param {{ termsAccepted?: unknown; signatureDataUrl?: unknown }} body
 * @returns {"clickwrap-self" | "drawn-signature" | null}
 */
export function acceptanceMethod(body) {
  if (body.termsAccepted === true) return "clickwrap-self";
  if (hasDrawnSignature(body.signatureDataUrl)) return "drawn-signature";
  return null;
}

/**
 * Returns an error message for the client, or null when the submission may be stored.
 *
 * @param {Record<string, any>} body
 * @returns {string | null}
 */
export function validateAgreementSubmission(body) {
  if (!VALID_PLANS.includes(body.plan)) return "Invalid plan";
  if (body.kind && body.kind !== "master" && body.kind !== "addendum") {
    return "Invalid agreement kind";
  }
  // An addendum with no master to adopt is not an addendum. `/start` always supplies this;
  // its absence means the client reached the signing form some other way.
  if (body.kind === "addendum" && !nonEmpty(body.parentAgreementId)) {
    return "Missing parent agreement";
  }
  if (!nonEmpty(body.clientLegalName)) return "Missing client legal name";
  if (!nonEmpty(body.clientEntityType)) return "Missing entity type";
  if (!nonEmpty(body.clientAddress)) return "Missing client address";
  if (!nonEmpty(body.signerName)) return "Missing signer name";
  if (!nonEmpty(body.signerTitle)) return "Missing signer title";
  if (!validEmail(body.signerEmail)) return "Invalid signer email";
  if (!acceptanceMethod(body)) {
    return "Please tick the box to agree to the Terms of Service";
  }
  // The scroll gate is enforced in the UI, but a submission that never reached
  // the end of the terms must not be accepted just because it skipped the UI.
  if (!validTimestamp(body.pageOpenedAt)) return "Missing page open timestamp";
  if (!validTimestamp(body.scrollCompletedAt)) {
    return "Agreement was not read to the end";
  }
  // Only on a master. The Enterprise master is where the client commits to the site list, so
  // it has to be named there. An addendum adding a site to an existing Enterprise bundle
  // derives its sites from `account.sites` instead — the account record is the truth about
  // what they own by then, and asking them to retype it invites the two to disagree.
  if (body.plan === "enterprise" && body.kind !== "addendum") {
    const sites = (body.additionalSites || []).filter(nonEmpty);
    if (sites.length < 2) return "Enterprise requires at least 2 site names";
  }
  // Phone handling. Captured at signing for a new Starter/Growth purchase, so the welcome
  // email can speak to the client's actual choice and the onboarding form opens prefilled.
  // Skipped for upgrades (the client already has a phone setup) and for Enterprise (the
  // per-site choice is deferred to the onboarding form). The UI enforces this too; the server
  // must not trust it to.
  // A downgrade keeps the phone setup the client already has, so it is skipped there too.
  const needsPhoneChoice =
    !body.upgradeSlug && !body.downgradeSlug && (body.plan === "starter" || body.plan === "growth");
  // Optional: the cover states the period when it is known, and both prices when it is not.
  if (body.billingPeriod && body.billingPeriod !== "monthly" && body.billingPeriod !== "annual") {
    return "Invalid billing period";
  }
  if (body.receptionistMode && !VALID_RECEPTIONIST_MODES.includes(body.receptionistMode)) {
    return "Invalid phone option";
  }
  if (needsPhoneChoice && !body.receptionistMode) {
    return "Please choose how your phone should be handled";
  }
  // Website-only is a Starter concession, not a Growth or Enterprise option: those are
  // receptionist plans with no web-only schedule to sign against.
  if (body.receptionistMode === "declined" && body.plan !== "starter") {
    return "Website-only is only available on the Starter plan";
  }
  // Forwarding needs a number to forward from. A choice of "forward" with nothing to forward
  // is not a usable instruction.
  if (body.receptionistMode === "forwarded" && !normalizeE164(body.forwardingNumber)) {
    return "A valid number to forward is required";
  }

  // A website-only site produces no calls, so there is nothing to text a summary about.
  // Replaces the old Starter-wide block: since the 2026-10-12 reprice every plan includes the
  // receptionist, and the one case with no calls is the website-only choice, not the tier.
  if (body.smsConsent && body.receptionistMode === "declined") {
    return "Call alert texts require a receptionist";
  }
  // Consent without a reachable number is not consent to anything. Checked in the UI too,
  // but a record claiming permission to text an unparseable string is worse than no record.
  if (body.smsConsent && !normalizeE164(body.alertPhone)) {
    return "A valid mobile number is required to enable call alert texts";
  }
  return null;
}
