/**
 * Read and unread in the Inbox (Xander, 2026-11-12: "make this feel a little bit more like an
 * email inbox").
 *
 * Opening a lead marks it read; Mark unread puts it back. The state is ours, kept in KV beside
 * the archive set, because a call's row is the client's own Airtable log and not ours to write.
 * One store for both sources, so Mark unread works the same on a call and a web enquiry.
 *
 * Runs the real store against the in-memory Upstash fake, and the real `buildInbox`.
 *
 * Run: `npm test`
 */

import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);

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
after(() => {
    globalThis.fetch = realFetch;
});

const { setRead, readRefs, purgeRead, parseReadRequest, READ_TTL_SECONDS } = await import(
    "../app/lib/portal-inbox-read.ts"
);
const { buildInbox } = await import("../app/lib/crm-contacts.ts");

const ACCT = "acct_ridgeline";
const SLUG = "ridgeline-plumbing";
const CALL = "recAAAAAAAAAAAAAA";
const CALL_2 = "recBBBBBBBBBBBBBB";
const LEAD = "lead:L123";

beforeEach(() => redis.reset());

/* ── the store ────────────────────────────────────────────────────────────── */

test("marking read adds the ids, and unread takes them back out", async () => {
    await setRead(ACCT, SLUG, [CALL, LEAD], true);
    assert.deepEqual([...(await readRefs(ACCT, SLUG))].sort(), [CALL, LEAD].sort());

    await setRead(ACCT, SLUG, [LEAD], false);
    assert.deepEqual([...(await readRefs(ACCT, SLUG))], [CALL]);
});

test("the read set carries the same 400-day backstop as the archive", async () => {
    await setRead(ACCT, SLUG, [CALL], true);
    const expire = redis.commands.find((c) => c[0] === "expire");
    assert.ok(expire, "no TTL was set on the read set");
    assert.equal(Number(expire[2]), READ_TTL_SECONDS);
    assert.equal(READ_TTL_SECONDS, 60 * 60 * 24 * 400);
});

test("read state is per site, so one site's reading never marks another's", async () => {
    await setRead(ACCT, SLUG, [CALL], true);
    assert.equal((await readRefs(ACCT, "other-site")).size, 0);
    assert.equal((await readRefs("acct_other", SLUG)).size, 0);
});

test("nothing to mark is a no-op, not a malformed SADD", async () => {
    await setRead(ACCT, SLUG, [], true);
    await setRead(ACCT, SLUG, [], false);
    assert.equal(redis.commands.length, 0);
});

test("teardown removes the read set", async () => {
    await setRead(ACCT, SLUG, [CALL, CALL_2], true);
    assert.equal(await purgeRead(ACCT, SLUG), 2);
    assert.equal((await readRefs(ACCT, SLUG)).size, 0);
});

/* ── the request ──────────────────────────────────────────────────────────── */

test("the request keeps only real inbox ids, and reads as 'read' unless told otherwise", () => {
    assert.deepEqual(parseReadRequest({ ids: [CALL, "nope", LEAD, 7, "lead:../x"] }), {
        ok: true,
        ids: [CALL, LEAD],
        read: true,
    });
    assert.deepEqual(parseReadRequest({ ids: [CALL], read: false }), { ok: true, ids: [CALL], read: false });
});

test("an empty or oversized request is refused before it reaches a key", () => {
    assert.equal(parseReadRequest({ ids: [] }).ok, false);
    assert.equal(parseReadRequest({}).ok, false);
    assert.equal(parseReadRequest(null).ok, false);
    const many = Array.from({ length: 101 }, (_, i) => `lead:L${i}`);
    assert.equal(parseReadRequest({ ids: many }).ok, false);
});

/* ── the inbox ────────────────────────────────────────────────────────────── */

const call = (id) => ({
    id,
    date: "2026-11-12T15:00:00.000Z",
    callerName: "Dana Whitfield",
    callerNumber: "+19075550187",
    callbackNumber: null,
    summary: "Kitchen sink backing up.",
    durationSeconds: 118,
    recordingUrl: null,
    email: null,
    address: null,
    outcome: null,
    callType: "inbound",
    site: SLUG,
    priority: null,
});
const lead = (leadId, readAt = null) => ({
    leadId,
    slug: SLUG,
    name: "Marcus Bell",
    phone: "+19075550119",
    phoneRaw: null,
    email: null,
    message: "Water heater quote.",
    fields: {},
    createdAt: "2026-11-12T14:00:00.000Z",
    readAt,
    source: "web-form",
    callbackPlaced: false,
});

test("one read set marks calls and web enquiries alike", () => {
    const items = buildInbox({
        calls: [call(CALL), call(CALL_2)],
        leads: [lead("L123"), lead("L456")],
        readIds: new Set([CALL, LEAD]),
    });
    const byId = Object.fromEntries(items.map((i) => [i.id, i.read]));
    assert.equal(byId[CALL], true);
    assert.equal(byId[CALL_2], false);
    assert.equal(byId[LEAD], true);
    assert.equal(byId["lead:L456"], false);
});

test("a lead's first-seen stamp does not pin it read, so Mark unread can undo it", () => {
    const [item] = buildInbox({ calls: [], leads: [lead("L123", "2026-11-12T14:05:00.000Z")] });
    assert.equal(item.read, false);
});
