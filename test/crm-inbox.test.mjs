/**
 * `buildInbox` — the web-form/callback collapse.
 *
 * This is the one piece of CRM v2 that depends on both inbound sources at once. Everything
 * else in the Inbox reads one store and shapes it; this merges the Airtable call log with the
 * portal's web-form leads and has to recognise when two rows are the *same* enquiry. On
 * Growth, a form submission makes the receptionist ring the submitter back, so one person
 * filling in one form produces a lead row and a call row minutes apart. A list that shows
 * both is a list the client stops trusting, and the function's own comment says exactly that.
 *
 * It shipped untested. It is also pure, so there is no excuse: no clock, no network, no KV —
 * the route fetches and this shapes.
 *
 * Imports the real `.ts` module, via the transpile hooks `npm test` registers (see
 * `ts-transpile.mjs` for why that exists). A test holding its own copy of the matcher would
 * certify the copy.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildInbox, callContactId } from "../app/lib/crm-contacts.ts";

const MIN = 60_000;
/** The window a call still counts as a callback in, mirroring `CALLBACK_WINDOW_MS`. */
const WINDOW = 60 * MIN;

/** A fixed instant, so nothing here depends on when the suite runs. */
const T0 = Date.parse("2026-10-01T12:00:00.000Z");
const at = (offsetMs) => new Date(T0 + offsetMs).toISOString();

const NUMBER = "+19305551234";

/** An Airtable call row. Only the fields the inbox reads are interesting; the rest are real
 *  because `CallRecord` has them and a partial fixture would drift from the shape. */
function call(overrides = {}) {
    return {
        id: "recCall",
        date: at(0),
        callerName: "Ada Byron",
        callerNumber: NUMBER,
        summary: "Asked about a bathroom refit.",
        durationSeconds: 94,
        callType: "inbound",
        outcome: "Qualified",
        site: "arthurs-plumbing",
        email: null,
        address: null,
        recordingUrl: "https://example.test/rec.mp3",
        priority: null,
        ...overrides,
    };
}

/** A web-form lead, submitted ten minutes before `T0` unless a test says otherwise. */
function lead(overrides = {}) {
    return {
        leadId: "L1",
        name: "Ada Byron",
        phone: NUMBER,
        phoneRaw: "930-555-1234",
        email: "ada@example.test",
        message: "Need a quote for a bathroom refit.",
        createdAt: at(-10 * MIN),
        readAt: null,
        callbackPlaced: true,
        ...overrides,
    };
}

const ids = (items) => items.map((i) => i.id);

test("a form lead and the callback it triggered collapse into one item", () => {
    const items = buildInbox({ calls: [call()], leads: [lead()] });

    assert.equal(items.length, 1, "the enquiry and its callback are one entry, not two");

    const [item] = items;
    assert.equal(item.id, "lead:L1");
    assert.equal(item.source, "web-form");
    // The enquiry's own details lead. It is what the client's customer actually wrote.
    assert.equal(item.preview, "Need a quote for a bathroom refit.");
    assert.equal(item.at, at(-10 * MIN));

    // The call is nested, not merged: its summary, length and recording stay attributable to
    // the call rather than being read as properties of the form submission.
    assert.deepEqual(item.callback, {
        at: at(0),
        durationSeconds: 94,
        summary: "Asked about a bathroom refit.",
        recordingUrl: "https://example.test/rec.mp3",
    });
    assert.equal(item.durationSeconds, null);
    assert.equal(item.recordingUrl, null);
});

test("a form lead with no callback stays its own item", () => {
    const items = buildInbox({ calls: [], leads: [lead()] });

    assert.deepEqual(ids(items), ["lead:L1"]);
    assert.equal(items[0].callback, null);
});

test("a call with no matching form lead stays its own item", () => {
    const items = buildInbox({ calls: [call()], leads: [] });

    assert.deepEqual(ids(items), ["recCall"]);
    assert.equal(items[0].source, "call");
    assert.equal(items[0].callback, null);
    assert.equal(items[0].durationSeconds, 94);
    assert.equal(items[0].recordingUrl, "https://example.test/rec.mp3");
});

test("a call from a number with no lead at all is matched on nothing", () => {
    // Different number, same minute. Proximity in time must not be enough on its own.
    const items = buildInbox({
        calls: [call({ callerNumber: "+19305559999" })],
        leads: [lead()],
    });

    assert.equal(items.length, 2);
    assert.deepEqual(new Set(ids(items)), new Set(["recCall", "lead:L1"]));
    assert.equal(items.find((i) => i.source === "web-form").callback, null);
});

