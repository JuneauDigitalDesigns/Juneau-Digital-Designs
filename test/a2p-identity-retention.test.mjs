/**
 * A2P identity — retention tests.
 *
 * **Preventive, not regression-driven, and deliberately so.** The repo convention is that a
 * test encodes a bug that actually shipped. This one encodes a bug that must never ship: an
 * EIN written to a draft store is silent (nothing errors), permanent (Twilio and the client's
 * browser both keep their copies) and unrecoverable (you cannot un-leak an identifier, and
 * retrofitting means auditing every draft, backup and browser that ever held one). The
 * handoff asks for it by name.
 *
 * Everything here imports the real implementation. The modules under test are plain ESM for
 * exactly this reason — Node v22.0.0 cannot import TypeScript, and a mocked version of this
 * code path would certify the mock.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
    findTaxIdPaths,
    isEinShaped,
    looksLikeTaxId,
    scrubVendorMessage,
    validateIdentityInput,
    buildBusinessEndUserAttributes,
} from "../app/lib/a2p-identity.mjs";
import { A2pVendorError, createIdentityObjects } from "../app/lib/a2p-trusthub.mjs";
import {
    a2pRegistrationKey,
    assertNoTaxId,
    saveRegistrationIdentity,
} from "../app/lib/a2p-registration-store.mjs";

/** The test EIN, in both renderings a leak could take. */
const EIN = "47-1234567";
const EIN_BARE = "471234567";

const SID = (prefix) => `${prefix}${"a".repeat(32)}`;

/** A complete, valid submission. */
function identityInput(overrides = {}) {
    return {
        registrationPath: "ein",
        legalBusinessName: "Arthur's Plumbing LLC",
        businessType: "Limited Liability Corporation",
        businessIndustry: "CONSUMER",
        websiteUrl: "https://arthursplumbing.com",
        ein: EIN,
        address: {
            street: "1200 Main St",
            city: "Orlando",
            region: "FL",
            postalCode: "32801-5123",
            country: "US",
        },
        rep: {
            firstName: "Arthur",
            lastName: "Reyes",
            jobPosition: "Owner",
            businessTitle: "Owner",
            email: "arthur@arthursplumbing.com",
            phone: "+14075550123",
        },
        ...overrides,
    };
}

/** A Redis double that records every write, so the test can inspect all of them. */
function redisSpy() {
    const writes = [];
    return {
        writes,
        async set(key, value) {
            writes.push({ key, value });
            return "OK";
        },
        async get() {
            return null;
        },
    };
}

/** A fetch double that records every request and returns successful Twilio shapes. */
function fetchSpy({ failOn = null } = {}) {
    const calls = [];
    const impl = async (url, init = {}) => {
        calls.push({ url: String(url), method: init.method, body: init.body ?? "" });
        if (failOn && String(url).includes(failOn)) {
            return {
                ok: false,
                status: 400,
                // What Twilio actually does, and the whole reason the error path is a leak
                // risk: it quotes the offending value straight back at you.
                async text() {
                    return JSON.stringify({
                        code: 21620,
                        message: `Invalid business_registration_number: ${EIN} is not a valid EIN`,
                    });
                },
            };
        }
        const sid = String(url).includes("Addresses.json")
            ? SID("AD")
            : String(url).includes("SupportingDocuments")
              ? SID("RD")
              : SID("IT");
        return { ok: true, status: 201, async text() { return JSON.stringify({ sid }); } };
    };
    impl.calls = calls;
    return impl;
}

/** Every string anywhere inside a value, flattened. */
function allStrings(value, out = []) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) value.forEach((v) => allStrings(v, out));
    else if (value && typeof value === "object") Object.values(value).forEach((v) => allStrings(v, out));
    return out;
}

const sourceOf = (relative) =>
    readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

// ── The core guarantee: the EIN reaches Twilio and nothing else ──────────────

