/**
 * The notice shown when a client presses Agree with the optional text-alerts box unticked, on
 * both agreement pages (`/agree/[code]` from the close wizard, and the self-serve `/agreement`).
 *
 * Xander, 2026-11-15: clients can buy a plan and not use the texts, "but it means they wont know
 * until they check their portal if they recieved a lead and part of the system working is them
 * being able to respond within 5 minutes knowing that they have a potential lead via that text
 * message." So the first press with the box unticked shows this and sends them back to the
 * agreement; a second press, still unticked, agrees.
 *
 * **Consent stays optional, and this must never make it otherwise** (TCPA, CTIA, and the
 * ACCOUNT_NOTIFICATION campaign, whose registered opt-in is optional). The notice says so in
 * words, never blocks a second press, never ticks the box, and changes neither the consent
 * wording nor the box. Any plan with a receptionist; never a website-only order, which has no
 * opt-in at all.
 *
 * Wording approved word for word by Xander, 2026-11-15. Don't reword it without sign-off.
 * Plain ESM, client-safe, so the pages and the test suite share it.
 */

/** @typedef {{ title: string, body: string, button: string }} SmsSkipNoticeCopy */

export const SMS_SKIP_NOTICE_TITLE = "Continue without text alerts?";

/**
 * v1, the campaign live today (`OWNER_TEXT_CAMPAIGN` unset). Calls only: v1 neither registers nor
 * sends new-lead texts (`ownerLeadAlertsEnabled` is v2-only), and under v1 portal Settings can
 * turn texts off but not on, so there is no "later in the portal".
 */
export const SMS_SKIP_NOTICE_BODY_V1 =
  "Without text alerts, we won't text you when your AI receptionist takes a call. Every call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Agree again.";

/** v2 (`OWNER_TEXT_CAMPAIGN=v2`): new-lead texts, and turning texts on later in the portal. */
export const SMS_SKIP_NOTICE_BODY_V2 =
  "Without text alerts, we won't text you when a new lead comes in or your AI receptionist takes a call. Every lead and call still reaches your portal inbox, so you would need to check it yourself. Text alerts are optional. To turn them on, tick the box and add your mobile number. To agree without them, press Agree again. You can also turn them on later in your portal Settings.";

export const SMS_SKIP_NOTICE_BUTTON = "Back to the agreement";

/**
 * The words for the campaign the page's opt-in shows, named by that opt-in's version
 * (`SmsConsentCopy.version`, which `smsConsentCopy()` picks from `OWNER_TEXT_CAMPAIGN`), so the
 * notice and the box can never be on different campaigns. Anything but v2 is v1, as the switch is.
 *
 * @param {string} consentVersion
 * @returns {SmsSkipNoticeCopy}
 */
export function smsSkipNoticeCopy(consentVersion) {
  const body = consentVersion === "sms-consent-v2" ? SMS_SKIP_NOTICE_BODY_V2 : SMS_SKIP_NOTICE_BODY_V1;
  return { title: SMS_SKIP_NOTICE_TITLE, body, button: SMS_SKIP_NOTICE_BUTTON };
}

/**
 * Whether this press of Agree shows the notice instead of agreeing.
 *
 * Only the first unticked press: once it has been shown, a second press agrees. Never when the
 * box is ticked, and never without a receptionist (no opt-in is offered there).
 *
 * @param {{ hasReceptionist: boolean, smsConsent: boolean, alreadyShown: boolean }} state
 * @returns {boolean}
 */
export function smsSkipNoticeDue({ hasReceptionist, smsConsent, alreadyShown }) {
  return hasReceptionist && !smsConsent && !alreadyShown;
}
