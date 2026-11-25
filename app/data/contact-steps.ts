/**
 * What happens after the /contact form is sent, in order.
 *
 * One list, printed twice: as the horizontal track on /contact ("What happens after you send.")
 * and as the vertical track on /contact/thank-you ("You're here."), where "You sent the form" is
 * prepended and ticked off and these follow. Keeping it here is what keeps the two in step.
 *
 * `when` is the promise JDD's own Terms make (`HOW_FAST` in app/data/faq.ts): a preview within
 * 72 hours of the onboarding form coming back, fully live within a week. Approved by Xander with
 * the page, 19 Nov 2026.
 */
export type ContactStep = { title: string; detail: string; when?: string };

export const CONTACT_STEPS: ContactStep[] = [
    { title: "We reach out", detail: "About your business, and what this would look like for it." },
    { title: "You pick a plan", detail: "Sign up online. Month to month, no contract." },
    { title: "You answer a few questions", detail: "About your business. Most people are done in one sitting." },
    { title: "Your preview site", detail: "Of sending your onboarding form back.", when: "Within 72 hours" },
    { title: "You're live", detail: "Your site, your receptionist, your portal.", when: "Within a week" },
];
