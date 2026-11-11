/**
 * The signed legal name reaches the intake as `brand.long`, the console's "Legal name".
 *
 * Finding F-B2a of the front-to-back onboarding test (2026-11-11). The client signed as
 * "Tracewell Heating & Air LLC". The wizard opened with that in its business-name box, the client
 * corrected it to the trading name "Tracewell Heating & Air", and the mapper set `brand.long` from
 * the business name. "LLC" appeared nowhere in the queued intake, so the console's Legal name, the
 * site's copyright line and its local-business data all read the trading name. The agreement
 * record had the legal name all along.
 *
 * Runs the real route against an in-memory Upstash: the agreement is a real `agreement:{id}` record
 * and the result is read from the real `jdd:intake:item:{id}` the console imports verbatim. Only
 * the session lookup and the after-response email are swapped (test/onboarding-route-hook.mjs).
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
const { signedLegalName } = await import("../app/lib/onboarding-submission.ts");

const EMAIL = "tess@tracewellair.test";
const LEGAL = "Tracewell Heating & Air LLC";
const TRADING = "Tracewell Heating & Air";
const AGREEMENT_ID = "0a20783f-test";

/** The agreement as the self-serve page stored it (checkpoint A), trimmed to what matters here. */
const AGREEMENT = {
    id: AGREEMENT_ID,
    plan: "starter",
    kind: "master",
    clientLegalName: LEGAL,
    clientEntityType: "LLC",
    clientAddress: "118 Lakeview Ave, Orlando, FL 32801",
    signerName: "Tess Tracewell",
    signerTitle: "Owner",
    signerEmail: EMAIL,
    additionalSites: [],
    receptionistMode: "forwarded",
    pdfUrl: "https://blob.test/agreement.pdf",
    agreementVersion: "5.4",
    audit: { signedAt: "2026-11-11T19:34:00.000Z" },
};

const redis = fakeUpstash({ url: KV_URL });
const realFetch = globalThis.fetch;

function pendingSite(extra = {}) {
    return {
        slug: "pending-Ck9dOJs7",
        name: LEGAL,
        plan: "starter",
        status: "pending-onboarding",
        sessionId: "cs_test_tracewell",
        signerEmail: EMAIL,
        signerName: "Tess Tracewell",
        onboardingCompletedAt: null,
        addedAt: 1,
        agreementId: AGREEMENT_ID,
        ...extra,
    };
}

function wizardBody(extra = {}) {
    return {
        selectedPlan: "starter",
        receptionistMode: "forwarded",
        // Prefilled from the agreement, then corrected by the client to the name they trade under.
        brandName: TRADING,
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
    };
}

function seedAgreement(record = AGREEMENT) {
    redis.kv.set(`agreement:${record.id}`, { value: JSON.stringify(record), exp: null });
}

/** POST the wizard and return the one intake it queued, exactly as the console will import it. */
async function submit(site, body = wizardBody()) {
    globalThis.__onboardingRoute = { account: { email: EMAIL, sites: [site], createdAt: 1, updatedAt: 1 }, site, completed: [] };
    const res = await POST(new Request("https://www.juneaudigitaldesigns.com/api/portal/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
    }));
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
    const keys = [...redis.kv.keys()].filter((k) => k.startsWith("jdd:intake:item:"));
    assert.equal(keys.length, 1, "exactly one intake queued");
    return JSON.parse(redis.get(keys[0])).intake;
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

test("signed as the LLC, renamed in the wizard: brand.name is the trading name, brand.long the signed legal name", async () => {
    seedAgreement();
    const intake = await submit(pendingSite());
    const [site] = intake.sites;
    assert.equal(site.brand.name, TRADING);
    assert.equal(site.brand.long, LEGAL, "the console's Legal name is the name on the agreement");
    assert.ok(!site._meta.missing_fields.includes("brand.long"), "a signed name is supplied, not missing");
});

test("no agreement on the site: brand.long stays the business name and is flagged missing", async () => {
    const intake = await submit(pendingSite({ agreementId: undefined }));
    const [site] = intake.sites;
    assert.equal(site.brand.long, TRADING, "today's behaviour, never an invented name");
    assert.ok(site._meta.missing_fields.includes("brand.long"));
});

test("an agreement that can't be read (expired, deleted) is treated as no agreement", async () => {
    const intake = await submit(pendingSite());
    const [site] = intake.sites;
    assert.equal(site.brand.long, TRADING);
    assert.ok(site._meta.missing_fields.includes("brand.long"));
});

test("enterprise: one agreement, every site gets the same legal name", async () => {
    seedAgreement({ ...AGREEMENT, plan: "enterprise" });
    const extra = (brandName) => ({ brandName, email: EMAIL, phone: "(407) 555-0143", address: "", businessHours: "", serviceList: [], palette: { mode: "preset", presetId: "slate-amber" }, brandDirection: { differentiators: "" } });
    const intake = await submit(
        pendingSite({ plan: "enterprise" }),
        wizardBody({ selectedPlan: "enterprise", additionalSites: [extra("Tracewell Plumbing"), extra("Tracewell Electric")] }),
    );
    assert.equal(intake.sites.length, 3);
    assert.deepEqual(intake.sites.map((s) => s.brand.long), [LEGAL, LEGAL, LEGAL]);
    assert.deepEqual(intake.sites.map((s) => s.brand.name), [TRADING, "Tracewell Plumbing", "Tracewell Electric"]);
    assert.ok(intake.sites.every((s) => !s._meta.missing_fields.includes("brand.long")));
});

test("the legal name is taken exactly as signed: the agreement first, then a close's order, no suffix invented", () => {
    assert.equal(signedLegalName({ agreement: { clientLegalName: `  ${LEGAL} ` } }), LEGAL);
    // Signed without the suffix: the entity type is not turned into one.
    assert.equal(signedLegalName({ agreement: { clientLegalName: TRADING, clientEntityType: "LLC" } }), TRADING);
    assert.equal(signedLegalName({ agreement: null, order: { client: { legalName: LEGAL } } }), LEGAL, "a sales-call close whose agreement can't be read");
    assert.equal(signedLegalName({ agreement: { clientLegalName: LEGAL }, order: { client: { legalName: "Other Name Inc" } } }), LEGAL);
    assert.equal(signedLegalName({ agreement: null, order: null }), null);
    assert.equal(signedLegalName({ agreement: { clientLegalName: "  " } }), null);
});
