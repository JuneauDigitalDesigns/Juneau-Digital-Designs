/**
 * The onboarding route's body → BrandIntakeSubmission step (app/lib/onboarding-submission.ts).
 *
 * The route used to rebuild the submission inline and never copied nine answers the wizard
 * collected: owner's name, brands carried, response time, stats, review aggregate, starting prices,
 * seasons, travel radius and current offer. The build then flagged them as missing. These tests pin
 * every one of them through to the intake the console and onboard.js read.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBrandIntakeToIntake, zBrandIntakeSubmission } from "@jdd/schema";

import { buildSubmission, markPaletteNotClientChosen, MAX_SERVICES } from "../app/lib/onboarding-submission.ts";

const site = { plan: "growth", signerEmail: "signer@ridgelineair.com" };
const BLOB = "https://abc.public.blob.vercel-storage.com/photo.jpg";

function body(extra = {}) {
    return {
        selectedPlan: "growth",
        receptionistMode: "forwarded",
        brandName: "Ridgeline Heating & Air",
        email: "marcus@ridgelineair.com",
        phone: "(407) 555-0142",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        industry: "hvac",
        ownerName: "Marcus Bell",
        brandsCarried: "Carrier\nAmerican Standard",
        responseTime: "Within 2 hours",
        certifications: "NATE certified\nBest of Orlando 2024",
        businessHours: "Mon to Sat, 7am to 6pm",
        agentName: "Sam",
        serviceArea: "Orlando\nWinter Park",
        stats: [{ key: "yearsTrading", value: "17+", label: "Years in business" }, { key: "rating", value: "", label: "Average rating" }],
        reviewAggregate: { score: "4.9", count: "212", url: "https://g.page/r/ridgeline" },
        servicePrices: { "Full Detail": "$150" },
        seasons: [{ key: "spring", label: "Spring", body: "Aeration and overseeding" }, { key: "fall", label: "Fall", body: "" }],
        serviceRadiusMiles: "25",
        offerBadge: "First mow free",
        serviceList: [{ name: "AC Installation & Service", tag: "Cooling" }],
        brandDirection: { differentiators: "Free estimates", targetCustomer: "Homeowners", vibe: [], tone: ["Warm"], adjectives: [], references: "", forbidden: "" },
        palette: { mode: "preset", presetId: "slate-amber" },
        hasLogo: false,
        images: { heroSlides: [{ url: BLOB, filename: "photo.jpg", alt: "" }], aboutFeature: { url: BLOB, filename: "team.jpg", alt: "" } },
        existingWebsiteUrl: "ridgelineair.com",
        ...extra,
    };
}

test("all nine answers the old route dropped now reach the submission", () => {
    const r = buildSubmission(body(), site);
    assert.equal(r.ok, true);
    const s = r.submission;
    assert.equal(s.ownerName, "Marcus Bell");
    assert.equal(s.brandsCarried, "Carrier\nAmerican Standard");
    assert.equal(s.responseTime, "Within 2 hours");
    assert.deepEqual(s.stats, [{ key: "yearsTrading", value: "17+", label: "Years in business" }], "blank stat dropped");
    assert.deepEqual(s.reviewAggregate, { score: "4.9", count: "212", url: "https://g.page/r/ridgeline" });
    assert.deepEqual(s.servicePrices, { "Full Detail": "$150" });
    assert.deepEqual(s.seasons, [{ key: "spring", label: "Spring", body: "Aeration and overseeding" }], "blank season dropped");
    assert.equal(s.serviceRadiusMiles, "25");
    assert.equal(s.offerBadge, "First mow free");
    assert.equal(zBrandIntakeSubmission.safeParse(s).success, true);
});

test("the newly asked answers come through too", () => {
    const s = buildSubmission(body(), site).submission;
    assert.equal(s.certifications, "NATE certified\nBest of Orlando 2024");
    assert.equal(s.businessHours, "Mon to Sat, 7am to 6pm");
    assert.equal(s.agentName, "Sam");
    assert.equal(s.images.aboutFeature?.url, BLOB);
});

test("they land where the console and onboard.js read them", () => {
    const x = mapBrandIntakeToIntake(buildSubmission(body(), site).submission).sites[0];
    assert.equal(x.extensions.ownerName, "Marcus Bell");
    assert.deepEqual(x.trust.logos, ["Carrier", "American Standard"]);
    assert.deepEqual(x.extensions.brandsCarried, ["Carrier", "American Standard"]);
    assert.equal(x.extensions.responseTime, "Within 2 hours");
    assert.deepEqual(x.extensions.trustBadges, ["NATE certified", "Best of Orlando 2024"]);
    assert.deepEqual(x.about.stats, [{ n: "17+", l: "Years in business" }]);
    assert.deepEqual(x.extensions.reviewBadge, { rating: 4.9, count: 212, url: "https://g.page/r/ridgeline" });
    assert.equal(x.images.about.feature, BLOB);
    for (const path of ["extensions.ownerName", "trust.logos", "extensions.responseTime", "about.stats", "extensions.reviewBadge"]) {
        assert.ok(!x._meta.missing_fields.includes(path), `${path} must not be flagged missing when answered`);
    }
});

test("keeps up to 12 services, as the wizard allows", () => {
    const many = Array.from({ length: 14 }, (_, i) => ({ name: `Service ${i + 1}`, tag: "" }));
    const s = buildSubmission(body({ serviceList: many }), site).submission;
    assert.equal(MAX_SERVICES, 12);
    assert.equal(s.serviceList.length, 12);
});

test("website-only is refused off Starter, allowed on Starter", () => {
    assert.deepEqual(buildSubmission(body({ receptionistMode: "declined" }), site), { ok: false, reason: "declined-not-starter" });
    const starter = buildSubmission(body({ receptionistMode: "declined", selectedPlan: "starter" }), { plan: "starter" });
    assert.equal(starter.ok && starter.submission.receptionistMode, "declined");
    const unknown = buildSubmission(body({ receptionistMode: "maybe" }), site);
    assert.equal(unknown.ok && "receptionistMode" in unknown.submission, false, "an unknown value is absent, never coerced");
});

test("still refuses a bad email, falls back to the signer, and only keeps our own blob URLs", () => {
    assert.deepEqual(buildSubmission(body({ email: "nope" }), site), { ok: false, reason: "invalid-email" });
    assert.equal(buildSubmission(body({ email: "" }), site).submission.email, "signer@ridgelineair.com");
    const s = buildSubmission(body({ images: { heroSlides: [{ url: "https://evil.example/x.jpg" }], logo: { url: "http://x" } } }), site).submission;
    assert.deepEqual(s.images.heroSlides, []);
    assert.equal(s.images.logo, undefined);
    const badLink = buildSubmission(body({ reviewAggregate: { score: "4.9", count: "10", url: "javascript:alert(1)" } }), site).submission;
    assert.equal(badLink.reviewAggregate.url, undefined);
});

test("the palette is recorded as not chosen by the client", () => {
    const intake = markPaletteNotClientChosen(mapBrandIntakeToIntake(buildSubmission(body(), site).submission));
    assert.ok(intake.sites[0]._meta.missing_fields.includes("brand.palette"));
    const twice = markPaletteNotClientChosen(intake);
    assert.equal(twice.sites[0]._meta.missing_fields.filter((f) => f === "brand.palette").length, 1);
});