test("items are ordered newest first, undated last", () => {
    const items = buildInbox({
        calls: [
            call({ id: "recOld", date: at(-3 * MIN), callerNumber: "+19305551111" }),
            call({ id: "recNew", date: at(-1 * MIN), callerNumber: "+19305552222" }),
            // Airtable's Date is optional, so a row can arrive with none. `timeOf(null)` is 0,
            // which sorts it last rather than first — an undated row is not breaking news.
            call({ id: "recUndated", date: null, callerNumber: "+19305553333" }),
        ],
        leads: [lead({ leadId: "Lmid", phone: "+19305554444", phoneRaw: null, createdAt: at(-2 * MIN) })],
    });

    assert.deepEqual(ids(items), ["recNew", "lead:Lmid", "recOld", "recUndated"]);
});

test("a collapsed item sorts on the enquiry, not on its callback", () => {
    // Deliberate: to the client this is one enquiry, and the moment they care about is when
    // their customer got in touch. The callback is a detail inside it.
    const items = buildInbox({
        calls: [
            call({ id: "recCallback", date: at(0) }),
            call({ id: "recOther", date: at(-5 * MIN), callerNumber: "+19305559999" }),
        ],
        leads: [lead({ createdAt: at(-10 * MIN) })],
    });

    assert.deepEqual(ids(items), ["recOther", "lead:L1"]);
});

test("the callback window is inclusive at exactly an hour and closed past it", () => {
    const inside = buildInbox({
        calls: [call({ date: at(0) })],
        leads: [lead({ createdAt: at(-WINDOW) })],
    });
    assert.equal(inside.length, 1, "exactly one hour later still reads as the callback");
    assert.notEqual(inside[0].callback, null);

    const outside = buildInbox({
        calls: [call({ date: at(0) })],
        leads: [lead({ createdAt: at(-WINDOW - 1) })],
    });
    assert.equal(outside.length, 2, "a millisecond past the window is a separate contact");
    assert.equal(outside.find((i) => i.source === "web-form").callback, null);
});

test("a call that came in before the form was filled in is a separate contact", () => {
    // Not a callback — nothing had been submitted yet to call back about. Someone who rang,
    // got the receptionist, and then went to the website is two genuine touches.
    const items = buildInbox({
        calls: [call({ date: at(-20 * MIN) })],
        leads: [lead({ createdAt: at(-10 * MIN) })],
    });

    assert.deepEqual(ids(items), ["lead:L1", "recCall"]);
    assert.equal(items[0].callback, null);
});

test("a call simultaneous with the enquiry still collapses", () => {
    // Zero gap is inside the window: the Make webhook and the lead capture write from the
    // same submission, and identical timestamps are a rounding artefact, not two enquiries.
    const items = buildInbox({
        calls: [call({ date: at(0) })],
        leads: [lead({ createdAt: at(0) })],
    });

    assert.equal(items.length, 1);
    assert.notEqual(items[0].callback, null);
});

test("with two enquiries from one number, the nearest preceding one claims the call", () => {
    const items = buildInbox({
        calls: [call({ date: at(0) })],
        leads: [
            lead({ leadId: "Lold", createdAt: at(-50 * MIN) }),
            lead({ leadId: "Lnew", createdAt: at(-5 * MIN) }),
        ],
    });

    assert.deepEqual(ids(items), ["lead:Lnew", "lead:Lold"]);
    assert.notEqual(items[0].callback, null, "the 5-minute-old enquiry owns the callback");
    assert.equal(items[1].callback, null, "and the older one is not given a second copy of it");
});

test("only one call is ever nested under one enquiry", () => {
    // Two calls, both from the enquiry's number, both inside its window. Whichever is taken
    // as the callback, the other has to surface on its own — swallowing it would hide a real
    // inbound from the client.
    const items = buildInbox({
        calls: [
            call({ id: "recA", date: at(-9 * MIN) }),
            call({ id: "recB", date: at(0) }),
        ],
        leads: [lead({ createdAt: at(-10 * MIN) })],
    });

    assert.equal(items.length, 2);
    const form = items.find((i) => i.source === "web-form");
    const standalone = items.find((i) => i.source === "call");
    assert.notEqual(form.callback, null);
    assert.ok(standalone, "the call that was not nested is still in the inbox");
});

test("the nearest call is nested, whichever order the calls arrive in", () => {
    /**
     * The bug this file was written to find, kept as the test that would catch it again.
     *
     * Matching used to run per call: each call took its own nearest preceding enquiry, but the
     * "one callback per enquiry" rule was enforced first-come in `calls` array order, so the
     * first call the loop happened to reach claimed the slot even when a later one sat much
     * closer. It was not a rarity either: `fetchCalls` requests `sort[0][direction]=desc`, so
     * production fed this newest-first and the *furthest* call inside the window won. The
     * enquiry at 11:50 with its genuine callback at 11:51 and an unrelated call at 12:00
     * nested the 12:00 one and showed the 11:51 callback as a standalone item — the duplicate
     * the collapse exists to prevent, one step removed.
     *
     * Pairing is decided per enquiry by gap now, so both orders agree on the nearer call.
     */
    const calls = [call({ id: "recEarly", date: at(-9 * MIN) }), call({ id: "recLate", date: at(0) })];
    const leads = [lead({ createdAt: at(-10 * MIN) })];

    const oldestFirst = buildInbox({ calls, leads });
    const newestFirst = buildInbox({ calls: [...calls].reverse(), leads });

    assert.deepEqual(oldestFirst, newestFirst, "the pairing does not depend on the input order");

    const form = oldestFirst.find((i) => i.source === "web-form");
    assert.equal(form.callback.at, at(-9 * MIN), "the call a minute after the form is the callback");
    assert.deepEqual(ids(oldestFirst), ["recLate", "lead:L1"], "and the later one stands alone");
});

