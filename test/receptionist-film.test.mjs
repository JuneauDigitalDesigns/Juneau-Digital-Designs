/**
 * The receptionist film on the homepage (`SiteToCallPanel`, data in `app/data/switchboard-calls.ts`).
 *
 * Retold on 12 Nov 2026 (Xander, storyboard approved word for word): it plays the Starter story
 * first, a customer calling the number on the site, and offers the Growth story after, the form
 * and the callback. These pin what has to stay true of it:
 *   - every call opens the way the real agents do, by saying the call is recorded (MSA v5.4:
 *     "every agent states that the call is recorded as its first line");
 *   - the words on screen are the approved ones, with no dashes;
 *   - the owner's text is the real alert template, never a nicer one;
 *   - the phone number the cursor taps is where the capture has it.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FILM_CALL, FILM_CALL_IN, FILM_COPY, FILM_SITE } from "../app/data/switchboard-calls.ts";

test("both calls open with the AI saying the call is recorded", () => {
    for (const call of [FILM_CALL_IN, FILM_CALL]) {
        assert.equal(call.transcript[0].role, "AI");
        assert.match(call.transcript[0].text, /This call is recorded\./);
    }
});

test("the Starter call is the approved transcript, word for word", () => {
    assert.deepEqual(FILM_CALL_IN.transcript, [
        { role: "AI", text: "Thanks for calling Your HVAC Co. This call is recorded. How can I help?" },
        { role: "CALLER", text: "Furnace quit overnight and the house is down to 58. Two kids at home." },
        { role: "AI", text: "I'm sorry to hear that. Can I get your name and the best number to reach you?" },
        { role: "CALLER", text: "Dave Kowalski. This number's fine." },
        { role: "AI", text: "Got it, Dave. I've marked this urgent, and the team will reach you first thing in the morning." },
    ]);
});

test("the Growth callback keeps its approved lines, with the recording notice in the first", () => {
    assert.equal(
        FILM_CALL.transcript[0].text,
        "Hi Dave, it's Your HVAC Co. You just asked for an estimate on our website. This call is recorded. What's going on with your system?",
    );
    assert.equal(FILM_CALL.transcript.length, 3);
});

test("the on-screen words are the approved ones", () => {
    assert.deepEqual(FILM_COPY, {
        customerSees: "What your customer sees",
        everyPlan: "Every plan",
        onGrowth: "On Growth",
        calling: "Calling…",
        meanwhile: "Meanwhile, on your phone",
        busy: "You're busy and can't pick up.",
        voicemail: "Normally, that call goes to voicemail",
        instead: "Instead, your receptionist answers",
        backOnYours: "Back on your phone",
        aMinuteLater: "About a minute later",
        callNumber: "Customers can still call your number. They reach you or your AI receptionist.",
        fillForm: "Your customers can also fill out this form, and your AI receptionist calls them back to get their details.",
        starterEnd: "On Growth, your receptionist also calls back every web form lead.",
        seeGrowth: "See how it works on Growth",
        skipToPortal: "Skip to how we capture this lead",
        growthEnd: "Next, see how we capture this lead",
        showMe: "Show me",
        replay: "Replay",
    });
});

test("no dashes in anything the film says", () => {
    const all = [...Object.values(FILM_COPY), ...FILM_CALL.transcript.map((l) => l.text), ...FILM_CALL_IN.transcript.map((l) => l.text)];
    for (const s of all) assert.doesNotMatch(s, /[–—]| - /, s);
});

test("both stories end in the same real alert, about the same lead", () => {
    assert.deepEqual(FILM_CALL_IN.ownerMessage, FILM_CALL.ownerMessage);
    assert.deepEqual(FILM_CALL_IN.caller, FILM_CALL.caller);
});

test("the cursor taps the hero's call button, measured from the capture", () => {
    assert.deepEqual(FILM_SITE.heroCall, { x: 20, y: 402, w: 350, h: 58 });
    // Above the estimate button it sits on top of, in the same column.
    assert.ok(FILM_SITE.heroCall.y + FILM_SITE.heroCall.h < FILM_SITE.heroEstimate.y);
});

test("the film no longer ends on a portal screen of its own: the portal section shows that", () => {
    const src = readFileSync("app/components/home/SiteToCallPanel.tsx", "utf8");
    assert.doesNotMatch(src, /In your portal/);
    assert.doesNotMatch(src, /function InboxScreen/);
    assert.doesNotMatch(src, /Same call/);
});

test("the film's script waits on the pausable clock, never on a bare setTimeout", () => {
    const src = readFileSync("app/components/home/SiteToCallPanel.tsx", "utf8");
    assert.match(src, /createDemoClock/);
    assert.doesNotMatch(src, /setTimeout\(/);
});
