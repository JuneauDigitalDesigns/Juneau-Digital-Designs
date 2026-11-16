/**
 * Search Growth is a paid add-on (Xander, 2026-11-16): the weekly job's proposals, the client's
 * page-addition notices and the facts wizard run only for a site that has it. Every site is still
 * verified at go-live (D1), so Google's data exists when a client buys; for a verified site
 * without the add-on the job makes one light readiness read and stores counts only, never a
 * proposal. Until this, every verified site got proposals, notices and the wizard for free.
 *
 * The network is the only double: an in-memory Upstash and a Google that answers from a table.
 * Accounts go through the real account store, so `searchAddon` must survive its schema parse.
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

const { hasSearchGrowth } = await import("../app/lib/search-growth.ts");
const job = await import("../app/lib/search-console-job.ts");
const store = await import("../app/lib/page-additions-store.ts");
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
const keys = (prefix) => [...redis.kv.keys()].filter((k) => k.startsWith(prefix));
const scope = (email) => createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 16);
const EMAIL = "owner@example.com";
const ACCT = scope(EMAIL);
const NOW = new Date("2026-11-16T08:00:00Z");
const ADDON = { status: "active", since: Date.parse("2026-11-01T00:00:00Z") };
const profile = (slug, verifiedAt = "2026-06-01T00:00:00.000Z") => ({
    v: 1,
    siteSlug: slug,
    property: `https://${slug}.vercel.app/`,
    verifiedAt,
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
});
const site = (slug, extra = {}) => ({ slug, plan: "starter", status: "live", addedAt: 1, airtableBaseId: null, ...extra });

let searchBodies = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
    redis.reset();
    searchBodies = [];
    resetSearchConsoleToken();
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input);
        if (redis.owns(input)) return redis.handle(input, init);
        if (url === "https://oauth2.googleapis.com/token") return new Response(JSON.stringify({ access_token: "ya29.test", expires_in: 3599 }), { status: 200 });
        if (url.startsWith("https://www.googleapis.com/webmasters/")) {
            const body = JSON.parse(init.body);
            searchBodies.push({ url, body });
            const prop = decodeURIComponent(url.split("/sites/")[1].split("/")[0]);
            const dims = body.dimensions.join();
            const q = (d) => (dims.startsWith("date") ? [d] : []);
            if (dims.endsWith("query,page")) {
                return Response.json({
                    rows: [
                        { keys: [...q(body.endDate), "ac repair minneola", `${prop}services/ac-repair`], clicks: 0, impressions: 20, position: 9 },
                        { keys: [...q(body.endDate), "minneola ac repair near me", prop], clicks: 0, impressions: 12, position: 11 },
                    ],
                });
            }
            return Response.json({ rows: [{ keys: [...q(body.endDate), `${prop}services/ac-repair`], clicks: 0, impressions: 40, position: 9 }] });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

// ── Who has it ────────────────────────────────────────────────────────────────────────────────────
test("a site has Search Growth while it is active, and while ending until its end date", () => {
    const t = NOW.getTime();
    assert.equal(hasSearchGrowth(site("a"), t), false);
    assert.equal(hasSearchGrowth(site("a", { searchAddon: ADDON }), t), true);
    assert.equal(hasSearchGrowth(site("a", { searchAddon: { status: "ending", since: 1, endsAt: t + 1000 } }), t), true);
    assert.equal(hasSearchGrowth(site("a", { searchAddon: { status: "ending", since: 1, endsAt: t } }), t), false, "ends at its end date");
    assert.equal(hasSearchGrowth(site("a", { searchAddon: { status: "ending", since: 1 } }), t), true, "ending with no date yet: still on");
    // D3: a start booked for the next renewal date is not on yet, even once its date has passed:
    // billing turns it "active" when the renewal invoice is paid, and only that.
    assert.equal(hasSearchGrowth(site("a", { searchAddon: { status: "scheduled", since: 1, startsAt: t + 1000 } }), t), false, "scheduled: not on yet");
    assert.equal(hasSearchGrowth(site("a", { searchAddon: { status: "scheduled", since: 1, startsAt: t - 1000 } }), t), false, "scheduled past its date: still off until billing says active");
});

// ── The weekly job ────────────────────────────────────────────────────────────────────────────────
test("the job proposes only for the add-on site; the other verified site gets a readiness read and nothing else", async () => {
    seed(`jdd:account:${EMAIL}`, {
        email: EMAIL,
        sites: [site("paid", { searchAddon: ADDON }), site("free")],
        createdAt: 1,
        updatedAt: 1,
    });
    seed(`jdd:seo:profile:v1:${ACCT}:paid`, profile("paid"));
    seed(`jdd:seo:profile:v1:${ACCT}:free`, profile("free"));

    const out = await job.runSearchConsoleInvocation({ now: NOW });
    assert.equal(out.status, "complete");
    assert.deepEqual([out.result.sites, out.result.done, out.result.checked], [1, 1, 1]);

    assert.ok(read(`jdd:seo:proposal:v1:${ACCT}:paid:spoke:minneola:ac-repair`), "the add-on site gets its proposal");
    assert.deepEqual(keys(`jdd:seo:proposal:v1:${ACCT}:free:`), [], "no proposal for a site without the add-on");
    assert.deepEqual(keys(`jdd:seo:day:v1:${ACCT}:free:`), [], "and no stored search data either");
    assert.equal(read(`jdd:seo:cursor:v1:${ACCT}:free`), null);

    const free = searchBodies.filter((s) => s.url.includes(encodeURIComponent("https://free.vercel.app/")));
    assert.equal(free.length, 1, "one Google query for a readiness read");
    assert.deepEqual(free[0].body.dimensions, ["query", "page"], "summed over the window, not day by day");
    assert.equal(free[0].body.endDate, "2026-11-14");
    assert.equal(free[0].body.startDate, "2026-08-17", "the L12 window: 90 days");

    const ready = read(`jdd:seo:ready:v1:${ACCT}:free`);
    assert.deepEqual(ready, { checkedAt: NOW.toISOString(), dataSince: "2026-06-01T00:00:00.000Z", days: 168, wouldPropose: 1 });
    assert.equal(read(`jdd:seo:ready:v1:${ACCT}:paid`), null, "an add-on site needs no readiness record");
});

test("a site verified less than 90 days ago reads only the days since verification, and says how many", async () => {
    seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: [site("young")], createdAt: 1, updatedAt: 1 });
    seed(`jdd:seo:profile:v1:${ACCT}:young`, profile("young", "2026-10-06T00:00:00.000Z"));
    await job.runSearchConsoleInvocation({ now: NOW });
    assert.equal(searchBodies[0].body.startDate, "2026-10-06");
    const ready = read(`jdd:seo:ready:v1:${ACCT}:young`);
    assert.equal(ready.days, 41, "whole days since verification");
    assert.equal(ready.wouldPropose, 1, "the counts are stored either way; when to show an offer is the portal's call (D2)");
});

test("a readiness read never counts a merge-back (fold): only new pages are what a client would buy", async () => {
    seed(`jdd:account:${EMAIL}`, { email: EMAIL, sites: [site("folds")], createdAt: 1, updatedAt: 1 });
    seed(`jdd:seo:profile:v1:${ACCT}:folds`, {
        ...profile("folds"),
        sharedFacts: {},
        spokes: [{ town: "Clermont", service: "ac-repair", since: "2026-01-01T00:00:00.000Z" }],
    });
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(input)) return redis.handle(input, init);
        if (String(input).startsWith("https://oauth2")) return Response.json({ access_token: "t", expires_in: 3599 });
        return Response.json({ rows: [] });
    };
    await job.runSearchConsoleInvocation({ now: NOW });
    assert.equal(read(`jdd:seo:ready:v1:${ACCT}:folds`).wouldPropose, 0);
});

// ── Portal: notices and the facts wizard ──────────────────────────────────────────────────────────
const proposal = {
    id: "spoke:minneola:ac-repair",
    kind: "spoke",
    town: "Minneola",
    service: "ac-repair",
    status: "asked",
    stage: "waiting",
    createdAt: "2026-11-02T00:00:00.000Z",
    decidedAt: "2026-11-03T00:00:00.000Z",
    stageAt: "2026-11-03T00:00:00.000Z",
    evidence: { windowDays: 90, impressions: 32, clicks: 0, queries: [] },
};
function seedPage(slug) {
    seed(`jdd:seo:profile:v1:${ACCT}:${slug}`, profile(slug));
    seed(`jdd:seo:proposal:v1:${ACCT}:${slug}:${proposal.id}`, proposal);
    redis.zsets.set(`jdd:seo:proposal:index:v1:${ACCT}:${slug}`, new Map([[proposal.id, 1]]));
}

test("without the add-on, the client sees no notice and can't open, save or decline a page, even one already asked", async () => {
    seedPage("free");
    const free = site("free");
    const account = { email: EMAIL, sites: [free], createdAt: 1, updatedAt: 1 };
    assert.deepEqual(await store.siteNotices(account, free, NOW), []);
    assert.equal(await store.wizardData(account, free, proposal.id), null);
    const saved = await store.saveFacts(account, free, proposal.id, { photos: [], reviews: [], job: "" }, { submit: false, now: NOW });
    assert.equal(saved.ok, false);
    const declined = await store.declinePage(account, free, proposal.id, null, NOW);
    assert.equal(declined.ok, false);
    assert.equal(read(`jdd:seo:proposal:v1:${ACCT}:free:${proposal.id}`).stage, "waiting", "nothing changed");
});

test("with the add-on, the same page shows and opens as before", async () => {
    seedPage("paid");
    const paid = site("paid", { searchAddon: ADDON });
    const account = { email: EMAIL, sites: [paid], createdAt: 1, updatedAt: 1 };
    assert.equal((await store.siteNotices(account, paid, NOW)).length, 1);
    assert.ok(await store.wizardData(account, paid, proposal.id));
});
