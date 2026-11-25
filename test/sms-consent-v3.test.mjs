/**
 * The v2 campaign's consent covers customer-reply alerts (Xander, 2026-11-18).
 *
 * The replacement campaign sends four kinds of owner text, but its consent sentence named three.
 * The fix is a new version, `sms-consent-v3`, not an edit: a consent record keeps its version and a
 * hash of the exact words, and records already point at `sms-consent-v2`, so those words must stay
 * findable unchanged. Terms §4.6 under v2 and the v2 keyword replies change with it, and the Terms'
 * v2 version moves to v6.2 (whether anyone had accepted v6.1 could not be checked, so it is not
 * edited in place). Everything here was approved word for word.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

const consent = await import("../app/lib/sms-consent-text.ts");
const { textAlertsCards } = await import("../app/lib/text-alerts-choice.mjs");
const { SMS_KEYWORD_RULES } = await import("../app/lib/owner-text-campaign.ts");
const { TERMS_VERSIONS, buildSections } = await import("../app/lib/legal/terms-of-service.ts");

const V3_TEXT =
    "Yes, text me call summaries, new-lead alerts, customer-reply alerts, and service alerts about my own Juneau Digital Designs account at the mobile number above. Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies based on call and lead volume. Reply STOP to opt out, HELP for help. See SMS Terms and Privacy Policy.";

test("v3 is the approved text, and the v2 campaign shows it", () => {
    assert.equal(consent.SMS_CONSENT_V3.version, "sms-consent-v3");
    assert.equal(consent.SMS_CONSENT_V3.text, V3_TEXT);
    assert.equal(consent.smsConsentCopy({ OWNER_TEXT_CAMPAIGN: "v2" }), consent.SMS_CONSENT_V3);
    assert.equal(consent.smsConsentCopy({}), consent.SMS_CONSENT_V1, "v1 is untouched");
});

test("records made under sms-consent-v2 still resolve to the words they were given", () => {
    assert.equal(consent.smsConsentCopyForVersion("sms-consent-v2"), consent.SMS_CONSENT_V2);
    assert.match(consent.SMS_CONSENT_V2.text, /^Yes, text me call summaries, new-lead alerts, and service alerts/);
    assert.equal(consent.smsConsentCopyForVersion("sms-consent-v3"), consent.SMS_CONSENT_V3);
    assert.equal(consent.smsConsentCopyForVersion("sms-consent-v1"), consent.SMS_CONSENT_V1);
});

test("the agreement pages' cards treat v3 as the v2 campaign", () => {
    assert.deepEqual(textAlertsCards("sms-consent-v3"), textAlertsCards("sms-consent-v2"));
    assert.notDeepEqual(textAlertsCards("sms-consent-v3"), textAlertsCards("sms-consent-v1"));
});

test("the v2 keyword replies name customer messages", () => {
    assert.equal(
        SMS_KEYWORD_RULES.v2.optInReply,
        "Juneau Digital Designs: You are opted in to account alerts about your calls, leads, customer messages and service. Msg & data rates may apply. Message frequency varies. Reply HELP for help, STOP to opt out.",
    );
    assert.equal(
        SMS_KEYWORD_RULES.v2.helpReply,
        "Juneau Digital Designs account alerts: texts about your calls, leads, customer messages and service. Msg & data rates may apply. Reply STOP to opt out. Help: support@juneaudigitaldesigns.com",
    );
});

test("Terms under v2 are v7.1 (v6.2 before the refund), and §4.6 names customer-reply alerts", () => {
    assert.equal(TERMS_VERSIONS.v2, "v7.1");
    assert.equal(TERMS_VERSIONS.v1, "v7.0");
    const text = JSON.stringify(buildSections("v2"));
    assert.ok(
        text.includes("If you opt in, we text you call summaries, new-lead alerts, customer-reply alerts and occasional service alerts about your own account."),
    );
    assert.ok(!JSON.stringify(buildSections("v1")).includes("customer-reply"), "the v1 text never names them");
});
