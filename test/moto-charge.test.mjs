/**
 * The card path ("Enter card", Stripe MOTO): the operator types the card into the Stripe
 * Dashboard and the agency charges it.
 *
 * Before this change the path did not exist: `POST /payment {method:"dashboard-moto"}` answered
 * "Entering a card isn't enabled yet", there was no charge endpoint, and `invoice.paid` was
 * ignored. On that code every test here fails, because `moto-charge.mjs` and `moto-payment.ts`
 * aren't there.
 *
 * The charge tests run the real `chargeMotoOrder` and the real Stripe SDK. The network is the
 * only double: an in-memory Upstash, and Stripe's HTTP API answered from `globalThis.fetch`
 * (the SDK's fetch transport, `stripe-fetch-hook.mjs`). What they pin down are the rules Xander
 * set for this path: never charge twice, never charge an amount other than the order's, and
 * never charge a card that wasn't added for this order.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import {
    chargeGate,
    classifyChargeError,
    dashboardCustomerUrl,
    motoInvoiceOrder,
    motoRef,
    pickMotoCard,
    nextPaymentAt,
    chargeReceipt,
    motoSetupParams,
    isMotoUnavailableError,
    isPaymentMethodId,
} from "../app/lib/moto-charge.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);
register("./clerk-unreachable-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_moto",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth_m",
    STRIPE_PRICE_GROWTH_ANNUAL: "price_growth_y",
    STRIPE_PRICE_GROWTH_ONBOARDING: "price_growth_onb",
});

// Dynamic, so the hooks above are in place first.
const { chargeMotoOrder, detectMotoCard, MotoError } = await import("../app/lib/moto-payment.ts");

/* ── the rules, pure ──────────────────────────────────────────────────────── */

test("only a card added after Enter card was chosen is charged", () => {
    const started = Date.parse("2026-11-04T15:00:00Z");
    const s = (iso) => Math.floor(Date.parse(iso) / 1000);
    const onFile = { id: "pm_old", created: s("2026-10-01T00:00:00Z") };
    const added = { id: "pm_new", created: s("2026-11-04T15:02:00Z") };
    const corrected = { id: "pm_newer", created: s("2026-11-04T15:03:00Z") };
    assert.equal(pickMotoCard([onFile], started), null, "a card already on file is never charged");
    assert.equal(pickMotoCard([onFile, added], started)?.id, "pm_new");
    assert.equal(pickMotoCard([added, corrected, onFile], started)?.id, "pm_newer", "the newest added card wins");
});

test("the charge is refused unless the order, the screen and Stripe agree on the amount", () => {
    const base = { status: "awaiting-payment", method: "dashboard-moto", expectedCents: 79400, requestedCents: 79400, previewCents: 79400 };
    assert.deepEqual(chargeGate(base), { ok: true });
    assert.equal(chargeGate({ ...base, requestedCents: 49700 }).code, "amount-mismatch");
    assert.equal(chargeGate({ ...base, requestedCents: "79400" }).code, "amount-mismatch");
    assert.equal(chargeGate({ ...base, previewCents: 99400 }).code, "price-mismatch");
    assert.equal(chargeGate({ ...base, previewCents: null }).code, "price-mismatch");
    assert.equal(chargeGate({ ...base, method: "link" }).code, "not-card");
    assert.equal(chargeGate({ ...base, status: "terms-accepted" }).code, "bad-status");
});

test("a failed first payment reads as declined or bank verification", () => {
    assert.equal(classifyChargeError({ type: "StripeCardError", code: "card_declined", decline_code: "authentication_required" }), "requires_action");
    assert.equal(classifyChargeError({ type: "StripeCardError", code: "card_declined", decline_code: "insufficient_funds" }), "declined");
    assert.equal(classifyChargeError({ type: "StripeConnectionError" }), "error");
});

test("invoice.paid fulfils a card-path order, and leaves a link payment to checkout.session.completed", () => {
    const meta = { order_id: "ord_1", payment_method: "dashboard-moto" };
    const current = {
        billing_reason: "subscription_create",
        customer: "cus_1",
        amount_paid: 79400,
        parent: { subscription_details: { metadata: meta, subscription: "sub_1" } },
    };
    assert.deepEqual(motoInvoiceOrder(current), { orderId: "ord_1", subscriptionId: "sub_1", customerId: "cus_1", amountPaid: 79400 });
    // The pre-2025 invoice shape.
    assert.equal(
        motoInvoiceOrder({ billing_reason: "subscription_create", subscription: "sub_1", subscription_details: { metadata: meta } })?.subscriptionId,
        "sub_1",
    );
    // A link payment's first invoice: the same order_id, but no card-path marker.
    assert.equal(motoInvoiceOrder({ ...current, parent: { subscription_details: { metadata: { order_id: "ord_1" }, subscription: "sub_1" } } }), null);
    // A renewal is not a first payment.
    assert.equal(motoInvoiceOrder({ ...current, billing_reason: "subscription_cycle" }), null);
    assert.equal(motoRef("sub_1"), "moto:sub_1");
});

