/**
 * The onboarding wizard's model (app/components/onboarding/wizard/model.ts): which screens a client
 * sees, what blocks, what is worked out rather than asked, what is sent, and how an old draft is
 * read back. The payload must stay the `BrandIntakeSubmission` shape the route and jdd-ops read.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zBrandIntakeSubmission, mapBrandIntakeToIntake } from "@jdd/schema";

import {
    buildPayload,
    cleanEntry,
    hoursLine,
    initialState,
    modesFor,
    requiredGaps,
    restoreDraft,
    screenErrors,
    screensFor,
    statValuesFor,
    townFromAddress,
    yearsInBusiness,
} from "../app/components/onboarding/wizard/model.ts";

const NOW = new Date("2026-11-04T12:00:00Z");
const growth = { plan: "growth", signedMode: "forwarded" };

function ridgeline() {
    return {
        ...initialState("marcus@ridgelineair.com", "forwarded"),
        trade: "hvac",
        name: "Ridgeline Heating & Air",
        phone: "(407) 555-0142",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        towns: ["Orlando", "Winter Park", "Maitland", "College Park"],
        website: "ridgelineair.com",
        services: [{ name: "AC Installation & Service", tag: "Cooling" }, { name: "Duct sanitizing", tag: "" }],
        diffs: ["24/7 emergency callouts", "We clean up before we leave"],
        customers: ["Homeowners with aging systems"],
        established: "2009",
        license: "CAC1812345",
        owner: "Marcus Bell",
        response: "Within 2 hours",
        brands: ["Carrier", "American Standard"],
        certs: ["NATE certified", "Best of Orlando 2024", "Lennox Premier Dealer"],
        rating: "4.9",
        reviewCount: "212",
        reviewUrl: "https://g.page/r/ridgeline",
        voice: ["Straight-talking", "Reassuring"],
        avoid: "cheap",
        hours: "Mon to Sat, 7am to 6pm",
        emergency: true,
        agentName: "Sam",
        images: { heroSlides: [{ url: "https://x.public.blob.vercel-storage.com/a.jpg", filename: "a.jpg", alt: "" }] },
    };
}

test("HVAC Growth: no color step, no website-only, and HVAC's stats are all worked out", () => {
    const ids = screensFor(ridgeline(), growth).map((s) => s.id);
    assert.ok(!ids.some((id) => /color|palette|look/.test(id)), "clients never choose colors");
    assert.ok(ids.includes("brands") && ids.includes("certs"), "brands and certifications are separate screens");
    assert.ok(!ids.includes("numbers"), "every HVAC stat is derivable, so there is no numbers screen");
    assert.ok(!ids.includes("sites"), "extra sites are Enterprise only");
    assert.deepEqual(modesFor(growth), ["forwarded", "published"], "website-only is Starter only");
    assert.equal(ids[0], "welcome");
    assert.equal(ids.at(-1), "review");
});

test("trade-specific screens appear only where the template uses them", () => {
    const lawn = screensFor({ ...ridgeline(), trade: "lawn-care" }, growth).map((s) => s.id);
    assert.ok(lawn.includes("numbers") && lawn.includes("prices") && lawn.includes("seasons") && lawn.includes("offer"));
    assert.ok(!lawn.includes("brands"), "no brand screen for lawn care");
    const car = screensFor({ ...ridgeline(), trade: "car-detailing" }, growth).map((s) => s.id);
    assert.ok(car.includes("radius") && car.includes("prices"));
    const ent = screensFor(ridgeline(), { plan: "enterprise" }).map((s) => s.id);
    assert.ok(ent.includes("sites"));
    assert.deepEqual(modesFor({ plan: "starter" }), ["forwarded", "published", "declined"]);
    assert.deepEqual(modesFor({ plan: "starter", signedMode: "declined" }), ["declined"]);
});

test("only the facts the build needs block, with the approved messages", () => {
    const empty = initialState("", undefined);
    assert.equal(screenErrors("trade", empty, growth).trade, 'Pick the closest one. "Something else" is fine too.');
    assert.equal(screenErrors("name", empty, growth).name, "We need your business name to build your site.");
    const c = screenErrors("contact", { ...empty, phone: "555-0142" }, growth);
    assert.equal(c.phone, "That looks short. Try the full number, like (407) 555-0142.");
    assert.equal(c.email, "That email doesn't look complete.");
    assert.equal(c.address, "We need an address for your site and your local area.");
    assert.equal(screenErrors("contact", empty, growth).phone, "We need a phone number to set up your calls.");
    assert.equal(screenErrors("setup", empty, growth).receptionistMode, "Pick one so we know whether to set up a number.");
    assert.ok(screenErrors("setup", { ...empty, receptionistMode: "declined" }, growth).receptionistMode, "declined is refused off Starter");
    for (const id of ["area", "services", "since", "brands", "certs", "reviews", "photos", "voice", "hours"]) {
        assert.deepEqual(screenErrors(id, empty, growth), {}, `${id} never blocks`);
    }
    assert.deepEqual(requiredGaps(ridgeline(), growth), []);
    assert.deepEqual(requiredGaps(empty, growth).map((s) => s.id), ["trade", "name", "contact", "setup"]);
});

test("derived values come only from the client's own answers", () => {
    assert.equal(yearsInBusiness("2009", NOW), 17);
    assert.equal(yearsInBusiness("20", NOW), null);
    assert.equal(yearsInBusiness("2031", NOW), null);
    assert.equal(townFromAddress("2140 Edgewater Dr, Orlando, FL 32804"), "Orlando");
    assert.equal(townFromAddress("Orlando"), "");
    assert.deepEqual(statValuesFor(ridgeline(), NOW), {
        emergencyAvailability: "24/7",
        yearsTrading: "17+",
        rating: "4.9★ from 212 reviews",
        coverageTowns: "4",
    });
    const blank = { ...ridgeline(), established: "", towns: [], rating: "", emergency: false, hours: "" };
    assert.deepEqual(statValuesFor(blank, NOW), {}, "a blank source leaves the stat out; nothing is invented");
    assert.equal(hoursLine(ridgeline()), "Mon to Sat, 7am to 6pm. Emergency calls answered 24/7");
    assert.equal(hoursLine({ hours: "Open 24/7", customHours: "", emergency: true }), "Open 24/7");
    assert.equal(hoursLine({ hours: "custom", customHours: " Tue to Sun, 9 to 4 ", emergency: false }), "Tue to Sun, 9 to 4");
});

test("custom entries can't be split into two by the mapper", () => {
    assert.equal(cleanEntry("Lennox Premier Dealer, 2024"), "Lennox Premier Dealer 2024");
    assert.equal(cleanEntry("  a;b\nc  "), "a b c");
});

test("the payload is the same intake shape, with custom brands and certifications", () => {
    const payload = buildPayload(ridgeline(), growth, NOW);
    assert.equal(zBrandIntakeSubmission.safeParse(payload).success, true, "must still validate as BrandIntakeSubmission");
    assert.equal(payload.receptionistMode, "forwarded");
    assert.equal(payload.industry, "hvac");
    assert.equal(payload.brandsCarried, "Carrier\nAmerican Standard");
    assert.equal(payload.certifications, "NATE certified\nBest of Orlando 2024\nLennox Premier Dealer");
    assert.equal(payload.serviceArea, "Orlando\nWinter Park\nMaitland\nCollege Park");
    assert.equal(payload.businessHours, "Mon to Sat, 7am to 6pm. Emergency calls answered 24/7");
    assert.equal(payload.agentName, "Sam");
    assert.equal(payload.ownerName, "Marcus Bell");
    assert.equal(payload.responseTime, "Within 2 hours");
    assert.deepEqual(payload.palette, { mode: "preset", presetId: "slate-amber" }, "trade default; the client never picks");
    assert.equal(payload.hasLogo, false);
    assert.deepEqual(payload.reviewAggregate, { score: "4.9", count: "212", url: "https://g.page/r/ridgeline" });
    assert.equal(payload.stats.length, 4);
    assert.equal(payload.brandDirection.differentiators, "24/7 emergency callouts. We clean up before we leave");

    const site = mapBrandIntakeToIntake(payload).sites[0];
    assert.deepEqual(site.extensions.trustBadges, ["NATE certified", "Best of Orlando 2024", "Lennox Premier Dealer"]);
    assert.deepEqual(site.trust.logos, ["Carrier", "American Standard"]);
    assert.deepEqual(site.extensions.hours, { all: "Mon to Sat, 7am to 6pm. Emergency calls answered 24/7" });
    assert.equal(site.extensions.ownerName, "Marcus Bell");
    assert.deepEqual(site.about.stats.map((s) => s.l), ["Emergency line", "Years in business", "Average rating", "Towns covered"]);
});

test("an unanswered phone choice stays absent rather than defaulted", () => {
    const p = buildPayload({ ...ridgeline(), receptionistMode: "" }, { plan: "growth" }, NOW);
    assert.equal("receptionistMode" in p, false);
});

test("a draft from the previous wizard is carried over, not dropped", () => {
    const old = {
        currentStep: 4, industry: "hvac", brandName: "Ridgeline", email: "m@r.com", phone: "4075550142", address: "1 A St, Orlando, FL",
        serviceArea: "Orlando, Winter Park", brandsCarried: "Carrier, Trane", diffChips: ["Free estimates"], diffText: "We clean up",
        customerChips: ["Homeowners"], customerText: "", voice: ["Warm"], forbidden: "cheap", existingWebsiteUrl: "r.com",
        ownerName: "Marcus", responseTime: "2 hours", reviewScore: "4.9", reviewCount: "200",
        serviceList: [{ name: "Boiler Service", tag: "Heating" }], palette: { mode: "preset", presetId: "crimson" },
        images: { heroSlides: [] }, receptionistMode: "published", colorStep: 2, savedAt: "2026-11-01",
    };
    const s = restoreDraft(old, initialState("signer@r.com", undefined));
    assert.equal(s.v, 2);
    assert.equal(s.screen, "trade");
    assert.equal(s.trade, "hvac");
    assert.deepEqual(s.towns, ["Orlando", "Winter Park"]);
    assert.deepEqual(s.brands, ["Carrier", "Trane"]);
    assert.deepEqual(s.diffs, ["Free estimates", "We clean up"]);
    assert.equal(s.owner, "Marcus");
    assert.equal(s.rating, "4.9");
    assert.equal(s.receptionistMode, "published");
    assert.equal(s.avoid, "cheap");
    assert.equal(s.website, "r.com");
    const signed = restoreDraft(old, initialState("signer@r.com", "forwarded"));
    assert.equal(signed.receptionistMode, "forwarded", "the signed choice beats a stale draft");
});

test("a v2 draft round-trips", () => {
    const st = { ...ridgeline(), screen: "certs", visited: ["welcome", "trade", "certs"], skipped: ["photos"] };
    const back = restoreDraft(JSON.parse(JSON.stringify(st)), initialState("x@y.com", "forwarded"));
    assert.deepEqual(back, st);
});
