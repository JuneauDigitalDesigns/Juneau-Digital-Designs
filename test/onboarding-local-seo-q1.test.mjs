/**
 * Local SEO, PR (b): Q1 under each job photo (Xander, 2026-11-12, wording approved word for word in
 * local-seo-architecture-decisions.md): "Which town was this job in?" / "Town only, never the
 * street." Chips are the client's own towns, then "Not sure". Saved as ImageMeta.town on general
 * photos (images.heroSlides) and each service's photos; absent or blank means "Not sure".
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBrandIntakeToIntake } from "@jdd/schema";

import { buildPayload, emptyFacts, initialState, photoTown, restoreDraft } from "../app/components/onboarding/wizard/model.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { buildSubmission } from "../app/lib/onboarding-submission.ts";

const growth = { plan: "growth", signedMode: "forwarded" };
const photo = (n, town) => ({ url: `https://x.public.blob.vercel-storage.com/p${n}.jpg`, filename: `p${n}.jpg`, alt: "", ...(town === undefined ? {} : { town }) });
const client = (extra = {}) => ({
    ...initialState("marcus@ridgelineair.com", "forwarded"),
    trade: "hvac",
    name: "Ridgeline Heating & Air",
    phone: "(407) 555-0142",
    address: "2140 Edgewater Dr, Orlando, FL 32804",
    towns: ["Orlando", "Winter Park", "Maitland"],
    services: [{ name: "AC Installation & Service", tag: "Cooling" }],
    ...extra,
});

test("the approved wording, word for word (Q1)", () => {
    assert.equal(C.photoTownQ, "Which town was this job in?");
    assert.equal(C.photoTownHelp, "Town only, never the street.");
    assert.equal(C.notSure, "Not sure");
});

test("a photo's town counts only if it's one of the client's towns; Not sure and blank count as none", () => {
    const st = client();
    assert.equal(photoTown(st, photo(1, "Winter Park")), "Winter Park");
    assert.equal(photoTown(st, photo(1, " winter park ")), "Winter Park", "the client's own spelling");
    assert.equal(photoTown(st, photo(1, "Tampa")), "", "not one of their towns");
    assert.equal(photoTown(st, photo(1, "")), "", "Not sure");
    assert.equal(photoTown(st, photo(1)), "", "not answered");
});

test("general and service photos carry their town; Not sure, unanswered and stray towns carry none", () => {
    const st = client({
        images: { heroSlides: [photo(1, "Winter Park"), photo(2, ""), photo(3), photo(4, "Tampa")] },
        serviceFacts: { "AC Installation & Service": { ...emptyFacts(), photos: [photo(5, "Maitland"), photo(6, "")] } },
    });
    const p = buildPayload(st, growth);
    assert.deepEqual(p.images.heroSlides.map((x) => x.town), ["Winter Park", undefined, undefined, undefined]);
    assert.equal("town" in p.images.heroSlides[1], false, "Not sure sends no town");
    assert.deepEqual(p.serviceList[0].photos.map((x) => x.town), ["Maitland", undefined]);
    assert.equal(p.images.heroSlides.every((x) => !("lat" in x) && !("lng" in x) && !("gps" in x)), true, "never coordinates");
});

test("a draft keeps each photo's town, including an explicit Not sure", () => {
    const st = client({ images: { heroSlides: [photo(1, "Orlando"), photo(2, "")] }, serviceFacts: { "AC Installation & Service": { ...emptyFacts(), photos: [photo(3, "Maitland")] } } });
    const back = restoreDraft(JSON.parse(JSON.stringify(st)), initialState("marcus@ridgelineair.com", "forwarded"));
    assert.equal(back.images.heroSlides[0].town, "Orlando");
    assert.equal(back.images.heroSlides[1].town, "", "Not sure stays chosen");
    assert.equal(back.serviceFacts["AC Installation & Service"].photos[0].town, "Maitland");
});

test("the server keeps the towns and the schema files the photos as jobs in those towns", () => {
    const st = client({
        images: { heroSlides: [photo(1, "Winter Park")] },
        serviceFacts: { "AC Installation & Service": { ...emptyFacts(), included: ["Sizing for your home"], photos: [photo(2, "Maitland")] } },
    });
    const r = buildSubmission(buildPayload(st, growth), { slug: "ridgeline", plan: "growth", status: "pending-onboarding", receptionistMode: "forwarded" });
    assert.equal(r.ok, true);
    assert.equal(r.submission.images.heroSlides[0].town, "Winter Park");
    assert.equal(r.submission.serviceList[0].photos[0].town, "Maitland");
    const site = mapBrandIntakeToIntake(r.submission).sites[0];
    const towns = (site.work?.projects ?? []).map((x) => x.town).filter(Boolean).sort();
    assert.deepEqual(towns, ["Maitland", "Winter Park"]);
});
