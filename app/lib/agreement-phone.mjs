import { normalizeUsPhone } from "./phone.mjs";

/**
 * The rule for the mobile number box beside the optional SMS opt-in, on both agreement pages
 * (`/terms/accept` and `/terms/[code]`), in the browser and on the server. One function, so the page
 * can never accept a number the server refuses, or the other way round.
 *
 * Client-safe (no node builtins): the pages import it as well as the routes.
 *
 * Found in Xander's front-to-back test, 2026-11-15: with the text-alerts box unticked, a page
 * dropped whatever was in the box and recorded the agreement, so "555" went through as accepted.
 * Now anything typed in the box must be a complete US number, ticked or not:
 *  - ticked: a valid number is required (consent must point at a number we can text);
 *  - unticked: blank is fine (the box is labelled optional), anything else must be valid.
 *
 * Never a reason to require consent: an unticked box with a blank number always passes.
 */

/**
 * Shown when the text-alerts box is unticked and the number box holds something that isn't a
 * complete US number. Same words in the browser and from the server.
 *
 * Approved word for word by Xander, 2026-11-15. Don't reword it without sign-off.
 */
export const ALERT_PHONE_UNTICKED_ERROR = "Enter a complete 10-digit mobile number, or leave the mobile number blank.";

/**
 * What is wrong with the number box, or null.
 *
 * @param {unknown} smsConsent  whether the opt-in box is ticked (only `true` counts)
 * @param {unknown} alertPhone  what is typed in the number box
 * @returns {"consent-needs-number" | "invalid-unticked" | null}
 */
export function alertPhoneProblem(smsConsent, alertPhone) {
  // A request can carry anything: a number sent as a JSON number (555) is not a blank box.
  const absent = alertPhone === undefined || alertPhone === null || (typeof alertPhone === "string" && alertPhone.trim() === "");
  const valid = typeof alertPhone === "string" && normalizeUsPhone(alertPhone) !== null;
  if (smsConsent === true) return valid ? null : "consent-needs-number";
  if (absent || valid) return null;
  return "invalid-unticked";
}
