/**
 * Local SEO, PR (a): two optional onboarding questions (Xander, 2026-11-12; wording approved word
 * for word in local-seo-architecture-decisions.md).
 * - Q2, after the towns screen: "Which towns do you get the most work from?" / "Pick up to 3.
 *   We'll start with these." → BrandIntakeSubmission.topTowns (up to 3 of the client's towns).
 * - Q5, per service: "What makes this job cost more or less?" / "No prices needed. For example
 *   the size of the home, or how hard it is to reach." → ServiceEntry.priceFactors.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    MAX_TOP_TOWNS,
    MAX_PRICE_FACTORS,
    buildPayload,
    emptyFacts,
    initialState,
    isAnswered,
    restoreDraft,
    screensFor,
    serviceStepsFor,
    topTownsFor,
} from "../app/components/onboarding/wizard/model.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";

const growth = { plan: "growth", signedMode: "forwarded" };
const client = (extra = {}) => ({
    ...initialState("marcus@ridgelineair.com", "forwarded"),
    trade: "hvac",
    name: "Ridgeline Heating & Air",
    phone: "(407) 555-0142",
    address: "2140 Edgewater Dr, Orlando, FL 32804",
    towns: ["Orlando", "Winter Park", "Maitland", "College Park"],
    services: [{ name: "AC Installation & Service", tag: "Cooling" }],
    ...extra,
});

test("the approved wording, word for word (Q2, Q5)", () => {
    assert.equal(C.topTownsQ, "Which towns do you get the most work from?");
    assert.equal(C.topTownsHelp, "Pick up to 3. We'll start with these.");
    assert.equal(C.qPriceFactors, "What makes this job cost more or less?");
    assert.equal(C.hPriceFactors, "No prices needed. For example the size of the home, or how hard it is to reach.");
});

test("Q2 is a skippable screen right after Towns, once there are two towns to choose from", () => {
    const ids = screensFor(client(), growth).map((x) => x.id);
    assert.equal(ids[ids.indexOf("area") + 1], "toptowns");
    const def = screensFor(client(), growth).find((x) => x.id === "toptowns");
    assert.equal(def.skippable, true);
    assert.equal(def.chapter, 0);
    assert.equal(screensFor(client({ towns: ["Orlando"] }), growth).some((x) => x.id === "toptowns"), false, "one town: nothing to rank");
});

test("top towns: only the client's own towns, at most 3, in the order picked", () => {
    assert.equal(MAX_TOP_TOWNS, 3);
    assert.deepEqual(topTownsFor(client({ topTowns: ["Maitland", "Orlando"] })), ["Maitland", "Orlando"]);
    assert.deepEqual(topTownsFor(client({ topTowns: ["Maitland", "Tampa", "Orlando", "Winter Park", "College Park"] })), ["Maitland", "Orlando", "Winter Park"]);
    assert.deepEqual(topTownsFor(client({ topTowns: ["Maitland"], towns: ["Orlando", "Winter Park"] })), [], "a removed town drops out");
    assert.equal(isAnswered("toptowns", client({ topTowns: [] })), false);
    assert.equal(isAnswered("toptowns", client({ topTowns: ["Orlando"] })), true);
});

test("Q5 is a step in each service's walkthrough, right after price and timing", () => {
    const steps = serviceStepsFor(client());
    assert.equal(steps[steps.indexOf("pricetime") + 1], "factors");
    assert.equal(emptyFacts().priceFactors, "");
});

test("both are sent, cleaned; blank or skipped is left out", () => {
    const st = client({
        topTowns: ["Maitland", "Orlando"],
        serviceFacts: { "AC Installation & Service": { ...emptyFacts(), priceFactors: "  Size of the home \n\n how   easy the attic is to reach \nsize of the home" } },
    });
    const p = buildPayload(st, growth);
    assert.deepEqual(p.topTowns, ["Maitland", "Orlando"]);
    assert.deepEqual(p.serviceList[0].priceFactors, ["Size of the home", "how easy the attic is to reach"], "one factor per line, cleaned, no repeats");
    const long = buildPayload(client({ serviceFacts: { "AC Installation & Service": { ...emptyFacts(), priceFactors: "x".repeat(500) } } }), growth);
    assert.equal(long.serviceList[0].priceFactors[0].length, MAX_PRICE_FACTORS, "about 80 characters, like an included item");
    assert.equal(MAX_PRICE_FACTORS, 80);
    const none = buildPayload(client(), growth);
    assert.equal("topTowns" in none, false);
    assert.equal("priceFactors" in none.serviceList[0], false);
});

test("a saved draft keeps both", () => {
    const saved = client({ topTowns: ["Orlando"], serviceFacts: { "AC Installation & Service": { ...emptyFacts(), priceFactors: "Attic access" } } });
    const back = restoreDraft(JSON.parse(JSON.stringify(saved)), initialState("marcus@ridgelineair.com", "forwarded"));
    assert.deepEqual(back.topTowns, ["Orlando"]);
    assert.equal(back.serviceFacts["AC Installation & Service"].priceFactors, "Attic access");
});

test("the server keeps both, and the schema maps them into the site", async () => {
    const { buildSubmission } = await import("../app/lib/onboarding-submission.ts");
    const { mapBrandIntakeToIntake } = await import("@jdd/schema");
    const p = buildPayload(client({
        topTowns: ["Winter Park", "Orlando"],
        serviceFacts: { "AC Installation & Service": { ...emptyFacts(), priceFactors: "Size of the home" } },
    }), growth);
    const r = buildSubmission(p, { slug: "ridgeline", plan: "growth", status: "pending-onboarding", receptionistMode: "forwarded" });
    assert.equal(r.ok, true);
    assert.deepEqual(r.submission.topTowns, ["Winter Park", "Orlando"]);
    assert.deepEqual(r.submission.serviceList[0].priceFactors, ["Size of the home"]);
    const site = mapBrandIntakeToIntake(r.submission).sites[0];
    assert.deepEqual(site.extensions.topTowns, ["Winter Park", "Orlando"]);
    assert.deepEqual(site.services.items[0].priceFactors, ["Size of the home"]);
});
