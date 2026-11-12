/**
 * The portal calendar (Xander, 2026-11-12: copy the console's calendar into the portal for
 * scheduling and follow-ups, tie it to customers and jobs, and let a job be added to it).
 *
 * The time maths is the console's, and is held here the way the console's own test holds it: it
 * is the one part that can produce a plausible wrong answer. The routes are real, on the
 * in-memory Upstash, with only the Clerk session stubbed.
 */

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./portal-crm-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;
globalThis.fetch = (input, init) => (redis.owns(input) ? redis.handle(input, init) : realFetch(input, init));

const GROWTH = { slug: "your-hvac", name: "Your HVAC Co.", plan: "growth", status: "live" };
const as = (email, site = GROWTH) => {
    globalThis.__portalCrm = { email, site };
};

const cal = await import("../app/lib/crm-calendar.ts");
const crm = await import("../app/lib/portal-crm.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const apptRoute = await import("../app/api/portal/appointments/route.ts");
const jobsRoute = await import("../app/api/portal/jobs/route.ts");
const detailRoute = await import("../app/api/portal/customers/[id]/route.ts");

const OWNER = "owner@yourhvac.test";
const STRANGER = "someone@else.test";

/* ── the console's maths, carried over ────────────────────────────────────── */

test("times read the console's way", () => {
    assert.equal(cal.formatTime(0), "12:00a");
    assert.equal(cal.formatTime(11 * 60), "11:00a");
    assert.equal(cal.formatTime(12 * 60 + 15), "12:15p");
    assert.equal(cal.formatSpan({ startMinutes: 11 * 60, durationMinutes: 120 }), "11:00a to 1:00p");
    assert.equal(cal.formatSpan({ startMinutes: 0, durationMinutes: cal.ALL_DAY }), "All day");
});

test("November 2026 is six Sunday-first weeks starting on the 1st", () => {
    const m = cal.monthMatrix(2026, 10);
    assert.equal(m.length, 6);
    assert.ok(m.every((w) => w.length === 7));
    assert.deepEqual(m[0][0], { day: "2026-11-01", inMonth: true });
    assert.deepEqual(m[4][1], { day: "2026-11-30", inMonth: true });
    assert.deepEqual(m[4][2], { day: "2026-12-01", inMonth: false });
    assert.equal(cal.shiftMonth("2026-12", 1), "2027-01");
    assert.equal(cal.shiftMonth("2027-01", -1), "2026-12");
    assert.equal(cal.monthLabel("2026-11"), "November 2026");
});

test("overlap is advisory and ignores cancelled appointments", () => {
    const a = { id: "a", day: "2026-11-19", startMinutes: 540, durationMinutes: 60, status: "scheduled", createdAt: "1" };
    const b = { ...a, id: "b", status: "cancelled" };
    assert.equal(cal.overlaps(a, { day: "2026-11-19", startMinutes: 570, durationMinutes: 30 }), true);
    assert.equal(cal.overlaps(a, { day: "2026-11-19", startMinutes: 600, durationMinutes: 30 }), false, "back to back");
    assert.equal(cal.firstConflict({ day: "2026-11-19", startMinutes: 540, durationMinutes: 30 }, [b, a]).id, "a");
    assert.equal(cal.firstConflict({ day: "2026-11-19", startMinutes: 540, durationMinutes: 30 }, [a], "a"), null);
});

test("the index score is chronological across days, months and years", () => {
    const order = [
        ["2026-12-31", 1439],
        ["2027-01-01", 0],
        ["2027-01-01", 15],
        ["2027-02-01", 0],
    ].map(([d, m]) => cal.scoreOf(d, m));
    assert.deepEqual([...order].sort((x, y) => x - y), order);
});

test("headings use the approved words", () => {
    assert.equal(cal.dayHeadingLabel("2026-11-12", "2026-11-12"), "Today, Thursday Nov 12");
    assert.equal(cal.dayHeadingLabel("2026-11-19", "2026-11-12"), "Thursday Nov 19");
    assert.deepEqual(Object.values(cal.APPT_KIND_LABEL), ["Job visit", "Estimate", "Call back", "Other"]);
    assert.deepEqual(Object.values(cal.APPT_STATUS_LABEL), ["Scheduled", "Done", "Cancelled", "No-show"]);
    assert.deepEqual(
        cal.APPT_LENGTHS.map((l) => cal.LENGTH_LABEL[l]),
        ["30 min", "1 hr", "1.5 hrs", "2 hrs", "3 hrs", "4 hrs", "All day"],
    );
});

test("what may be stored", () => {
    assert.equal(cal.parseNewAppt({ day: "2026-02-30" }).ok, false, "no such day");
    assert.equal(cal.parseApptPatch({ startMinutes: 547 }).ok, false, "off the 15-minute grid");
    assert.equal(cal.parseApptPatch({ durationMinutes: 45 }).ok, false, "not a length the form offers");
    assert.deepEqual(cal.parseApptPatch({ durationMinutes: cal.ALL_DAY, startMinutes: 540 }), {
        ok: true,
        value: { durationMinutes: cal.ALL_DAY, startMinutes: 0 },
    });
    const n = cal.parseNewAppt({ day: "2026-11-19", jobId: "j1" });
    assert.equal(n.value.jobId, null, "a job needs its customer");
    assert.equal(n.value.kind, "visit");
    assert.equal(n.value.status, "scheduled");
});

/* ── through the routes ───────────────────────────────────────────────────── */

const req = (method, body) =>
    new Request("https://portal.test/api?site=your-hvac", {
        method,
        headers: { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
const call = async (route, method, body) => {
    const res = await route[method](req(method, body));
    return { status: res.status, json: await res.json() };
};

let dave, carol, furnace;
beforeEach(async () => {
    redis.reset();
    as(OWNER);
    const acct = accountScope(OWNER);
    dave = (await crm.createCustomer(acct, GROWTH.slug, { name: "Dave Kowalski", address: "2210 Wren Hollow Rd", source: "manual" }, "u")).customer;
    carol = (await crm.createCustomer(acct, GROWTH.slug, { name: "Carol Ostrander", source: "manual" }, "u")).customer;
    furnace = (await call(jobsRoute, "POST", { customerId: dave.customerId, service: "Furnace repair" })).json.job;
    await crm.createTask(acct, GROWTH.slug, dave.customerId, "Send the thermostat quote", "2026-11-18");
});

test("a job goes onto the calendar, tied to its customer", async () => {
    const r = await call(apptRoute, "POST", {
        customerId: dave.customerId,
        jobId: furnace.jobId,
        day: "2026-11-12",
        startMinutes: 660,
        durationMinutes: 120,
        address: "2210 Wren Hollow Rd",
    });
    assert.equal(r.status, 201);

    const all = (await call(apptRoute, "GET")).json;
    assert.equal(all.appointments.length, 1);
    assert.equal(all.appointments[0].jobId, furnace.jobId);
    assert.deepEqual(all.customers.map((c) => c.name).sort(), ["Carol Ostrander", "Dave Kowalski"]);
    assert.deepEqual(all.jobs.map((j) => j.service), ["Furnace repair"]);
    assert.deepEqual(
        all.followUps.map((f) => [f.title, f.dueAt, f.customerId]),
        [["Send the thermostat quote", "2026-11-18", dave.customerId]],
        "open follow-ups with a due date show on the calendar",
    );

    // And the customer's record sees it, for Coming up and the job's visits.
    const rec = await (await detailRoute.GET(new Request("https://portal.test/x?site=your-hvac"), {
        params: Promise.resolve({ id: dave.customerId }),
    })).json();
    assert.deepEqual(rec.appointments.map((a) => a.id), [r.json.appointment.id]);
});

test("appointments read in time order, and moving one re-sorts it", async () => {
    const late = await call(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-19", startMinutes: 900 });
    await call(apptRoute, "POST", { customerId: carol.customerId, day: "2026-11-12", startMinutes: 870, kind: "estimate" });
    let days = (await call(apptRoute, "GET")).json.appointments.map((a) => a.day);
    assert.deepEqual(days, ["2026-11-12", "2026-11-19"]);

    const moved = await call(apptRoute, "PATCH", { id: late.json.appointment.id, day: "2026-11-10" });
    assert.equal(moved.status, 200);
    assert.equal(moved.json.appointment.startMinutes, 900, "a drag keeps the time");
    days = (await call(apptRoute, "GET")).json.appointments.map((a) => a.day);
    assert.deepEqual(days, ["2026-11-10", "2026-11-12"]);

    await call(apptRoute, "PATCH", { id: late.json.appointment.id, status: "done" });
    assert.equal((await call(apptRoute, "GET")).json.appointments[0].status, "done");
});

test("a job can only be booked for its own customer", async () => {
    const r = await call(apptRoute, "POST", { customerId: carol.customerId, jobId: furnace.jobId, day: "2026-11-19" });
    assert.equal(r.status, 400);
});

test("deleting a job takes its visits with it", async () => {
    await call(apptRoute, "POST", { customerId: dave.customerId, jobId: furnace.jobId, day: "2026-11-12" });
    await call(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-13" });
    await call(jobsRoute, "DELETE", { jobId: furnace.jobId });
    const left = (await call(apptRoute, "GET")).json.appointments;
    assert.deepEqual(left.map((a) => a.day), ["2026-11-13"], "only the job's own visit went");
});

test("Starter is refused, and another account sees and touches nothing", async () => {
    const a = await call(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-12" });
    as(OWNER, { ...GROWTH, plan: "starter" });
    assert.equal((await call(apptRoute, "GET")).status, 403);
    as(STRANGER);
    assert.deepEqual((await call(apptRoute, "GET")).json.appointments, []);
    assert.equal((await call(apptRoute, "PATCH", { id: a.json.appointment.id, day: "2026-11-13" })).status, 404);
    assert.equal((await call(apptRoute, "DELETE", { id: a.json.appointment.id })).status, 404);
    assert.equal((await call(apptRoute, "POST", { customerId: dave.customerId, day: "2026-11-12" })).status, 404);
    as(OWNER);
    assert.equal((await call(apptRoute, "GET")).json.appointments[0].day, "2026-11-12");
});
