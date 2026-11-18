// A job's before photo (Xander, 2026-11-18; @jdd/schema v1.41.0). Only a trade whose site draws
// before-and-after pairs offers it (pressure washing today), under each job photo in that service's
// photos step. It goes through the same upload as the job photo (prep: orientation, no metadata,
// size limits), travels on the job photo as `before`, survives a saved draft, and is never sent
// blank. The wording (BA1 to BA5) is pinned word for word.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mapBrandIntakeToIntake, zBrandIntakeSubmission } from "@jdd/schema";
import { buildPayload, emptyFacts, initialState, restoreDraft } from "../app/components/onboarding/wizard/model.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { BEFORE_AFTER_TRADES, showsBeforeAfter } from "../app/lib/before-after.ts";

const growth = { plan: "growth", signedMode: "forwarded" };
const SVC = "Driveway & Sidewalk Cleaning";
const photo = (n, extra = {}) => ({ url: `https://x.public.blob.vercel-storage.com/p${n}.jpg`, filename: `p${n}.jpg`, alt: "", ...extra });
const before = (n) => ({ url: `https://x.public.blob.vercel-storage.com/b${n}.jpg`, filename: `b${n}.jpg`, alt: "" });
const client = (photos) => ({
    ...initialState("owner@lakesidewash.com", "forwarded"),
    trade: "pressure-washing",
    name: "Lakeside Pressure Washing",
    phone: "(407) 555-0142",
    address: "2140 Edgewater Dr, Orlando, FL 32804",
    towns: ["Orlando"],
    services: [{ name: SVC, tag: "Concrete" }],
    serviceFacts: { [SVC]: { ...emptyFacts(), photos } },
});

test("only pressure washing offers a before photo", () => {
    assert.deepEqual([...BEFORE_AFTER_TRADES], ["pressure-washing"]);
    assert.equal(showsBeforeAfter("pressure-washing"), true);
    for (const t of ["hvac", "roofing", "plumbing", "lawn-care", "car-detailing", "health", ""]) assert.equal(showsBeforeAfter(t), false, t);
});

test("a before photo travels on its job photo, validates, and reaches the job", () => {
    const p = buildPayload(client([photo(1, { before: before(1) }), photo(2)]), growth);
    assert.deepEqual(p.serviceList[0].photos[0].before, before(1));
    assert.equal("before" in p.serviceList[0].photos[1], false);
    assert.equal(zBrandIntakeSubmission.safeParse(p).success, true);
    const job = mapBrandIntakeToIntake(p).sites[0].work.projects[0];
    assert.equal(job.before.url, before(1).url);
});

test("a blank before photo is never sent", () => {
    const p = buildPayload(client([photo(1, { before: { url: "", filename: "", alt: "" } })]), growth);
    assert.equal("before" in p.serviceList[0].photos[0], false);
});

test("a saved draft keeps the before photo", () => {
    const st = client([photo(1, { before: before(1) })]);
    const back = restoreDraft(JSON.parse(JSON.stringify(st)), initialState("owner@lakesidewash.com", "forwarded"));
    assert.deepEqual(back.serviceFacts[SVC].photos[0].before, before(1));
});

test("the wording, word for word (BA1 to BA5)", () => {
    assert.equal(C.beforeAdd, "+ Before photo");
    assert.equal(C.beforeHelp, "Have a photo of the same spot before you cleaned it? Add it to that job photo and your site shows the two side by side.");
    assert.equal(C.beforeTag, "Before");
    assert.equal(C.beforeRemove, "Remove before photo");
    assert.equal(C.beforeAlt("Driveway & Sidewalk Cleaning", 2), "Driveway & Sidewalk Cleaning photo 2, before");
});

test("the photos step shows the control only through the gate, and uploads through the same pipeline", () => {
    const screens = readFileSync(new URL("../app/components/onboarding/wizard/screens.tsx", import.meta.url), "utf8");
    assert.match(screens, /showsBeforeAfter\(state\.trade\)/);
    const page = readFileSync(new URL("../app/components/onboarding/onboardingpageclient.tsx", import.meta.url), "utf8");
    assert.match(page, /before: \(name: string, index: number, files: File\[\]\) =>\s*void runUpload\(`svc:\$\{name\}:before:\$\{index\}`/);
});