test("the webhook routes invoice.paid through the card-path rule into the shared fulfilment", () => {
    const src = readFileSync(new URL("../app/api/webhooks/stripe/route.ts", import.meta.url), "utf8");
    assert.match(src, /event\.type === "invoice\.paid"/);
    assert.match(src, /motoInvoiceOrder\(event\.data\.object\)/);
    assert.match(src, /fulfilOperatorPayment\(/);
});

test("a test key opens the test Dashboard", () => {
    assert.equal(dashboardCustomerUrl("cus_1", "sk_test_x"), "https://dashboard.stripe.com/test/customers/cus_1");
    assert.equal(dashboardCustomerUrl("cus_1", "sk_live_x"), "https://dashboard.stripe.com/customers/cus_1");
});

/* ── the charge, end to end against network doubles ──────────────────────── */

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

/** Every request that reached Stripe: method, path, form body, idempotency key. */
let stripeCalls = [];
/** How the fake Stripe answers subscription creation. */
let onCreate = async () => ({ status: 200, body: {} });
/** How it answers saving a typed card (SetupIntent create). */
let onSetup = async () => ({ status: 200, body: { object: "setup_intent", id: "seti_1", status: "succeeded", payment_method: "pm_typed1234" } });
let cards = [];
let previewCents = 79400;

const STARTED = Date.parse("2026-11-04T15:00:00Z");
const card = (id, iso) => ({
    id,
    object: "payment_method",
    type: "card",
    created: Math.floor(Date.parse(iso) / 1000),
    card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2030 },
});
const list = (data) => ({ object: "list", data, has_more: false, url: "/" });

async function stripeFetch(url, init) {
    const u = new URL(url);
    const headers = new Headers(init.headers);
    stripeCalls.push({
        method: init.method,
        path: u.pathname,
        body: String(init.body ?? ""),
        idempotencyKey: headers.get("idempotency-key"),
    });
    const json = (status, body) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });
    if (u.pathname === "/v1/subscriptions" && init.method === "GET") return json(200, list([]));
    if (u.pathname === "/v1/account") return json(200, { object: "account", settings: { payments: { statement_descriptor: "JUNEAU DIGITAL" } } });
    if (u.pathname === "/v1/invoices/create_preview") return json(200, { object: "invoice", amount_due: previewCents });
    if (u.pathname === "/v1/customers/cus_moto/payment_methods") return json(200, list(cards));
    if (u.pathname === "/v1/setup_intents" && init.method === "POST") {
        const { status, body } = await onSetup();
        return json(status, body);
    }
    if (u.pathname === "/v1/subscriptions" && init.method === "POST") {
        const { status, body } = await onCreate();
        return json(status, body);
    }
    throw new Error(`fake stripe: unhandled ${init.method} ${u.pathname}`);
}

const declined = (decline_code) => ({
    status: 402,
    body: { error: { type: "card_error", code: "card_declined", decline_code, message: "Your card was declined." } },
});

function order(overrides = {}) {
    return {
        id: "ord_moto",
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
        agreementId: "agr_1",
        agreementKind: "master",
        payment: { method: "dashboard-moto", stripeCustomerId: "cus_moto" },
        events: [],
        createdAt: STARTED - 60_000,
        updatedAt: STARTED,
        ...overrides,
    };
}

