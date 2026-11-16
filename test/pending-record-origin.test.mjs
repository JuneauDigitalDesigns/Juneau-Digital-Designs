/**
 * The console's pending-onboard record carries the order or purchase the paid site came from
 * (Xander, 2026-11-16). `jdd:pending-onboard:{slug}` is how the console's Clients board first
 * sees a client who has paid but not onboarded; it now says which path they came through.
 *
 * Runs the real `createPendingSite` against an in-memory Upstash.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});

const { createPendingSite } = await import("../app/lib/account-store.ts");

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;

function site(extra = {}) {
    return {
        slug: "pending-Ab12Cd34",
        name: "Ridgeback Roofing LLC",
        plan: "starter",
        status: "pending-onboarding",
        sessionId: "cs_test_ridgeback",
        signerEmail: "rae@ridgeback.test",
        signerName: "Rae Ridgeback",
        onboardingCompletedAt: null,
        addedAt: 1700000000000,
        ...extra,
    };
}

const pending = (slug) => JSON.parse(redis.get(`jdd:pending-onboard:${slug}`));

beforeEach(() => {
    redis.reset();
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(String(input))) return redis.handle(input, init);
        throw new Error(`unexpected fetch: ${String(input)}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

test("self-serve checkout: the pending record carries the purchase id", async () => {
    await createPendingSite("rae@ridgeback.test", site({ purchaseId: "pur_ridgeback" }));
    const rec = pending("pending-Ab12Cd34");
    assert.equal(rec.purchaseId, "pur_ridgeback");
    assert.equal("orderId" in rec, false);
});

test("operator order paid: the pending record carries the order id", async () => {
    await createPendingSite("rae@ridgeback.test", site({ slug: "ridgeback-roofing", slugLocked: true, orderId: "ord_ridgeback", sessionId: "pay_ridgeback" }));
    const rec = pending("ridgeback-roofing");
    assert.equal(rec.orderId, "ord_ridgeback");
    assert.equal("purchaseId" in rec, false);
});
