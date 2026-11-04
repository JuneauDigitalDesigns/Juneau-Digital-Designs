/**
 * A2P identity — the draft-store half of the retention tests, and the strip itself.
 *
 * A2P registration moved to the operator console in jdd-ops (`PLAN-console-a2p-registration.md`,
 * decision 7): the operator types the EIN and the authorized representative's details there, one
 * request per Twilio call. The vendor half of this suite — the EIN reaching exactly one Twilio
 * request, the vendor-error scrub, the rollback, the validators — moved there with the code it
 * covers. What stays here is what this repo still owns: the two draft writers and their guard.
 *
 * **Preventive, and deliberately so.** An EIN written to a draft store is silent, permanent and
 * unrecoverable. There is no EIN field left in the wizard, which is exactly when a tripwire is
 * cheapest to keep and easiest to delete by accident.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { findTaxIdPaths, looksLikeTaxId } from "../app/lib/tax-id-guard.mjs";

const EIN = "47-1234567";

const sourceOf = (relative) =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

/** Every source file under app/, as [repo-relative path, contents]. */
function appSources() {
    const root = fileURLToPath(new URL("../app/", import.meta.url));
    const out = [];
    const walk = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = join(dir, name);
            if (statSync(full).isDirectory()) walk(full);
            else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push([relative(root, full).split(sep).join("/"), readFileSync(full, "utf8")]);
        }
    };
    walk(root);
    return out;
}

// ── The strip: this site collects no EIN and talks to no Trust Hub ──────────

test("no code in app/ calls Twilio Trust Hub or the old identity route", () => {
    // What this removes from production: the client's onboarding wizard collected an EIN and
    // a representative's details and sent them to Twilio from this site, with no operator
    // between the typing and the filing. Registration is the console's now. A Trust Hub URL anywhere in app/ means a
    // second registration path has grown back.
    const files = appSources();
    assert.ok(files.length > 50, "the walk found too little of app/ to be meaningful");
    for (const [path, src] of files) {
        assert.doesNotMatch(src, /trusthub\.twilio\.com/, `${path} calls Twilio Trust Hub`);
        assert.doesNotMatch(src, /\/api\/onboarding\/a2p-identity/, `${path} references the removed identity route`);
    }
});

test("the onboarding wizard has no business-registration step and no EIN field", () => {
    const wizard = sourceOf("../app/components/onboarding/onboardingpageclient.tsx");
    assert.doesNotMatch(wizard, /key:\s*"a2p"/, "the A2P step is back in the step list");
    assert.doesNotMatch(wizard, /placeholder="12-3456789"/, "an EIN input is back in the wizard");
    assert.doesNotMatch(wizard, /\bein:\s*["'`]/, "wizard state holds an `ein` field again");
});

// ── The draft path: Redis (30-day TTL) and localStorage (no expiry in practice) ──

test("the draft guard catches an EIN under any field name, at any depth", () => {
    // The point of a value-shape check rather than a key denylist: a denylist is one rename
    // away from leaking, and these are the renames.
    const drafts = [
        { ein: EIN },
        { taxId: EIN },
        { a2p: { businessRegistrationNumber: EIN } },
        { answers: [{ label: "EIN", value: EIN }] },
        { notes: `our EIN is ${EIN}, thanks` },
    ];
    for (const draft of drafts) {
        assert.notDeepEqual(findTaxIdPaths(draft), [], `missed an EIN in ${JSON.stringify(draft)}`);
    }
});

test("the draft guard does not fire on the data a real wizard draft holds", () => {
    // A tripwire that fires on ordinary data is a tripwire somebody switches off. The
    // handoff's `\d{2}-?\d{7}` would match inside every 10-digit phone number here.
    const draft = {
        brandName: "Arthur's Plumbing",
        phone: "4075551234",
        phonePretty: "(407) 555-1234",
        altPhone: "+1 407-555-1234",
        address: "1200 Main St, Orlando FL 32801-5123",
        zipPlusFour: "32801-5123",
        reviewCount: "180",
        statValues: { jobs: "12000", years: "15" },
        serviceList: [{ name: "Drain cleaning", tag: "Repair" }],
        currentStep: 4,
        savedAt: "2026-10-30T00:00:00.000Z",
    };
    assert.deepEqual(findTaxIdPaths(draft), []);
    assert.equal(looksLikeTaxId("4075551234"), false);
    assert.equal(looksLikeTaxId("32801-5123"), false);
    assert.equal(looksLikeTaxId("555-1234"), false);
    assert.equal(looksLikeTaxId(EIN), true);
});

test("both draft writers consult the guard before writing", () => {
    // A runtime guard nothing calls is decoration. These assert the wiring, so removing
    // either call fails the suite rather than quietly removing the protection.
    const route = sourceOf("../app/api/portal/onboarding/draft/route.ts");
    assert.match(route, /findTaxIdPaths\(body\.data\)/, "the Redis draft route must check the payload");
    assert.ok(
        route.indexOf("findTaxIdPaths") < route.indexOf("saveDraft(ctx.userId"),
        "the check must come before the write",
    );

    const wizard = sourceOf("../app/components/onboarding/onboardingpageclient.tsx");
    const autosave = wizard.slice(
        wizard.indexOf("── Draft autosave"),
        wizard.indexOf("// After success (non-portal mode)"),
    );
    assert.ok(autosave.length > 0, "could not locate the autosave effect");
    assert.match(autosave, /findTaxIdPaths\(record\)/, "the localStorage writer must check the record");
    assert.ok(
        autosave.indexOf("findTaxIdPaths") < autosave.indexOf("localStorage.setItem"),
        "the check must come before the localStorage write",
    );
});

test("no A2P identity field is a member of the autosaved WizardState", () => {
    // This is the §3 blocker itself: the wizard's state type is what gets autosaved, in full, to
    // Redis for 30 days and to localStorage. If someone ever adds an identity field to it (to make
    // it survive a reload, which is the tempting change) this fails. The type moved from
    // `WizardData` in onboardingpageclient.tsx to `WizardState` in wizard/model.ts with the
    // Build-along redesign; the check is unchanged.
    const wizard = sourceOf("../app/components/onboarding/wizard/model.ts");
    const start = wizard.indexOf("export type WizardState = {");
    assert.ok(start > -1, "could not find the WizardState declaration");
    const body = wizard.slice(start, wizard.indexOf("\n};", start));

    for (const field of [
        "ein",
        "legalBusinessName",
        "businessType",
        "businessIndustry",
        "registrationPath",
        "repEmail",
        "repPhone",
        "repFirstName",
        "repLastName",
        "postalCode",
    ]) {
        assert.doesNotMatch(
            body,
            new RegExp(`(^|[^A-Za-z])${field}\\s*:`, "m"),
            `${field} must not be a WizardState member — it would be autosaved to both draft stores`,
        );
    }
});