test("the EIN is sent to Twilio exactly once and never persisted", async () => {
    const fetchImpl = fetchSpy();
    const redis = redisSpy();

    const sids = await createIdentityObjects({
        slug: "arthurs-plumbing",
        input: identityInput(),
        auth: { accountSid: "ACtest", authToken: "token" },
        fetchImpl,
    });

    await saveRegistrationIdentity({
        slug: "arthurs-plumbing",
        registrationPath: "ein",
        sids,
        redis,
    });

    // 1. It went out exactly once, on the business EndUser call and no other.
    const carrying = fetchImpl.calls.filter((c) => c.body.includes(encodeURIComponent(EIN)) || c.body.includes(EIN));
    assert.equal(carrying.length, 1, "the EIN must appear in exactly one outbound request");
    assert.match(carrying[0].url, /trusthub\.twilio\.com\/v1\/EndUsers$/);

    // 2. Nothing tax-ID-shaped was written to Redis — the handoff's assertion, over every
    //    value actually written rather than over the one we expected to be written.
    assert.ok(redis.writes.length > 0, "the test is worthless if nothing was written");
    for (const { key, value } of redis.writes) {
        assert.deepEqual(
            findTaxIdPaths(value),
            [],
            `tax-ID-shaped value written under ${key}`,
        );
        for (const str of allStrings(value)) {
            assert.ok(!str.includes(EIN), `the EIN was persisted under ${key}`);
            assert.ok(!str.includes(EIN_BARE), `the EIN (unhyphenated) was persisted under ${key}`);
        }
    }

    // 3. And the rep's personal details are not in there either — same treatment.
    const persisted = allStrings(redis.writes.map((w) => w.value)).join(" ");
    for (const personal of ["arthur@arthursplumbing.com", "+14075550123", "Reyes"]) {
        assert.ok(!persisted.includes(personal), `${personal} must not be persisted`);
    }

    // 4. What *is* written: the SIDs, under the documented key.
    assert.equal(redis.writes.length, 1);
    assert.equal(redis.writes[0].key, a2pRegistrationKey("arthurs-plumbing"));
    assert.equal(redis.writes[0].value.businessEndUserSid, SID("IT"));
    assert.equal(redis.writes[0].value.addressSid, SID("AD"));
    assert.equal(redis.writes[0].value.addressDocSid, SID("RD"));
});

test("a vendor rejection cannot carry the EIN into an error message or a log", async () => {
    const fetchImpl = fetchSpy({ failOn: "/v1/EndUsers" });

    const error = await createIdentityObjects({
        slug: "arthurs-plumbing",
        input: identityInput(),
        auth: { accountSid: "ACtest", authToken: "token" },
        fetchImpl,
    }).then(
        () => assert.fail("expected the vendor call to reject"),
        (e) => e,
    );

    assert.ok(error instanceof A2pVendorError);
    assert.equal(error.status, 400);
    // The field-level reason survives — the runbook wants the precise bad field surfaced
    // rather than a multi-day rejection — but the value does not.
    assert.match(error.message, /business_registration_number/);
    assert.ok(!error.message.includes(EIN), "the EIN rode along in the error message");
    assert.ok(!error.message.includes(EIN_BARE));
    assert.deepEqual(findTaxIdPaths(error.message), []);
    // An unhandled throw prints the stack, so the whole thing has to be clean.
    assert.ok(!String(error.stack).includes(EIN));
});

test("a partial failure deletes the EndUser it already created", async () => {
    // Otherwise an orphan holding the EIN stays on Twilio with its SID discarded on our
    // side, so nothing could ever find it again to delete it.
    const fetchImpl = fetchSpy({ failOn: "Addresses.json" });

    await createIdentityObjects({
        slug: "arthurs-plumbing",
        input: identityInput(),
        auth: { accountSid: "ACtest", authToken: "token" },
        fetchImpl,
    }).then(
        () => assert.fail("expected the address call to reject"),
        () => {},
    );

    const deletes = fetchImpl.calls.filter((c) => c.method === "DELETE");
    assert.equal(deletes.length, 2, "both EndUsers created before the failure must be deleted");
    for (const call of deletes) {
        assert.match(call.url, /\/v1\/EndUsers\/IT/);
    }
});

