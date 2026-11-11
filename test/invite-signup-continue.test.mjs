/**
 * What an invited client sees when they accept their portal invitation (F-F1, front-to-back
 * onboarding test, 2026-11-11).
 *
 * A client closed on a call follows "Set up my login" to `/portal/sign-up?__clerk_ticket=…`. The
 * ticket verifies their email, the sign-up is still missing its password, and Clerk routes to
 * `/portal/sign-up/continue`. That step said "Fill in missing fields / Please fill in the
 * remaining details to continue", when the only thing to do was create a password. On that code
 * the first test fails.
 *
 * Clerk takes localization on the provider only, so the wording reaches every continue step, not
 * just the invitation's. The second test is why that is safe: it rebuilds the continue step's
 * fields the way Clerk's own code does (`@clerk/ui` 1.42.4: drop a verified email, drop the
 * password after a verified OAuth account, then drop every field that isn't required) from the
 * recorded settings of both instances. If a dashboard change ever makes names, a username, a phone
 * or legal consent required at sign-up, the heading would be wrong. Re-record the fixtures after
 * any Clerk sign-up setting change, by saving `user_settings` from
 * `GET https://<frontend-api-host>/v1/environment` (public, no key needed), and this fails.
 *
 * Run: `npm test`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const { clerkLocalization } = await import("../app/portal/clerkAppearance.ts");

const instances = {
    dev: JSON.parse(read("test/fixtures/clerk/environment-dev.json")),
    production: JSON.parse(read("test/fixtures/clerk/environment-production.json")),
};

/** The fields Clerk's continue step shows for a sign-up that arrived `via` a ticket or OAuth. */
function continueStepFields(userSettings, via) {
    const fields = Object.entries(userSettings.attributes)
        .filter(([name, a]) => a.enabled && a.required && name !== "ticket")
        .map(([name]) => name);
    if (userSettings.sign_up.legal_consent_enabled) fields.push("legal_accepted");
    // Both a ticket and an OAuth account arrive with the email verified.
    const shown = fields.filter((f) => f !== "email_address");
    return via === "oauth" ? shown.filter((f) => f !== "password") : shown;
}

test("the invited client's continue step asks them to create a password", () => {
    const step = clerkLocalization.signUp?.continue;
    assert.ok(step, "signUp.continue is not localized: Clerk shows 'Fill in missing fields'");
    assert.notEqual(step.title, "Fill in missing fields");
    assert.match(step.title, /password/i);
    assert.notEqual(step.subtitle, "Please fill in the remaining details to continue.");
    // Reaches the page through the provider; Clerk has no per-component localization.
    assert.match(read("app/portal/layout.tsx"), /localization=\{clerkLocalization\}/);
});

test("on both instances a password is the only thing a continue step can ask for", () => {
    for (const [name, env] of Object.entries(instances)) {
        assert.equal(env.instance_environment_type, name === "dev" ? "development" : "production", name);
        assert.deepEqual(continueStepFields(env.user_settings, "ticket"), ["password"], `${name}, invitation`);
        // An OAuth sign-up is missing nothing, so it never reaches the step this heading is on.
        assert.deepEqual(continueStepFields(env.user_settings, "oauth"), [], `${name}, OAuth`);
    }
});

test("the first sign-up step keeps Clerk's own title, which has no approved string", () => {
    assert.deepEqual(Object.keys(clerkLocalization.signUp ?? {}), ["continue"]);
});
