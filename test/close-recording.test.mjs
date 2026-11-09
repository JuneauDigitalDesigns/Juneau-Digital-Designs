/**
 * Recording the terms on a read-aloud close (Xander, 2026-11-09: terms only, with "Recording
 * stopped" required before payment, and the file attached later from /manage).
 *
 * Runs the real routes, PDF and agreement record included. The network is the only double:
 * in-memory Upstash with real expiry behaviour, and a Blob store that keeps nothing.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-unreachable-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);
register("./vercel-blob-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_rec",
    RESEND_API_KEY: "re_test",
    OPS_ORDERS_SECRET: "orders-secret",
    AGREEMENTS_BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_teststore_secretsecret",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_m",
    STRIPE_PRICE_GROWTH_ONBOARDING: "price_growth_onb",
});

const { getPayloadFromClientToken } = await import("@vercel/blob/client");
const { buildCallScript } = await import("../app/lib/legal/call-script.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const { TERMS_VERSION } = await import("../app/lib/legal/index.ts");
const acceptRoute = await import("../app/api/ops/orders/[id]/accept-terms/route.ts");
const stoppedRoute = await import("../app/api/ops/orders/[id]/recording-stopped/route.ts");
const paymentRoute = await import("../app/api/ops/orders/[id]/payment/route.ts");
const recordingRoute = await import("../app/api/ops/orders/[id]/recording/route.ts");
const fileRoute = await import("../app/api/ops/orders/[id]/recording/file/route.ts");
const orderRoute = await import("../app/api/ops/orders/[id]/route.ts");

/* ── doubles ──────────────────────────────────────────────────────────────── */

