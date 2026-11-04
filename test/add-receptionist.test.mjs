/**
 * Website-only clients and the receptionist (D7, approved by Xander 2026-11-04), and a
 * website-only client upgrading to Growth (M7).
 *
 * On the code before this change these fail:
 *   - A website-only client could only email to have the receptionist switched on, though the
 *     Starter contract promises it carries no onboarding fee and nothing tracked the request.
 *   - A website-only Starter upgrading to Growth was never asked how their phone should work, so
 *     the site ended up on Growth with the receptionist still "declined", which onboard.js
 *     refuses to provision.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateAgreementSubmission } from "../app/lib/agreement-validate.mjs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const base = {
  plan: "starter",
  clientLegalName: "Acme Plumbing LLC",
  clientEntityType: "LLC",
  clientAddress: "1 Main St, Orlando FL",
  signerName: "Ann Acme",
  signerTitle: "Owner",
  signerEmail: "ann@acme.test",
  additionalSites: [],
  termsAccepted: true,
  pageOpenedAt: "2026-11-04T10:00:00.000Z",
  scrollCompletedAt: "2026-11-04T10:02:00.000Z",
};

test("switching the receptionist on needs a real phone choice, never website-only again", () => {
  assert.equal(
    validateAgreementSubmission({ ...base, receptionistSlug: "acme", receptionistMode: "declined" }),
    "Please choose how your phone should be handled",
  );
  assert.equal(validateAgreementSubmission({ ...base, receptionistSlug: "acme", receptionistMode: "published" }), null);
});

test("the Call Log panel offers the switch-on, with the approved wording", () => {
  const panel = read("app/components/portal/ui/FeatureState.tsx");
  assert.ok(
    panel.includes(
      "Your plan includes an AI receptionist on a dedicated business number — it answers when you can't, and every call is logged here with who rang and what they wanted. You started website-only, and you can switch it on here at no extra cost.",
    ),
  );
  assert.match(panel, /href=\{addReceptionistHref\(siteSlug\)\}/);
  assert.match(panel, />\s*Switch it on\s*</);
  assert.doesNotMatch(panel, /Add%20my%20AI%20receptionist/);
  const strip = read("app/components/portal/HealthStrip.tsx");
  assert.match(strip, /href=\{addReceptionistHref\(slug\)\}/);
});

test("the switch-on errors say exactly what Xander approved", async () => {
  const copy = await import("../app/lib/plan-change-copy.ts");
  assert.equal(
    copy.RECEPTIONIST_FAILED,
    "We couldn't switch on your receptionist, and nothing has changed. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
  assert.equal(
    copy.RECEPTIONIST_SESSION_EXPIRED,
    "Your session expired while signing. Your agreement is saved. Please sign in and try again.",
  );
});

test("the switch-on charges nothing, records the choice and tells Xander", () => {
  const route = read("app/api/portal/receptionist/route.ts");
  assert.doesNotMatch(route, /stripe/i);
  assert.match(route, /receptionistMode: mode/);
  assert.match(route, /sendOpsNotice\(/);
  assert.match(route, /!acceptedBy\(agreement, account\)/);
  assert.match(route, /masterAgreement: masterRefFor\(agreement\)/);
});

test("a website-only upgrade to Growth asks for, and records, the phone choice", () => {
  const page = read("app/agreement/page.tsx");
  assert.match(page, /askPhoneChoice = isWebOnly\(site\)/);
  const route = read("app/api/portal/upgrade/route.ts");
  assert.match(route, /webOnly && phoneMode !== "forwarded" && phoneMode !== "published"/);
  assert.match(route, /\.\.\.\(webOnly \? \{ receptionistMode: phoneMode \} : \{\}\)/);
});
