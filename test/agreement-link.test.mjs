/**
 * The Terms step's two ways to accept: the read-aloud script, and a private link the client uses
 * to read and agree themselves (Xander, 2026-11-08). Before this there was no link, and the
 * script left out the arbitration clause, electronic signing and the overage price.
 *
 * The route tests run the real handler, PDF and agreement record included. The network is the
 * only double (in-memory Upstash, a Blob `put` that keeps nothing, an accepting email API).
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import {
    AGREE_CODE,
    agreementLinkState,
    agreementSubmissionError,
    newAgreeCode,
    orderDocFingerprint,
} from "../app/lib/agreement-link.mjs";

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
    STRIPE_SECRET_KEY: "sk_test_agree",
    RESEND_API_KEY: "re_test",
    OPS_ORDERS_SECRET: "orders-secret",
});

const { buildCallScript } = await import("../app/lib/legal/call-script.ts");
const { createAgreementLink } = await import("../app/lib/agreement-link.ts");
const { termsHashForOrder } = await import("../app/lib/verbal-agreement.ts");
const agree = await import("../app/api/agree/[code]/route.ts");

/* ── the rules ────────────────────────────────────────────────────────────── */

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

test("a link is live only for a draft order, before expiry, for the same document", () => {
    const fingerprint = "fp";
    const link = { orderId: "o", fingerprint, expiresAt: 2000 };
    const state = (l, o, f = fingerprint, nowMs = 1000) => agreementLinkState({ link: l, order: o, fingerprint: f, nowMs });
    assert.equal(state(link, { status: "draft" }), "active");
    assert.equal(state(link, { status: "draft" }, "changed"), "inactive", "the order changed after the link went out");
    assert.equal(state(link, { status: "draft" }, fingerprint, 3000), "inactive", "expired");
    assert.equal(state(link, { status: "terms-accepted" }), "inactive", "accepted another way");
    assert.equal(state({ ...link, acceptedAt: 1500 }, { status: "terms-accepted" }), "accepted", "reloading after agreeing");
    assert.equal(state(null, { status: "draft" }), "inactive");
});

test("the document fingerprint follows everything the agreement names", () => {
    const base = orderDocFingerprint(order(), "hash");
    assert.equal(orderDocFingerprint(order(), "hash"), base);
    assert.notEqual(orderDocFingerprint(order({ plan: "starter" }), "hash"), base);
    assert.notEqual(orderDocFingerprint(order({ period: "annual" }), "hash"), base);
    assert.notEqual(orderDocFingerprint(order(), "other-terms"), base);
    assert.notEqual(orderDocFingerprint(order({ client: { ...order().client, legalName: "Other LLC" } }), "hash"), base);
});

test("the code is long enough that it can't be guessed", () => {
    assert.match(newAgreeCode(), AGREE_CODE);
    assert.equal(newAgreeCode().length, 10);
});

test("a submission needs the tick, the current document, and a read to the end", () => {
    const ok = { accepted: true, termsHash: "h", pageOpenedAt: "2026-11-08T15:00:00Z", scrollCompletedAt: "2026-11-08T15:02:00Z" };
    assert.equal(agreementSubmissionError(ok, "h"), null);
    assert.match(agreementSubmissionError({ ...ok, accepted: "true" }, "h"), /tick the box/);
    assert.match(agreementSubmissionError(ok, "other"), /changed/);
    assert.match(agreementSubmissionError({ ...ok, scrollCompletedAt: undefined }, "h"), /read to the end/);
});

/* ── the read-aloud script ────────────────────────────────────────────────── */

