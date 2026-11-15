/**
 * The client missed-call safety net (app/lib/client-call-reconcile.ts).
 *
 * The vendor responses are RECORDED from the `_e2e_test_growth` fixture client on 2026-11-15 by
 * scripts/record-reconcile-fixtures.mjs, then scrubbed. They hold the cases that matter, as they
 * really happened: seven connected callbacks that each have their row, two dropped callbacks
 * (2026-11-09) the gate excludes that have NO row, and one dropped callback (2026-11-08) that has
 * a row from before the gate existed. They also hold two vendor facts nobody would write by hand:
 * Airtable's `Date` equals Retell's `start_timestamp` to the millisecond, and asking a
 * single-site base for `Site` fails the whole request (422 UNKNOWN_FIELD_NAME).
 *
 * Where a test needs a missing row, it serves the recorded list without that one record, which is
 * exactly what Airtable answers when the row was never written. Where it needs an enterprise
 * base, it adds a `Site` value to recorded rows (no enterprise client exists to record from).
 *
 * The network is the only double: the real reconcile, the real @upstash/redis client against an
 * in-memory Upstash (test/fake-upstash.mjs), the real @jdd/schema gate.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);

import { fakeUpstash } from "./fake-upstash.mjs";

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    AIRTABLE_API_KEY: "airtable-test-key",
    RETELL_API_KEY: "retell-test-key",
});

const { Redis } = await import("@upstash/redis");
const { CALL_PROFILE_INDEX, callProfileKey, shouldLogCall } = await import("@jdd/schema");
const R = await import("../app/lib/client-call-reconcile.ts");
R.setRetellPacing(0);

const FIX = JSON.parse(readFileSync(new URL("./fixtures/call-reconcile/e2e_test_growth.json", import.meta.url), "utf8"));
const CALLS = FIX.listCalls.flatMap((p) => p.body.items);
const ROWS = FIX.airtableList.body.records;
const GET_CALL = FIX.getCall.body; // call_1a46a61…, the newest connected callback
const byId = (id) => CALLS.find((c) => c.call_id === id);
const rowFor = (call) => ROWS.find((r) => Date.parse(r.fields.Date) === call.start_timestamp);

const HOUR = 60 * 60 * 1000;
/** Half a day after the newest recorded call: every call is settled and inside the 7-day window. */
const NOW = Math.max(...CALLS.map((c) => c.end_timestamp)) + 12 * HOUR;
const HOOK = "https://hook.us2.make.com/" + "e2egrowthclonehook0000000000000a";
const ACCT = "0123456789abcdef";

const profile = (over = {}) => ({
    v: 1,
    acctScope: ACCT,
    siteSlug: "_e2e_test_growth",
    label: "E2E Test Growth",
    retellAgentId: FIX.agentId,
    airtableBaseId: FIX.baseId,
    airtableTable: "Call Log",
    siteColumn: null,
    hookUrl: HOOK,
    updatedAt: "2026-11-15T00:00:00.000Z",
    ...over,
});

/* ── the network ──────────────────────────────────────────────────────────── */

const kv = fakeUpstash({ url: KV_URL });
const redis = new Redis({ url: KV_URL, token: "test-token" });
let net;

/** Airtable as recorded, answering the reconcile's `IS_AFTER` / `IS_BEFORE` window on `Date`. */
function airtable(url) {
    const u = new URL(url);
    const fields = u.searchParams.getAll("fields[]");
    if (fields.includes("Site") && !net.enterprise) return Response.json(FIX.airtableUnknownField.body, { status: 422 });
    const formula = u.searchParams.get("filterByFormula") ?? "";
    const after = /IS_AFTER\(\{Date\}, '([^']+)'\)/.exec(formula)?.[1];
    const before = /IS_BEFORE\(\{Date\}, '([^']+)'\)/.exec(formula)?.[1];
    const records = net
        .rows({ narrow: Boolean(before) })
        .filter((r) => (!after || Date.parse(r.fields.Date) > Date.parse(after)) && (!before || Date.parse(r.fields.Date) < Date.parse(before)));
    return Response.json({ records });
}

/** Retell's v3 list-calls as recorded, honouring the agent and `start_timestamp ge` filter. */
function listCalls(init) {
    const { filter_criteria: f } = JSON.parse(init.body);
    assert.equal(f.start_timestamp.op, "ge");
    const items = CALLS.filter((c) => f.agent_id.includes(c.agent_id) && c.start_timestamp >= f.start_timestamp.value);
    return Response.json({ items, has_more: false });
}

