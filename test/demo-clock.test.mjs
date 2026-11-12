/**
 * The pausable clock behind the homepage films (`app/components/home/demo-clock.ts`).
 *
 * Xander's rule (2026-11-12): a click pauses a demo, and the next click resumes it from exactly
 * where it stopped. Every pause in a film's script is a `wait` on this clock, so these tests are
 * the rule: time spent paused never counts, and a resumed wait runs only what it had left.
 *
 * Run: `npm test`
 */

import { test, mock } from "node:test";
import assert from "node:assert/strict";

import { createDemoClock } from "../app/components/home/demo-clock.ts";

/** Lets settled promises run their callbacks. */
const flush = () => new Promise((r) => setImmediate(r));

function withClock(fn) {
    return async () => {
        mock.timers.enable({ apis: ["setTimeout", "Date"] });
        try {
            await fn();
        } finally {
            mock.timers.reset();
        }
    };
}

test(
    "a wait resolves once its time has run",
    withClock(async () => {
        const clock = createDemoClock();
        let done = false;
        clock.wait(1000).then(() => (done = true));
        mock.timers.tick(999);
        await flush();
        assert.equal(done, false);
        mock.timers.tick(1);
        await flush();
        assert.equal(done, true);
    }),
);

test(
    "time spent paused does not count, and resume runs only what was left",
    withClock(async () => {
        const clock = createDemoClock();
        let done = false;
        clock.wait(1000).then(() => (done = true));
        mock.timers.tick(400);
        clock.pause();
        mock.timers.tick(5000);
        await flush();
        assert.equal(done, false, "a paused wait must not resolve");
        assert.equal(clock.paused, true);
        clock.resume();
        mock.timers.tick(599);
        await flush();
        assert.equal(done, false, "600ms were left, not 1000");
        mock.timers.tick(1);
        await flush();
        assert.equal(done, true);
    }),
);

test(
    "a wait started while paused starts counting on resume",
    withClock(async () => {
        const clock = createDemoClock();
        clock.pause();
        let done = false;
        clock.wait(300).then(() => (done = true));
        mock.timers.tick(10000);
        await flush();
        assert.equal(done, false);
        clock.resume();
        mock.timers.tick(300);
        await flush();
        assert.equal(done, true);
    }),
);

test(
    "elapsed() is film time: it stops while paused",
    withClock(async () => {
        const clock = createDemoClock();
        mock.timers.tick(250);
        clock.pause();
        mock.timers.tick(4000);
        assert.equal(clock.elapsed(), 250);
        clock.resume();
        mock.timers.tick(100);
        assert.equal(clock.elapsed(), 350);
    }),
);

test(
    "cancel rejects every pending wait, paused or not, and later waits too",
    withClock(async () => {
        const clock = createDemoClock();
        const a = clock.wait(1000);
        clock.pause();
        const b = clock.wait(1000);
        clock.cancel();
        await assert.rejects(a, /cancelled/);
        await assert.rejects(b, /cancelled/);
        await assert.rejects(clock.wait(10), /cancelled/);
    }),
);

test(
    "pause and resume are idempotent",
    withClock(async () => {
        const clock = createDemoClock();
        let done = false;
        clock.wait(500).then(() => (done = true));
        mock.timers.tick(200);
        clock.pause();
        clock.pause();
        mock.timers.tick(1000);
        clock.resume();
        clock.resume();
        mock.timers.tick(299);
        await flush();
        assert.equal(done, false);
        mock.timers.tick(1);
        await flush();
        assert.equal(done, true);
    }),
);

test(
    "onChange hears every pause and resume, so a film can freeze its CSS with it",
    withClock(async () => {
        const clock = createDemoClock();
        const heard = [];
        clock.onChange((p) => heard.push(p));
        clock.pause();
        clock.pause();
        clock.resume();
        assert.deepEqual(heard, [true, false]);
    }),
);
