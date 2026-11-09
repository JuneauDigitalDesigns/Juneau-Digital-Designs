/**
 * Two fulfilments of one operator order at once. Stripe delivers webhooks concurrently, and on
 * 2026-11-08 two deliveries each sent a portal invitation 38 ms apart: the client received one
 * and the order recorded the other, so Resend invite would have revoked the wrong link.
 *
 * Runs the real fulfilment. The network is the only double, plus a Clerk that counts invitations.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-recording-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_race",
    RESEND_API_KEY: "re_test",
});

const { fulfilOperatorPayment } = await import("../app/lib/checkout-fulfillment.ts");

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
        case "sadd":
        case "persist":
            return 1;
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

let emails = [];
const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    emails = [];
    globalThis.__clerk = { created: 0 };
    kv.set(
        "jdd:order:ord_race",
        JSON.stringify({
            id: "ord_race",
            version: 1,
            source: "operator-call",
            status: "awaiting-payment",
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
            payment: { method: "link", stripeCustomerId: "cus_1" },
            events: [],
            createdAt: 1793800000000,
            updatedAt: 1793800000000,
        }),
    );
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        if (url.startsWith("https://api.resend.com/")) {
            emails.push(String(init.body));
            return Response.json({ id: "email_1" });
        }
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const delivery = (ref) => fulfilOperatorPayment("ord_race", { ref, customerId: "cus_1", subscriptionId: "sub_1", amountTotal: 79400 });

test("two deliveries at once send one invitation, and the order records the one emailed", async () => {
    const [a, b] = await Promise.all([delivery("cs_1"), delivery("cs_1")]);
    assert.ok(a && b, "both callers get the fulfilled result");
    assert.equal(globalThis.__clerk.created, 1, "one invitation");
    const order = JSON.parse(kv.get("jdd:order:ord_race"));
    assert.equal(order.status, "fulfilled");
    assert.equal(order.invite.invitationId, "inv_1");
    assert.equal(emails.length, 1, "one welcome email");
    assert.match(emails[0], /clerk\.test\/ticket\/1/, "the email carries the recorded invitation");
});

test("a later delivery changes nothing", async () => {
    await delivery("cs_1");
    await delivery("cs_1");
    assert.equal(globalThis.__clerk.created, 1);
    assert.equal(emails.length, 1);
});

test("the lock is released, so a failed run can be retried", async () => {
    await delivery("cs_1");
    assert.equal(kv.has("jdd:order-fulfil-lock:ord_race"), false);
});