/** value + whether it has an expiry, because losing or regaining one is what's being tested. */
const kv = new Map();
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
function upstash([op, ...args]) {
    switch (op.toLowerCase()) {
        case "get": {
            const v = kv.get(args[0]);
            return v === undefined ? null : b64(v.value);
        }
        case "set": {
            const flags = args.slice(2).map((a) => String(a).toLowerCase());
            const prior = kv.get(args[0]);
            if (flags.includes("nx") && prior) return null;
            const expires = flags.includes("keepttl") ? Boolean(prior?.expires) : flags.includes("ex");
            kv.set(args[0], { value: String(args[1]), expires });
            return "OK";
        }
        case "del":
            return args.filter((k) => kv.delete(k)).length;
        case "exists":
            return args.filter((k) => kv.has(k)).length;
        case "zadd":
            return 1;
        case "persist": {
            const v = kv.get(args[0]);
            if (v) v.expires = false;
            return v ? 1 : 0;
        }
        case "ttl": {
            const v = kv.get(args[0]);
            return !v ? -2 : v.expires ? 1000 : -1;
        }
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

let stored;
const realFetch = globalThis.fetch;

beforeEach(() => {
    kv.clear();
    stored = new Map();
    globalThis.__blobHead = async (pathname) => {
        if (!stored.has(pathname)) throw Object.assign(new Error("not found"), { name: "BlobNotFoundError" });
        return { size: stored.get(pathname) };
    };
    globalThis.__blobGet = async (pathname, options) => {
        assert.equal(options.access, "private");
        return stored.has(pathname) ? { statusCode: 200, stream: new Response("bytes").body } : null;
    };
    globalThis.fetch = async (url, init) => {
        const u = String(url);
        if (u.startsWith(KV_URL)) {
            const path = new URL(u).pathname;
            const body = JSON.parse(init.body);
            if (path.startsWith("/pipeline") || path.startsWith("/multi-exec")) {
                return Response.json(body.map((c) => ({ result: upstash(c) })));
            }
            return Response.json({ result: upstash(body) });
        }
        if (u.includes("api.stripe.com")) {
            const json = (b) => new Response(JSON.stringify(b), { status: 200, headers: { "content-type": "application/json", "request-id": "req_test" } });
            if (u.includes("/v1/checkout/sessions")) return json({ id: "cs_1", object: "checkout.session", url: "https://checkout.stripe.com/c/pay/cs_1" });
            if (u.includes("/v1/customers")) return json({ id: "cus_1", object: "customer", metadata: {} });
        }
        if (u.includes("api.resend.com")) return Response.json({ id: "email_1" });
        throw new Error(`unexpected fetch ${u}`);
    };
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

/* ── helpers ──────────────────────────────────────────────────────────────── */

const ID = "ord_rec";
const params = { params: Promise.resolve({ id: ID }) };
const post = (route, body) =>
    route.POST(
        new Request(`https://x.test/api/ops/orders/${ID}/x`, {
            method: "POST",
            headers: { "x-ops-secret": "orders-secret", "content-type": "application/json" },
            body: JSON.stringify(body ?? {}),
        }),
        params,
    );
const get = (route) => route.GET(new Request(`https://x.test/api/ops/orders/${ID}/x`, { headers: { "x-ops-secret": "orders-secret" } }), params);

const baseOrder = (o = {}) => ({
    id: ID,
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

function seedOrder(o) {
    kv.set(`jdd:order:${ID}`, { value: JSON.stringify(baseOrder(o)), expires: false });
}
const readJson = (k) => JSON.parse(kv.get(k).value);
const savedOrder = () => readJson(`jdd:order:${ID}`);
const savedAgreement = () => readJson(`agreement:${savedOrder().agreementId}`);

function acceptBody(over = {}) {
    const order = baseOrder();
    return {
        confirmed: true,
        scriptHash: buildCallScript("growth", "monthly").hash,
        termsHash: termsHashForOrder(order, "master"),
        recordingConsentAt: new Date().toISOString(),
        ...over,
    };
}

async function accepted() {
    seedOrder();
    const res = await post(acceptRoute, acceptBody());
    assert.equal(res.status, 200, await res.clone().text());
}

const FILE = { fileName: "Terms call.MP4", contentType: "video/mp4", sizeBytes: 1234 };
const SHA = "a".repeat(64);

async function uploaded() {
    const begin = await (await post(recordingRoute, { step: "begin", ...FILE })).json();
    stored.set(begin.pathname, FILE.sizeBytes);
    return begin;
}

/* ── the script ───────────────────────────────────────────────────────────── */

test("the recording lines are the approved words, and the script's hash covers them", () => {
    const s = buildCallScript("growth", "monthly");
    assert.equal(s.recordingNotice, "This part of our call is recorded to keep a record of these terms. Is that okay with you?");
    assert.equal(s.recordingOpener, "We're now recording. You're okay with that?");
    // An acceptance has to prove the client was told, so these can't sit outside the hash.
    const expected = createHash("sha256").update([s.version, s.recordingNotice, s.recordingOpener, ...s.lines].join("\n"), "utf8").digest("hex");
    assert.equal(s.hash, expected);
});

test("the version names this revision of the script, so one version never means two sets of words", () => {
    assert.equal(buildCallScript("growth", "monthly").version, `${TERMS_VERSION}-growth-monthly-r2`);
    assert.equal(buildCallScript("starter", "annual", { webOnly: true }).version, `${TERMS_VERSION}-web-only-annual-r2`);
});

/* ── accepting ────────────────────────────────────────────────────────────── */

test("a read-aloud acceptance needs the consent tick, and stores it with the script it was read from", async () => {
    seedOrder();
    assert.equal((await post(acceptRoute, acceptBody({ recordingConsentAt: undefined }))).status, 400, "no tick");
    assert.equal(savedOrder().status, "draft");

    const at = new Date().toISOString();
    assert.equal((await post(acceptRoute, acceptBody({ recordingConsentAt: at }))).status, 200);
    const { acceptance } = savedAgreement();
    assert.equal(acceptance.recordingConsentAt, at);
    assert.equal(acceptance.scriptHash, buildCallScript("growth", "monthly").hash);
    assert.equal(acceptance.recordingStoppedAt, undefined);
});

test("a consent time that can't be from this call is refused", async () => {
    seedOrder();
    const iso = (ms) => new Date(Date.now() + ms).toISOString();
    for (const bad of [iso(60 * 60_000), iso(-24 * 60 * 60_000), "yesterday", 1793800000000]) {
        assert.equal((await post(acceptRoute, acceptBody({ recordingConsentAt: bad }))).status, 400, String(bad));
    }
});

/* ── stopped before payment ───────────────────────────────────────────────── */

test("payment is refused until the recording is confirmed stopped", async () => {
    await accepted();
    const refused = await post(paymentRoute, { method: "link" });
    assert.equal(refused.status, 409);
    assert.equal((await refused.json()).code, "recording-running");
    assert.equal(savedOrder().status, "terms-accepted", "nothing moved");

    assert.equal((await post(stoppedRoute)).status, 200);
    assert.ok(savedAgreement().acceptance.recordingStoppedAt);

    const after = await post(paymentRoute, { method: "link" });
    assert.notEqual((await after.json()).code, "recording-running");
});

test("an agreement accepted on the private link is never held at payment", async () => {
    seedOrder({ status: "terms-accepted", agreementId: "agr_link" });
    kv.set("agreement:agr_link", { value: JSON.stringify({ id: "agr_link", acceptance: { method: "clickwrap-self", checkedAt: "x", ip: "x", userAgent: "x" } }), expires: true });
    assert.notEqual((await (await post(paymentRoute, { method: "link" })).json()).code, "recording-running");
});

test("confirming twice keeps the first stop time", async () => {
    await accepted();
    await post(stoppedRoute);
    const first = savedAgreement().acceptance.recordingStoppedAt;
    await new Promise((r) => setTimeout(r, 5));
    await post(stoppedRoute);
    assert.equal(savedAgreement().acceptance.recordingStoppedAt, first);
});

/* ── attaching the file ───────────────────────────────────────────────────── */

test("the upload token can write one path under this agreement, and nothing else", async () => {
    await accepted();
    const { pathname, uploadToken } = await (await post(recordingRoute, { step: "begin", ...FILE })).json();
    assert.match(pathname, new RegExp(`^recordings/${savedOrder().agreementId}/[0-9a-f-]{36}\\.mp4$`));
    const payload = getPayloadFromClientToken(uploadToken);
    assert.equal(payload.pathname, pathname);
    assert.equal(payload.allowOverwrite, false);
    assert.deepEqual(payload.allowedContentTypes, ["video/*", "audio/*"]);
    assert.ok(!uploadToken.includes("secretsecret"), "the store's own token must not be handed out");
});

test("a completed upload is recorded with its hash", async () => {
    await accepted();
    const { pathname } = await uploaded();
    const res = await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA });
    assert.equal(res.status, 200);
    assert.deepEqual({ ...savedAgreement().recording, attachedAt: null }, { pathname, ...FILE, sha256: SHA, attachedAt: null });
});

test("attaching a recording to a paid agreement doesn't put it back on a 30-day expiry", async () => {
    await accepted();
    const key = `agreement:${savedOrder().agreementId}`;
    upstash(["persist", key]);
    const { pathname } = await uploaded();
    await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA });
    assert.ok(savedAgreement().recording, "it was attached");
    assert.equal(upstash(["ttl", key]), -1);
});

test("the stored file has to be there, at the size reported", async () => {
    await accepted();
    const { pathname } = await (await post(recordingRoute, { step: "begin", ...FILE })).json();
    assert.equal((await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA })).status, 409, "never uploaded");
    stored.set(pathname, 999);
    assert.equal((await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA })).status, 409, "wrong size");
    assert.equal(savedAgreement().recording, undefined);
});

