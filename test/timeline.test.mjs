/**
 * The customer timeline's shaping.
 *
 * The old list said what happened and left out who did it: "2 messages", "Moved to Quoted",
 * "Rosalind called — 3m 42s". An owner opening a record wants to know whether the customer
 * chased them or they chased the customer, and that was the one thing the list never said.
 *
 * All of the new reading is decided here, in pure functions, so it is testable away from React
 * — which is also why the component stayed thin enough to be worth reading.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    buildTimeline,
    dayHeading,
    entryKindLabel,
    entryTitle,
    kindLabel,
} from "../app/lib/timeline.ts";

const NAME = "Rosalind Mackay";
/** A Tuesday, so the weekday assertions mean something. */
const NOW = new Date("2026-11-03T18:00:00Z");

const ev = (o) => ({
    id: "e1",
    kind: "call",
    at: "2026-11-03T14:18:00Z",
    summary: "something happened",
    actor: "customer",
    ...o,
});

/* ── who did what ─────────────────────────────────────────────────────────── */

test("every entry names the actor", () => {
    const call = ev({ kind: "call", actor: "customer" });
    const form = ev({ kind: "web-form", actor: "customer" });
    const out = ev({ kind: "sms-out", actor: "client" });
    const incoming = ev({ kind: "sms-in", actor: "customer" });

    assert.equal(entryTitle(call, [call], NAME), "Rosalind Mackay called you");
    assert.equal(entryTitle(form, [form], NAME), "Rosalind Mackay sent an enquiry from your website");
    assert.equal(entryTitle(out, [out], NAME), "You texted Rosalind Mackay");
    assert.equal(entryTitle(incoming, [incoming], NAME), "Rosalind Mackay texted you");
});

test("a conversation says who started it", () => {
    // "2 messages" was true and useless. Who opened the exchange is the useful half.
    const mine = ev({ id: "a", kind: "sms-out", actor: "client", at: "2026-11-03T14:41:00Z" });
    const theirs = ev({ id: "b", kind: "sms-in", actor: "customer", at: "2026-11-03T14:44:00Z" });

    assert.equal(entryTitle(theirs, [mine, theirs], NAME), "You texted, Rosalind Mackay replied");
    assert.equal(entryTitle(mine, [theirs, mine], NAME), "Rosalind Mackay texted, you replied");
});

test("a stage change says who moved them, and where to", () => {
    // Stored as "Moved to Quoted", which leaves out that the client did it themselves.
    const moved = ev({
        kind: "stage-change",
        actor: "client",
        summary: "Moved to Quoted",
        meta: { from: "contacted", to: "quoted" },
    });

    assert.equal(entryTitle(moved, [moved], NAME), "You moved Rosalind Mackay to Quoted");
});

test("a stage change with no destination falls back to what was stored", () => {
    // Older records predate the meta. Better the stored sentence than an invented one.
    const moved = ev({ kind: "stage-change", actor: "client", summary: "Moved to Quoted", meta: {} });

    assert.equal(entryTitle(moved, [moved], NAME), "Moved to Quoted");
});

test("sentences the server already writes whole are left alone", () => {
    // The review request and notes are written closer to the event than this is.
    const review = ev({
        kind: "review-request",
        actor: "client",
        summary: "You asked Rosalind Mackay for a Google review",
    });
    const note = ev({ kind: "note", actor: "client", summary: "Added to your customers from your inbox" });

    assert.equal(entryTitle(review, [review], NAME), "You asked Rosalind Mackay for a Google review");
    assert.equal(entryTitle(note, [note], NAME), "Added to your customers from your inbox");
});

test("a nameless customer still reads as English", () => {
    const call = ev({ kind: "call" });
    const out = ev({ kind: "sms-out", actor: "client" });

    assert.equal(entryTitle(call, [call], null), "They called you");
    assert.equal(entryTitle(out, [out], ""), "You texted they");
});

