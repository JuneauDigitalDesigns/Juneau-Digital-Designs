/**
 * The Search Console job as a weekly run that finishes every site (Xander, 2026-11-15).
 *
 * What shipped before this: a nightly GitHub schedule that GitHub never fired, and a per-run time
 * budget that, past it, counted the remaining sites as "skipped" in the same order every night, so
 * the last sites on the list would never be pulled, and nothing said so. What this pins:
 *   - the schedule lives in vercel.json (weekly, Monday 08:00 UTC), with no GitHub workflow beside
 *     it, and the demo-call reconcile is on exactly one 15-minute schedule;
 *   - a weekly pull re-reads a week before its cursor, so every day since the last run is covered;
 *   - a run that runs out of time continues in follow-on invocations, each making progress, until
 *     every site is done, and only then records the completed-run marker the console watches;
 *   - a continuation is single-flight and only ever continues the run it names.
 * The network is the only double: an in-memory Upstash and a Google that answers from a table.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
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
delete process.env.VERCEL_PROJECT_PRODUCTION_URL;

const route = await import("../app/api/cron/search-console/route.ts");
const job = await import("../app/lib/search-console-job.ts");
const { resetSearchConsoleToken } = await import("../app/lib/search-console.ts");

const redis = fakeUpstash({ url: KV_URL });
const seed = (key, value) => redis.kv.set(key, { value: JSON.stringify(value), exp: null });
const read = (key) => {
    const e = redis.kv.get(key);
    if (e === undefined) return null;
    try {
        return JSON.parse(e.value);
    } catch {
        return e.value;
    }
};
const scope = (email) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
const EMAIL = "owner@example.com";
const ACCT = scope(EMAIL);
const profile = (slug) => ({
    v: 1,
    siteSlug: slug,
    property: `https://${slug}.vercel.app/`,
    verifiedAt: "2026-06-01T00:00:00.000Z",
    mainCity: "Clermont",
    caps: { area: 10, spoke: 15 },
    towns: [{ name: "Minneola", slug: "minneola", hub: true, qualifies: true, facts: 4 }],
    services: [{ slug: "ac-repair", name: "AC Repair", terms: ["ac repair"], page: true }],
    sharedFacts: {},
    spokes: [],
    updatedAt: "2026-11-01T00:00:00.000Z",
});
// These sites have Search Growth, the paid add-on (2026-11-16), so each gets the full weekly cycle.
const site = (slug) => ({ slug, plan: "growth", status: "live", addedAt: 1, airtableBaseId: null, searchAddon: { status: "active", since: 1 } });
const seedSites = (...slugs) => {
    seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: slugs.map(site), createdAt: 1, updatedAt: 1 });
    for (const s of slugs) seed(`jdd:seo:profile:v1:${ACCT}:${s}`, profile(s));
};

let searchBodies = [];
let selfCalls = [];
let failProperty = null;
const realFetch = globalThis.fetch;

beforeEach(() => {
    redis.reset();
    searchBodies = [];
    selfCalls = [];
    failProperty = null;
    resetSearchConsoleToken();
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (redis.owns(input)) return redis.handle(input, init);
        if (url === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3599 }), { status: 200 });
        if (url.startsWith("https://www.googleapis.com/webmasters/")) {
            if (failProperty && url.includes(encodeURIComponent(failProperty))) return new Response("{}", { status: 500 });
            searchBodies.push({ url, body: JSON.parse(init.body) });
            return new Response(JSON.stringify({ rows: [] }), { status: 200 });
        }
        if (url.startsWith("https://x.test/api/cron/search-console")) {
            selfCalls.push({ url, auth: new Headers(init.headers).get("authorization") });
            return new Response(null, { status: 202 });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
    delete process.env.SEARCH_CONSOLE_INVOCATION_BUDGET_MS;
});
const tick = () => new Promise((r) => setTimeout(r, 20));
const cron = (qs = "") => route.GET(new Request(`https://x.test/api/cron/search-console${qs}`, { headers: { authorization: "Bearer cron-secret" } }));

// ── The schedule ──────────────────────────────────────────────────────────────────────────────────
test("the schedule is in vercel.json: Search Console weekly, the demo-call reconcile every 15 minutes, nothing on GitHub beside them", () => {
    const crons = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8")).crons;
    const at = Object.fromEntries(crons.map((c) => [c.path, c.schedule]));
    assert.equal(at["/api/cron/search-console"], "0 8 * * 1", "Monday 08:00 UTC: 3 a.m. EST, 4 a.m. EDT");
    assert.equal(at["/api/cron/search-console"], `0 ${job.SLOT_HOUR_UTC} * * ${job.SLOT_WEEKDAY}`, "the slot a run records is the slot Vercel fires");
    assert.equal(at["/api/cron/reconcile-demo-calls"], "*/15 * * * *");
    assert.equal(crons.length, new Set(crons.map((c) => c.path)).size, "one schedule per endpoint");
    for (const wf of ["search-console-nightly.yml", "reconcile-demo-calls.yml"]) {
        assert.ok(!existsSync(new URL(`../.github/workflows/${wf}`, import.meta.url)), `${wf} would be a second scheduler`);
    }
    assert.equal(route.maxDuration, 800, "Pro with Fluid compute allows 800 s");
});

