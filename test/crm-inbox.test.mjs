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
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";

import {
    buildInbox,
    callContactId,
    groupForItem,
    groupInbox,
    groupItemIds,
    classifyDeepLink,
    filterInbox,
    inboxItemForDeepLink,
    inboxStatus,
    isDeepLinkId,
    markOrigin,
    parseInboxFilter,
    promotionInput,
} from "../app/lib/crm-contacts.ts";

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
        callbackNumber: null,
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
        id: "recCall",
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

test("both sources read from one read set, and carry different promotion keys", () => {
    // Read state for both lives in one KV set keyed by inbox id (`portal-inbox-read.ts`), so
    // Mark unread works the same on either; a lead's `readAt` is a first-seen stamp and is not
    // read. The promotion key follows the item id, so a lead is `lead:{leadId}` and a call is
    // its bare Airtable record id.
    const items = buildInbox({
        calls: [call({ id: "recRead", callerNumber: "+19305559999" })],
        leads: [lead({ leadId: "Lread", readAt: at(-MIN) })],
        promoted: new Set(["lead:Lread"]),
        readIds: new Set(["recRead", "lead:Lread"]),
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

/* ── the inbox as a worklist: promoted leads leave it ─────────────────────── */

/** The inbox as `buildInbox` returns it: one unread call, one read form lead, one promoted. */
function mixedInbox() {
    return buildInbox({
        calls: [
            call({ id: "recOpen", date: at(-5 * MIN), callerNumber: "+19305551111" }),
            call({ id: "recDone", date: at(-20 * MIN), callerNumber: "+19305552222" }),
        ],
        leads: [lead({ leadId: "Lform", phone: "+19305553333", phoneRaw: null, createdAt: at(-10 * MIN), readAt: at(-9 * MIN) })],
        promoted: new Set(["recDone"]),
        readIds: new Set(["recDone", "lead:Lform"]),
    });
}

test("every ordinary filter hides a promoted lead", () => {
    // The bug this encodes: `buildInbox` only ever set `promoted: true`, and the component
    // filtered on read/source/search alone — so a lead that had been turned into a customer
    // sat in the inbox for good, and the list that is meant to empty never did.
    const items = mixedInbox();
    assert.ok(items.some((i) => i.id === "recDone" && i.promoted), "fixture really is promoted");

    for (const f of ["needs", "all", "calls", "forms", "reminders", "done"]) {
        assert.ok(
            !filterInbox(items, f).some((i) => i.id === "recDone"),
            `the "${f}" filter still showed a promoted lead`,
        );
    }
});

test("the promoted filter shows promoted leads and nothing else", () => {
    // Not a nicety: promotion is one click and has no undo, so without this view a lead
    // promoted by mistake would be unreachable from the inbox entirely.
    const shown = filterInbox(mixedInbox(), "promoted");

    assert.deepEqual(ids(shown), ["recDone"]);
    assert.equal(shown[0].promoted, true);
});

test("the ordinary filters still filter", () => {
    const items = mixedInbox();

    assert.deepEqual(ids(filterInbox(items, "all")), ["recOpen", "lead:Lform"]);
    // Opening a lead is not handling it: the read form lead still needs the owner.
    assert.deepEqual(ids(filterInbox(items, "needs")), ["recOpen", "lead:Lform"]);
    assert.deepEqual(ids(filterInbox(items, "calls")), ["recOpen"]);
    assert.deepEqual(ids(filterInbox(items, "forms")), ["lead:Lform"]);
});

test("search still applies, and never resurrects a promoted lead", () => {
    const items = mixedInbox();

    assert.deepEqual(ids(filterInbox(items, "all", "ada")), ["recOpen", "lead:Lform"]);
    assert.deepEqual(ids(filterInbox(items, "all", "nobody")), []);
    assert.deepEqual(
        ids(filterInbox(items, "all", "ada byron")),
        ["recOpen", "lead:Lform"],
        "a search that matches the promoted lead too still does not show it",
    );
});

test("a new call from an already-promoted number is still inbound", () => {
    /**
     * The tempting shortcut is to hide anything from a number already on the board. That would
     * be wrong: a customer ringing back about a second job is new work, and silently swallowing
     * it is worse than the duplicate this change set out to remove.
     *
     * Promotion is keyed on the Airtable record id, so a later call from the same number is
     * simply not in the promoted set.
     */
    const items = buildInbox({
        calls: [
            call({ id: "recFirst", date: at(-60 * MIN) }),
            call({ id: "recSecond", date: at(0) }),
        ],
        promoted: new Set(["recFirst"]),
    });

    assert.deepEqual(ids(filterInbox(items, "all")), ["recSecond"]);
});

/* ── what promotion carries ───────────────────────────────────────────────── */

test("promotion carries the address, the outcome and when they actually rang", () => {
    // All three used to be dropped. The address was already on the Airtable row, the outcome is
    // the only triage the call has, and without the contact time the record claims the customer
    // appeared the moment the client clicked Promote.
    const [item] = buildInbox({
        calls: [call({ address: "1482 Glacier Spur Rd", outcome: "Qualified", date: at(-30 * MIN) })],
    });

    assert.deepEqual(promotionInput(item), {
        name: "Ada Byron",
        phone: NUMBER,
        email: null,
        address: "1482 Glacier Spur Rd",
        note: "Asked about a bathroom refit.",
        tags: ["qualified"],
        source: "call",
        sourceRef: "recCall",
        firstContactAt: at(-30 * MIN),
    });
});

test("a long call summary is carried whole", () => {
    // `POST /api/portal/customers` ran every string through a 300-character clamp, including
    // the note, while `PATCH` allowed 4000 — so promoting a call with a real summary silently
    // cut it, and the client could never tell what was missing.
    const summary = "A".repeat(900);
    const [item] = buildInbox({ calls: [call({ summary })] });

    assert.equal(promotionInput(item).note.length, 900);
});

test("a triage outcome that means 'not a lead' is not made into a tag", () => {
    for (const outcome of ["Spam", "wrong number", "No answer"]) {
        const [item] = buildInbox({ calls: [call({ outcome })] });
        assert.deepEqual(promotionInput(item).tags, [], `${outcome} became a tag`);
    }
});

test("a web-form lead promotes with what a form actually has", () => {
    const [item] = buildInbox({ calls: [], leads: [lead()] });
    const input = promotionInput(item);

    assert.equal(input.source, "web-form");
    assert.equal(input.sourceRef, "lead:L1");
    assert.equal(input.note, "Need a quote for a bathroom refit.");
    assert.equal(input.firstContactAt, at(-10 * MIN));
    // A form has no address field and no triage outcome. Null rather than invented.
    assert.equal(input.address, null);
    assert.deepEqual(input.tags, []);
});

/* ── the origin call ──────────────────────────────────────────────────────── */

test("the call a customer was promoted from is flagged in the timeline", () => {
    // `sourceRef` was stored on every promoted customer and read by nothing, so the record
    // showed the originating call as just another row, summary and recording behind a click.
    const timeline = [
        { id: "msg:1", meta: { body: "hi" } },
        { id: "call:recCall", meta: { detail: "…", recordingUrl: "https://example.test/r.mp3" } },
        { id: "call:recOther", meta: { detail: "…" } },
    ];

    const marked = markOrigin(timeline, "recCall");

    assert.equal(marked[1].meta.origin, true);
    assert.equal(marked[1].meta.recordingUrl, "https://example.test/r.mp3", "other meta kept");
    assert.ok(!("origin" in marked[0].meta));
    assert.ok(!("origin" in marked[2].meta));
});

test("a sourceRef with nothing to match flags nothing and throws nothing", () => {
    // A web-form customer's `lead:{id}` matches no timeline entry, because the lead store is
    // not folded into the timeline. That is ordinary, not an error.
    const timeline = [{ id: "call:recCall", meta: {} }];

    assert.deepEqual(markOrigin(timeline, "lead:L1"), timeline);
    assert.deepEqual(markOrigin(timeline, null), timeline);
    assert.deepEqual(markOrigin([], "recCall"), []);
});

test("marking the origin does not mutate the timeline it was given", () => {
    const timeline = [{ id: "call:recCall", meta: { detail: "x" } }];
    markOrigin(timeline, "recCall");

    assert.ok(!("origin" in timeline[0].meta), "the caller's array was written through");
});

/* ── deep links from the owner's text ─────────────────────────────────────── */

test("a deep link to a call opens that call", () => {
    const items = buildInbox({ calls: [call()] });

    assert.equal(inboxItemForDeepLink(items, "recCall").id, "recCall");
});

test("a deep link to a nested callback opens the enquiry it belongs to", () => {
    /**
     * The case that makes this helper necessary. On Growth the owner is texted about the call
     * the receptionist made, but `buildInbox` consumes that call into the enquiry that caused
     * it — so it is not an item, and matching ids alone finds nothing at all.
     */
    const items = buildInbox({
        calls: [call({ id: "recCallback", date: at(0) })],
        leads: [lead({ createdAt: at(-10 * MIN) })],
    });

    assert.equal(items.length, 1, "the call really was folded in");
    assert.equal(items[0].callback.id, "recCallback", "the callback carries its own id");
    assert.equal(inboxItemForDeepLink(items, "recCallback").id, "lead:L1");
});

test("a deep link to nothing opens nothing, and does not throw", () => {
    const items = buildInbox({ calls: [call()] });

    assert.equal(inboxItemForDeepLink(items, "recGone00000000000"), null);
    assert.equal(inboxItemForDeepLink(items, null), null);
    assert.equal(inboxItemForDeepLink([], "recCall"), null);
});

test("a deep link still reaches an item that has been promoted away", () => {
    // The list hides promoted leads — it is a worklist. A link naming one by id is not the
    // list, and the drawer tells them it is already a customer rather than offering it twice.
    const items = buildInbox({ calls: [call()], promoted: new Set(["recCall"]) });

    assert.deepEqual(ids(filterInbox(items, "all")), [], "hidden from the list");
    assert.equal(inboxItemForDeepLink(items, "recCall").id, "recCall", "still reachable by id");
});

test("a promoted item resolves to its customer, not to the inbox", () => {
    // The whole reason the redirect asks before choosing a destination: sending a promoted
    // lead to the inbox lands on an ordinary inbox with no sign of the thing they tapped.
    assert.deepEqual(classifyDeepLink("recABCDEFGHIJKLMN", "cust_7", null), {
        kind: "customer",
        customerId: "cust_7",
    });
    assert.deepEqual(classifyDeepLink("lead:abc", "cust_7", true), {
        kind: "customer",
        customerId: "cust_7",
    });
});

test("a lead that is no longer in the store is gone", () => {
    assert.deepEqual(classifyDeepLink("lead:abc", null, false), { kind: "gone" });
    assert.deepEqual(classifyDeepLink("lead:abc", null, true), {
        kind: "inbox",
        itemId: "lead:abc",
    });
});

test("an unknown call id is taken on trust rather than called gone", () => {
    /**
     * Pinning a deliberate limit, not an oversight. The resolver reads KV only — it runs on
     * the hot path of a tapped text message and will not put an Airtable round trip there —
     * and a call lives in Airtable, so its absence cannot be proven. Both answers end at the
     * plain inbox anyway; only the route differs.
     */
    assert.deepEqual(classifyDeepLink("recABCDEFGHIJKLMN", null, null), {
        kind: "inbox",
        itemId: "recABCDEFGHIJKLMN",
    });
});

test("only the two real id shapes resolve to anything", () => {
    // An id that came from somewhere we did not write never reaches a KV key or a query
    // string. `gone` even when a customer was somehow found for it.
    for (const bad of [
        "",
        "../../etc/passwd",
        "lead:",
        "rec",
        "recTooShort",
        "recWayTooLongToBeReal00000",
        "lead:has spaces",
        "<script>",
        "cust_7",
    ]) {
        assert.equal(isDeepLinkId(bad), false, `${bad} should not be a deep-link id`);
        assert.deepEqual(classifyDeepLink(bad, "cust_7", true), { kind: "gone" }, bad);
    }

    assert.equal(isDeepLinkId("recABCDEFGHIJKLMN"), true);
    assert.equal(isDeepLinkId("lead:0f8e7d6c-1234-4abc-89de-0123456789ab"), true);
});

test("a real leadId is a valid deep-link id", () => {
    // `portal-leads.ts` creates these with `randomUUID()`, so the shape is a canonical v4:
    // hex and hyphens, 36 characters. The guard has to admit it.
    assert.equal(isDeepLinkId(`lead:${randomUUID()}`), true);
});

/* ── one person, one row ──────────────────────────────────────────────────── */

const gids = (groups) => groups.map((g) => g.id);

test("repeat calls from one number become a single row", () => {
    // The crowding this was asked for: a person who rings three times is one person with one
    // problem, and three rows of them is three times the list for no extra information.
    const groups = groupInbox(
        buildInbox({
            calls: [
                call({ id: "recNew", date: at(0) }),
                call({ id: "recMid", date: at(-70 * MIN) }),
                call({ id: "recOld", date: at(-200 * MIN) }),
            ],
        }),
    );

    assert.equal(groups.length, 1);
    const [g] = groups;
    assert.equal(g.id, `contact:${NUMBER}`);
    assert.equal(g.contact, NUMBER);
    assert.equal(g.count, 3);
    assert.equal(g.lead.id, "recNew", "the row renders the newest call");
    assert.deepEqual(groupItemIds(g), ["recNew", "recMid", "recOld"], "newest first");
    assert.equal(g.at, at(0));
});

test("different numbers stay different rows, newest run first", () => {
    const groups = groupInbox(
        buildInbox({
            calls: [
                call({ id: "recB1", date: at(-5 * MIN), callerNumber: "+19305552222" }),
                call({ id: "recA1", date: at(-30 * MIN) }),
                call({ id: "recA2", date: at(-90 * MIN) }),
            ],
        }),
    );

    assert.deepEqual(gids(groups), ["contact:+19305552222", `contact:${NUMBER}`]);
    assert.deepEqual(
        groups.map((g) => g.count),
        [1, 2],
    );
});

test("a web enquiry never joins a caller's run", () => {
    /**
     * Different channel, different content. It also cannot arise on Growth, where a form
     * triggers a receptionist callback and the enquiry reaches the inbox as the resulting
     * call — so a lead sitting beside calls from the same number means a Starter site, where
     * the person filled the form *and* rang, and the two are worth seeing separately.
     */
    const groups = groupInbox(
        buildInbox({
            calls: [call({ id: "recLate", date: at(0) })],
            // Well outside the callback window, so `buildInbox` does not collapse them.
            leads: [lead({ createdAt: at(-500 * MIN) })],
        }),
    );

    assert.equal(groups.length, 2);
    assert.deepEqual(new Set(gids(groups)), new Set([`contact:${NUMBER}`, "lead:L1"]));
});

test("calls with no usable number are each their own row", () => {
    // Withheld and spoofed numbers cannot be grouped, and they are most of what a client wants
    // rid of — which is why Archive carries more weight for them than grouping ever could.
    const groups = groupInbox(
        buildInbox({
            calls: [
                call({ id: "recX", date: at(0), callerNumber: null }),
                call({ id: "recY", date: at(-10 * MIN), callerNumber: "withheld" }),
            ],
        }),
    );

    assert.deepEqual(gids(groups), ["recX", "recY"]);
    assert.deepEqual(
        groups.map((g) => g.count),
        [1, 1],
    );
    assert.equal(groups[0].contact, null);
});

test("a run is unread when any call in it is", () => {
    const groups = groupInbox(
        buildInbox({
            calls: [call({ id: "recSeen", date: at(0) }), call({ id: "recNew", date: at(-MIN) })],
            readIds: new Set(["recSeen"]),
        }),
    );

    assert.equal(groups.length, 1);
    assert.equal(groups[0].unread, true, "one unopened call still wants attention");
    assert.equal(groups[0].lead.read, true, "even though the row renders the one already read");
});

test("a deep link finds the row holding its call, nested callbacks included", () => {
    const groups = groupInbox(
        buildInbox({
            calls: [
                call({ id: "recNew", date: at(0) }),
                call({ id: "recOld", date: at(-80 * MIN) }),
            ],
        }),
    );

    assert.equal(groupForItem(groups, "recOld").id, `contact:${NUMBER}`);
    assert.equal(groupForItem(groups, "recNew").id, `contact:${NUMBER}`);
    assert.equal(groupForItem(groups, "recGone00000000000"), null);
    assert.equal(groupForItem(groups, null), null);

    // A call folded under an enquiry is reachable through the row that swallowed it.
    const withCallback = groupInbox(
        buildInbox({
            calls: [call({ id: "recCallback", date: at(0) })],
            leads: [lead({ createdAt: at(-10 * MIN) })],
        }),
    );
    assert.equal(groupForItem(withCallback, "recCallback").id, "lead:L1");
});

test("grouping runs after filtering, which is what makes the archive accumulate", () => {
    /**
     * Three calls archived today and a fourth next week must read as one row of four, not as a
     * row of three beside a row of one. Grouping the *filtered* list gives that for free and
     * needs no stored notion of a group; grouping first and filtering after would split the
     * same number across two rows the moment one call was archived.
     */
    const items = buildInbox({
        calls: [
            call({ id: "recFourth", date: at(0) }),
            call({ id: "recThird", date: at(-100 * MIN) }),
            call({ id: "recSecond", date: at(-200 * MIN) }),
            call({ id: "recFirst", date: at(-300 * MIN) }),
        ],
        archived: new Set(["recFirst", "recSecond", "recThird", "recFourth"]),
    });

    const archivedView = groupInbox(filterInbox(items, "done"));
    assert.equal(archivedView.length, 1);
    assert.equal(archivedView[0].count, 4);

    // And the worklist is empty, rather than showing a row of nothing.
    assert.deepEqual(groupInbox(filterInbox(items, "needs")), []);
});

test("a partly archived run splits between the two views", () => {
    const items = buildInbox({
        calls: [
            call({ id: "recKeep", date: at(0) }),
            call({ id: "recGone", date: at(-60 * MIN) }),
        ],
        archived: new Set(["recGone"]),
    });

    const working = groupInbox(filterInbox(items, "needs"));
    const archived = groupInbox(filterInbox(items, "done"));

    assert.deepEqual(groupItemIds(working[0]), ["recKeep"]);
    assert.deepEqual(groupItemIds(archived[0]), ["recGone"]);
});

/* ── archived ─────────────────────────────────────────────────────────────── */

test("Needs you hides a Done item; All and its slices still show it", () => {
    /**
     * Done (stored as `archived`) is out of today's work, not out of the inbox. It used to
     * vanish from every view but its own, so a lead put away by mistake was only findable by
     * someone who knew to look in the archive. All, Calls and Forms now keep it (muted, with a
     * Done chip), and Needs you and Reminders do not.
     */
    const items = buildInbox({
        calls: [call({ id: "recOpen", date: at(0), callerNumber: "+19305551111" })],
        leads: [lead({ leadId: "Lgone", phone: "+19305552222", phoneRaw: null })],
        archived: new Set(["lead:Lgone"]),
    });

    for (const f of ["needs", "reminders"]) {
        assert.ok(
            !filterInbox(items, f).some((i) => i.id === "lead:Lgone"),
            `the "${f}" view still showed a Done item`,
        );
    }
    for (const f of ["all", "forms"]) {
        assert.ok(
            filterInbox(items, f).some((i) => i.id === "lead:Lgone"),
            `the "${f}" view lost a Done item`,
        );
    }
    assert.deepEqual(ids(filterInbox(items, "done")), ["lead:Lgone"]);
});

test("the retired ?f= values still land on the view they became", () => {
    assert.equal(parseInboxFilter("unread"), "needs");
    assert.equal(parseInboxFilter("archived"), "done");
    assert.equal(parseInboxFilter(null), "needs");
    assert.equal(parseInboxFilter(""), "needs");
    assert.equal(parseInboxFilter("<script>"), "needs");
    for (const f of ["needs", "all", "calls", "forms", "reminders", "promoted", "done"]) {
        assert.equal(parseInboxFilter(f), f);
    }
});

test("an item that is both promoted and archived reads as promoted", () => {
    // Being told it became a customer is more use than being told it was put away.
    const items = buildInbox({
        calls: [call()],
        promoted: new Set(["recCall"]),
        archived: new Set(["recCall"]),
    });

    assert.deepEqual(ids(filterInbox(items, "promoted")), ["recCall"]);
    assert.deepEqual(ids(filterInbox(items, "done")), []);
    assert.equal(inboxStatus(items[0]), "promoted");
});

test("an archived item is still reachable by deep link", () => {
    // An owner's text links to one enquiry. Archiving it later must not turn that link into a
    // dead end — the item is out of the worklist, not gone.
    const items = buildInbox({ calls: [call()], archived: new Set(["recCall"]) });

    assert.deepEqual(ids(filterInbox(items, "needs")), [], "hidden from the worklist");
    assert.equal(inboxItemForDeepLink(items, "recCall").id, "recCall", "still reachable");
    assert.equal(items[0].archived, true);
});

/* ── "no, use my cell" ───────────────────────────────────────────────────── */

test("a number the caller asked to be reached at shows, and the call's own number stays the identity", () => {
    // Retell extracts bare digits; Caller number is E.164.
    const [item] = buildInbox({ calls: [call({ callbackNumber: "2075550100" })], leads: [] });
    assert.equal(item.callbackPhone, "+12075550100");
    assert.equal(item.callbackPhoneDisplay, "(207) 555-0100");
    assert.equal(item.phone, NUMBER, "the contact is still the number the call was on");
});

test("the same number in another format is not a different number", () => {
    // Every call the agent confirms extracts the number it is on. A raw compare would show each
    // of them a "Callback number" identical to Phone.
    const [item] = buildInbox({ calls: [call({ callbackNumber: "9305551234" })], leads: [] });
    assert.equal(item.callbackPhone, null);
    assert.equal(item.callbackPhoneDisplay, null);
});

test("no spoken number, or nothing dialable, shows nothing", () => {
    for (const callbackNumber of [null, "", "unknown", "123"]) {
        const [item] = buildInbox({ calls: [call({ callbackNumber })], leads: [] });
        assert.equal(item.callbackPhone, null, String(callbackNumber));
    }
});

test("a callback collapsed into its form lead still carries the corrected number", () => {
    const [item] = buildInbox({ calls: [call({ callbackNumber: "2075550100" })], leads: [lead()] });
    assert.equal(item.source, "web-form");
    assert.equal(item.callbackPhone, "+12075550100");
    assert.equal(buildInbox({ calls: [], leads: [lead()] })[0].callbackPhone, null);
});

test("the record shows it, and the call button rings it", () => {
    // The lead pane moved to `inbox/LeadDetail.tsx` when the Inbox was split up. Every call
    // control there — Call back, the row's hover action, the swipe and the `c` key — dials
    // through `dialNumber`, so the rule is pinned in that one place.
    const src = readFileSync(new URL("../app/components/portal/inbox/LeadDetail.tsx", import.meta.url), "utf8");
    assert.match(src, /<Fact label="Callback number">/);
    assert.match(src, /const dial = dialNumber\(item\)/);
    assert.match(src, /tel:\$\{dial\}/);
    const list = readFileSync(new URL("../app/components/portal/inbox/InboxList.tsx", import.meta.url), "utf8");
    assert.match(list, /return item\.callbackPhone \?\? item\.phone;/);
    const calls = readFileSync(new URL("../app/lib/airtable-calls.ts", import.meta.url), "utf8");
    assert.match(calls, /callbackNumber: str\(r\.fields\["Callback number"\]\)/);
    assert.match(calls, /const KNOWN_FIELDS[^;]*"Callback number"/s, "a base without the column must not be asked for it");
});