test("the store refuses to persist a tax-ID-shaped value", async () => {
    // The guard is on values, not key names, so it holds through any rename of the step
    // above it. Simulated here by a SID that is somehow an EIN.
    const redis = redisSpy();
    await assert.rejects(
        () =>
            saveRegistrationIdentity({
                slug: "arthurs-plumbing",
                registrationPath: "ein",
                sids: {
                    businessEndUserSid: EIN,
                    repEndUserSid: SID("IT"),
                    addressSid: SID("AD"),
                    addressDocSid: SID("RD"),
                },
                redis,
            }),
        /refused to persist a tax-ID-shaped value/,
    );
    assert.equal(redis.writes.length, 0, "nothing may be written when the guard trips");

    assert.throws(() => assertNoTaxId({ nested: { renamed: EIN } }, "test"), /\$\.nested\.renamed/);
});

// ── The draft path: Redis (30-day TTL) and localStorage (no expiry in practice) ──

test("the draft guard catches an EIN under any field name, at any depth", () => {
    // The point of a value-shape check rather than a key denylist: a denylist is one rename
    // away from leaking, and these are the renames.
    const drafts = [
        { ein: EIN },
        { taxId: EIN },
        { a2p: { businessRegistrationNumber: EIN } },
        { answers: [{ label: "EIN", value: EIN }] },
        { notes: `our EIN is ${EIN}, thanks` },
    ];
    for (const draft of drafts) {
        assert.notDeepEqual(findTaxIdPaths(draft), [], `missed an EIN in ${JSON.stringify(draft)}`);
    }
});

test("the draft guard does not fire on the data a real wizard draft holds", () => {
    // A tripwire that fires on ordinary data is a tripwire somebody switches off. The
    // handoff's `\d{2}-?\d{7}` would match inside every 10-digit phone number here.
    const draft = {
        brandName: "Arthur's Plumbing",
        phone: "4075551234",
        phonePretty: "(407) 555-1234",
        altPhone: "+1 407-555-1234",
        address: "1200 Main St, Orlando FL 32801-5123",
        zipPlusFour: "32801-5123",
        reviewCount: "180",
        statValues: { jobs: "12000", years: "15" },
        serviceList: [{ name: "Drain cleaning", tag: "Repair" }],
        currentStep: 4,
        savedAt: "2026-10-30T00:00:00.000Z",
    };
    assert.deepEqual(findTaxIdPaths(draft), []);
    assert.equal(looksLikeTaxId("4075551234"), false);
    assert.equal(looksLikeTaxId("32801-5123"), false);
    assert.equal(looksLikeTaxId("555-1234"), false);
    assert.equal(looksLikeTaxId(EIN), true);
});

test("both draft writers consult the guard before writing", () => {
    // A runtime guard nothing calls is decoration. These assert the wiring, so removing
    // either call fails the suite rather than quietly removing the protection.
    const route = sourceOf("../app/api/portal/onboarding/draft/route.ts");
    assert.match(route, /findTaxIdPaths\(body\.data\)/, "the Redis draft route must check the payload");
    assert.ok(
        route.indexOf("findTaxIdPaths") < route.indexOf("saveDraft(ctx.userId"),
        "the check must come before the write",
    );

    const wizard = sourceOf("../app/components/onboarding/onboardingpageclient.tsx");
    const autosave = wizard.slice(
        wizard.indexOf("── Draft autosave"),
        wizard.indexOf("── A2P: is a business identity already on file?"),
    );
    assert.ok(autosave.length > 0, "could not locate the autosave effect");
    assert.match(autosave, /findTaxIdPaths\(record\)/, "the localStorage writer must check the record");
    assert.ok(
        autosave.indexOf("findTaxIdPaths") < autosave.indexOf("localStorage.setItem"),
        "the check must come before the localStorage write",
    );
});