test("one agreement can't be pointed at another agreement's recording", async () => {
    await accepted();
    stored.set("recordings/other-agreement/x.mp4", FILE.sizeBytes);
    const res = await post(recordingRoute, { step: "complete", pathname: "recordings/other-agreement/x.mp4", ...FILE, sha256: SHA });
    assert.equal(res.status, 409);
    assert.equal(savedAgreement().recording, undefined);
});

test("an attached recording can't be replaced", async () => {
    await accepted();
    const { pathname } = await uploaded();
    await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA });
    assert.equal((await post(recordingRoute, { step: "begin", ...FILE })).status, 409);
    assert.equal((await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: "b".repeat(64) })).status, 409);
    assert.equal(savedAgreement().recording.sha256, SHA);
});

test("no recording can be attached without consent on the agreement", async () => {
    seedOrder({ status: "terms-accepted", agreementId: "agr_link" });
    kv.set("agreement:agr_link", { value: JSON.stringify({ id: "agr_link", acceptance: { method: "clickwrap-self" } }), expires: false });
    assert.equal((await post(recordingRoute, { step: "begin", ...FILE })).status, 409);
});

test("only video or audio is accepted", async () => {
    await accepted();
    assert.equal((await post(recordingRoute, { step: "begin", ...FILE, contentType: "application/pdf" })).status, 400);
});

test("the summary the console sees says what's on file, without the storage path", async () => {
    await accepted();
    const before = (await (await get(orderRoute)).json()).agreement.call;
    assert.equal(before.recording, null);
    assert.ok(before.recordingConsentAt);
    const { pathname } = await uploaded();
    await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA });
    const text = JSON.stringify((await (await get(orderRoute)).json()).agreement);
    assert.ok(text.includes(SHA));
    assert.ok(!text.includes("recordings/"), "the path stays on the agency's side");
});

test("the file route needs the ops secret and streams the private blob", async () => {
    await accepted();
    const { pathname } = await uploaded();
    await post(recordingRoute, { step: "complete", pathname, ...FILE, sha256: SHA });
    const anon = await fileRoute.GET(new Request("https://x.test/a"), params);
    assert.ok(anon.status === 401 || anon.status === 403 || anon.status === 404, `got ${anon.status}`);
    const res = await get(fileRoute);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), "bytes");
    assert.equal(res.headers.get("content-type"), "video/mp4");
});
