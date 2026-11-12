/**
 * Jobs and notes on a customer (customer card rework, Xander 2026-11-12).
 *
 * Real routes and stores against an in-memory Upstash (`fake-upstash.mjs`); only the Clerk
 * session lookup is stubbed (`portal-crm-hook.mjs`). What is held here:
 * - a customer has several jobs, each with its own status, and "Paid" is one of them;
 * - the board's value becomes the jobs total (cancelled jobs left out);
 * - notes are a list, the old single note shows as the oldest, and editing or deleting it works;
 * - notes appear on the timeline and leave it when deleted;
 * - Starter is refused, and one account cannot reach another's jobs or notes.
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
const STARTER = { ...GROWTH, plan: "starter" };
const as = (email, site = GROWTH) => {
    globalThis.__portalCrm = { email, site };
};

const crm = await import("../app/lib/portal-crm.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const jobsRoute = await import("../app/api/portal/jobs/route.ts");
const notesRoute = await import("../app/api/portal/notes/route.ts");
const detailRoute = await import("../app/api/portal/customers/[id]/route.ts");
const {
    JOB_STATUSES,
    JOB_STATUS_LABEL,
    jobsTotal,
    parseAmount,
    parseJobPatch,
    parseNewJob,
    LEGACY_NOTE_ID,
} = await import("../app/lib/crm-jobs.ts");

const OWNER = "owner@yourhvac.test";
const STRANGER = "someone@else.test";

const req = (method, body) =>
    new Request("https://portal.test/api?site=your-hvac", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
const call = async (route, method, body) => {
    const res = await route[method](req(method, body));
    return { status: res.status, json: await res.json() };
};
const detail = async (id) => {
    const res = await detailRoute.GET(new Request(`https://portal.test/api/portal/customers/${id}?site=your-hvac`), {
        params: Promise.resolve({ id }),
    });
    return res.json();
};

let dave;
beforeEach(async () => {
    redis.reset();
    as(OWNER);
    const made = await crm.createCustomer(
        accountScope(OWNER),
        GROWTH.slug,
        {
            name: "Dave Kowalski",
            phone: null,
            address: "2210 Wren Hollow Rd",
            source: "manual",
            note: "Two kids at home.",
        },
        "user_test",
    );
    dave = made.customer;
});

/* ── the rules ────────────────────────────────────────────────────────────── */

test("a job's own statuses, Paid among them", () => {
    assert.deepEqual([...JOB_STATUSES], ["quoted", "booked", "done", "paid", "cancelled"]);
    assert.equal(JOB_STATUS_LABEL.paid, "Paid");
});

test("the total leaves out cancelled jobs and counts paid ones", () => {
    assert.equal(jobsTotal([]), null, "no jobs, no total: a hand-typed value stays");
    assert.equal(
        jobsTotal([
            { status: "booked", amount: 385 },
            { status: "paid", amount: 240 },
            { status: "cancelled", amount: 5000 },
            { status: "quoted", amount: null },
        ]),
        625,
    );
});

test("amounts are read the way a client types them", () => {
    assert.equal(parseAmount("$1,250"), 1250);
    assert.equal(parseAmount("385.50"), 386);
    assert.equal(parseAmount(""), null);
    assert.equal(parseAmount("about 400"), undefined);
    assert.equal(parseAmount(-5), undefined);
});

test("a job always has a service", () => {
    assert.equal(parseNewJob({ service: "  " }).ok, false);
    assert.equal(parseJobPatch({ service: "" }).ok, false);
    assert.equal(parseJobPatch({ status: "lost" }).ok, false);
    const ok = parseNewJob({ service: "Furnace repair", amount: "$385" });
    assert.deepEqual(ok, {
        ok: true,
        value: { service: "Furnace repair", status: "quoted", amount: 385, address: null, notes: null },
    });
});

/* ── jobs through the route ───────────────────────────────────────────────── */

test("several jobs per customer, and the board's value follows them", async () => {
    const a = await call(jobsRoute, "POST", { customerId: dave.customerId, service: "Furnace repair", amount: 385, status: "booked" });
    assert.equal(a.status, 201);
    assert.equal(a.json.job.address, "2210 Wren Hollow Rd", "starts at the customer's address");
    const b = await call(jobsRoute, "POST", { customerId: dave.customerId, service: "Thermostat swap", amount: "$240" });
    assert.equal(b.json.job.status, "quoted");

    let rec = await detail(dave.customerId);
    assert.equal(rec.jobs.length, 2);
    assert.equal(rec.customer.value, 625);

    await call(jobsRoute, "PATCH", { jobId: b.json.job.jobId, status: "cancelled" });
    rec = await detail(dave.customerId);
    assert.equal(rec.customer.value, 385, "a cancelled job stops counting");

    await call(jobsRoute, "PATCH", { jobId: a.json.job.jobId, status: "paid" });
    rec = await detail(dave.customerId);
    assert.equal(rec.jobs.find((j) => j.jobId === a.json.job.jobId).status, "paid");
    assert.equal(rec.customer.value, 385);

    await call(jobsRoute, "DELETE", { jobId: a.json.job.jobId });
    await call(jobsRoute, "DELETE", { jobId: b.json.job.jobId });
    rec = await detail(dave.customerId);
    assert.equal(rec.jobs.length, 0);
    assert.equal(rec.customer.value, null, "no jobs left, nothing to total");
});

