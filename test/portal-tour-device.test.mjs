/**
 * The portal tour plays once per person per kind of device (Xander, 19 Nov 2026): "it only does
 * it once the very first time that the user lands on the portal. Does it once for the desktop and
 * once for the mobile for every user."
 *
 * `app/lib/portal-tour-seen.ts` holds the whole rule, as pure functions over the Clerk metadata,
 * so it is tested here directly, together with the auto-launch gate that reads it.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { nextTour, readTour, tourDeviceFor, isTourDevice } from "../app/lib/portal-tour-seen.ts";
import { shouldAutoLaunchTour } from "../app/components/portal/tour/auto-launch.ts";

const NOW = "2026-11-19T15:00:00.000Z";
const LATER = "2026-11-20T09:00:00.000Z";
const firstVisit = (completed) => shouldAutoLaunchTour({ tourCompleted: completed, siteStatus: "live", redirectPending: false });

test("a new person gets the tour on a computer and on a phone", () => {
    const t = readTour(undefined);
    assert.equal(firstVisit(t.desktop.completed), true);
    assert.equal(firstVisit(t.mobile.completed), true);
});

test("finishing it on a phone doesn't stop it on the computer, and the other way round", () => {
    const afterPhone = readTour(nextTour(undefined, { device: "mobile", completed: true }, NOW));
    assert.equal(firstVisit(afterPhone.mobile.completed), false, "phone seen");
    assert.equal(firstVisit(afterPhone.desktop.completed), true, "computer still to come");

    const afterBoth = readTour(nextTour(nextTour(undefined, { device: "mobile", completed: true }, NOW), { device: "desktop", completed: true }, LATER));
    assert.equal(firstVisit(afterBoth.desktop.completed), false);
    assert.equal(firstVisit(afterBoth.mobile.completed), false);
});

test("a second phone, or a new browser, does not get it again: it follows the person, not the browser", () => {
    // The flag is the person's (Clerk metadata), so any phone reads the same "seen".
    const stored = nextTour(undefined, { device: "mobile", completed: true }, NOW);
    assert.equal(readTour(JSON.parse(JSON.stringify(stored))).mobile.completed, true);
});

test("seen never goes back to unseen: a stray false, a later step write or a replay leaves it seen", () => {
    let s = nextTour(undefined, { device: "desktop", completed: true, step: 9 }, NOW);
    s = nextTour(s, { device: "desktop", completed: false }, LATER);
    s = nextTour(s, { device: "desktop", step: 2 }, LATER);
    assert.equal(readTour(s).desktop.completed, true);
    assert.equal(readTour(s).desktop.at, NOW, "first completion time is kept");
});

test("an interrupted tour picks up at its step, on that device only", () => {
    const s = nextTour(undefined, { device: "mobile", step: 7 }, NOW);
    const t = readTour(s);
    assert.equal(t.mobile.step, 7);
    assert.equal(t.mobile.completed, false);
    assert.equal(t.desktop.step, 0, "the computer starts from the top");
});

test("a write from one device never touches the other's flag", () => {
    const s = nextTour(nextTour(undefined, { device: "desktop", completed: true, step: 30 }, NOW), { device: "mobile", step: 3 }, LATER);
    assert.deepEqual(readTour(s).desktop, { completed: true, step: 30, at: NOW });
});

test("the old tours' fields are ignored and dropped: nobody is skipped", () => {
    const legacy = { completed: true, lastStepIndex: 8, seen: ["inbox", "overview"] };
    const t = readTour(legacy);
    assert.equal(t.desktop.completed, false);
    assert.equal(t.mobile.completed, false);
    const s = nextTour(legacy, { device: "desktop", step: 1 }, NOW);
    assert.deepEqual(Object.keys(s).sort(), ["desktop", "mobile", "updatedAt"]);
});

test("junk in the metadata reads as not seen, and a junk step is not stored", () => {
    assert.deepEqual(readTour({ desktop: "yes", mobile: { completed: "true", step: -4 } }), {
        desktop: { completed: false, step: 0 },
        mobile: { completed: false, step: 0 },
    });
    assert.equal(readTour(nextTour(undefined, { device: "mobile", step: 1e9 }, NOW)).mobile.step, 0);
});

test("the phone layout is the phone; anything else is the computer; nothing else is a device", () => {
    assert.equal(tourDeviceFor(true), "mobile");
    assert.equal(tourDeviceFor(false), "desktop");
    assert.equal(isTourDevice("mobile"), true);
    assert.equal(isTourDevice("tablet"), false);
    assert.equal(isTourDevice(undefined), false);
});

test("the first-visit start still waits for a site that is being set up, and for a redirecting page", () => {
    assert.equal(shouldAutoLaunchTour({ tourCompleted: false, siteStatus: "pending-onboarding", redirectPending: false }), false);
    assert.equal(shouldAutoLaunchTour({ tourCompleted: false, siteStatus: "live", redirectPending: true }), false);
});
