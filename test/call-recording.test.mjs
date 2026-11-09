/**
 * A call recording plays for the signed-in owner of that account and for nobody else.
 *
 * Measured 2026-11-09: a Retell recording link opens with no login, and the portal handed it to
 * the browser in the call list's JSON and in `<audio src>`. Anyone who ever saw one could keep it
 * and share it, for good.
 *
 * The vendor responses in test/fixtures/recordings/ were recorded from one `_e2e_test_growth`
 * call on 2026-11-09, then scrubbed of its numbers, caller details and links. They carry two
 * things worth knowing that nobody would have written by hand: Retell's time filter is
 * `{type:"number",op:"eq",value}` (a bare `{op,value}` is a 400), and Airtable answers an id
 * from another base with a 403, not a 404.
 *
 * Real route, real account store, real KV helpers. Only the network is doubled.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { readFileSync } from "node:fs";

register("./server-only-hook.mjs", import.meta.url);
register("./recording-route-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    AIRTABLE_API_KEY: "airtable-test-key",
    RETELL_API_KEY: "retell-test-key",
});

const fixture = (name) =>
    JSON.parse(readFileSync(new URL(`./fixtures/recordings/${name}.json`, import.meta.url), "utf8"));
const ROW = fixture("airtable-record");
const ROW_FORBIDDEN = fixture("airtable-record-missing");
const LIST = fixture("retell-list-calls");
const LIST_EMPTY = fixture("retell-list-calls-empty");
const GET_CALL = fixture("retell-get-call");

const { GET } = await import("../app/api/portal/calls/[id]/recording/route.ts");
const { fetchCalls } = await import("../app/lib/airtable-calls.ts");
const { pickRetellCall, isRetellRecordingHost } = await import("../app/lib/call-recording.ts");
const { accountScope } = await import("../app/lib/portal-kv.ts");
const { accountKey, accountByUserKey } = await import("@jdd/schema");

const USER = "user_owner";
const EMAIL = "owner@example.test";
const BASE = "appOWNERBASE00000";
const SLUG = "owners-site";
const AGENT = LIST.body.items[0].agent_id;
const RECORD = "recRECORDEDFIXTUR";
const STORED = ROW.body.fields["Recording URL"];
/** Stands in for whatever Retell mints: the route must use it without parsing it. */
const CURRENT = "https://dxc03zgurdly9.cloudfront.net/CURRENT/recording.wav";

const site = (over = {}) => ({
    slug: SLUG,
    name: "Owner's Site",
    plan: "growth",
    status: "live",
    airtableBaseId: BASE,
    retellAgentId: AGENT,
    addedAt: 0,
    ...over,
});
const account = (sites = [site()]) => ({
    email: EMAIL,
    sites,
    createdAt: 0,
    updatedAt: 0,
});

/* ── the network ──────────────────────────────────────────────────────────── */

const kv = new Map();
let requests;
let responses;
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");

