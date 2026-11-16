import { normalizeUsPhone } from "./phone.mjs";

/**
 * The text-alerts choice on both agreement pages (`/agree/[code]` from the close wizard, and the
 * self-serve `/agreement`), as Xander decided on 2026-11-15: "two cards, one that revealed the phone
 * number input and the opt in message with the check box to record their consent, and the other
 * for them to bypass it, if we dont collect their consent, we dont send messages."
 *
 *  - Neither card is chosen when the page opens, and agreeing needs one.
 *  - **Yes** reveals the mobile number (a complete US number) and, beside it, the registered
 *    unchecked box with the registered words, both unchanged. Consent is the tick, and only the
 *    tick: Yes with the box unticked is refused, never read as consent.
 *  - **No** has no number and records nothing. No consent, no texts.
 *
 * This replaces the optional number field and the "Continue without text alerts?" notice (#138).
 * In Xander's retest a number went through with the box unticked, a number with no consent.
 *
 * **Consent stays optional** (TCPA, CTIA, the ACCOUNT_NOTIFICATION campaign): No always agrees,
 * and nothing here ticks the box.
 *
 * Plain ESM, client-safe: the pages, the routes and the tests share it, so the browser and the
 * server say the same thing.
 */

/** The two answers. Anything else is no answer. */
export const TEXT_ALERTS_CHOICES = /** @type {const} */ (["yes", "no"]);

/*
 * The words below await Xander's word-for-word approval (drafted 2026-11-15).
 */

/** Agree pressed with neither card chosen. */
export const TEXT_ALERTS_CHOICE_ERROR = "Choose whether you want text alerts.";
/** Yes chosen, with a blank number or not a complete US number. */
export const TEXT_ALERTS_NUMBER_ERROR = "Enter a complete 10-digit mobile number, or choose No text messages.";
/** Yes chosen, a valid number, and the box unticked: no consent, so no agreement on these terms. */
export const TEXT_ALERTS_TICK_ERROR = "Tick the box to agree to text alerts, or choose No text messages.";

/** The heading above the cards. Texts stay optional; the choice is what is required. */
export const TEXT_ALERTS_HEADING = "TEXT ALERTS · CHOOSE ONE";

/**
 * @typedef {{ title: string, line: string }} TextAlertsCard
 * @typedef {{ heading: string, yes: TextAlertsCard, no: TextAlertsCard }} TextAlertsCards
 */

/**
 * The cards for the campaign the page's opt-in shows, named by that opt-in's version
 * (`SmsConsentCopy.version`, which `smsConsentCopy()` picks from `OWNER_TEXT_CAMPAIGN`), so the
 * cards and the box are always on one campaign. Anything but v2 is v1, as the switch is.
 *
 * v1 promises calls only: it neither registers nor sends texts about web-form leads, and its
 * portal Settings can turn texts off but not on, so its No card offers no "later".
 *
 * @param {string} consentVersion
 * @returns {TextAlertsCards}
 */
export function textAlertsCards(consentVersion) {
  if (consentVersion === "sms-consent-v2") {
    return {
      heading: TEXT_ALERTS_HEADING,
      yes: {
        title: "Yes, text me about new leads and calls",
        line: "A short text when a new lead comes in from your website or your AI receptionist takes a call.",
      },
      no: {
        title: "No text messages",
        line: "I'll check my portal inbox for new leads and calls myself. You can turn texts on later in your portal Settings.",
      },
    };
  }
  return {
    heading: TEXT_ALERTS_HEADING,
    yes: { title: "Yes, text me about my calls", line: "A short text each time your AI receptionist takes a call." },
    no: { title: "No text messages", line: "I'll check my portal inbox for new leads and calls myself." },
  };
}

/**
 * What stops this choice from being recorded, as the words to show, or null when it can be.
 * The browser and the server both call this.
 *
 * A No carries no number and no consent. A request saying No with either is contradictory, so it
 * is sent back to choose rather than guessed at either way.
 *
 * @param {{ choice: unknown, smsConsent: unknown, alertPhone: unknown }} input
 * @returns {string | null}
 */
export function textAlertsChoiceError({ choice, smsConsent, alertPhone }) {
  if (choice !== "yes" && choice !== "no") return TEXT_ALERTS_CHOICE_ERROR;
  if (choice === "no") {
    const numberSent = alertPhone !== undefined && alertPhone !== null && alertPhone !== "";
    return smsConsent === true || numberSent ? TEXT_ALERTS_CHOICE_ERROR : null;
  }
  if (typeof alertPhone !== "string" || !normalizeUsPhone(alertPhone)) return TEXT_ALERTS_NUMBER_ERROR;
  if (smsConsent !== true) return TEXT_ALERTS_TICK_ERROR;
  return null;
}
