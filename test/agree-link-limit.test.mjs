/**
 * The private terms link (`/terms/[code]`, `/api/agree/[code]`) can't be guessed at from one IP
 * (Xander, 2026-11-19: "Yes, add a limit").
 *
 * No login: the 10-character code is the credential. Nothing limited how many codes one visitor
 * could try. Now an IP that has looked up too many codes that don't exist sees every code as
 * "no longer active", the page and answer a wrong code already gets, so there are no new words.
 *
 * Only codes that don't exist are counted. A real client only ever opens their own code, so they
 * never come near the limit however often they reload, and nothing they see changes.
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-recording-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./vercel-blob-hook.mjs", import.meta.url);
register("./next-link-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_agree",
    RESEND_API_KEY: "re_test",
    OPS_ORDERS_SECRET: "orders-secret",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "private-store-token",
});

const { createAgreementLink } = await import("../app/lib/agreement-link.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const { lookupAgreementLink, agreeLinkLimits } = await import("../app/lib/agree-link-limit.ts");
const agree = await import("../app/api/agree/[code]/route.ts");

const order = (o = {}) => ({
    id: "ord_agree",
    version: 1,
    source: "operator-call",
    status: "draft",
    leadId: "lead_1",
    siteSlug: "arthurs-plumbing",
    plan: "growth",
    period: "monthly",
    pricing: { kind: "standard" },
    client: {
        legalName: "Arthur's Plumbing LLC",
        entityType: "LLC",
        address: "1 Main St, Orlando, FL 32801",
        contactName: "Arthur Dent",
        contactTitle: "Owner",
        email: "arthur@arthursplumbing.com",
        phone: "+14075550123",
    },
    vertical: "plumbing",
    receptionistMode: "forwarded",
    forwardingNumber: "+14075550123",
    operator: "xander",
    events: [],
    createdAt: 1793800000000,
    updatedAt: 1793800000000,
    ...o,
});

const redis = fakeUpstash({ url: KV_URL });
const realHandle = redis.handle;
const realFetch = globalThis.fetch;
const seed = (key, value) => redis.kv.set(key, { value: JSON.stringify(value), exp: null });
const saved = () => JSON.parse(redis.get("jdd:order:ord_agree"));

beforeEach(() => {
    redis.reset();
    globalThis.__clerk = { created: 0 };
    for (const k of Object.keys(process.env)) if (k.startsWith("AGREE_LINK_")) delete process.env[k];
    seed("jdd:order:ord_agree", order());
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (redis.owns(url)) {
            const body = JSON.parse(init.body);
            const cmds = url.endsWith("/pipeline") ? body : [body];
            if (cmds.every((c) => String(c[0]).toLowerCase() === "persist")) {
                return url.endsWith("/pipeline") ? Response.json(cmds.map(() => ({ result: 1 }))) : Response.json({ result: 1 });
            }
            return realHandle(input, init);
        }
        if (url.startsWith("https://api.resend.com/")) return Response.json({ id: "email_1" });
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const GUESSER = "198.51.100.66";
const CLIENT = "203.0.113.9";

const post = (code, ip, body = {}) =>
    agree.POST(
        new Request(`http://agency.test/api/agree/${code}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": ip, "user-agent": "phone-browser" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ code }) },
    );

const accept = (code, ip) =>
    post(code, ip, {
        accepted: true,
        termsHash: termsHashForOrder(order(), "master"),
        pageOpenedAt: "2026-11-15T15:00:00Z",
        scrollCompletedAt: "2026-11-15T15:02:00Z",
    });

/** Well-formed codes that were never issued. */
const guesses = (n) =>
    Array.from({ length: n }, (_, i) => `GUESS${String(i).padStart(5, "0").replace(/\d/g, (d) => "ABCDEFGHJK"[d])}`);

test("an IP past the limit of codes that don't exist can't open even a real link", async () => {
    const { code } = await createAgreementLink(order());
    for (const g of guesses(agreeLinkLimits().missHourly)) {
        assert.equal((await post(g, GUESSER)).status, 410);
    }
    const res = await accept(code, GUESSER);
    assert.equal(res.status, 410);
    assert.deepEqual(await res.json(), { error: "This link is no longer active.", code: "inactive" }, "the words a wrong code already gets");
    assert.equal(saved().status, "draft", "nothing accepted");
    assert.equal((await lookupAgreementLink(code, GUESSER)).state, "inactive", "the page shows it inactive too");
});

test("the guesser's limit is theirs: the client's own IP still opens the link", async () => {
    const { code } = await createAgreementLink(order());
    for (const g of guesses(agreeLinkLimits().missHourly + 5)) await post(g, GUESSER);
    assert.equal((await lookupAgreementLink(code, CLIENT)).state, "active");
});

test("a real client reloading their own link any number of times is never limited", async () => {
    const { code } = await createAgreementLink(order());
    for (let i = 0; i < 60; i++) assert.equal((await lookupAgreementLink(code, CLIENT)).state, "active");
    assert.equal((await accept(code, CLIENT)).status, 200);
});

test("under the limit, a few mistyped codes change nothing for that IP", async () => {
    const { code } = await createAgreementLink(order());
    for (const g of guesses(agreeLinkLimits().missHourly - 1)) await post(g, CLIENT);
    assert.equal((await lookupAgreementLink(code, CLIENT)).state, "active");
});

test("malformed codes are turned away before any lookup and don't count", async () => {
    const before = redis.commands.length;
    for (let i = 0; i < 30; i++) assert.equal((await lookupAgreementLink("nope", GUESSER)).state, "inactive");
    assert.equal(redis.commands.length, before, "no store calls at all");
});

test("the limit store failing never blocks a real client", async () => {
    const { code } = await createAgreementLink(order());
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        const body = redis.owns(url) ? JSON.parse(init.body) : null;
        const cmds = body ? (url.endsWith("/pipeline") ? body : [body]) : [];
        if (cmds.some((c) => /^(incr|mget|expire)$/i.test(String(c[0])))) throw new TypeError("fetch failed");
        return realHandle(input, init);
    };
    assert.equal((await lookupAgreementLink(code, CLIENT)).state, "active");
});

test("the page and the route both look links up through the limit", () => {
    const page = readFileSync("app/terms/[code]/page.tsx", "utf8");
    const route = readFileSync("app/api/agree/[code]/route.ts", "utf8");
    assert.match(page, /lookupAgreementLink\(/);
    assert.match(route, /lookupAgreementLink\(/);
    assert.doesNotMatch(page, /resolveAgreementLink\(/);
    assert.doesNotMatch(route, /resolveAgreementLink\(/);
});