test("every kind has a word, so no meaning rests on an icon", () => {
    assert.equal(kindLabel("call"), "Call");
    assert.equal(kindLabel("web-form"), "Web lead");
    assert.equal(kindLabel("sms-in"), "Texts");
    assert.equal(kindLabel("sms-out"), "Texts");
    assert.equal(kindLabel("review-request"), "Review");
    assert.equal(kindLabel("stage-change"), "Stage");
    assert.equal(kindLabel("note"), "Note");
});

/* ── days ─────────────────────────────────────────────────────────────────── */

test("days carry a weekday, because a weekday places an event", () => {
    // The header used to be "2 NOVEMBER" in grey mono capitals.
    const today = dayHeading("2026-11-03T14:00:00Z", NOW);
    assert.equal(today.label, "Today");
    assert.match(today.detail, /Tuesday/);

    const yesterday = dayHeading("2026-11-02T14:00:00Z", NOW);
    assert.equal(yesterday.label, "Yesterday");
    assert.match(yesterday.detail, /Monday/);

    const older = dayHeading("2026-11-01T14:00:00Z", NOW);
    assert.equal(older.label, "Sunday", "past yesterday the weekday is the label");
    assert.match(older.detail, /November/);
});

test("an unreadable date is grouped rather than dropped", () => {
    const heading = dayHeading("not-a-date", NOW);
    assert.equal(heading.key, "unknown");
    assert.equal(heading.label, "Earlier");
});

/* ── the whole thing ──────────────────────────────────────────────────────── */

test("the timeline groups by day, newest first, and collapses a conversation", () => {
    const days = buildTimeline(
        [
            ev({ id: "call1", kind: "call", actor: "customer", at: "2026-11-01T14:18:00Z" }),
            ev({ id: "sms1", kind: "sms-out", actor: "client", at: "2026-11-03T14:41:00Z" }),
            ev({ id: "sms2", kind: "sms-in", actor: "customer", at: "2026-11-03T14:44:00Z" }),
            ev({
                id: "stage",
                kind: "stage-change",
                actor: "client",
                at: "2026-11-03T15:02:00Z",
                summary: "Moved to Quoted",
                meta: { to: "quoted" },
            }),
        ],
        NAME,
        NOW,
    );

    assert.deepEqual(
        days.map((d) => d.label),
        ["Today", "Sunday"],
        "newest day first",
    );

    const [today, sunday] = days;
    assert.deepEqual(
        today.entries.map((e) => e.title),
        ["You moved Rosalind Mackay to Quoted", "You texted, Rosalind Mackay replied"],
    );
    // Two texts became one row.
    assert.equal(today.entries[1].run.length, 2);
    assert.deepEqual(today.entries[1].run.map((e) => e.id), ["sms1", "sms2"], "oldest first inside a thread");
    assert.deepEqual(sunday.entries.map((e) => e.title), ["Rosalind Mackay called you"]);
});

test("only texts collapse, and only against texts", () => {
    // Two calls an hour apart are two calls: each has its own summary and its own recording,
    // and merging them would hide one.
    const days = buildTimeline(
        [
            ev({ id: "c1", kind: "call", at: "2026-11-03T14:00:00Z" }),
            ev({ id: "c2", kind: "call", at: "2026-11-03T15:00:00Z" }),
        ],
        NAME,
        NOW,
    );

    assert.equal(days[0].entries.length, 2);
});

test("a text separated by a call does not join the conversation above it", () => {
    const days = buildTimeline(
        [
            ev({ id: "s1", kind: "sms-out", actor: "client", at: "2026-11-03T16:00:00Z" }),
            ev({ id: "call", kind: "call", at: "2026-11-03T15:00:00Z" }),
            ev({ id: "s2", kind: "sms-in", actor: "customer", at: "2026-11-03T14:00:00Z" }),
        ],
        NAME,
        NOW,
    );

    assert.deepEqual(
        days[0].entries.map((e) => e.run.length),
        [1, 1, 1],
        "the call between them keeps the two texts apart",
    );
});