test("no comment still says the team is on Hobby", () => {
    for (const f of ["../app/api/cron/retell-usage/route.ts", "../app/api/cron/search-console/route.ts", "../app/api/cron/reconcile-demo-calls/route.ts"]) {
        assert.doesNotMatch(readFileSync(new URL(f, import.meta.url), "utf8"), /on (the )?\*{0,2}Hobby/i, f);
    }
});

// ── The window ────────────────────────────────────────────────────────────────────────────────────
test("a weekly pull re-reads the 7 days before its cursor, so every day since the last run is covered", async () => {
    seedSites("acme");
    const now = new Date("2026-11-16T08:00:00Z");
    seed(`jdd:seo:cursor:v1:${ACCT}:acme`, "2026-11-07");
    await job.runSearchConsoleInvocation({ now });
    const b = searchBodies[0].body;
    assert.equal(b.endDate, "2026-11-14", "final data trails by 2 days");
    assert.equal(b.startDate, "2026-10-31", "7 days of overlap before the cursor");
    assert.equal(read(`jdd:seo:cursor:v1:${ACCT}:acme`), "2026-11-14");
});

test("a missed week is caught up, not skipped: the pull still starts a week before the old cursor", async () => {
    seedSites("acme");
    seed(`jdd:seo:cursor:v1:${ACCT}:acme`, "2026-10-24");
    await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:00:00Z") });
    assert.equal(searchBodies[0].body.startDate, "2026-10-17");
});

// ── Every site, across invocations ────────────────────────────────────────────────────────────────
test("a run out of time continues in follow-on invocations, each making progress, and is marked complete only when every site is done", async () => {
    seedSites("a1", "a2", "a3");
    const now = new Date("2026-11-16T08:00:00Z");
    const first = await job.runSearchConsoleInvocation({ now, budgetMs: 0 });
    assert.equal(first.status, "continuing");
    assert.equal(first.result.done, 1, "at least one site per invocation, so a chain always ends");
    assert.equal(read("jdd:seo:completed:v1"), null, "not complete with sites left");
    assert.equal(read("jdd:seo:health:v1"), null, "health is judged on a whole run");

    const second = await job.runSearchConsoleInvocation({ now, budgetMs: 0, runId: first.runId });
    assert.equal(second.status, "continuing");
    const third = await job.runSearchConsoleInvocation({ now, budgetMs: 0, runId: first.runId });
    assert.equal(third.status, "complete");
    assert.deepEqual(
        { sites: third.result.sites, done: third.result.done, failed: third.result.failed },
        { sites: 3, done: 3, failed: 0 },
    );
    const done = read("jdd:seo:completed:v1");
    assert.equal(done.id, first.runId);
    assert.equal(done.invocations, 3);
    assert.equal(done.sites, 3);
    assert.ok(done.completedAt);
    assert.equal(new Set(searchBodies.map((s) => s.url)).size, 3, "each site pulled once");
    assert.equal(read("jdd:seo:runs:v1").length, 1, "one run, logged once");
    assert.ok(read("jdd:seo:health:v1"), "health recorded at completion");
});

test("a site that fails is counted and the run still goes on to the others and completes", async () => {
    seedSites("a1", "a2", "a3");
    failProperty = "https://a2.vercel.app/";
    const out = await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:00:00Z") });
    assert.equal(out.status, "complete");
    assert.deepEqual([out.result.done, out.result.failed], [2, 1]);
    assert.equal(read("jdd:seo:completed:v1").failed, 1);
});

test("a continuation only continues the run it names, and never runs beside another invocation", async () => {
    seedSites("a1", "a2");
    const now = new Date("2026-11-16T08:00:00Z");
    const first = await job.runSearchConsoleInvocation({ now, budgetMs: 0 });
    assert.equal((await job.runSearchConsoleInvocation({ now, runId: "2026-01-01T00:00:00.000Z" })).status, "stale");
    redis.kv.set("jdd:seo:run:lease:v1", { value: "someone-else", exp: Date.now() + 60_000 });
    assert.equal((await job.runSearchConsoleInvocation({ now, runId: first.runId })).status, "busy");
    redis.kv.delete("jdd:seo:run:lease:v1");
    assert.equal((await job.runSearchConsoleInvocation({ now, runId: first.runId })).status, "complete");
    assert.equal((await job.runSearchConsoleInvocation({ now, runId: first.runId })).status, "stale", "a doubled continuation after completion does nothing");
    assert.equal(new Set(searchBodies.map((s) => s.url)).size, 2);
});

