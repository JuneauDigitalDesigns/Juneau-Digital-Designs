/**
 * "Finish later" (finding F-B1b, end-to-end test 2026-11-10). A client whose only site was still
 * being set up had nowhere to go: /portal sent them straight back to the wizard. Xander,
 * 2026-11-11: go to another set-up site's dashboard if there is one, otherwise show a "Saved"
 * screen in the wizard with Keep going and Sign out.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FINISH_LATER, SIGNED_OUT_URL, finishLaterTarget } from "../app/components/onboarding/wizard/finish-later.ts";

test("only site, still being set up: no dashboard to go to", () => {
    assert.equal(finishLaterTarget([{ slug: "ridgeline", status: "pending-onboarding" }], "ridgeline"), null);
});

test("another site already set up: its dashboard", () => {
    const sites = [{ slug: "ridgeline", status: "pending-onboarding" }, { slug: "ridgeline-plumbing", status: "live" }];
    assert.equal(finishLaterTarget(sites, "ridgeline"), "ridgeline-plumbing");
    assert.equal(finishLaterTarget([{ slug: "a", status: "building" }, { slug: "b", status: "pending-onboarding" }], "b"), "a", "a site being built has a dashboard");
});

test("other sites that are also pending don't count", () => {
    const sites = [{ slug: "a", status: "pending-onboarding" }, { slug: "b", status: "pending-onboarding" }];
    assert.equal(finishLaterTarget(sites, "a"), null);
});

test("the approved wording, word for word (F1 to F3)", () => {
    assert.equal(FINISH_LATER.savedHeading, "Your answers are saved");
    assert.equal(FINISH_LATER.savedBody, "Come back any time, on any device. Sign in at juneaudigitaldesigns.com/portal and you'll pick up right where you left off.");
    assert.equal(FINISH_LATER.keepGoing, "Keep going");
    assert.equal(FINISH_LATER.signOut, "Sign out");
    assert.equal(SIGNED_OUT_URL, "/");
});

test("the wizard no longer sends Finish later to bare /portal", () => {
    const src = readFileSync(new URL("../app/components/onboarding/onboardingpageclient.tsx", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("const finishLater"), src.indexOf("// ── Render ──"));
    assert.ok(fn.length > 0, "finishLater exists");
    assert.doesNotMatch(fn, /assign\("\/portal"\)/, "bare /portal bounces a pending site back to the wizard");
    assert.match(fn, /finishLaterTarget|otherSiteSlug/);
});

test("the onboarding page tells the wizard about another set-up site", () => {
    const src = readFileSync(new URL("../app/portal/onboarding/page.tsx", import.meta.url), "utf8");
    assert.match(src, /finishLaterTarget\(/);
    assert.match(src, /otherSiteSlug=/);
});
