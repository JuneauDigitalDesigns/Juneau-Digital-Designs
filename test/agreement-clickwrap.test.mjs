/**
 * Self-serve agreement acceptance: a ticked box, not a drawn signature.
 *
 * Imports the real rules (`app/lib/agreement-validate.mjs`) that `/api/agreement` runs. Every
 * case here is a behaviour that changed on 2026-11-03 (Xander's decision to drop the signature
 * pad) or one that must NOT change with it — the optional SMS opt-in, which the carrier
 * registration describes exactly as it is.
 *
 * On the code before this change, the first test fails: a submission with no signature was
 * refused with "Missing or invalid signature", so no self-serve buyer could reach checkout
 * without drawing one.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptanceMethod, validateAgreementSubmission } from "../app/lib/agreement-validate.mjs";

const NOW = "2026-11-03T15:00:00.000Z";

/** What the agreement page sends for a Growth purchase, minus whatever the case overrides. */
function submission(overrides = {}) {
  return {
    plan: "growth",
    clientLegalName: "Rivera Plumbing & Drain LLC",
    clientEntityType: "LLC",
    clientAddress: "1420 Example Ave, Orlando, FL 32801",
    signerName: "Marisol Rivera",
    signerTitle: "Owner",
    signerEmail: "marisol@riverapd.example",
    additionalSites: [],
    pageOpenedAt: NOW,
    scrollCompletedAt: NOW,
    receptionistMode: "published",
    termsAccepted: true,
    ...overrides,
  };
}

test("a ticked terms box with no signature is accepted, so self-serve reaches checkout", () => {
  const body = submission();
  assert.equal("signatureDataUrl" in body, false);
  assert.equal(validateAgreementSubmission(body), null);
  assert.equal(acceptanceMethod(body), "clickwrap-self");
});

test("a submission without the terms box ticked is refused", () => {
  for (const termsAccepted of [false, undefined, "true", 1]) {
    const err = validateAgreementSubmission(submission({ termsAccepted }));
    assert.match(err ?? "", /Terms of Service/, `termsAccepted=${String(termsAccepted)}`);
  }
});

test("an upgrade (addendum) accepts the same way, with no signature", () => {
  const body = submission({ kind: "addendum", parentAgreementId: "agr_master", upgradeSlug: "rivera-plumbing", receptionistMode: undefined });
  assert.equal(validateAgreementSubmission(body), null);
});

test("a drawn signature from a page loaded before the change still counts", () => {
  // A client mid-signing across the deploy must not be turned away, and the stored signed
  // agreements this mirrors stay valid untouched.
  const body = submission({ termsAccepted: undefined, signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=" });
  assert.equal(validateAgreementSubmission(body), null);
  assert.equal(acceptanceMethod(body), "drawn-signature");
});

test("the SMS opt-in is still optional and still separate from accepting the terms", () => {
  // Not opting in is fine.
  assert.equal(validateAgreementSubmission(submission()), null);
  // Opting in with a reachable number is fine.
  assert.equal(validateAgreementSubmission(submission({ smsConsent: true, alertPhone: "(407) 555-0143" })), null);
  // Opting in does not stand in for accepting the terms.
  assert.match(
    validateAgreementSubmission(submission({ termsAccepted: false, smsConsent: true, alertPhone: "(407) 555-0143" })) ?? "",
    /Terms of Service/,
  );
  // Consent pointing at nothing, or at a site with no receptionist, is still refused.
  assert.ok(validateAgreementSubmission(submission({ smsConsent: true, alertPhone: "12" })));
  assert.ok(
    validateAgreementSubmission(submission({ plan: "starter", receptionistMode: "declined", smsConsent: true, alertPhone: "(407) 555-0143" })),
  );
});
