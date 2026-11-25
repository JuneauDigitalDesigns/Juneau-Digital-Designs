/**
 * The tour's sample data (Xander, 19 Nov 2026): "the dummy data in the portal that's shown
 * during the tour is HVAC customers, and so on and so forth for all the other industry verticals".
 *
 * Two promises are checked here:
 * 1. Every trade has a full sample set, in the shapes the portal's routes answer with.
 * 2. While the tour runs, nothing a person taps on a sample screen is written anywhere, and
 *    everything that is not lead or customer data is the real thing.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import { TRADE_SAMPLES, sampleTradeFor, tradeSample } from "../app/data/trade-samples.ts";
import { sampleAnswer } from "../app/components/portal/tour/sample-mode.ts";
import {
    TOUR_LEAD_ID,
    TOUR_RECORD_ID,
    isTourId,
    sampleCalendar,
    sampleCustomers,
    sampleInbox,
    samplePipeline,
    sampleRecord,
} from "../app/components/portal/tour/sample-data.ts";

const NOW = new Date("2026-11-19T15:42:00");
const VERTICALS = ["hvac", "roofing", "plumbing", "lawn-care", "car-detailing", "pressure-washing", "health"];
const opts = (trade = "plumbing") => ({ trade, now: NOW, growth: true });

test("every trade the portal sells has its own sample set, plus one for anything else", () => {
    for (const v of [...VERTICALS, "other"]) {
        const s = TRADE_SAMPLES[v];
        assert.ok(s, v);
        assert.equal(s.trade, v);
        assert.equal(s.inbox.length, 3, `${v}: three more Inbox rows`);
        assert.ok(s.transcript.length >= 4, `${v}: a call to read`);
        assert.ok(s.job.service && s.job.amount > 0, `${v}: Dave's job`);
        for (const stage of ["lead", "contacted", "quoted", "scheduled"]) assert.equal(s.board[stage].length, 1, `${v}: ${stage}`);
    }
    // Each trade is its own: no two share Dave's call.
    const previews = new Set(Object.values(TRADE_SAMPLES).map((s) => s.lead.preview));
    assert.equal(previews.size, Object.keys(TRADE_SAMPLES).length);
});

test("sample numbers are all in the 555-01XX range reserved for fiction", () => {
    for (const s of Object.values(TRADE_SAMPLES)) {
        const phones = [s.lead.phone, ...Object.values(s.board).flat().map((c) => c.phone)];
        for (const p of phones) assert.match(p, /555-01\d\d/, p);
    }
    for (const r of sampleInbox("roofing", NOW)) assert.match(r.phoneDisplay, /555-01\d\d/);
});

test("no sample text has a dash in it", () => {
    for (const s of Object.values(TRADE_SAMPLES)) {
        for (const text of [s.lead.preview, s.lead.summary, s.sms, s.reply, s.note, ...s.inbox.map((r) => r.preview), ...s.transcript.map((t) => t.text)]) {
            assert.doesNotMatch(text, /[–—]| - /, text);
        }
    }
});

test("a site's trade comes from what it was set up as, else a hint in its name, else 'other'", () => {
    assert.equal(sampleTradeFor("plumbing", "Anything"), "plumbing");
    assert.equal(sampleTradeFor("other", "Peak Comfort HVAC"), "other");
    assert.equal(sampleTradeFor(null, "Peak Comfort HVAC"), "hvac");
    assert.equal(sampleTradeFor(null, "Summit Roofing"), "roofing");
    assert.equal(sampleTradeFor(null, "Brightside Pressure Washing"), "pressure-washing");
    assert.equal(sampleTradeFor(null, "Greenline Lawn Care"), "lawn-care");
    assert.equal(sampleTradeFor(null, "Northside Family Clinic"), "health");
    assert.equal(sampleTradeFor(null, "Acme Ltd"), "other");
    assert.equal(tradeSample("nonsense"), TRADE_SAMPLES.other);
});

test("the samples are the trade's: a plumber's tour shows plumbing work", () => {
    const inbox = sampleInbox("plumbing", NOW);
    assert.equal(inbox[0].id, TOUR_LEAD_ID);
    assert.match(inbox[0].preview, /water heater/i);
    assert.ok(sampleCustomers("plumbing", NOW).some((c) => c.tags.includes("Bathroom repipe")));
});

test("the record the tour opens has everything the tour points at", () => {
    const r = sampleRecord("hvac", TOUR_RECORD_ID, NOW);
    assert.equal(r.state, "ready");
    assert.ok(r.tasks.length > 0, "a follow-up for Coming up");
    assert.ok(r.jobs.length > 0, "a job for Jobs");
    assert.ok(r.notes.length > 0, "a note for Notes");
    assert.ok(r.appointments.length > 0, "a booked visit");
    assert.ok(r.timeline.some((e) => e.kind === "sms-in"), "a reply on the timeline");
    assert.equal(sampleRecord("hvac", "not-a-sample", NOW), null);
});

test("every sample id is marked as the tour's own", () => {
    const ids = [
        ...sampleInbox("hvac", NOW).map((i) => i.id),
        ...sampleCustomers("hvac", NOW).map((c) => c.customerId),
        ...sampleCalendar("hvac", NOW).appointments.map((a) => a.id),
        ...samplePipeline("hvac", NOW).tasks.map((t) => t.taskId),
    ];
    for (const id of ids) assert.ok(isTourId(id), id);
});

test("while the tour runs, the lead and customer screens read the samples", () => {
    assert.deepEqual(sampleAnswer("/api/portal/inbox", "GET", opts()).body.items.map((i) => i.id), sampleInbox("plumbing", NOW).map((i) => i.id));
    assert.equal(sampleAnswer("/api/portal/customers", "GET", opts()).body.customers.length, sampleCustomers("plumbing", NOW).length);
    assert.equal(sampleAnswer(`/api/portal/customers/${TOUR_RECORD_ID}`, "GET", opts()).status, 200);
    assert.equal(sampleAnswer("/api/portal/appointments", "GET", opts()).body.state, "ready");
    assert.equal(sampleAnswer(`/api/portal/calls/${TOUR_LEAD_ID}/transcript`, "GET", opts()).body.turns.length > 0, true);
    assert.equal(sampleAnswer("/api/portal/inbox", "GET", { ...opts(), growth: false }).body.canPromote, false, "Starter can't promote");
});

test("nothing a person taps during the tour is written: every lead and customer write is answered locally", () => {
    for (const [path, method] of [
        ["/api/portal/inbox/archive", "POST"],
        ["/api/portal/inbox/read", "POST"],
        ["/api/portal/customers", "POST"],
        [`/api/portal/customers/${TOUR_RECORD_ID}`, "PATCH"],
        ["/api/portal/tasks", "POST"],
        ["/api/portal/jobs", "POST"],
        ["/api/portal/notes", "POST"],
        ["/api/portal/appointments", "DELETE"],
        ["/api/portal/messages", "POST"],
        ["/api/portal/review-request", "POST"],
    ]) {
        const a = sampleAnswer(path, method, opts());
        assert.ok(a, `${method} ${path} must not reach the server`);
        assert.equal(a.status, 200);
    }
});

test("everything that is not lead or customer data is the real thing", () => {
    for (const path of ["/api/portal/tour", "/api/portal/billing", "/api/portal/traffic", "/api/portal/tickets", "/api/portal/review-message", "/api/portal/profile", "/api/portal/usage"]) {
        assert.equal(sampleAnswer(path, "GET", opts()), null, path);
        assert.equal(sampleAnswer(path, "POST", opts()), null, path);
    }
});
