/**
 * Commas in the onboarding wizard (finding F-B2b, end-to-end test 2026-11-10). The wizard stripped
 * every comma from every chip, so "Upfront pricing, no surprises" arrived as "Upfront pricing no
 * surprises", and approved suggestion chips like "Nights, weekends and holidays" were reworded
 * without the client knowing.
 *
 * Commas are only a problem for the three fields sent as one text the mapper splits on commas,
 * semicolons and line breaks (serviceArea, brandsCarried, certifications). Those still lose them;
 * everything else (differentiators and customers, joined with ". ", and each service's lists,
 * sent as arrays) keeps the client's words exactly.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { INDUSTRY_MENUS, mapBrandIntakeToIntake, zBrandIntakeSubmission } from "@jdd/schema";

import { buildPayload, initialState } from "../app/components/onboarding/wizard/model.ts";
import { buildSubmission } from "../app/lib/onboarding-submission.ts";

const NOW = new Date("2026-11-11T12:00:00Z");
const growth = { plan: "growth", signedMode: "forwarded" };

function client(extra = {}) {
    return {
        ...initialState("marcus@ridgelineair.com", "forwarded"),
        trade: "hvac",
        name: "Ridgeline Heating & Air",
        phone: "(407) 555-0142",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        towns: ["Orlando", "Winter Park"],
        services: [{ name: "24/7 Emergency Service", tag: "Emergency" }],
        ...extra,
    };
}

test("what sets you apart and who you serve keep their commas", () => {
    const p = buildPayload(client({ diffs: ["Upfront pricing, no surprises", "Locally Owned"], customers: ["Homeowners, landlords and property managers"] }), growth, NOW);
    assert.equal(p.brandDirection.differentiators, "Upfront pricing, no surprises. Locally Owned");
    assert.equal(p.brandDirection.targetCustomer, "Homeowners, landlords and property managers");
    const intake = mapBrandIntakeToIntake(p);
    assert.match(JSON.stringify(intake), /Upfront pricing, no surprises/);
});

test("a service's included, jobs and questions keep their commas", () => {
    const p = buildPayload(client({
        serviceFacts: {
            "24/7 Emergency Service": {
                included: ["Nights, weekends and holidays", "Diagnostic visit"],
                typicalJobs: ["No heat, no AC"],
                areasMode: "", areas: [], brands: [], priceFrom: "", duration: "", photos: [],
                questions: [{ q: "Should I repair, coat or replace?", a: "It depends, honestly." }],
            },
        },
    }), growth, NOW);
    const sv = p.serviceList[0];
    assert.deepEqual(sv.included, ["Nights, weekends and holidays", "Diagnostic visit"]);
    assert.deepEqual(sv.typicalJobs, ["No heat, no AC"]);
    assert.equal(sv.questions[0].q, "Should I repair, coat or replace?");
    assert.equal(zBrandIntakeSubmission.safeParse(p).success, true);
});

test("every approved suggestion chip with a comma arrives exactly as approved", () => {
    let checked = 0;
    for (const menu of INDUSTRY_MENUS) for (const s of menu.services) {
        const included = (s.included ?? []).filter((x) => x.includes(","));
        const jobs = (s.jobs ?? []).filter((x) => x.includes(","));
        if (!included.length && !jobs.length) continue;
        const p = buildPayload(client({
            trade: menu.id,
            services: [{ name: s.label, tag: s.tag }],
            serviceFacts: { [s.label]: { included: included.slice(0, 8), typicalJobs: jobs.slice(0, 6), areasMode: "", areas: [], brands: [], priceFrom: "", duration: "", photos: [], questions: [] } },
        }), growth, NOW);
        const sv = p.serviceList[0];
        assert.deepEqual(sv.included ?? [], included.slice(0, 8), `${menu.id} / ${s.label} included`);
        assert.deepEqual(sv.typicalJobs ?? [], jobs.slice(0, 6), `${menu.id} / ${s.label} jobs`);
        checked += included.length + jobs.length;
    }
    assert.ok(checked > 0, "the approved menus do contain chips with commas");
});

test("towns, brands and certifications still lose commas, so the mapper can't split one in two", () => {
    const p = buildPayload(client({ towns: ["Winter Garden, FL", "Orlando"], brands: ["Bryant, Inc."], certs: ["Lennox Premier Dealer, 2024", "NATE"] }), growth, NOW);
    assert.equal(p.serviceArea, "Winter Garden FL\nOrlando");
    assert.equal(p.brandsCarried, "Bryant Inc.");
    assert.equal(p.certifications, "Lennox Premier Dealer 2024\nNATE");
    const intake = mapBrandIntakeToIntake(p);
    assert.deepEqual(intake.sites[0].extensions.serviceArea, ["Winter Garden FL", "Orlando"]);
});

test("line breaks still never get into a chip", () => {
    const p = buildPayload(client({ diffs: ["Two\nlines"] }), growth, NOW);
    assert.equal(p.brandDirection.differentiators, "Two lines");
});

test("the server keeps the commas the wizard sends", () => {
    const p = buildPayload(client({
        diffs: ["Upfront pricing, no surprises"],
        serviceFacts: { "24/7 Emergency Service": { included: ["Nights, weekends and holidays"], typicalJobs: [], areasMode: "", areas: [], brands: [], priceFrom: "", duration: "", photos: [], questions: [] } },
    }), growth, NOW);
    const r = buildSubmission(p, { slug: "ridgeline", plan: "growth", status: "pending-onboarding", receptionistMode: "forwarded" });
    assert.equal(r.ok, true);
    assert.equal(r.submission.brandDirection.differentiators, "Upfront pricing, no surprises");
    assert.deepEqual(r.submission.serviceList[0].included, ["Nights, weekends and holidays"]);
});