test("a conversation is inbound when the customer said anything in it", () => {
    /**
     * The marker is filled for inbound. A thread where the client wrote last but the customer
     * also wrote must still read as inbound — an unanswered reply is the single thing in a
     * record most worth noticing, and it must not be hidden by the client having spoken since.
     */
    const days = buildTimeline(
        [
            ev({ id: "s1", kind: "sms-out", actor: "client", at: "2026-11-03T14:00:00Z" }),
            ev({ id: "s2", kind: "sms-in", actor: "customer", at: "2026-11-03T14:30:00Z" }),
            ev({ id: "s3", kind: "sms-out", actor: "client", at: "2026-11-03T15:00:00Z" }),
        ],
        NAME,
        NOW,
    );

    const thread = days[0].entries[0];
    assert.equal(thread.run.length, 3);
    assert.equal(thread.inbound, true);
    assert.match(thread.timeLabel, / – /, "a conversation shows the span, not one instant");
});

test("a single event shows one time, not a span of itself", () => {
    const days = buildTimeline([ev({ id: "c1", kind: "call", at: "2026-11-03T14:18:00Z" })], NAME, NOW);

    assert.ok(!days[0].entries[0].timeLabel.includes("–"), days[0].entries[0].timeLabel);
});

test("an empty history is an empty timeline, not a crash", () => {
    assert.deepEqual(buildTimeline([], NAME, NOW), []);
    assert.deepEqual(buildTimeline([], null, NOW), []);
});

/* ── the actor decides, not the kind ──────────────────────────────────────── */

/**
 * Exactly what `customers/route.ts` writes when an inbox item is promoted: the **source's**
 * kind on a bookkeeping entry, with the client as the actor. Transcribed from that route, not
 * invented — the first version of this test suite used `kind: "note"` here, which is why the
 * bug below survived a browser check.
 */
const promotionEvent = (source) =>
    ev({
        id: "promo",
        kind: source,
        actor: "client",
        summary: "Added to your customers from your inbox",
        at: "2026-11-03T14:52:00Z",
    });

test("promotion keeps its own wording instead of claiming the customer called", () => {
    /**
     * Found by the session mirroring the portal for the homepage, in review of this change.
     *
     * `entryTitle` switched on kind before anything else, so an entry stored as `kind: "call"`
     * with `actor: "client"` rendered as "Robert Ochoa called you", chipped "Call", and drawn
     * outlined as something the client did — a sentence and a marker contradicting each other,
     * with "Added to your customers from your inbox" thrown away.
     */
    const call = promotionEvent("call");
    const form = promotionEvent("web-form");

    assert.equal(entryTitle(call, [call], NAME), "Added to your customers from your inbox");
    assert.equal(entryTitle(form, [form], NAME), "Added to your customers from your inbox");
});

test("a promotion is chipped Added, never Call", () => {
    // "Call" beside "Added to your customers from your inbox" is worse than no chip.
    assert.equal(entryKindLabel(promotionEvent("call")), "Added");
    assert.equal(entryKindLabel(promotionEvent("web-form")), "Added");
});

test("a real call is still a call, and still reads as inbound", () => {
    // The guard must not swallow the thing it is guarding: the actor is what differs.
    const real = ev({ kind: "call", actor: "customer" });

    assert.equal(entryTitle(real, [real], NAME), "Rosalind Mackay called you");
    assert.equal(entryKindLabel(real), "Call");
});

test("the promotion row's title and its marker agree", () => {
    // The marker is outlined because the client acted. The title has to say so too.
    const days = buildTimeline([promotionEvent("call")], NAME, NOW);
    const [entry] = days[0].entries;

    assert.equal(entry.inbound, false, "the client did this");
    assert.equal(entry.title, "Added to your customers from your inbox");
    assert.equal(entry.kindLabel, "Added");
});
