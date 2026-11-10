/**
 * Service details, online profiles and the service-area question in the onboarding wizard
 * (onboarding-facts, 2026-11-10). Each fact is asked once, here, and reaches site.ts through
 * @jdd/schema's buildScaffold; the console intake shows it and never asks again.
 *
 * The own-page status comes from the schema's gate (qualifiesForServicePage), run on the mapped
 * SiteContent, so the wizard and the console can never disagree about which services get a page.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { zBrandIntakeSubmission, mapBrandIntakeToIntake } from "@jdd/schema";

import {
    MAX_TOWNS,
    SERVICE_CAPS,
    buildPayload,
    emptyFacts,
    initialState,
    restoreDraft,
    screensFor,
    serviceStatus,
} from "../app/components/onboarding/wizard/model.ts";
import { profileLinkProblem } from "../app/lib/profile-links.ts";

const growth = { plan: "growth", signedMode: "forwarded" };
const photo = (n) => ({ url: `https://x.public.blob.vercel-storage.com/p${n}.jpg`, filename: `p${n}.jpg`, alt: "" });

function base() {
    return {
        ...initialState("marcus@ridgelineair.com", "forwarded"),
        trade: "hvac",
        name: "Ridgeline Heating & Air",
        phone: "(407) 555-0142",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        towns: ["Orlando", "Winter Park", "Maitland"],
        services: [
            { name: "AC Installation & Service", tag: "Cooling" },
            { name: "Furnace Repair & Replacement", tag: "Heating" },
            { name: "Duct Cleaning & Sealing", tag: "Air Quality" },
        ],
    };
}

const facts = (patch) => ({ ...emptyFacts(), ...patch });

test("details follows services, online follows website, and the prices screen is gone", () => {
    const ids = screensFor(base(), growth).map((s) => s.id);
    assert.equal(ids[ids.indexOf("services") + 1], "details");
    assert.equal(ids[ids.indexOf("website") + 1], "online");
    for (const trade of ["hvac", "lawn-care", "car-detailing", "plumbing", "roofing"]) {
        assert.ok(!screensFor({ ...base(), trade }, growth).some((s) => s.id === "prices"), `${trade}: price lives on each service now`);
    }
    const none = screensFor({ ...base(), services: [] }, growth).map((s) => s.id);
    assert.ok(!none.includes("details"), "no services, nothing to detail");
});

test("per-service facts travel nested on serviceList, blanks left out", () => {
    const st = {
        ...base(),
        serviceFacts: {
            "AC Installation & Service": facts({
                included: ["Sizing for your home", "Removal of the old unit", "Permit and inspection"],
                typicalJobs: ["AC blowing warm air", "High electric bills"],
                areasMode: "some",
                areas: ["Orlando", "Winter Park"],
                brands: ["Carrier"],
                priceFrom: " $89 ",
                photos: [photo(1), photo(2)],
                questions: [{ q: "Should I repair or replace my AC?", a: "" }],
            }),
        },
    };
    const p = buildPayload(st, growth);
    assert.equal(zBrandIntakeSubmission.safeParse(p).success, true);
    const ac = p.serviceList[0];
    assert.deepEqual(ac.included, ["Sizing for your home", "Removal of the old unit", "Permit and inspection"]);
    assert.deepEqual(ac.typicalJobs, ["AC blowing warm air", "High electric bills"]);
    assert.deepEqual(ac.areas, ["Orlando", "Winter Park"]);
    assert.deepEqual(ac.brands, ["Carrier"]);
    assert.equal(ac.priceFrom, "$89");
    assert.equal(ac.photos.length, 2);
    assert.deepEqual(ac.questions, [{ q: "Should I repair or replace my AC?", a: "" }]);
    assert.deepEqual(p.serviceList[1], { name: "Furnace Repair & Replacement", tag: "Heating" }, "a service with no details sends name and tag only");
    assert.equal("servicePrices" in p, false, "the name-keyed price map is no longer sent");

    const site = mapBrandIntakeToIntake(p).sites[0];
    const item = site.services.items[0];
    assert.equal(item.priceFrom, "$89");
    assert.equal(item.image.url, photo(1).url, "photo 1 is the service's picture");
    assert.equal(site.work.projects.filter((x) => x.service === item.slug).length, 2, "every photo is a tagged job photo");
    assert.ok(site.extensions.brandsCarried.includes("Carrier"), "a service's brand is also a brand carried");
});

test('"Everywhere I cover" stores no areas, and neither does ticking every town', () => {
    const one = (f) => buildPayload({ ...base(), serviceFacts: { "AC Installation & Service": facts(f) } }, growth).serviceList[0];
    assert.equal("areas" in one({ areasMode: "all", areas: ["Orlando"] }), false);
    assert.equal("areas" in one({ areasMode: "some", areas: [] }), false);
    assert.equal("areas" in one({ areasMode: "some", areas: ["Orlando", "Winter Park", "Maitland"] }), false, "every town is the same as everywhere");
    assert.deepEqual(one({ areasMode: "some", areas: ["Maitland", "Nowhere"] }).areas, ["Maitland"], "only towns they cover");
});

test("caps match what the service page shows", () => {
    assert.deepEqual(SERVICE_CAPS, { included: 8, typicalJobs: 6, brands: 8, questions: 5, photos: 3 });
    assert.equal(MAX_TOWNS, 20);
    const many = (n, w) => Array.from({ length: n }, (_, i) => `${w} ${i}`);
    const p = buildPayload(
        {
            ...base(),
            serviceFacts: {
                "AC Installation & Service": facts({
                    included: many(12, "inc"), typicalJobs: many(9, "job"), brands: many(10, "b"),
                    questions: many(7, "q").map((q) => ({ q, a: "" })), photos: [1, 2, 3, 4].map(photo),
                }),
            },
        },
        growth,
    ).serviceList[0];
    assert.equal(p.included.length, 8);
    assert.equal(p.typicalJobs.length, 6);
    assert.equal(p.brands.length, 8);
    assert.equal(p.questions.length, 5);
    assert.equal(p.photos.length, 3);
});

test("own-page status comes from the schema's gate", () => {
    const status = (f) => serviceStatus({ ...base(), serviceFacts: { "AC Installation & Service": facts(f) } }, 0);
    assert.equal(status({}).state, "none");
    assert.equal(status({ included: ["a", "b"] }).state, "core", "something given, but no core fact yet");
    assert.equal(status({ priceFrom: "$89" }).state, "core");
    assert.equal(status({ included: ["a", "b", "c"] }).state, "near", "core fact, one more needed");
    assert.equal(status({ included: ["a", "b", "c"], areasMode: "all" }).state, "near", "everywhere is no fact");
    assert.equal(status({ included: ["a", "b", "c"], priceFrom: "$89" }).state, "ready");
    assert.equal(status({ typicalJobs: ["x", "y"], questions: [{ q: "How soon can you come?", a: "" }] }).state, "ready");
    assert.equal(status({ included: ["a", "b", "c"], photos: [photo(1)] }).state, "ready", "a tagged job photo counts");
    assert.equal(status({ included: ["a", "b", "c"], areasMode: "some", areas: ["Orlando"] }).state, "ready");
    assert.equal(status({ included: ["a", "b", "c"], priceFrom: "$89" }).count, 2);
});

test("the address question sets serviceAreaBusiness, and stays absent until answered", () => {
    assert.equal("serviceAreaBusiness" in buildPayload(base(), growth), false);
    assert.equal(buildPayload({ ...base(), visitAddress: "yes" }, growth).serviceAreaBusiness, false);
    assert.equal(buildPayload({ ...base(), visitAddress: "no" }, growth).serviceAreaBusiness, true);
    const site = mapBrandIntakeToIntake(buildPayload({ ...base(), visitAddress: "no" }, growth)).sites[0];
    assert.equal(site.extensions.serviceAreaBusiness, true);
});

test("profiles: only good links are sent, and the rating badge links to the one it came from", () => {
    const st = {
        ...base(),
        profiles: [
            { kind: "google", url: "https://maps.app.goo.gl/r7Hq2vKx" },
            { kind: "facebook", url: "https://www.facebook.com/ridgelineair" },
            { kind: "yelp", url: "https://www.google.com/search?q=ridgeline" },
            { kind: "bbb", url: "" },
        ],
        rating: "4.9",
        reviewCount: "212",
        reviewSource: "google",
        reviewUrl: "https://old.example/reviews",
    };
    const p = buildPayload(st, growth);
    assert.deepEqual(p.profiles, [
        { kind: "google", url: "https://maps.app.goo.gl/r7Hq2vKx" },
        { kind: "facebook", url: "https://www.facebook.com/ridgelineair" },
    ]);
    assert.equal(p.reviewAggregate.url, "https://maps.app.goo.gl/r7Hq2vKx");
    const noProfiles = buildPayload({ ...st, profiles: [], reviewSource: "" }, growth);
    assert.equal("profiles" in noProfiles, false);
    assert.equal(noProfiles.reviewAggregate.url, "https://old.example/reviews", "with no profiles the old link field still works");
});

test("profile link checks", () => {
    assert.equal(profileLinkProblem("google", "https://maps.app.goo.gl/r7Hq2vKx"), "");
    assert.equal(profileLinkProblem("google", "https://www.google.com/maps/place/Ridgeline"), "");
    assert.equal(profileLinkProblem("google", "g.page/ridgeline"), "", "a missing https:// is fine");
    assert.equal(profileLinkProblem("google", "https://business.google.com/n/123"), "");
    assert.equal(profileLinkProblem("google", "https://www.google.com/search?q=ridgeline+hvac"), "search");
    assert.equal(profileLinkProblem("google", "https://facebook.com/ridgeline"), "wrong-site");
    assert.equal(profileLinkProblem("facebook", "https://m.facebook.com/ridgeline"), "");
    assert.equal(profileLinkProblem("yelp", "https://www.yelp.com/biz/ridgeline-orlando"), "");
    assert.equal(profileLinkProblem("yelp", "https://www.yelp.com/search?find_desc=hvac"), "search");
    assert.equal(profileLinkProblem("angi", "https://www.homeadvisor.com/rated.Ridgeline.123.html"), "");
    assert.equal(profileLinkProblem("instagram", "ridgeline"), "not-link");
    assert.equal(profileLinkProblem("other", "https://ridgeline.example/reviews"), "");
    assert.equal(profileLinkProblem("other", "javascript:alert(1)"), "not-link");
    assert.equal(profileLinkProblem("facebook", "https://facebook.com.evil.example/x"), "wrong-site");
});

test("drafts: an old price map moves onto the service, and the new answers round-trip", () => {
    const old = { ...base(), v: 2, screen: "prices", servicePrices: { "Duct Cleaning & Sealing": "$299" } };
    delete old.serviceFacts;
    const s = restoreDraft(JSON.parse(JSON.stringify(old)), initialState("x@y.com", "forwarded"));
    assert.equal(s.serviceFacts["Duct Cleaning & Sealing"].priceFrom, "$299");
    assert.equal(s.visitAddress, "");
    assert.deepEqual(s.profiles, []);

    const st = {
        ...base(),
        screen: "details",
        visited: ["welcome", "details"],
        detailOpen: "AC Installation & Service",
        visitAddress: "no",
        profiles: [{ kind: "google", url: "https://g.page/ridgeline" }],
        reviewSource: "google",
        serviceFacts: {
            "AC Installation & Service": facts({ included: ["a", "b", "c"], areasMode: "some", areas: ["Orlando"], photos: [photo(1)], questions: [{ q: "Q?", a: "A." }] }),
        },
    };
    assert.deepEqual(restoreDraft(JSON.parse(JSON.stringify(st)), initialState("x@y.com", "forwarded")), st);
});

test("how long a job takes: the client's own words, sent as given, not a page fact", () => {
    const one = (f) => buildPayload({ ...base(), serviceFacts: { "AC Installation & Service": facts(f) } }, growth).serviceList[0];
    assert.equal(emptyFacts().duration, "", "a new service starts with no answer");
    assert.equal(one({ duration: " Half a day " }).duration, "Half a day");
    assert.equal("duration" in one({ duration: "  " }), false, "blank is left out, never defaulted");
    assert.equal(one({ duration: "x".repeat(60) }).duration.length, 40);
    const p = buildPayload({ ...base(), serviceFacts: { "AC Installation & Service": facts({ duration: "A full day" }) } }, growth);
    assert.equal(zBrandIntakeSubmission.safeParse(p).success, true);
    assert.equal(zBrandIntakeSubmission.parse(p).serviceList[0].duration, "A full day", "the schema keeps it");
    assert.equal(mapBrandIntakeToIntake(p).sites[0].services.items[0].duration, "A full day");
    const status = (f) => serviceStatus({ ...base(), serviceFacts: { "AC Installation & Service": facts(f) } }, 0).state;
    assert.equal(status({ included: ["a", "b", "c"], duration: "Half a day" }), "near", "it feeds What to expect; the own-page gate doesn't count it");
    assert.equal(status({ duration: "Half a day" }), "core", "something given, so not 'No details yet'");
});
