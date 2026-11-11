import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import {
    NEXT_STREAMED_REDIRECT_META_ID,
    shouldAutoLaunchTour,
    streamedRedirectPending,
} from "../app/components/portal/tour/auto-launch.ts";

/**
 * The first-run tour crashed the portal for a client whose only site was pending onboarding.
 *
 * Seen three times on 2026-11-11: "Finish later" in the wizard loads `/portal`, the Overview
 * calls `redirect()` to the wizard after the layout has streamed (so the response is a 200 with
 * Next's refresh tag), and the tour auto-launched as the shell mounted and pushed
 * `/portal/calls?tour=1`. With the refresh tag in the document Next makes that push a hard
 * navigation, and the two navigations together crash Next's root router with "Rendered more
 * hooks than during the previous render". The root router sits above every error boundary, so
 * the client got the black "This page couldn't load" screen, then a reload into the wizard.
 *
 * Reproduced in the browser against a copy of the shell: the crash on every run with the tour
 * auto-launching, none with it off, and none with either rule below on its own.
 */

const base = { tourCompleted: false, siteStatus: "live", redirectPending: false };

test("the tour auto-launches for a first visit to a page that stays put", () => {
    assert.equal(shouldAutoLaunchTour(base), true);
    assert.equal(shouldAutoLaunchTour({ ...base, siteStatus: "building" }), true);
});

test("a completed tour never auto-launches", () => {
    assert.equal(shouldAutoLaunchTour({ ...base, tourCompleted: true }), false);
});

test("the tour does not auto-launch for a site still in onboarding", () => {
    assert.equal(shouldAutoLaunchTour({ ...base, siteStatus: "pending-onboarding" }), false);
});

test("the tour does not auto-launch while the page is redirecting", () => {
    assert.equal(shouldAutoLaunchTour({ ...base, redirectPending: true }), false);
});

test("a pending redirect is read from Next's refresh tag", () => {
    const withTag = { getElementById: (id) => (id === NEXT_STREAMED_REDIRECT_META_ID ? {} : null) };
    const without = { getElementById: () => null };
    assert.equal(streamedRedirectPending(withTag), true);
    assert.equal(streamedRedirectPending(without), false);
});

/**
 * The redirect rule reads a Next internal. If an upgrade renamed the tag, the guard would go
 * quiet and the crash would come back, so check the installed Next still writes it and still
 * turns navigations into hard ones while it is present.
 */
test("the installed Next still streams the refresh tag the guard looks for", () => {
    const require = createRequire(import.meta.url);
    const nextDist = dirname(require.resolve("next/dist/server/app-render/make-get-server-inserted-html.js"));
    const inserted = readFileSync(join(nextDist, "make-get-server-inserted-html.js"), "utf8");
    assert.match(inserted, new RegExp(`id: "${NEXT_STREAMED_REDIRECT_META_ID}",\\s*httpEquiv: "refresh"`));

    const reducer = readFileSync(
        require.resolve("next/dist/client/components/router-reducer/reducers/navigate-reducer.js"),
        "utf8",
    );
    assert.match(
        reducer,
        new RegExp(`getElementById\\('${NEXT_STREAMED_REDIRECT_META_ID}'\\)\\)\\s*\\{\\s*return [^;]*completeHardNavigation`),
    );
});

/** Code only, so a comment naming a pattern can't satisfy the check. */
function code(path) {
    return readFileSync(path, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
}

test("the tour's auto-launch goes through the rule, with the live redirect state", () => {
    const tour = code("app/components/portal/tour/TourController.tsx");
    const effect = tour.slice(tour.indexOf("if (startedRef.current) return;"));
    assert.ok(effect.length < tour.length, "TourController has no auto-launch effect");
    const gate = effect.indexOf("shouldAutoLaunchTour(");
    const launch = effect.indexOf("void start(initialStep)");
    assert.ok(gate >= 0 && launch > gate, "auto-launch must be decided by shouldAutoLaunchTour first");
    assert.match(effect.slice(gate, launch), /redirectPending:\s*streamedRedirectPending\(document\)/);
    assert.match(effect.slice(gate, launch), /siteStatus/);
});

test("the shell tells the tour which site it is showing", () => {
    const chrome = code("app/components/portal/PortalChrome.tsx");
    assert.match(chrome, /<TourController[^>]*siteStatus=\{selected\.status\}/);
});
