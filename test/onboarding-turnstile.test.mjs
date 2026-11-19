/**
 * The onboarding wizard checks a person sent it (Xander, 2026-11-19: "Add Turnstile to onboarding").
 * The privacy policy has said since launch that "The onboarding form uses Cloudflare Turnstile to
 * verify you are human"; until this, nothing did.
 *
 * The same widget, keys and check as the Get started form (#171, `agency-lead-gate.ts`), with one
 * difference his answer sets: a signed-in client whose check can't run is never locked out of
 * onboarding. Their intake is queued, marked unverified. Only a token Cloudflare rejects (or none,
 * from something that isn't the wizard) is refused, and the wizard lets them send again.
 *
 * Runs the real route (test/onboarding-route-hook.mjs swaps only Clerk and the email).
 */

import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

const HOST = "www.juneaudigitaldesigns.com";
const SECRET = "agency-widget-secret";
const EMAIL = "tess@tracewellair.test";

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;
let cloudflare = "up";
const spent = new Set();
let seq = 0;
const solved = (host = HOST) => `pass:${host}:lead:${++seq}`;

function siteverify(form) {
    if (cloudflare === "down") return new Response("bad gateway", { status: 502 });
    if (form.get("secret") !== SECRET) return Response.json({ success: false, "error-codes": ["invalid-input-secret"] });
    const token = form.get("response") ?? "";
    if (spent.has(token)) return Response.json({ success: false, "error-codes": ["timeout-or-duplicate"] });
    spent.add(token);
    const [kind, host, action] = token.split(":");
    if (kind !== "pass") return Response.json({ success: false, "error-codes": ["invalid-input-response"] });
    return Response.json({ success: true, hostname: host, action });
}

beforeEach(() => {
    redis.reset();
    spent.clear();
    cloudflare = "up";
    process.env.TURNSTILE_SECRET_KEY = SECRET;
    globalThis.fetch = async (input, init = {}) => {
        if (redis.owns(String(input))) return redis.handle(input, init);
        if (String(input) === "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
            return siteverify(new URLSearchParams(String(init.body)));
        }
        throw new Error(`unexpected fetch: ${String(input)}`);
    };
});
afterEach(() => {
    globalThis.fetch = realFetch;
});

const site = () => ({
    slug: "pending-Ck9dOJs7",
    name: "Tracewell Heating & Air",
    plan: "starter",
    status: "pending-onboarding",
    sessionId: "cs_test_tracewell",
    signerEmail: EMAIL,
    onboardingCompletedAt: null,
    addedAt: 1,
});

const body = (extra = {}) => ({
    selectedPlan: "starter",
    receptionistMode: "forwarded",
    brandName: "Tracewell Heating & Air",
    email: EMAIL,
    phone: "(407) 555-0142",
    address: "118 Lakeview Ave, Orlando, FL 32801",
    industry: "hvac",
    serviceList: [{ name: "AC Installation & Service", tag: "Cooling" }],
    brandDirection: { differentiators: "", targetCustomer: "", vibe: [], tone: [], adjectives: [], references: "", forbidden: "" },
    palette: { mode: "preset", presetId: "slate-amber" },
    hasLogo: false,
    images: { heroSlides: [] },
    ...extra,
});

async function send(extra) {
    const s = site();
    globalThis.__onboardingRoute = { account: { email: EMAIL, sites: [s], createdAt: 1, updatedAt: 1 }, site: s, completed: [] };
    const res = await POST(new Request(`https://${HOST}/api/portal/onboarding`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.9" },
        body: JSON.stringify(body(extra)),
    }));
    return { status: res.status, body: await res.json() };
}

const queued = () =>
    [...redis.kv.keys()].filter((k) => k.startsWith("jdd:intake:item:")).map((k) => JSON.parse(redis.get(k)));

test("a token Cloudflare rejects is refused: nothing queued, the site not moved on", async () => {
    const r = await send({ turnstileToken: "bot-made-this-up" });
    assert.equal(r.status, 403);
    assert.equal(r.body.error, "not-verified");
    assert.equal(queued().length, 0);
    assert.equal(globalThis.__onboardingRoute.completed.length, 0);
});

test("no token and no word from the widget (not the wizard) is refused", async () => {
    assert.equal((await send({})).status, 403);
    assert.equal(queued().length, 0);
});

test("a token solved on another host is refused", async () => {
    assert.equal((await send({ turnstileToken: solved("attacker.example") })).status, 403);
});

test("a person's onboarding goes through, recorded as passed; the token isn't kept", async () => {
    const token = solved();
    const r = await send({ turnstileToken: token });
    assert.equal(r.status, 200);
    const [item] = queued();
    assert.equal(item.humanCheck, "passed");
    assert.ok(!JSON.stringify(item).includes(token));
});

for (const [what, set, extra] of [
    ["the widget couldn't run in their browser", () => {}, { turnstileStatus: "error" }],
    ["Cloudflare is down", () => (cloudflare = "down"), null],
    ["the secret isn't set", () => delete process.env.TURNSTILE_SECRET_KEY, null],
]) {
    test(`never locked out: ${what}, the intake is queued, marked unverified`, async () => {
        set();
        const r = await send(extra ?? { turnstileToken: solved() });
        assert.equal(r.status, 200);
        const [item] = queued();
        assert.equal(item.humanCheck, "unverified");
        assert.equal(globalThis.__onboardingRoute.completed.length, 1, "the site moves on to building");
    });
}

test("the wizard renders the widget, sends its token, and shows the approved line when refused", () => {
    const wiz = readFileSync("app/components/onboarding/onboardingpageclient.tsx", "utf8");
    assert.match(wiz, /from "@jdd\/ui\/turnstile"/);
    assert.match(wiz, /useTurnstile\(turnstileSiteKey\(\)\)/);
    assert.match(wiz, /ref=\{turnstile\.containerRef\}/);
    assert.match(wiz, /turnstileToken/);
    assert.match(wiz, /turnstileStatus: "error"/);
    assert.match(wiz, /LEAD_FORM_NOT_VERIFIED/);
    assert.match(wiz, /turnstile\.reset\(\)/);
});
