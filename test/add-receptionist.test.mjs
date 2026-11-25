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
    // v1.45.0: website-only is its own plan, so `declined` is refused on any other plan first.
    "Website only is the Starter plan, so please choose Starter instead",
  );
  assert.equal(validateAgreementSubmission({ ...base, receptionistSlug: "acme", receptionistMode: "published" }), null);
});

test("adding the receptionist is the website plan's paid upgrade, not a free switch-on", () => {
  // The old free panel and its "no extra cost" words are retired (copy batch C3, 24 Nov 2026).
  const panel = read("app/components/portal/ui/FeatureState.tsx");
  assert.doesNotMatch(panel, /at no extra cost/);
  assert.doesNotMatch(panel, />\s*Switch it on\s*</);
  assert.doesNotMatch(panel, /addReceptionistHref/);
  // Every "Add the AI receptionist" link goes to the Starter + AI Receptionist agreement, which
  // finishes at the upgrade endpoint.
  const types = read("app/portal/types.ts");
  assert.match(types, /\/terms\/accept\?plan=starter&upgrade=/);
  assert.doesNotMatch(types, /receptionist=\$\{/);
  const health = read("app/components/portal/analytics/SiteHealth.tsx");
  assert.match(health, /href=\{addReceptionistHref\(slug\)\}/);
  assert.match(health, /Add the AI receptionist/);
  assert.doesNotMatch(health, /Add your receptionist/);
});

test("the switch-on errors say exactly what Xander approved", async () => {
  const copy = await import("../app/lib/plan-change-copy.ts");
  assert.equal(
    copy.RECEPTIONIST_FAILED,
    "We couldn't switch on your receptionist, and nothing has changed. Email hello@juneaudigitaldesigns.com and we'll sort it out.",
  );
  assert.equal(
    copy.RECEPTIONIST_SESSION_EXPIRED,
    "Your session expired before you finished. Your acceptance is saved. Please sign in and try again.",
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
  const page = read("app/terms/accept/page.tsx");
  assert.match(page, /askPhoneChoice = isWebOnly\(site\)/);
  const route = read("app/api/portal/upgrade/route.ts");
  assert.match(route, /webOnly && phoneMode !== "forwarded" && phoneMode !== "published"/);
  assert.match(route, /\.\.\.\(webOnly \? \{ receptionistMode: phoneMode \} : \{\}\)/);
});
