/**
 * The nightly Search Console job, end to end through the real route and store.
 *
 * The network is the only double: an in-memory Upstash and a Google that answers from a table.
 * What it pins: only verified, live sites are pulled; days are stored and a repeated run changes
 * nothing (no second proposal, no second count against the monthly cap); call and lead towns are
 * stored as counts only; the response carries no site, query, town or credential.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    CRON_SECRET: "cron-secret",
    GOOGLE_OAUTH_CLIENT_ID: "cid",
    GOOGLE_OAUTH_CLIENT_SECRET: "CLIENT-SECRET-xyz",
    GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN: "REFRESH-abc",
});
delete process.env.AIRTABLE_API_KEY;

const { GET } = await import("../app/api/cron/search-console/route.ts");
const { resetSearchConsoleToken } = await import("../app/lib/search-console.ts");

const redis = fakeUpstash({ url: KV_URL });
const seed = (key, value) => redis.kv.set(key, { value: JSON.stringify(value), exp: null });
const read = (key) => {
    const e = redis.kv.get(key);
    if (e === undefined) return null;
    try {
        return JSON.parse(e.value);
    } catch {
        return e.value; // a bare string, as @upstash/redis stores one
    }
};
const scope = (email) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);

const EMAIL = "owner@example.com";
const ACCT = scope(EMAIL);
const PROPERTY = "https://acme.vercel.app/";
const profile = {
    v: 1,
    siteSlug: "acme",
    property: PROPERTY,
    verifiedAt: "2026-06-01T00:00:00.000Z",
    mainCity: "Clermont",
    caps: { area: 10, spoke: 15 },
    towns: [
        { name: "Clermont", slug: "clermont", hub: false, qualifies: false, facts: 0 },
        { name: "Minneola", slug: "minneola", hub: true, qualifies: true, facts: 4 },
    ],
    services: [{ slug: "ac-repair", name: "AC Repair", terms: ["ac repair"], page: true }],
    sharedFacts: { "Minneola|ac-repair": 2 },
    spokes: [],
    updatedAt: "2026-11-01T00:00:00.000Z",
};
const site = (slug, extra = {}) => ({ slug, plan: "growth", status: "live", addedAt: 1, airtableBaseId: null, ...extra });

let googleCalls = [];
const realFetch = globalThis.fetch;

function google(input, init) {
    const url = String(input);
    googleCalls.push(url);
    if (url === "https://oauth2.googleapis.com/token") {
        return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3599 }), { status: 200 });
    }
    const body = JSON.parse(init.body);
    if (body.dimensions.join() === "date,query,page") {
        const rows = [
            { keys: [body.endDate, "ac repair minneola", `${PROPERTY}services/ac-repair`], clicks: 0, impressions: 20, position: 9.1 },
            { keys: [body.endDate, "minneola ac repair near me", `${PROPERTY}`], clicks: 0, impressions: 12, position: 11 },
        ];
        return new Response(JSON.stringify({ rows }), { status: 200 });
    }
    return new Response(JSON.stringify({ rows: [{ keys: [body.endDate, `${PROPERTY}services/ac-repair`], clicks: 0, impressions: 40, position: 9 }] }), { status: 200 });
}

beforeEach(() => {
    redis.reset();
    googleCalls = [];
    resetSearchConsoleToken();
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(input)) return redis.handle(input, init);
        if (String(input).startsWith("https://oauth2.googleapis.com/") || String(input).startsWith("https://www.googleapis.com/webmasters/")) {
            return google(input, init);
        }
        throw new Error(`unexpected fetch: ${input}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const run = () => GET(new Request("https://x.test/api/cron/search-console", { headers: { authorization: "Bearer cron-secret" } }));

test("refuses without the cron secret", async () => {
    const r = await GET(new Request("https://x.test/api/cron/search-console"));
    assert.equal(r.status, 401);
});

test("pulls only verified, live sites, stores days, proposes once, and a second run changes nothing", async () => {
    seed(`jdd:account:${EMAIL}`, {
        email: EMAIL,
        sites: [site("acme"), site("unverified"), site("building", { status: "building" })],
        createdAt: 1,
        updatedAt: 1,
    });
    seed(`jdd:seo:profile:v1:${ACCT}:acme`, profile);
    seed(`jdd:seo:profile:v1:${ACCT}:unverified`, { ...profile, siteSlug: "unverified", property: null });
    seed(`jdd:seo:profile:v1:${ACCT}:building`, { ...profile, siteSlug: "building" });

    const first = await (await run()).json();
    assert.deepEqual(
        { ok: first.ok, sites: first.sites, done: first.done, failed: first.failed, proposals: first.proposals },
        { ok: true, sites: 1, done: 1, failed: 0, proposals: 1 },
    );
    const searchCalls = googleCalls.filter((u) => u.includes("/searchAnalytics/"));
    assert.equal(searchCalls.length, 2, "query×page and page-only, for the one verified live site");
    assert.ok(searchCalls.every((u) => u.includes(encodeURIComponent(PROPERTY))));

    const cursor = read(`jdd:seo:cursor:v1:${ACCT}:acme`);
    assert.match(cursor, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(read(`jdd:seo:day:v1:${ACCT}:acme:${cursor}`).q.length, 2);

    const p = read(`jdd:seo:proposal:v1:${ACCT}:acme:spoke:minneola:ac-repair`);
    assert.equal(p.kind, "spoke");
    assert.equal(p.status, "open");
    assert.equal(p.evidence.impressions, 32);
    const month = new Date().toISOString().slice(0, 7);
    assert.equal(read(`jdd:seo:proposed:v1:${ACCT}:acme:${month}`), 1);

    const second = await (await run()).json();
    assert.equal(second.proposals, 0, "an open proposal is never created twice");
    assert.equal(read(`jdd:seo:proposed:v1:${ACCT}:acme:${month}`), 1, "and never counted twice against the cap");
});

test("lead towns are stored as counts only, and the response names no site, query, town or secret", async () => {
    seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: [site("acme")], createdAt: 1, updatedAt: 1 });
    seed(`jdd:seo:profile:v1:${ACCT}:acme`, profile);
    seed(`portal:lead:v1:${ACCT}:acme:l1`, {
        leadId: "l1", slug: "acme", name: "Pat", phone: "+14075550100", phoneRaw: null, email: null,
        message: "AC died at our place in Minneola", fields: {}, createdAt: "2026-11-01T00:00:00.000Z",
        readAt: null, source: "web-form", callbackPlaced: false,
    });
    redis.zsets.set(`portal:lead:index:v1:${ACCT}:acme`, new Map([["l1", 1]]));

    const res = await run();
    const text = await res.text();
    for (const leak of ["acme", "minneola", "Minneola", "ac repair", "REFRESH-abc", "CLIENT-SECRET-xyz", "ya29"]) {
        assert.ok(!text.includes(leak), `response must not carry ${leak}`);
    }
    const signals = read(`jdd:seo:signals:v1:${ACCT}:acme`);
    assert.deepEqual(signals.towns, { Minneola: { calls: 0, leads: 1 } });
    assert.ok(!JSON.stringify(signals).includes("Pat") && !JSON.stringify(signals).includes("+1407"), "counts only");
});

test("without Google credentials nothing is pulled and the run says so", async () => {
    const saved = process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;
    delete process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN;
    try {
        seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: [site("acme")], createdAt: 1, updatedAt: 1 });
        seed(`jdd:seo:profile:v1:${ACCT}:acme`, profile);
        const body = await (await run()).json();
        assert.equal(body.configured, false);
        assert.equal(googleCalls.length, 0);
    } finally {
        process.env.GOOGLE_SEARCH_CONSOLE_REFRESH_TOKEN = saved;
    }
});