test("no A2P identity field is a member of the autosaved WizardData", () => {
    // This is the §3 blocker itself: `WizardData` is what gets autosaved, in full, to Redis
    // for 30 days and to localStorage. The A2P fields live in their own `useState`. If
    // someone ever moves one into `WizardData` — to make it survive a reload, which is the
    // tempting change — this fails.
    const wizard = sourceOf("../app/components/onboarding/onboardingpageclient.tsx");
    const start = wizard.indexOf("type WizardData = {");
    assert.ok(start > -1, "could not find the WizardData declaration");
    const body = wizard.slice(start, wizard.indexOf("\n};", start));

    for (const field of [
        "ein",
        "legalBusinessName",
        "businessType",
        "businessIndustry",
        "registrationPath",
        "repEmail",
        "repPhone",
        "repFirstName",
        "repLastName",
        "postalCode",
    ]) {
        assert.doesNotMatch(
            body,
            new RegExp(`(^|[^A-Za-z])${field}\\s*:`, "m"),
            `${field} must not be a WizardData member — it would be autosaved to both draft stores`,
        );
    }
});

// ── Input rules that prevent multi-day rejections ────────────────────────────

test("the EIN format check accepts only NN-NNNNNNN", () => {
    assert.equal(isEinShaped(EIN), true);
    assert.equal(isEinShaped(" 47-1234567 "), true);
    assert.equal(isEinShaped(EIN_BARE), false, "an unhyphenated EIN is a typo we can catch");
    assert.equal(isEinShaped("4-71234567"), false);
    assert.equal(isEinShaped("47-123456"), false);
    assert.equal(isEinShaped("47-12345678"), false);
});

test("the sole-proprietor path must not carry an EIN", () => {
    // Collecting one and sending it on a profile that does not need it is the leak the whole
    // design is about, done voluntarily.
    const result = validateIdentityInput(identityInput({ registrationPath: "sole-proprietor" }));
    assert.equal(result.ok, false);
    assert.ok(result.fields.includes("ein"));

    const clean = validateIdentityInput(
        identityInput({ registrationPath: "sole-proprietor", ein: "" }),
    );
    assert.equal(clean.ok, true);

    // …and the attributes then omit the field rather than sending it empty, which Twilio
    // would evaluate rather than skip.
    const attrs = buildBusinessEndUserAttributes(
        identityInput({ registrationPath: "sole-proprietor", ein: "" }),
    );
    assert.equal("business_registration_number" in attrs, false);
    assert.equal("business_registration_identifier" in attrs, false);
});

test("validation reports field names, never values", () => {
    const result = validateIdentityInput({ registrationPath: "ein", ein: EIN });
    assert.equal(result.ok, false);
    assert.ok(result.fields.includes("legalBusinessName"));
    assert.ok(result.fields.includes("address.region"));
    assert.ok(result.fields.includes("rep.email"));
    assert.deepEqual(findTaxIdPaths(result), [], "a validation result must never carry a value");
});

test("industry and business type are enums, not free text", () => {
    assert.equal(validateIdentityInput(identityInput({ businessIndustry: "PLUMBING" })).ok, false);
    assert.equal(
        validateIdentityInput(identityInput({ businessType: "Limited Liability Company" })).ok,
        false,
        "the runbook's spelling is not one Twilio accepts",
    );
});

test("scrubVendorMessage removes submitted values and tax-ID shapes alike", () => {
    const body = `Invalid business_registration_number: ${EIN}; rep arthur@arthursplumbing.com unknown`;
    const scrubbed = scrubVendorMessage(body, [EIN, "arthur@arthursplumbing.com"]);
    assert.ok(!scrubbed.includes(EIN));
    assert.ok(!scrubbed.includes("arthur@arthursplumbing.com"));
    assert.match(scrubbed, /business_registration_number/);
    // Unrecognised but still tax-ID-shaped: goes anyway.
    assert.ok(!scrubVendorMessage("saw 99-8887776 in there", []).includes("99-8887776"));
});
