/**
 * The call-summary sample /sms-terms prints under "A typical call summary reads".
 *
 * Exactly what `callBriefBody` sends under the live v1 campaign (owner-text-campaign.ts): the
 * approved campaign's registered sample, line for line, with a sample lead. Approved by Xander word
 * for word on 2026-11-18, replacing the old one-line sample ("…call alert: Callback requested. New
 * lead Maria Alvarez, callback (930) 555-0117. Reply STOP to opt out."), which matched nothing the
 * code sent. `test/sms-terms-sample.test.mjs` builds the same lead with `callBriefBody` and holds
 * this to it, so the page cannot drift from the text.
 */
export const CALL_SUMMARY_SAMPLE = [
    "Juneau Digital Designs call alert",
    "Name: Maria Alvarez",
    "Status: Callback",
    "Phone: (930) 555-0117",
    "About: Water heater leaking in the garage",
    "Reply STOP to opt out, HELP for help",
].join("\n");