test("the script states the renewal charge, the overage, the disputes clause, and that yes accepts the full agreement", () => {
    const { lines } = buildCallScript("growth", "monthly");
    const all = lines.join(" ");
    assert.equal(lines.length, 7);
    assert.match(all, /you are charged \$497 on this date each month until you cancel/);
    assert.match(all, /Extra minutes are \$0\.20 each/);
    assert.match(all, /handled individually through arbitration, not in court/);
    assert.match(all, /the terms limit our liability/);
    assert.match(all, /By saying yes, you accept these terms and the full agreement we'll email you\. Do you agree\?/);
    assert.match(buildCallScript("growth", "annual").lines.join(" "), /charged \$4,970 on this date each year/);
    // Website-only has no call minutes to state.
    assert.equal(buildCallScript("starter", "monthly", { webOnly: true }).lines.some((l) => /call-minutes/.test(l)), false);
});

/* ── the client's page, end to end ────────────────────────────────────────── */

const kv = new Map();
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
function upstash([op, ...args]) {
    switch (op.toLowerCase()) {
        case "get": {
            const v = kv.get(args[0]);
            return v === undefined ? null : b64(v);
        }
        case "set": {
            const flags = args.slice(2).map((a) => String(a).toLowerCase());
            if (flags.includes("nx") && kv.has(args[0])) return null;
            kv.set(args[0], String(args[1]));
            return "OK";
        }
        case "del":
            return args.filter((k) => kv.delete(k)).length;
        case "zadd":
            return 1;
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

let emails = 0;
const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    emails = 0;
    kv.set("jdd:order:ord_agree", JSON.stringify(order()));
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        if (url.startsWith("https://api.resend.com/")) {
            emails += 1;
            return Response.json({ id: "email_1" });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const saved = () => JSON.parse(kv.get("jdd:order:ord_agree"));
const records = () => [...kv.keys()].filter((k) => k.startsWith("agreement:") || k.startsWith("jdd:agreement:"));
const submit = (code, overrides = {}) =>
    agree.POST(
        new Request(`http://agency.test/api/agree/${code}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9, 10.0.0.1", "user-agent": "phone-browser" },
            body: JSON.stringify({
                accepted: true,
                termsHash: termsHashForOrder(order(), "master"),
                pageOpenedAt: "2026-11-08T15:00:00Z",
                scrollCompletedAt: "2026-11-08T15:02:00Z",
                ...overrides,
            }),
        }),
        { params: Promise.resolve({ code }) },
    );

test("agreeing records the agreement on the order, the same kind of record a verbal one is", async () => {
    const { code } = await createAgreementLink(order());
    const res = await submit(code);
    assert.equal(res.status, 200);

    const after = saved();
    assert.equal(after.status, "terms-accepted");
    assert.ok(after.agreementId);
    assert.equal(after.agreementKind, "master");

    const record = JSON.parse(kv.get(records()[0]));
    assert.equal(record.id, after.agreementId);
    assert.equal(record.signerName, "Arthur Dent");
    assert.equal(record.acceptance.method, "clickwrap-self");
    assert.equal(record.acceptance.orderId, "ord_agree");
    assert.equal(record.acceptance.ip, "203.0.113.9");
    assert.equal(record.audit.ip, "203.0.113.9");
    assert.equal(record.audit.termsHash, termsHashForOrder(order(), "master"));
    assert.ok(record.pdfUrl.startsWith("https://blob.test/agreements/"));
    // The copy goes out after the response, and stripping the PDF takes longer on a busy machine.
    for (let i = 0; i < 100 && emails === 0; i++) await new Promise((r) => setTimeout(r, 50));
    assert.equal(emails, 1, "the client gets their copy");
});

test("agreeing twice records once", async () => {
    const { code } = await createAgreementLink(order());
    await submit(code);
    const first = saved().agreementId;
    const again = await submit(code);
    assert.equal(again.status, 200, "a reload or double click still reads as recorded");
    assert.equal(saved().agreementId, first);
    assert.equal(records().length, 1);
});

test("a link for a changed order records nothing", async () => {
    const { code } = await createAgreementLink(order());
    kv.set("jdd:order:ord_agree", JSON.stringify(order({ period: "annual" })));
    assert.equal((await submit(code)).status, 410);
    assert.equal(saved().status, "draft");
    assert.equal(records().length, 0);
});

test("a submission that skipped the tick records nothing", async () => {
    const { code } = await createAgreementLink(order());
    assert.equal((await submit(code, { accepted: false })).status, 400);
    assert.equal(saved().status, "draft");
});

test("New link kills the old one; an unchanged order reuses it", async () => {
    const first = await createAgreementLink(order());
    assert.equal((await createAgreementLink(order())).code, first.code);
    const next = await createAgreementLink(order(), { fresh: true });
    assert.notEqual(next.code, first.code);
    assert.equal((await submit(first.code)).status, 410);
});
