/**
 * The client's side of a page addition, through the real store on an in-memory Upstash:
 * the notice and its first-seen stamp, the facts the client sends (only their own uploads, only
 * word-for-word reviews, only their own towns), the hand-over to JDD, and "I don't want this page".
 *
 * The console intake reads the same records (contract in page-additions-store.ts), so the shape
 * is pinned here too.
 */
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { createHash } from "node:crypto";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, { KV_REST_API_URL: KV_URL, KV_REST_API_TOKEN: "t", UPSTASH_REDIS_REST_URL: KV_URL, UPSTASH_REDIS_REST_TOKEN: "t" });

const store = await import("../app/lib/page-additions-store.ts");
const { accountKey } = await import("../app/lib/upload-guard.ts");

const redis = fakeUpstash({ url: KV_URL });
const seed = (k, v) => redis.kv.set(k, { value: JSON.stringify(v), exp: null });
const read = (k) => {
    const e = redis.kv.get(k);
    return e ? JSON.parse(e.value) : null;
};
const realFetch = globalThis.fetch;
beforeEach(() => {
    redis.reset();
    globalThis.fetch = async (input, init = {}) => {
        if (!redis.owns(input)) throw new Error(`unexpected fetch: ${input}`);
        return redis.handle(input, init);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const EMAIL = "owner@example.com";
const ACCT = createHash("sha256").update(EMAIL).digest("hex").slice(0, 16);
const site = { slug: "acme", name: "Acme Air", plan: "starter", status: "live", addedAt: 1 };
const account = { email: EMAIL, sites: [site], createdAt: 1, updatedAt: 1 };
const NOW = new Date("2026-11-20T12:00:00Z");
const profile = {
    v: 1, siteSlug: "acme", property: "https://acme.vercel.app/", verifiedAt: "2026-10-01T00:00:00.000Z", mainCity: "Clermont",
    caps: { area: 10, spoke: 15 }, updatedAt: "2026-11-10T00:00:00.000Z",
    towns: [{ name: "Minneola", slug: "minneola", hub: true, qualifies: true, facts: 4 }, { name: "Groveland", slug: "groveland", hub: false, qualifies: false, facts: 0 }],
    services: [{ slug: "ac-repair", name: "AC Repair", terms: ["ac repair"], page: true }],
    sharedFacts: {}, spokes: [],
};
const ID = "spoke:minneola:ac-repair";
const PKEY = `jdd:seo:proposal:v1:${ACCT}:acme:${ID}`;
const proposal = (over = {}) => ({
    id: ID, kind: "ask-client", town: "Minneola", service: "ac-repair", status: "asked", createdAt: "2026-11-01T00:00:00.000Z",
    decidedAt: "2026-11-13T00:00:00.000Z", evidence: { windowDays: 90, impressions: 32, clicks: 1, queries: [] }, ...over,
});
const own = (name) => `https://abc.public.blob.vercel-storage.com/onboarding/${accountKey(EMAIL)}/acme/${name}`;

function setUp(p = proposal()) {
    seed(`jdd:seo:profile:v1:${ACCT}:acme`, profile);
    seed(PKEY, p);
    redis.zsets.set(`jdd:seo:proposal:index:v1:${ACCT}:acme`, new Map([[ID, 1]]));
}

test("the notice shows, and showing it stamps when the client first saw that stage", async () => {
    setUp();
    const [n] = await store.siteNotices(account, site, NOW);
    assert.equal(n.heading, "Help us build your AC Repair in Minneola page");
    assert.equal(n.siteName, null, "one site: no label");
    assert.deepEqual(read(PKEY).seen, { stage: "waiting", at: NOW.toISOString() });
    const two = await store.siteNotices({ ...account, sites: [site, { ...site, slug: "acme-2", name: "Acme Air Orlando" }] }, site, NOW);
    assert.equal(two[0].siteName, "Acme Air", "enterprise: labelled with the site name");
});

test("only the client's own uploads, word-for-word reviews and their own towns are kept", async () => {
    setUp();
    const out = await store.saveFacts(account, site, ID, {
        photos: [
            { url: own("a.jpg"), filename: "a.jpg", town: "minneola" },
            { url: "https://evil.example/a.jpg", filename: "x.jpg", town: "Minneola" },
            { url: "https://abc.public.blob.vercel-storage.com/onboarding/otheraccount/acme/b.jpg", town: "Minneola" },
            { url: own("c.jpg"), town: "Atlantis" },
        ],
        reviews: [{ text: "Fixed it the same day.", name: "Dana", verbatim: true }, { text: "Paraphrased", verbatim: false }],
        job: "Replaced a seized condenser fan.",
    }, { submit: false, now: NOW });
    assert.deepEqual(out, { ok: true, needed: 0, stage: "waiting" }, "saved, not sent");
    const f = read(`jdd:seo:clientfacts:v1:${ACCT}:acme:${ID}`);
    assert.equal(f.photos.length, 1);
    assert.deepEqual({ ...f.photos[0], id: "x" }, { id: "x", url: own("a.jpg"), filename: "a.jpg", alt: "", town: "Minneola", service: "ac-repair", addedAt: NOW.toISOString(), status: "pending" });
    assert.equal(f.reviews.length, 1);
    assert.deepEqual([f.reviews[0].text, f.reviews[0].name, f.reviews[0].verbatim, f.reviews[0].status], ["Fixed it the same day.", "Dana", true, "pending"]);
    assert.equal(f.jobs[0].text, "Replaced a seized condenser fan.");
    assert.equal(f.submittedAt, null);
    assert.ok(redis.zsets.get(`jdd:seo:clientfacts:index:v1:${ACCT}:acme`).has(ID), "indexed for the console");
});

test("sending enough facts hands the page to JDD (Thank you), and sent facts can't be removed", async () => {
    setUp();
    await store.saveFacts(account, site, ID, { photos: [{ url: own("a.jpg"), town: "Minneola" }] }, { submit: true, now: NOW });
    assert.equal(read(PKEY).stage ?? "waiting", "waiting", "1 of 2: still waiting");
    const later = new Date(NOW.getTime() + 60_000);
    const out = await store.saveFacts(account, site, ID, { photos: [], reviews: [{ text: "Great work.", verbatim: true }] }, { submit: true, now: later });
    assert.deepEqual(out, { ok: true, needed: 0, stage: "received" });
    const f = read(`jdd:seo:clientfacts:v1:${ACCT}:acme:${ID}`);
    assert.equal(f.photos.length, 1, "the photo sent earlier is kept though the client sent an empty list");
    assert.equal(read(PKEY).stage, "received");
    const [n] = await store.siteNotices(account, site, later);
    assert.equal(n.heading, "We have what we need for AC Repair in Minneola");
});

test("I don't want this page pauses it with the reason, keeps what was sent, and only while it is the client's to answer", async () => {
    setUp();
    await store.saveFacts(account, site, ID, { photos: [{ url: own("a.jpg"), town: "Minneola" }] }, { submit: true, now: NOW });
    assert.deepEqual(await store.declinePage(account, site, ID, "  We don't go up there anymore.  ", NOW), { ok: true });
    const p = read(PKEY);
    assert.equal(p.stage, "paused");
    assert.deepEqual(p.clientDecline, { at: NOW.toISOString(), reason: "We don't go up there anymore." });
    assert.equal(read(`jdd:seo:clientfacts:v1:${ACCT}:acme:${ID}`).photos.length, 1, "a decline never deletes facts");
    assert.equal((await store.declinePage(account, site, ID, null, NOW)).ok, false, "already paused");
    redis.reset();
    setUp(proposal({ status: "open", decidedAt: undefined }));
    assert.equal((await store.declinePage(account, site, ID, null, NOW)).ok, false, "still in review: nothing to decline");
    assert.equal((await store.saveFacts(account, site, ID, {}, { submit: true, now: NOW })).ok, false, "and no facts to send");
});