test("blanking a job's service is refused, not saved", async () => {
    const a = await call(jobsRoute, "POST", { customerId: dave.customerId, service: "Furnace repair" });
    const r = await call(jobsRoute, "PATCH", { jobId: a.json.job.jobId, service: "" });
    assert.equal(r.status, 400);
    assert.equal((await detail(dave.customerId)).jobs[0].service, "Furnace repair");
});

test("another account cannot add to, change or delete this account's jobs", async () => {
    const a = await call(jobsRoute, "POST", { customerId: dave.customerId, service: "Furnace repair" });
    as(STRANGER);
    assert.equal((await call(jobsRoute, "POST", { customerId: dave.customerId, service: "x" })).status, 404);
    assert.equal((await call(jobsRoute, "PATCH", { jobId: a.json.job.jobId, amount: 1 })).status, 404);
    assert.equal((await call(jobsRoute, "DELETE", { jobId: a.json.job.jobId })).status, 404);
    as(OWNER);
    assert.equal((await detail(dave.customerId)).jobs.length, 1);
});

test("Starter is refused", async () => {
    as(OWNER, STARTER);
    assert.equal((await call(jobsRoute, "POST", { customerId: dave.customerId, service: "x" })).status, 403);
    assert.equal((await call(notesRoute, "POST", { customerId: dave.customerId, body: "x" })).status, 403);
});

/* ── notes ────────────────────────────────────────────────────────────────── */

test("notes are a list, newest first, with the old single note as the oldest", async () => {
    await call(notesRoute, "POST", { customerId: dave.customerId, body: "Prefers a text over a call." });
    await new Promise((r) => setTimeout(r, 5));
    await call(notesRoute, "POST", { customerId: dave.customerId, body: "Side gate sticks." });
    const rec = await detail(dave.customerId);
    assert.deepEqual(
        rec.notes.map((n) => n.body),
        ["Side gate sticks.", "Prefers a text over a call.", "Two kids at home."],
    );
    assert.equal(rec.notes.at(-1).noteId, LEGACY_NOTE_ID);
});

test("notes show on the timeline under the client's name, and leave it when deleted", async () => {
    const n = await call(notesRoute, "POST", { customerId: dave.customerId, body: "Side gate sticks." });
    let rec = await detail(dave.customerId);
    const entry = rec.timeline.find((e) => e.id === `note:${n.json.note.noteId}`);
    assert.ok(entry, "the note is on the timeline");
    assert.equal(entry.kind, "note");
    assert.equal(entry.summary, "You added a note");
    assert.equal(entry.meta.detail, "Side gate sticks.");

    await call(notesRoute, "DELETE", { noteId: n.json.note.noteId });
    rec = await detail(dave.customerId);
    assert.ok(!rec.timeline.some((e) => e.id === `note:${n.json.note.noteId}`));
});

test("editing the old single note turns it into a real one; deleting it clears it", async () => {
    const e = await call(notesRoute, "PATCH", {
        noteId: LEGACY_NOTE_ID,
        customerId: dave.customerId,
        body: "Two kids at home. Furnace is in the hall closet.",
    });
    assert.equal(e.status, 200);
    let rec = await detail(dave.customerId);
    assert.equal(rec.customer.note, null);
    assert.equal(rec.notes.length, 1);
    assert.notEqual(rec.notes[0].noteId, LEGACY_NOTE_ID);
    assert.equal(rec.notes[0].body, "Two kids at home. Furnace is in the hall closet.");
    assert.ok(rec.notes[0].updatedAt, "it reads as edited");

    await crm.updateCustomer(accountScope(OWNER), GROWTH.slug, dave.customerId, { note: "Old note" }, "user_test");
    await call(notesRoute, "DELETE", { noteId: LEGACY_NOTE_ID, customerId: dave.customerId });
    rec = await detail(dave.customerId);
    assert.equal(rec.customer.note, null);
    assert.ok(!rec.notes.some((n) => n.noteId === LEGACY_NOTE_ID));
});

test("another account cannot read, change or delete this account's notes", async () => {
    const n = await call(notesRoute, "POST", { customerId: dave.customerId, body: "Gate code is on the fridge." });
    as(STRANGER);
    assert.equal((await call(notesRoute, "PATCH", { noteId: n.json.note.noteId, body: "x" })).status, 404);
    assert.equal((await call(notesRoute, "DELETE", { noteId: n.json.note.noteId })).status, 404);
    assert.equal((await call(notesRoute, "POST", { customerId: dave.customerId, body: "x" })).status, 404);
    as(OWNER);
    assert.equal((await detail(dave.customerId)).notes[0].body, "Gate code is on the fridge.");
});
