/**
 * Every signup carries the order or purchase it came from (Xander, 2026-11-16).
 *
 * The console sees the queued intake and the pending-onboard record, never the account. Until
 * now neither said whether the client was closed on a sales call or bought here themselves, so
 * the console's Clients badge ("new signups from the agency site") had to infer it from an
 * address claim. Both records now copy `orderId` / `purchaseId` from the PortalSite.
 *
 * Runs the real onboarding route and the real `createPendingSite` against an in-memory Upstash,
 * and reads the records exactly as the console will.
 *
 * Run: `npm test`
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { fakeUpstash } from "./fake-upstash.mjs";

register("./server-only-hook.mjs", import.meta.url);
register("./onboarding-route-hook.mjs", import.meta.url);

const KV_URL = "https://kv.test.invalid";
Object.assign(process.env, {
    KV_REST_API_URL: KV_URL,
    KV_REST_API_TOKEN: "test-token",
    UPSTASH_REDIS_REST_URL: KV_URL,
    UPSTASH_REDIS_REST_TOKEN: "test-token",
});
delete process.env.INTAKE_QUEUE_ENABLED;

const { POST } = await import("../app/api/portal/onboarding/route.ts");
const { intakeOriginIds } = await import("../app/lib/intake-origin.ts");

const EMAIL = "cora@copperline.test";
const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;

function site(extra = {}) {
    return {
        slug: "pending-Xy12AbCd",
        name: "Copperline Heating & Cooling LLC",
        plan: "growth",
        status: "pending-onboarding",
        sessionId: "cs_test_copperline",
        signerEmail: EMAIL,
        signerName: "Cora Copperline",
        onboardingCompletedAt: null,
        addedAt: 1,
        ...extra,
    };
}

const BODY = {
    selectedPlan: "growth",
    receptionistMode: "forwarded",
    brandName: "Copperline Heating & Cooling",
    email: EMAIL,
    phone: "(407) 555-0288",
    address: "200 Main St, Orlando, FL 32801",
    industry: "hvac",
    serviceList: [{ name: "AC Repair", tag: "Cooling" }],
    brandDirection: { differentiators: "", targetCustomer: "", vibe: [], tone: [], adjectives: [], references: "", forbidden: "" },
    palette: { mode: "preset", presetId: "slate-amber" },
    hasLogo: false,
    images: { heroSlides: [] },
};

/** POST the wizard and return the one queued intake record, as the console reads it. */
async function queued(s) {
    globalThis.__onboardingRoute = { account: { email: EMAIL, sites: [s], createdAt: 1, updatedAt: 1 }, site: s, completed: [] };
    const res = await POST(new Request("https://www.juneaudigitaldesigns.com/api/portal/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(BODY),
    }));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const keys = [...redis.kv.keys()].filter((k) => k.startsWith("jdd:intake:item:"));
    assert.equal(keys.length, 1, "exactly one intake queued");
    return JSON.parse(redis.get(keys[0]));
}

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

test("self-serve: the queued intake carries the purchase id and no order id", async () => {
    const rec = await queued(site({ purchaseId: "pur_copperline" }));
    assert.equal(rec.purchaseId, "pur_copperline");
    assert.equal("orderId" in rec, false);
});

test("closed on a call: the queued intake carries the order id, and keeps the locked address", async () => {
    const rec = await queued(site({ slug: "copperline-heating", slugLocked: true, orderId: "ord_copperline" }));
    assert.equal(rec.orderId, "ord_copperline");
    assert.equal(rec.slugGuess, "copperline-heating");
    assert.equal("purchaseId" in rec, false);
});

test("a site with neither id (pre-cutover) queues neither key, never an empty one", async () => {
    const rec = await queued(site());
    assert.equal("orderId" in rec, false);
    assert.equal("purchaseId" in rec, false);
});

test("intakeOriginIds leaves out blank and null ids", () => {
    assert.deepEqual(intakeOriginIds({}), {});
    assert.deepEqual(intakeOriginIds({ orderId: "", purchaseId: null }), {});
    assert.deepEqual(intakeOriginIds({ orderId: "o", purchaseId: "p" }), { orderId: "o", purchaseId: "p" });
});