const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.reset();
    net = { rows: () => ROWS, enterprise: false, hookPosts: [], requests: [], hookStatus: 200 };
    globalThis.fetch = async (input, init = {}) => {
        if (kv.owns(input)) return kv.handle(input, init);
        const url = String(input);
        net.requests.push(url);
        if (url.startsWith("https://api.airtable.com/")) return airtable(url);
        // A 429 is a bare status here: no Retell 429 body has been recorded, and the reconcile
        // reads nothing but the status.
        if (url.startsWith("https://api.retellai.com/") && net.retellBusy) return new Response(null, { status: 429 });
        if (url === "https://api.retellai.com/v3/list-calls") return listCalls(init);
        if (url.startsWith("https://api.retellai.com/v2/get-call/")) {
            const id = decodeURIComponent(url.split("/").pop());
            return id === GET_CALL.call_id ? Response.json(GET_CALL) : Response.json({ error: "not recorded" }, { status: 404 });
        }
        if (url === net.hookUrl || url.startsWith("https://hook.")) {
            net.hookPosts.push({ url, body: JSON.parse(init.body) });
            return new Response("Accepted", { status: net.hookStatus });
        }
        throw new Error(`unexpected request to ${new URL(url).hostname}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

async function publish(p = profile()) {
    const key = callProfileKey(p.acctScope, p.siteSlug);
    await redis.set(key, p);
    await redis.sadd(CALL_PROFILE_INDEX, key);
    // Open the window a week back, as a site that has been reconciled all along would be.
    await redis.set(R.cursorKey(p), NOW - 7 * 24 * HOUR + 2 * HOUR);
    return p;
}
const run = (now = NOW) => R.reconcileClientCalls({ now, redis });
const without = (...calls) => () => ROWS.filter((r) => !calls.some((c) => rowFor(c)?.id === r.id));

/* ── the recorded week ────────────────────────────────────────────────────── */

test("the recorded week: every connected call has its row, so nothing is replayed", async () => {
    await publish();
    const r = await run();
    const site = r.results[0];
    assert.equal(site.error, undefined);
    assert.equal(site.replayed, 0);
    assert.equal(site.present, 4); // the four connected callbacks inside the window
    assert.equal(site.excluded, 3); // three dropped callbacks
    assert.equal(net.hookPosts.length, 0);
    assert.equal(net.requests.filter((u) => u.includes("/get-call/")).length, 0);
    assert.equal(await redis.smembers(R.ALERT_INDEX).then((s) => s.length), 0);
});

test("a call the gate excludes is never replayed, even with no row at all", async () => {
    await publish();
    net.rows = () => []; // the clone wrote nothing this week
    await run();
    const excluded = CALLS.filter((c) => !shouldLogCall({ event: "call_analyzed", call: c })).map((c) => c.call_id);
    assert.ok(excluded.length >= 3);
    const touched = net.requests.filter((u) => u.includes("/get-call/")).map((u) => decodeURIComponent(u.split("/").pop()));
    for (const id of excluded) {
        assert.ok(!touched.includes(id), `${id} was re-fetched for replay`);
        assert.ok(!net.hookPosts.some((p) => p.body.call.call_id === id), `${id} was replayed`);
    }
    // The 2026-11-09 dropped callbacks really have no row: this is the case, not a construction.
    assert.equal(rowFor(byId(excluded.find((id) => id.startsWith("call_910dea7")) ?? excluded[0])), undefined);
});

test("a present row is never replayed", async () => {
    await publish();
    await run();
    await run(NOW + 15 * 60 * 1000);
    assert.equal(net.hookPosts.length, 0);
});

/* ── missing → replay once → alert ───────────────────────────────────────── */

test("a missing call is replayed once, Retell-shaped, through the client's own hook", async () => {
    await publish();
    net.rows = without(GET_CALL);
    const r = await run();
    assert.equal(r.replayed, 1);
    assert.equal(net.hookPosts.length, 1);
    assert.equal(net.hookPosts[0].url, HOOK);
    assert.deepEqual(net.hookPosts[0].body, { event: "call_analyzed", call: GET_CALL });
    const claim = await redis.get(R.replayKey(GET_CALL.call_id));
    assert.equal(claim.status, 200);
});

test("still missing on a later run: no second replay, and an alert with the count", async () => {
    await publish();
    net.rows = without(GET_CALL);
    await run();
    // The next cron, 15 minutes on. Make never wrote the row: the clone is off.
    const later = await run(NOW + 15 * 60 * 1000);
    assert.equal(later.replayed, 0);
    assert.equal(later.stillMissing, 1);
    assert.equal(net.hookPosts.length, 1);
    const alert = await redis.get(R.alertKey(profile()));
    assert.equal(alert.label, "E2E Test Growth");
    assert.equal(alert.missing.length, 1);
    assert.equal(alert.missing[0].callId, GET_CALL.call_id);
    assert.deepEqual(await redis.smembers(R.ALERT_INDEX), [R.alertKey(profile())]);
    // And again: still one replay, still one missing call, and the call isn't even re-fetched.
    await run(NOW + 30 * 60 * 1000);
    assert.equal(net.hookPosts.length, 1);
    assert.equal(net.requests.filter((u) => u.includes("/get-call/")).length, 1);
    assert.equal((await redis.get(R.alertKey(profile()))).missing.length, 1);
});

test("the alert waits for the next run: a replay just sent is not yet an alert", async () => {
    await publish();
    net.rows = without(GET_CALL);
    const r = await run();
    assert.equal(r.stillMissing, 0);
    assert.equal(await redis.get(R.alertKey(profile())), null);
});

test("a run soon after a replay (a manual one) doesn't alert yet: Make gets ten minutes", async () => {
    await publish();
    net.rows = without(GET_CALL);
    await run();
    const soon = await run(NOW + 5 * 60 * 1000);
    assert.equal(soon.stillMissing, 0);
    assert.equal(await redis.get(R.alertKey(profile())), null);
});

test("the gate is applied again to the fresh get-call: an analysis that now says dropped is not replayed", async () => {
    await publish();
    net.rows = without(GET_CALL);
    // Retell re-analysed the call between the two reads. The analysis it now carries is the
    // recorded one of the 2026-11-09 dropped callback, which the gate excludes.
    const dropped = CALLS.find((c) => !shouldLogCall({ event: "call_analyzed", call: c }) && !rowFor(c));
    const realGet = GET_CALL.call_analysis;
    GET_CALL.call_analysis = dropped.call_analysis;
    try {
        const r = await run();
        assert.equal(r.replayed, 0);
        assert.equal(net.hookPosts.length, 0);
    } finally {
        GET_CALL.call_analysis = realGet;
    }
});

test("a replayed call still inside the overlap is judged, not re-fetched or re-sent", async () => {
    // 31 minutes after the call ended: replayed now, and still in the window 15 minutes later.
    const soon = GET_CALL.end_timestamp + 31 * 60 * 1000;
    await publish();
    net.rows = without(GET_CALL);
    await run(soon);
    const later = await run(soon + 15 * 60 * 1000);
    assert.equal(later.results[0].scanned > 0, true);
    assert.equal(later.stillMissing, 1);
    assert.equal(net.requests.filter((u) => u.includes("/get-call/")).length, 1);
    assert.equal(net.hookPosts.length, 1);
});

test("the row turning up clears the alert", async () => {
    await publish();
    net.rows = without(GET_CALL);
    await run();
    await run(NOW + 15 * 60 * 1000);
    assert.ok(await redis.get(R.alertKey(profile())));
    net.rows = () => ROWS; // someone turned the scenario back on and Make caught up
    const r = await run(NOW + 30 * 60 * 1000);
    assert.equal(r.results[0].resolved, 1);
    assert.equal(await redis.get(R.alertKey(profile())), null);
    assert.deepEqual(await redis.smembers(R.ALERT_INDEX), []);
    assert.deepEqual(await redis.smembers(R.watchKey(profile())), []);
});

test("two overlapping runs replay once", async () => {
    await publish();
    net.rows = without(GET_CALL);
    await Promise.all([run(), run()]);
    assert.equal(net.hookPosts.length, 1);
});

test("the re-check right before replaying finds a row Make wrote meanwhile, and sends nothing", async () => {
    await publish();
    // The window read misses the row; the narrow re-check of that one call sees it.
    net.rows = ({ narrow }) => (narrow ? ROWS : without(GET_CALL)());
    const r = await run();
    assert.equal(r.replayed, 0);
    assert.equal(net.hookPosts.length, 0);
    assert.equal(await redis.get(R.replayKey(GET_CALL.call_id)), null);
});

test("a hook that can't be reached is still a replay: judged next run, never retried", async () => {
    await publish();
    net.rows = without(GET_CALL);
    net.hookStatus = 410; // what Make answers for a hook that no longer exists
    await run();
    await run(NOW + 15 * 60 * 1000);
    assert.equal(net.hookPosts.length, 1);
    assert.equal((await redis.get(R.replayKey(GET_CALL.call_id))).status, 410);
    assert.equal((await redis.get(R.alertKey(profile()))).missing.length, 1);
});

/* ── enterprise ──────────────────────────────────────────────────────────── */

test("enterprise: only a row tagged with THIS site counts; another site's row at the same ms does not", async () => {
    await publish(profile({ siteSlug: "acme-2", siteColumn: "acme-2" }));
    net.enterprise = true;
    const tagged = (site) => () => ROWS.map((r) => ({ ...r, fields: { ...r.fields, Site: site } }));

    net.rows = tagged("acme-1");
    const other = await run();
    assert.equal(other.replayed, 1, "a row from acme-1 is not acme-2's call");

    kv.reset();
    net.hookPosts = [];
    await publish(profile({ siteSlug: "acme-2", siteColumn: "acme-2" }));
    net.rows = tagged("acme-2");
    const own = await run();
    assert.equal(own.replayed, 0);
    assert.ok(net.requests.some((u) => new URL(u).searchParams?.getAll?.("fields[]")?.includes("Site")));
});

test("enterprise: a blank Site at the exact millisecond is this call (a replay would duplicate it)", async () => {
    await publish(profile({ siteSlug: "acme-2", siteColumn: "acme-2" }));
    net.enterprise = true;
    const r = await run(); // recorded rows carry no Site at all
    assert.equal(r.replayed, 0);
});

test("a single-site base is never asked for Site, which would fail the whole read", async () => {
    await publish();
    const r = await run();
    assert.equal(r.failed, 0);
    assert.ok(!net.requests.some((u) => u.includes("Site")));
});

/* ── profiles ────────────────────────────────────────────────────────────── */

test("a profile whose hook is not a Make webhook is never acted on", async () => {
    await publish(profile({ hookUrl: "https://www.juneaudigitaldesigns.com/api/ingest/call" }));
    net.rows = () => [];
    const r = await run();
    assert.equal(r.invalid, 1);
    assert.equal(r.checked, 0);
    assert.equal(net.requests.length, 0);
});

test("the hook URL never reaches the run record or the alert", async () => {
    await publish();
    net.rows = without(GET_CALL);
    await run();
    await run(NOW + 15 * 60 * 1000);
    const secret = HOOK.split("/").pop();
    for (const key of [R.LAST_RUN_KEY, R.alertKey(profile()), R.replayKey(GET_CALL.call_id)]) {
        assert.ok(!JSON.stringify(await redis.get(key)).includes(secret), key);
    }
});

test("the cursor moves to the settle line, so the next run re-reads only the overlap", async () => {
    await publish();
    await run();
    assert.equal(await redis.get(R.cursorKey(profile())), NOW - R.SETTLE_MS);
});

/* ── sharing Retell with live calls ──────────────────────────────────────── */

test("a 429 stops the client pass at once: no retry, no replay, cursor kept, the rest left for the next run", async () => {
    // Live calls (/api/voice/no-answer, /api/contact) may share this account's 30 requests per 10 s.
    // A 429 there is a caller who never reaches the agent, so this pass never pushes back.
    const first = await publish();
    const second = await publish(profile({ siteSlug: "_e2e_test_growth_b", acctScope: "fedcba9876543210" }));
    net.rows = without(GET_CALL);
    net.retellBusy = true;
    const before = await redis.get(R.cursorKey(first));
    const r = await run();
    assert.equal(net.requests.filter((u) => u.startsWith("https://api.retellai.com/")).length, 1);
    assert.equal(r.replayed, 0);
    assert.equal(r.failed, 0);
    assert.equal(r.skipped, 2);
    assert.equal(net.hookPosts.length, 0);
    const busySite = r.results[0].site === first.siteSlug ? first : second;
    assert.equal(await redis.get(R.cursorKey(busySite)), before);

    // The next run, with Retell free again, starts from that same site and replays the call.
    net.retellBusy = false;
    const next = await run(NOW + 15 * 60 * 1000);
    assert.equal(next.results[0].site, busySite.siteSlug);
    assert.equal(net.hookPosts.length, 1);
});