function upstash([op, ...args]) {
    switch (op.toLowerCase()) {
        case "get":
            return kv.has(args[0]) ? b64(kv.get(args[0])) : null;
        case "set":
            kv.set(args[0], args[1]);
            return "OK";
        case "del":
            return kv.delete(args[0]) ? 1 : 0;
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

const recorded = ({ status, body }) => Response.json(body, { status });

const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    requests = [];
    responses = {
        airtable: () => recorded(ROW),
        list: () => recorded(LIST),
        getCall: () => recorded({ ...GET_CALL, body: { ...GET_CALL.body, recording_url: CURRENT } }),
        cdn: () => new Response("RIFFaudio", { status: 200, headers: { "content-length": "9", "accept-ranges": "bytes" } }),
    };
    globalThis.__recordingRoute = { userId: USER, rateLimited: false };
    kv.set(accountByUserKey(USER), JSON.stringify(EMAIL));
    kv.set(accountKey(EMAIL), JSON.stringify(account()));

    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        requests.push({ url, init });
        if (url.startsWith("https://api.airtable.com/")) return responses.airtable(url);
        if (url === "https://api.retellai.com/v3/list-calls") return responses.list(init);
        if (url.startsWith("https://api.retellai.com/v2/get-call/")) return responses.getCall(url);
        return responses.cdn(url, init);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

function play(id = RECORD, { site: slug = SLUG, range } = {}) {
    return GET(
        new Request(`https://portal.test/api/portal/calls/${id}/recording?site=${slug}`, {
            headers: range ? { range } : {},
        }),
        { params: Promise.resolve({ id }) },
    );
}
const vendorHits = () => requests.map((r) => new URL(r.url).hostname);
const cdnHits = () => requests.filter((r) => r.url.includes("cloudfront.net"));

/* ── who can play it ──────────────────────────────────────────────────────── */

test("signed out: refused before any vendor is asked", async () => {
    globalThis.__recordingRoute.userId = null;
    const res = await play();
    assert.equal(res.status, 401);
    assert.deepEqual(vendorHits(), []);
});

test("a signed-in user with no account here: refused before any vendor is asked", async () => {
    globalThis.__recordingRoute.userId = "user_stranger";
    const res = await play();
    assert.equal(res.status, 403);
    assert.deepEqual(vendorHits(), []);
});

test("another client's record id: Airtable refuses it from this base, and no audio is fetched", async () => {
    responses.airtable = () => recorded(ROW_FORBIDDEN);
    assert.equal(ROW_FORBIDDEN.status, 403, "the recording says what Airtable really answers");
    const res = await play("recOTHERCLIENT000");
    assert.equal(res.status, 404);
    assert.ok(requests[0].url.includes(`/v0/${BASE}/`), "read from the signed-in account's own base");
    assert.deepEqual(cdnHits(), []);
});

test("a shared base: a row tagged for the account's other site is not this site's", async () => {
    const other = site({ slug: "second-site" });
    kv.set(accountKey(EMAIL), JSON.stringify(account([site(), other])));
    responses.airtable = () => recorded({ ...ROW, body: { ...ROW.body, fields: { ...ROW.body.fields, Site: "second-site" } } });
    const res = await play();
    assert.equal(res.status, 404);
    assert.deepEqual(cdnHits(), []);
});

test("not a record id: refused without reading Airtable", async () => {
    const res = await play("../../secrets");
    assert.equal(res.status, 404);
    assert.deepEqual(vendorHits(), []);
});

/* ── what it plays ────────────────────────────────────────────────────────── */

test("plays the link Retell gives now, found by the row's exact start time", async () => {
    const res = await play();
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "RIFFaudio");
    assert.equal(res.headers.get("content-type"), "audio/wav");
    assert.equal(res.headers.get("cache-control"), "private, no-store");

    const list = requests.find((r) => r.url.endsWith("/v3/list-calls"));
    assert.deepEqual(JSON.parse(list.init.body).filter_criteria.start_timestamp, {
        type: "number",
        op: "eq",
        value: Date.parse(ROW.body.fields.Date),
    });
    assert.deepEqual(cdnHits().map((r) => r.url), [CURRENT], "the current link, not the stored one");
});

test("the vendor's link is nowhere in the response", async () => {
    const res = await play();
    const all = JSON.stringify([...res.headers]) + (await res.text());
    assert.doesNotMatch(all, /cloudfront/);
});

test("a seek is forwarded as a Range request and answered as one", async () => {
    responses.cdn = (_url, init) => {
        assert.equal(init.headers.Range, "bytes=100-199");
        return new Response("x".repeat(100), {
            status: 206,
            headers: { "content-length": "100", "content-range": "bytes 100-199/5514942", "accept-ranges": "bytes" },
        });
    };
    const res = await play(RECORD, { range: "bytes=100-199" });
    assert.equal(res.status, 206);
    assert.equal(res.headers.get("content-range"), "bytes 100-199/5514942");
});

test("an older call Retell can't match still plays, from its stored link", async () => {
    // The growth fixture's first calls ran on an agent that has since been replaced. Those rows
    // stay playable only through the link in the column.
    responses.list = () => recorded(LIST_EMPTY);
    const res = await play();
    assert.equal(res.status, 200);
    assert.deepEqual(cdnHits().map((r) => r.url), [STORED]);
});

test("Retell being down falls back to the stored link", async () => {
    responses.list = () => new Response("nope", { status: 500 });
    const res = await play();
    assert.equal(res.status, 200);
    assert.deepEqual(cdnHits().map((r) => r.url), [STORED]);
});

test("an expired stored link with no fresh one is a 404, and is not remembered", async () => {
    responses.list = () => recorded(LIST_EMPTY);
    responses.cdn = () => new Response("<Error>AccessDenied</Error>", { status: 403 });
    const res = await play();
    assert.equal(res.status, 404);
    assert.equal([...kv.keys()].filter((k) => k.startsWith("portal:recording:")).length, 0);
});

test("a stored link on a host Retell doesn't use is never fetched", async () => {
    responses.list = () => recorded(LIST_EMPTY);
    responses.airtable = () =>
        recorded({ ...ROW, body: { ...ROW.body, fields: { ...ROW.body.fields, "Recording URL": "http://169.254.169.254/latest/meta-data" } } });
    const res = await play();
    assert.equal(res.status, 404);
    assert.equal(requests.some((r) => r.url.includes("169.254")), false);
});

test("a row with no recording never reaches Retell", async () => {
    const { "Recording URL": _gone, ...fields } = ROW.body.fields;
    responses.airtable = () => recorded({ ...ROW, body: { ...ROW.body, fields } });
    const res = await play();
    assert.equal(res.status, 404);
    assert.deepEqual([...new Set(vendorHits())], ["api.airtable.com"]);
});

test("a seek inside the window reuses the resolved link instead of asking every vendor again", async () => {
    await (await play()).text();
    const first = requests.length;
    await (await play(RECORD, { range: "bytes=0-1" })).text();
    assert.equal(requests.length, first + 1, "only the CDN");
});

test("the cached link is held per account and site", async () => {
    await (await play()).text();
    const keys = [...kv.keys()].filter((k) => k.startsWith("portal:recording:"));
    assert.deepEqual(keys, [`portal:recording:v1:${accountScope(EMAIL)}:${SLUG}:${RECORD}`]);
});

/* ── the call list ────────────────────────────────────────────────────────── */

test("the call list hands the browser the portal's route, never the vendor's link", async () => {
    const schema = { tables: [{ name: "Call Log", fields: Object.keys(ROW.body.fields).map((name) => ({ name })) }] };
    responses.airtable = (url) =>
        url.includes("/meta/bases/") ? Response.json(schema) : Response.json({ records: [{ id: RECORD, fields: ROW.body.fields }] });
    const result = await fetchCalls({ baseId: BASE, apiKey: "k", siteSlug: SLUG, scopeToSite: false, acctScope: "a" });
    assert.equal(result.ok, true);
    assert.equal(result.calls[0].recordingUrl, `/api/portal/calls/${RECORD}/recording?site=${SLUG}`);
    assert.doesNotMatch(JSON.stringify(result), /cloudfront/);
});

/* ── matching a row to its Retell call ────────────────────────────────────── */

const [call] = LIST.body.items;
const startMs = call.start_timestamp;
const number = ROW.body.fields["Caller number"];

test("the recorded row and the recorded call really do share a start time", () => {
    assert.equal(Date.parse(ROW.body.fields.Date), startMs);
});

test("a call matches on its agent, or on its number when the agent has been replaced", () => {
    assert.equal(pickRetellCall([call], { startMs, callerNumber: null, agentId: AGENT }), call.call_id);
    assert.equal(pickRetellCall([call], { startMs, callerNumber: number, agentId: "agent_replaced" }), call.call_id);
});

test("the same millisecond on someone else's agent and number is not this call", () => {
    assert.equal(pickRetellCall([call], { startMs, callerNumber: "+14075551234", agentId: "agent_other" }), null);
});

test("two calls that both match are no answer, never a guess", () => {
    assert.equal(
        pickRetellCall([call, { ...call, call_id: "call_two" }], { startMs, callerNumber: number, agentId: AGENT }),
        null,
    );
});

test("an inexact time is not a match", () => {
    assert.equal(pickRetellCall([call], { startMs: startMs + 1, callerNumber: number, agentId: AGENT }), null);
});

test("only Retell's hosts pass, and only over https", () => {
    assert.equal(isRetellRecordingHost(STORED), true);
    assert.equal(isRetellRecordingHost("https://evil.example/recording.wav"), false);
    assert.equal(isRetellRecordingHost("http://dxc03zgurdly9.cloudfront.net/x"), false);
    assert.equal(isRetellRecordingHost("not a url"), false);
});