const realFetch = globalThis.fetch;
beforeEach(() => {
    kv.clear();
    stripeCalls = [];
    cards = [card("pm_added", "2026-11-04T15:02:00Z")];
    previewCents = 79400;
    onCreate = async () => declined("generic_decline");
    onSetup = async () => ({ status: 200, body: { object: "setup_intent", id: "seti_1", status: "succeeded", payment_method: "pm_typed1234" } });
    kv.set("jdd:order-charge:ord_moto", JSON.stringify({ startedAt: STARTED, attempt: 0 }));
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

const creates = () => stripeCalls.filter((c) => c.method === "POST" && c.path === "/v1/subscriptions");

test("a double click charges once", async () => {
    let release;
    const held = new Promise((r) => (release = r));
    onCreate = async () => {
        await held; // the first charge is still waiting on Stripe when the second click lands
        return declined("generic_decline");
    };
    const first = chargeMotoOrder(order(), 79400);
    while (creates().length === 0) await new Promise((r) => setTimeout(r, 5));
    await assert.rejects(chargeMotoOrder(order(), 79400), (e) => e instanceof MotoError && e.code === "charge-in-progress");
    release();
    assert.equal((await first).outcome, "declined");
    assert.equal(creates().length, 1, "the second click must not reach Stripe");
});

test("an amount other than the order's is never sent to Stripe", async () => {
    await assert.rejects(chargeMotoOrder(order(), 49700), (e) => e.code === "amount-mismatch");
    previewCents = 99400; // a Stripe price that drifted from Schedule A
    await assert.rejects(chargeMotoOrder(order(), 79400), (e) => e.code === "price-mismatch");
    assert.equal(creates().length, 0);
});

test("a card already on the customer is not charged", async () => {
    cards = [card("pm_on_file", "2026-10-01T00:00:00Z")];
    await assert.rejects(chargeMotoOrder(order(), 79400), (e) => e.code === "no-card");
    assert.equal(creates().length, 0);
});

test("the charge is the order's period price plus onboarding, on the added card, refusing an incomplete first invoice", async () => {
    await chargeMotoOrder(order(), 79400);
    const body = new URLSearchParams(creates()[0].body);
    assert.equal(body.get("customer"), "cus_moto");
    assert.equal(body.get("items[0][price]"), "price_growth_m");
    assert.equal(body.get("add_invoice_items[0][price]"), "price_growth_onb");
    assert.equal(body.get("default_payment_method"), "pm_added");
    assert.equal(body.get("payment_behavior"), "error_if_incomplete");
    assert.equal(body.get("metadata[order_id]"), "ord_moto");
    assert.equal(body.get("metadata[payment_method]"), "dashboard-moto");

    // Annual: $4,970 for the year + $297 onboarding, on the annual price.
    stripeCalls = [];
    previewCents = 526_700;
    await chargeMotoOrder(order({ period: "annual" }), 526_700);
    assert.equal(new URLSearchParams(creates()[0].body).get("items[0][price]"), "price_growth_y");
});

test("bank verification charges nothing, and the retry gets a new idempotency key", async () => {
    onCreate = async () => declined("authentication_required");
    const r1 = await chargeMotoOrder(order(), 79400);
    assert.equal(r1.outcome, "requires_action");
    assert.match(r1.message, /Use a payment link instead\. Nothing was charged\./);
    const r2 = await chargeMotoOrder(order(), 79400);
    assert.equal(r2.outcome, "requires_action");
    const [k1, k2] = creates().map((c) => c.idempotencyKey);
    assert.ok(k1 && k2 && k1 !== k2, "reusing a declined attempt's key would replay the decline");
});

test("a paid order is not charged again", async () => {
    const r = await chargeMotoOrder(order({ status: "paid" }), 79400);
    assert.equal(r.outcome, "paid");
    assert.equal(stripeCalls.filter((c) => c.method === "POST").length, 0, "a paid order sends nothing that could charge");
});

/* ── the checkout and the receipt ─────────────────────────────────────────── */

test("detecting the card answers yes or no, in one read, and says nothing about the card", async () => {
    assert.deepEqual(await detectMotoCard(order()), { cardAdded: true });
    assert.deepEqual(stripeCalls.map((c) => c.path), ["/v1/customers/cus_moto/payment_methods"]);
    cards = [card("pm_on_file", "2026-10-01T00:00:00Z")];
    assert.deepEqual(await detectMotoCard(order()), { cardAdded: false }, "a card already on file isn't the card for this order");
});

test("the next payment is a month or a year on, the same day, as Stripe anchors it", () => {
    const signed = Date.parse("2026-11-04T15:00:00Z");
    assert.equal(new Date(nextPaymentAt(signed, "monthly")).toISOString(), "2026-12-04T15:00:00.000Z");
    assert.equal(new Date(nextPaymentAt(signed, "annual")).toISOString(), "2027-11-04T15:00:00.000Z");
    // The 31st clamps to the end of a shorter month rather than spilling into the next.
    assert.equal(new Date(nextPaymentAt(Date.parse("2027-01-31T15:00:00Z"), "monthly")).toISOString(), "2027-02-28T15:00:00.000Z");
});

test("the receipt shows what Stripe charged, not what we expected", () => {
    const receipt = chargeReceipt({
        id: "sub_1",
        latest_invoice: { object: "invoice", number: "A1B2C3-0001", amount_paid: 79400, created: 1793800000, status_transitions: { paid_at: 1793800005 } },
        default_payment_method: { object: "payment_method", card: { brand: "visa", last4: "4242" } },
        items: { data: [{ current_period_end: 1796478405, price: { unit_amount: 49700 } }] },
    });
    assert.deepEqual(receipt, {
        amountPaidCents: 79400,
        paidAt: 1793800005000,
        invoiceNumber: "A1B2C3-0001",
        card: { brand: "visa", last4: "4242" },
        nextPaymentAt: 1796478405000,
        nextAmountCents: 49700,
    });
    // Unexpanded ids give an honest blank, not a guess.
    assert.deepEqual(chargeReceipt({ latest_invoice: "in_1", default_payment_method: "pm_1", items: { data: [] } }), {
        amountPaidCents: null,
        paidAt: null,
        invoiceNumber: null,
        card: null,
        nextPaymentAt: null,
        nextAmountCents: null,
    });
});

/* ── the card typed into the wizard's own Stripe field ────────────────────── */

// Recorded from this account on 2026-11-04 (test mode), before Stripe enabled API phone orders.
const MOTO_NOT_ENABLED = {
    type: "invalid_request_error",
    code: "parameter_unknown",
    param: "payment_method_options[card][moto]",
    message: "Received unknown parameter: payment_method_options[card][moto]",
};

test("a typed card is saved as a phone order, for renewals, before it is charged", () => {
    const p = motoSetupParams({ customerId: "cus_1", paymentMethodId: "pm_typed1234", orderId: "ord_1" });
    assert.equal(p.payment_method_options.card.moto, true, "without moto the bank may send a 3-D Secure code to the client");
    assert.equal(p.usage, "off_session");
    assert.equal(p.confirm, true);
    assert.equal(p.customer, "cus_1");
    assert.equal(p.payment_method, "pm_typed1234");
});

test("Stripe's answer before phone orders are enabled is recognised, and nothing else is", () => {
    assert.equal(isMotoUnavailableError(MOTO_NOT_ENABLED), true);
    assert.equal(isMotoUnavailableError({ code: "parameter_unknown", param: "metadata[x]", message: "Received unknown parameter: metadata[x]" }), false);
    assert.equal(isMotoUnavailableError({ type: "StripeCardError", code: "card_declined" }), false);
});

test("only a Stripe card id is accepted from the card field", () => {
    assert.equal(isPaymentMethodId("pm_1Q2w3E4r5T6y"), true);
    for (const bad of ["4242424242424242", "tok_visa", "pm_", "", null, 4242]) assert.equal(isPaymentMethodId(bad), false, String(bad));
});

test("the card field's card is attached as a phone order, then charged, in one request", async () => {
    await chargeMotoOrder(order(), 79400, "pm_typed1234");
    const setup = stripeCalls.find((c) => c.path === "/v1/setup_intents");
    assert.ok(setup, "the card is saved to the customer first");
    const sb = new URLSearchParams(setup.body);
    assert.equal(sb.get("payment_method_options[card][moto]"), "true");
    assert.equal(sb.get("customer"), "cus_moto");
    assert.equal(sb.get("payment_method"), "pm_typed1234");
    assert.ok(setup.idempotencyKey, "a retried request attaches the card once");
    assert.equal(new URLSearchParams(creates()[0].body).get("default_payment_method"), "pm_typed1234");
    assert.equal(stripeCalls.some((c) => c.path.endsWith("/payment_methods")), false, "the typed card is charged, not whatever is newest on the customer");
});

test("until Stripe enables phone orders, a typed card is refused and nothing is charged", async () => {
    onSetup = async () => ({ status: 400, body: { error: MOTO_NOT_ENABLED } });
    await assert.rejects(chargeMotoOrder(order(), 79400, "pm_typed1234"), (e) => e.code === "moto-unavailable");
    assert.equal(creates().length, 0);
});

test("anything but a Stripe card id is refused before Stripe is called", async () => {
    await assert.rejects(chargeMotoOrder(order(), 79400, "4242424242424242"), (e) => e.code === "bad-card");
    assert.equal(stripeCalls.length, 0);
});
