/**
 * Opening and replacing an operator order's payment link. Bugs from the 2026-11-08 test run:
 *
 *   - F5: "already has a link?" and "create one" were two steps, so two requests at once each
 *     opened a Checkout Session (`ord_ASb-ORO87ynR`: two open sessions in the same second, one
 *     orphaned at Stripe).
 *   - F3: Stripe refusing the session (no Terms of service URL on the account) came back as a
 *     bare 500, "Could not open a payment link", with nothing to act on.
 *
 * Runs the real routes and the real Stripe SDK. The network is the only double: an in-memory
 * Upstash and Stripe's HTTP API. Stripe's refusal text below is written from the test-run report,
 * which kept the request id but not the message, so `checkoutRefusal` matches it loosely.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { checkoutRefusal } from "../app/lib/order-link.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-unreachable-hook.mjs", import.meta.url);
register("./next-server-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_link",
    OPS_ORDERS_SECRET: "orders-secret",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_m",
    STRIPE_PRICE_GROWTH_ONBOARDING: "price_growth_onb",
});

const { createAccount } = await import("@jdd/schema");
const payment = await import("../app/api/ops/orders/[id]/payment/route.ts");
const resend = await import("../app/api/ops/orders/[id]/resend-link/route.ts");

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
        case "exists":
            return args.filter((k) => kv.has(k)).length;
        case "zadd":
            return 1;
        default:
            throw new Error(`fake upstash: unhandled ${op}`);
    }
}

let sessionsCreated = 0;
let customersCreated = 0;
let onCreate;
const sessionsExpired = [];

async function stripeFetch(url, init) {
    const u = new URL(url);
    const json = (status, body) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });
    if (u.pathname === "/v1/checkout/sessions" && init.method === "POST") {
        sessionsCreated += 1;
        const { status, body } = await onCreate(sessionsCreated);
        return json(status, body);
    }
    if (u.pathname === "/v1/customers" && init.method === "POST") {
        customersCreated += 1;
        await new Promise((r) => setTimeout(r, 40));
        return json(200, { id: `cus_${customersCreated}`, object: "customer" });
    }
    if (/^\/v1\/customers\/[^/]+$/.test(u.pathname)) return json(200, { id: u.pathname.split("/").pop(), object: "customer", metadata: {} });
    if (u.pathname === "/v1/setup_intents") {
        return json(400, { error: { type: "invalid_request_error", code: "parameter_unknown", param: "payment_method_options[card][moto]", message: "Received unknown parameter: payment_method_options[card][moto]" } });
    }
    const expire = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)\/expire$/);
    if (expire) {
        sessionsExpired.push(expire[1]);
        return json(200, { id: expire[1], object: "checkout.session", status: "expired" });
    }
    const get = u.pathname.match(/^\/v1\/checkout\/sessions\/([^/]+)$/);
    if (get) return json(200, { id: get[1], object: "checkout.session", status: "open", payment_status: "unpaid" });
    throw new Error(`fake stripe: unhandled ${init.method} ${u.pathname}`);
}

const session = (n) => ({
    status: 200,
    body: { id: `cs_test_${n}`, object: "checkout.session", url: `https://checkout.stripe.com/c/pay/cs_test_${n}` },
});

function order(overrides = {}) {
    return {
        id: "ord_link",
        version: 1,
        source: "operator-call",
        status: "terms-accepted",
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
        agreementId: "agr_1",
        agreementKind: "master",
        events: [],
        createdAt: 1793800000000,
        updatedAt: 1793800000000,
        ...overrides,
    };
}

const seed = (o) => kv.set("jdd:order:ord_link", JSON.stringify(o));
const saved = () => JSON.parse(kv.get("jdd:order:ord_link"));
const call = (route, body = { method: "link" }) =>
    route.POST(
        new Request("http://agency.test/api/ops/orders/ord_link/x", {
            method: "POST",
            headers: { "x-ops-secret": "orders-secret", "content-type": "application/json" },
            body: JSON.stringify(body),
        }),
        { params: Promise.resolve({ id: "ord_link" }) },
    );

const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    sessionsCreated = 0;
    customersCreated = 0;
    sessionsExpired.length = 0;
    onCreate = async (n) => session(n);
    const account = { ...createAccount("arthur@arthursplumbing.com"), stripeCustomerId: "cus_link" };
    kv.set("jdd:account:arthur@arthursplumbing.com", JSON.stringify(account));
    seed(order());
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (url.startsWith(KV_URL)) {
            const body = JSON.parse(init.body);
            return url.endsWith("/pipeline")
                ? Response.json(body.map((cmd) => ({ result: upstash(cmd) })))
                : Response.json({ result: upstash(body) });
        }
        if (url.startsWith("https://api.stripe.com/")) return stripeFetch(url, init);
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

test("two requests at once open one Checkout Session, and both get its link", async () => {
    onCreate = async (n) => {
        await new Promise((r) => setTimeout(r, 60)); // the second request lands while this one waits on Stripe
        return session(n);
    };
    const [a, b] = await Promise.all([call(payment), call(payment)]);
    assert.equal(sessionsCreated, 1, "the second request must not open a session");
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const [ja, jb] = await Promise.all([a.json(), b.json()]);
    assert.equal(ja.shortUrl, jb.shortUrl);
    assert.equal(saved().payment.checkoutSessionId, "cs_test_1");
    // On 2026-11-08 the wizard showed a code the order hadn't kept, so the link it copied was dead.
    assert.ok(ja.shortUrl.endsWith(`/pay/${saved().payment.shortCode}`), "the link handed back is the one the order saved");
    assert.equal(kv.has(`jdd:pay:${saved().payment.shortCode}`), true);
});

const noCustomerYet = () => kv.set("jdd:account:arthur@arthursplumbing.com", JSON.stringify(createAccount("arthur@arthursplumbing.com")));

test("two requests at once make one Stripe customer, on the link path and the card path", async () => {
    // The account and the order ended up on different customers on 2026-11-08.
    noCustomerYet();
    const links = await Promise.all([call(payment), call(payment)]);
    assert.deepEqual(links.map((r) => r.status), [200, 200]);
    assert.equal(customersCreated, 1);
    assert.equal(saved().payment.stripeCustomerId, JSON.parse(kv.get("jdd:account:arthur@arthursplumbing.com")).stripeCustomerId);

    customersCreated = 0;
    noCustomerYet();
    seed(order());
    kv.delete("jdd:order-link-lock:ord_link");
    const cards = await Promise.all([call(payment, { method: "dashboard-moto" }), call(payment, { method: "dashboard-moto" })]);
    assert.deepEqual(cards.map((r) => r.status), [200, 200]);
    assert.equal(customersCreated, 1);
    assert.equal(saved().payment.stripeCustomerId, JSON.parse(kv.get("jdd:account:arthur@arthursplumbing.com")).stripeCustomerId);
});

test("a failed attempt doesn't block the next one", async () => {
    onCreate = async () => ({ status: 500, body: { error: { type: "api_error", message: "boom" } } });
    assert.notEqual((await call(payment)).status, 200);
    onCreate = async (n) => session(n);
    assert.equal((await call(payment)).status, 200);
});

test("Stripe refusing for want of a Terms of service URL says so", async () => {
    onCreate = async () => ({
        status: 400,
        body: {
            error: {
                type: "invalid_request_error",
                message: "You cannot collect consent to your terms of service unless a URL is set in the Stripe Dashboard.",
            },
        },
    });
    const res = await call(payment);
    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.code, "no-tos-url");
    assert.match(body.error, /no Terms of service URL/);
    assert.match(body.error, /Settings, Public details/);
});

test("any other refusal passes on Stripe's reason; a non-Stripe failure doesn't pretend to", () => {
    assert.deepEqual(checkoutRefusal({ type: "StripeInvalidRequestError", message: "No such price" }), {
        code: "stripe-refused",
        message: "Stripe refused the payment link: No such price",
    });
    assert.equal(checkoutRefusal(new Error("kv down")), null);
});

test("New link replaces a live link: the old session is closed and the order keeps awaiting payment", async () => {
    await call(payment);
    const first = saved().payment;
    const res = await call(resend, {});
    assert.equal(res.status, 200);
    assert.deepEqual(sessionsExpired, [first.checkoutSessionId]);
    const after = saved();
    assert.equal(after.status, "awaiting-payment");
    assert.equal(after.payment.checkoutSessionId, "cs_test_2");
    assert.notEqual(after.payment.shortCode, first.shortCode);
    assert.equal(kv.has(`jdd:pay:${first.shortCode}`), false, "the old short link stops resolving");
});