test("with three calls in one window, only the nearest is nested", () => {
    // A busy morning on one number: the callback a minute after the form, then two unrelated
    // inbound calls, all three inside the hour. Only one can be the callback, and swallowing
    // either of the others would hide a real inbound — so the inbox is the enquiry plus two
    // calls, and which one is nested cannot turn on the order Airtable returned them in.
    const calls = [
        call({ id: "recFar", date: at(40 * MIN) }),
        call({ id: "recNear", date: at(-9 * MIN) }),
        call({ id: "recMid", date: at(5 * MIN) }),
    ];
    const leads = [lead({ createdAt: at(-10 * MIN) })];

    for (const order of [calls, [...calls].reverse()]) {
        const items = buildInbox({ calls: order, leads });
        const form = items.find((i) => i.source === "web-form");

        assert.equal(form.callback.at, at(-9 * MIN), "the nearest call is the callback");
        assert.deepEqual(new Set(ids(items)), new Set(["lead:L1", "recMid", "recFar"]));
    }
});

test("a lead whose number cannot be parsed still reaches the inbox", () => {
    // It can never collapse — there is no identity to match on — but dropping it would lose
    // an enquiry outright, which is worse than showing it unmatched. The raw string is shown
    // rather than a tidy "No number", because it is sometimes the only contact detail there.
    const items = buildInbox({
        calls: [call()],
        leads: [lead({ phone: null, phoneRaw: "ask for Ada at the shop" })],
    });

    assert.equal(items.length, 2);
    const form = items.find((i) => i.source === "web-form");
    assert.equal(form.phone, null);
    assert.equal(form.phoneDisplay, "ask for Ada at the shop");
    assert.equal(form.callback, null);
});

test("a lead with no number at all falls back to a readable placeholder", () => {
    const [item] = buildInbox({ calls: [], leads: [lead({ phone: null, phoneRaw: null })] });

    assert.equal(item.phoneDisplay, "No number");
});

test("the two sources carry different notions of read, and different promotion keys", () => {
    // A lead's read state is stored on the lead itself; a call's lives in a KV set, because
    // Airtable is not ours to write to. The promotion key follows the item id, so a lead is
    // `lead:{leadId}` and a call is its bare Airtable record id.
    const items = buildInbox({
        calls: [call({ id: "recRead", callerNumber: "+19305559999" })],
        leads: [lead({ leadId: "Lread", readAt: at(-MIN) })],
        promoted: new Set(["lead:Lread"]),
        readCallIds: new Set(["recRead"]),
    });

    const form = items.find((i) => i.source === "web-form");
    const row = items.find((i) => i.source === "call");

    assert.equal(form.read, true);
    assert.equal(form.promoted, true);
    assert.equal(row.read, true);
    assert.equal(row.promoted, false, "the call was not in the promoted set under its own id");
});

test("numbers are normalised for both matching and display", () => {
    // The collapse hinges on this: a form typed as "(930) 555-1234" and an Airtable row
    // reading "930-555-1234" are the same person, and only normalisation says so.
    assert.equal(callContactId(call({ callerNumber: "930-555-1234" })), NUMBER);
    assert.equal(callContactId(call({ callerNumber: "(930) 555-1234" })), NUMBER);
    assert.equal(callContactId(call({ callerNumber: null })), null);

    const items = buildInbox({
        calls: [call({ callerNumber: "(930) 555-1234" })],
        leads: [lead({ phone: null, phoneRaw: "9305551234" })],
    });

    assert.equal(items.length, 1, "differently formatted, same contact");
    assert.equal(items[0].phoneDisplay, "(930) 555-1234");
});

test("no leads at all is the same as no leads argument", () => {
    // `leads` is optional on purpose — the Inbox had to work on calls alone before web-form
    // capture landed, and the route still passes nothing on a tier without it.
    const withEmpty = buildInbox({ calls: [call()], leads: [] });
    const withNothing = buildInbox({ calls: [call()] });

    assert.deepEqual(withNothing, withEmpty);
    assert.deepEqual(ids(withNothing), ["recCall"]);
});