test("the weekly cron resumes an unfinished run from this week instead of starting over", async () => {
    seedSites("a1", "a2");
    const now = new Date("2026-11-16T08:00:00Z");
    const first = await job.runSearchConsoleInvocation({ now, budgetMs: 0 });
    const again = await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T09:00:00Z") });
    assert.equal(again.runId, first.runId);
    assert.equal(again.status, "complete");
    assert.equal(searchBodies.length, 4, "2 sites × 2 queries: the first site was not pulled twice");
});

test("an unfinished run from an earlier week is closed off, and the cron starts a new one", async () => {
    seedSites("a1", "a2");
    const first = await job.runSearchConsoleInvocation({ now: new Date("2026-11-09T08:00:00Z"), budgetMs: 0 });
    const next = await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:00:00Z") });
    assert.notEqual(next.runId, first.runId);
    assert.equal(next.result.done, 2);
});

// ── The slot (Xander, 2026-11-15): the missed-run alert is per scheduled slot, not a rolling window ─
test("each run records the weekly slot it belongs to: the latest Monday 08:00 UTC at or before it started", () => {
    assert.equal(job.weeklySlot(new Date("2026-11-16T08:00:00Z")), "2026-11-16T08:00:00.000Z");
    assert.equal(job.weeklySlot(new Date("2026-11-16T09:30:00Z")), "2026-11-16T08:00:00.000Z");
    assert.equal(job.weeklySlot(new Date("2026-11-16T07:59:59Z")), "2026-11-09T08:00:00.000Z", "before the slot is last week's");
    assert.equal(job.weeklySlot(new Date("2026-11-15T23:00:00Z")), "2026-11-09T08:00:00.000Z");
    assert.equal(job.weeklySlot(new Date("2026-11-19T12:00:00Z")), "2026-11-16T08:00:00.000Z", "a late or manual run still counts for its week's slot");
});

test("the completed-run marker names its slot, even when the run finished in a later invocation", async () => {
    seedSites("a1", "a2");
    const first = await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:00:30Z"), budgetMs: 0 });
    await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:12:00Z"), runId: first.runId });
    const done = read("jdd:seo:completed:v1");
    assert.equal(done.slot, "2026-11-16T08:00:00.000Z");
    assert.equal(read("jdd:seo:runs:v1")[0].slot, done.slot);
});

test("the cron resumes an unfinished run only within its own slot; the next slot starts a new run", async () => {
    seedSites("a1", "a2");
    const sunday = await job.runSearchConsoleInvocation({ now: new Date("2026-11-15T20:00:00Z"), budgetMs: 0 });
    const monday = await job.runSearchConsoleInvocation({ now: new Date("2026-11-16T08:00:00Z") });
    assert.notEqual(monday.runId, sunday.runId, "a day apart, but a different slot");
    assert.equal(read("jdd:seo:completed:v1").slot, "2026-11-16T08:00:00.000Z");
});

// ── Through the route ─────────────────────────────────────────────────────────────────────────────
test("the cron answers with counts and, with sites left, asks for the next invocation with the run id and the secret", async () => {
    seedSites("a1", "a2");
    process.env.SEARCH_CONSOLE_INVOCATION_BUDGET_MS = "0";
    const res = await cron();
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "continuing");
    await tick();
    assert.equal(selfCalls.length, 1);
    const u = new URL(selfCalls[0].url);
    assert.equal(u.searchParams.get("run"), read("jdd:seo:run:v1").id);
    assert.equal(selfCalls[0].auth, "Bearer cron-secret");
    for (const leak of ["a1", "a2", "REFRESH-abc", "ya29"]) assert.ok(!JSON.stringify(body).includes(leak), leak);
});

test("a continuation request is answered at once and does its work after the response", async () => {
    seedSites("a1", "a2");
    process.env.SEARCH_CONSOLE_INVOCATION_BUDGET_MS = "0";
    await cron();
    await tick();
    const runId = read("jdd:seo:run:v1").id;
    const res = await cron(`?run=${encodeURIComponent(runId)}`);
    assert.equal(res.status, 202);
    await tick();
    assert.ok(read("jdd:seo:completed:v1"), "the follow-on finished the run");
    assert.equal(selfCalls.length, 1, "a finished run asks for nothing more");
});

test("refuses without the cron secret, continuation or not", async () => {
    assert.equal((await route.GET(new Request("https://x.test/api/cron/search-console?run=x"))).status, 401);
});
