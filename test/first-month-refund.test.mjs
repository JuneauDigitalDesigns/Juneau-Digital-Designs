/**
 * The first-month refund (Terms v7 §2.2, §1.2), run for real against a fake Stripe and a fake
 * Upstash. The network is the only double: the real Stripe SDK (on its fetch transport) and the
 * real `@upstash/redis` client build every request.
 *
 * What it proves: only the first invoice's plan line is refunded (never onboarding); the
 * subscription ends the same day; a retry, a double click or a cancel that failed half-way never
 * refunds twice; and the window, "once per business" and a chargeback all close it.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./stripe-fetch-hook.mjs", import.meta.url);

const redis = fakeUpstash();
Object.assign(process.env, {
    KV_REST_API_URL: redis.url,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: redis.url,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
    STRIPE_SECRET_KEY: "sk_test_refund",
    STRIPE_PRICE_WEBSITE_MONTHLY: "price_web",
    STRIPE_PRICE_WEBSITE_ONBOARDING: "price_web_onb",
    STRIPE_PRICE_STARTER_MONTHLY: "price_starter",
    STRIPE_PRICE_STARTER_MONTHLY_LEGACY: "price_starter_197",
    STRIPE_PRICE_GROWTH_MONTHLY: "price_growth",
    STRIPE_PRICE_ENTERPRISE_MONTHLY: "price_ent",
});

const { quoteFirstMonthRefund, refundFirstMonthAndEnd } = await import("../app/lib/first-month-refund.ts");

const DAY = 86_400_000;
const EMAIL = "owner@sunshine.test";
const site = { slug: "sunshine", plan: "website", status: "live", addedAt: 1, stripeSubscriptionId: "sub_1" };
const account = { email: EMAIL, sites: [site], createdAt: 1, updatedAt: 1 };

let state;
const calls = [];
const list = (data) => ({ object: "list", data, has_more: false, url: "/v1/x" });

function freshState(over = {}) {
    return {
        paidAtS: Math.floor((Date.now() - 2 * DAY) / 1000),
        planPrice: "price_web",
        planCents: 9700,
        subStatus: "active",
        disputed: false,
        refunds: [],
        cancelFails: 0,
        ...over,
    };
}

async function stripeFetch(url, init) {
    const u = new URL(url);
    const headers = new Headers(init.headers);
    const method = init.method ?? "GET";
    calls.push({ method, path: u.pathname, idempotencyKey: headers.get("idempotency-key"), body: String(init.body ?? "") });
    const json = (status, body) =>
        new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });

    if (u.pathname === "/v1/invoices" && method === "GET") {
        return json(200, list([{
            id: "in_1",
            object: "invoice",
            status: "paid",
            billing_reason: "subscription_create",
            amount_paid: state.planCents + 29700,
            status_transitions: { paid_at: state.paidAtS },
            lines: list([
                { id: "il_plan", amount: state.planCents, discount_amounts: [], parent: { subscription_item_details: { proration: false } }, pricing: { price_details: { price: state.planPrice } } },
                { id: "il_onb", amount: 29700, discount_amounts: [], parent: { invoice_item_details: { proration: false } }, pricing: { price_details: { price: "price_web_onb" } } },
            ]),
        }]));
    }
    if (u.pathname === "/v1/invoice_payments") {
        return json(200, list([{ id: "inpay_1", status: "paid", payment: { type: "payment_intent", payment_intent: "pi_1" } }]));
    }
    if (u.pathname === "/v1/payment_intents/pi_1") {
        const refunded = state.refunds.reduce((s, r) => s + r.amount, 0);
        return json(200, { id: "pi_1", object: "payment_intent", latest_charge: { id: "ch_1", object: "charge", amount: state.planCents + 29700, amount_refunded: refunded, disputed: state.disputed } });
    }
    if (u.pathname === "/v1/refunds" && method === "GET") return json(200, list(state.refunds));
    if (u.pathname === "/v1/refunds" && method === "POST") {
        const p = new URLSearchParams(String(init.body));
        const refund = {
            id: `re_${state.refunds.length + 1}`,
            object: "refund",
            amount: Number(p.get("amount")),
            status: "succeeded",
            metadata: { jdd_kind: p.get("metadata[jdd_kind]") },
        };
        state.refunds.push(refund);
        return json(200, refund);
    }
    if (u.pathname === "/v1/subscriptions/sub_1" && method === "GET") {
        return json(200, { id: "sub_1", object: "subscription", status: state.subStatus, schedule: null, items: list([]) });
    }
    if (u.pathname === "/v1/subscriptions/sub_1" && method === "DELETE") {
        if (state.cancelFails > 0) {
            state.cancelFails -= 1;
            return json(500, { error: { type: "api_error", message: "boom" } });
        }
        state.subStatus = "canceled";
        return json(200, { id: "sub_1", object: "subscription", status: "canceled" });
    }
    throw new Error(`fake stripe: unhandled ${method} ${u.pathname}`);
}

const realFetch = globalThis.fetch;
beforeEach(() => {
    redis.reset();
    calls.length = 0;
    state = freshState();
    globalThis.fetch = async (input, init = {}) => {
        const url = String(input instanceof Request ? input.url : input);
        if (redis.owns(url)) return redis.handle(url, init);
        if (url.startsWith("https://api.stripe.com/")) return stripeFetch(url, init);
        throw new Error(`unexpected fetch: ${url}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const sub = () => ({ id: "sub_1", status: state.subStatus });
const refundPosts = () => calls.filter((c) => c.method === "POST" && c.path === "/v1/refunds");

async function cancelInWindow(acct = account) {
    const quote = await quoteFirstMonthRefund(acct, acct.sites[0], sub());
    assert.equal(quote.eligible, true, JSON.stringify(quote));
    return refundFirstMonthAndEnd({ account: acct, site: acct.sites[0], subscription: sub(), quote });
}

test("in the window: the plan fee alone is refunded ($97, never the $297 onboarding) and service ends today", async () => {
    const quote = await quoteFirstMonthRefund(account, site, sub());
    assert.equal(quote.eligible, true);
    assert.equal(quote.amountCents, 9700);
    assert.equal(quote.amountText, "$97");

    const result = await refundFirstMonthAndEnd({ account, site, subscription: sub(), quote });
    assert.equal(result.ok, true);
    assert.equal(result.amountCents, 9700);
    assert.equal(refundPosts().length, 1);
    assert.match(refundPosts()[0].body, /amount=9700/);
    assert.match(refundPosts()[0].body, /metadata\[jdd_kind\]=first-month-refund/);
    assert.equal(refundPosts()[0].idempotencyKey, "jdd-first-month-refund-in_1");
    assert.equal(state.subStatus, "canceled");
    assert.ok(calls.some((c) => c.method === "DELETE" && c.path === "/v1/subscriptions/sub_1"));
});

test("a retry after success refunds nothing more and returns the same refund", async () => {
    const first = await cancelInWindow();
    const again = await refundFirstMonthAndEnd({
        account,
        site,
        subscription: sub(),
        quote: { eligible: true, amountCents: 9700, amountText: "$97", windowEndsAt: 0, invoiceId: "in_1", payment: { paymentIntentId: "pi_1" } },
    });
    assert.equal(again.ok, true);
    assert.equal(again.refundId, first.refundId);
    assert.equal(refundPosts().length, 1);
});

test("a double click refunds once", async () => {
    const quote = await quoteFirstMonthRefund(account, site, sub());
    const [a, b] = await Promise.all([
        refundFirstMonthAndEnd({ account, site, subscription: sub(), quote }),
        refundFirstMonthAndEnd({ account, site, subscription: sub(), quote }),
    ]);
    assert.ok(a.ok || b.ok);
    assert.equal(state.refunds.length, 1);
});

test("a cancel that fails after the refund resumes at the cancel, without refunding again", async () => {
    // More failures than the SDK retries, so the cancel really fails this time.
    state.cancelFails = 10;
    const first = await cancelInWindow();
    assert.equal(first.ok, false);
    assert.equal(first.code, "cancel-failed");
    assert.equal(state.refunds.length, 1);
    assert.equal(state.subStatus, "active");

    // The quote still says eligible (the claim is resumed), and the retry only cancels.
    state.cancelFails = 0;
    const second = await cancelInWindow();
    assert.equal(second.ok, true);
    assert.equal(state.refunds.length, 1);
    assert.equal(state.subStatus, "canceled");
});

test("a lost KV claim still never refunds twice: our refund is found on the payment", async () => {
    await cancelInWindow();
    redis.reset();
    state.subStatus = "active";
    const quote = { eligible: true, amountCents: 9700, amountText: "$97", windowEndsAt: 0, invoiceId: "in_1", payment: { paymentIntentId: "pi_1" } };
    const again = await refundFirstMonthAndEnd({ account, site, subscription: sub(), quote });
    assert.equal(again.ok, true);
    assert.equal(state.refunds.length, 1);
});

test("day 30 and after: no refund, the ordinary period-end cancel applies", async () => {
    state = freshState({ paidAtS: Math.floor((Date.now() - 30 * DAY - 1000) / 1000) });
    const quote = await quoteFirstMonthRefund(account, site, sub());
    assert.equal(quote.eligible, false);
    assert.equal(quote.reason, "outside-window");
});

test("once per business: a second subscription on the same account gets no second refund", async () => {
    await cancelInWindow();
    const other = { ...site, slug: "sunshine-2", stripeSubscriptionId: "sub_1" };
    state = freshState();
    const quote = await quoteFirstMonthRefund({ ...account, sites: [other] }, other, { id: "sub_2", status: "active" });
    assert.equal(quote.eligible, false);
    assert.equal(quote.reason, "already-used");
});

test("a second site on an account that already bills is not its first payment", async () => {
    const second = { ...site, slug: "second", stripeSubscriptionId: "sub_1" };
    const acct = { ...account, sites: [{ ...site, slug: "first", stripeSubscriptionId: "sub_0" }, second] };
    const quote = await quoteFirstMonthRefund(acct, second, sub());
    assert.equal(quote.eligible, false);
    assert.equal(quote.reason, "not-first-payment");
});

test("after a chargeback, no refund", async () => {
    state.disputed = true;
    const quote = await quoteFirstMonthRefund(account, site, sub());
    assert.equal(quote.eligible, false);
    assert.equal(quote.reason, "disputed");
});

test("a grandfathered $197 Starter price is a plan line too", async () => {
    state = freshState({ planPrice: "price_starter_197", planCents: 19700 });
    const starter = { ...site, plan: "starter", receptionistMode: "forwarded" };
    const quote = await quoteFirstMonthRefund({ ...account, sites: [starter] }, starter, sub());
    assert.equal(quote.eligible, true);
    assert.equal(quote.amountCents, 19700);
});
