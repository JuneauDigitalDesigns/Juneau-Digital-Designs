/**
 * Two logos (2026-11-19). The Logo screen asks for a square logo (the nav's monogram,
 * `images.monogram`) and a wide logo (the footer's wordmark, `images.logo`), @jdd/schema v1.42.0.
 * Xander approved the mockup and its Wording board word for word ("The mockup for asking clients
 * for both logos looks good", https://claude.ai/artifact/Lmg7cMwAiivdPsPsNKaiB9, items W1 to W14).
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { mapBrandIntakeToIntake, zBrandIntakeSubmission } from "@jdd/schema";

import {
    buildPayload,
    exampleInitials,
    initialState,
    isAnswered,
    logoShapeNudge,
    logoSummary,
    moveLogo,
    restoreDraft,
} from "../app/components/onboarding/wizard/model.ts";
import { C } from "../app/components/onboarding/wizard/copy-service-details.ts";
import { buildSubmission } from "../app/lib/onboarding-submission.ts";

const NOW = new Date("2026-11-19T12:00:00Z");
const growth = { plan: "growth", signedMode: "forwarded" };
const MARK = { url: "https://abc.public.blob.vercel-storage.com/onboarding/k/s/tracewell-mark.png", filename: "tracewell-mark.png", alt: "" };
const WORD = { url: "https://abc.public.blob.vercel-storage.com/onboarding/k/s/tracewell-full-logo.png", filename: "tracewell-full-logo.png", alt: "" };
const client = (images = {}, extra = {}) => ({
    ...initialState("owner@tracewellair.com", "forwarded"),
    trade: "hvac",
    name: "Tracewell Heating & Air",
    phone: "(407) 555-0177",
    address: "1200 Example Rd, Orlando, FL 32804",
    towns: ["Orlando"],
    services: [{ name: "AC Repair", tag: "Cooling" }],
    images: { heroSlides: [], ...images },
    ...extra,
});
const siteOf = (payload) => mapBrandIntakeToIntake(payload).sites[0];

test("the approved wording, word for word (W2 to W14)", () => {
    assert.equal(C.logoHelp, "Your site shows your logo in two spots, so there are two boxes. Only have one? Put it in the box it looks most like. PNG, JPG or WebP, up to 10 MB.");
    assert.equal(C.logoSquare, "Square logo");
    assert.equal(C.logoSquareWhat, "Your initials or a symbol. It sits in the bar at the top of every page.");
    assert.equal(C.logoWide, "Wide logo");
    assert.equal(C.logoWideWhat, "Your business name written out as a logo. It sits at the bottom of every page.");
    assert.equal(C.logoUploadSquare, "Upload your square logo");
    assert.equal(C.logoUploadWide, "Upload your wide logo");
    assert.equal(C.logoLikeThis, "Like this");
    assert.equal(C.logoSummaryBoth, "Square and wide logos");
    assert.equal(C.logoSummarySquare, "Square logo only");
    assert.equal(C.logoSummaryWide, "Wide logo only");
    assert.equal(C.logoShownTop, "Shown at the top of every page");
    assert.equal(C.logoShownBottom, "Shown at the bottom of every page");
    assert.equal(C.logoNoWide, "No wide logo? That's fine. The bottom of each page shows your square logo next to your business name.");
    assert.equal(C.logoNoSquare, "No square logo? That's fine. The top of each page shows your business name on its own.");
    assert.equal(C.logoLooksWide, "This one looks wide. Move it to the wide logo box?");
    assert.equal(C.logoLooksSquare, "This one looks square. Move it to the square logo box?");
    assert.equal(C.logoMove, "Move it");
});

test("the square logo reaches images.monogram and the nav; the wide logo stays images.logo and the footer", () => {
    const payload = buildPayload(client({ monogram: MARK, logo: WORD }), growth, NOW);
    assert.equal(zBrandIntakeSubmission.safeParse(payload).success, true);
    assert.deepEqual(payload.images.monogram, MARK);
    assert.deepEqual(payload.images.logo, WORD);
    assert.equal(payload.hasLogo, true);

    const s = buildSubmission(payload, { plan: "growth" });
    assert.equal(s.ok, true);
    assert.equal(s.submission.images.monogram.url, MARK.url);
    assert.equal(s.submission.images.logo.url, WORD.url);
    assert.equal(zBrandIntakeSubmission.safeParse(s.submission).success, true);

    const site = siteOf(s.submission);
    assert.equal(site.images.nav.logoImage, MARK.url);
    assert.equal(site.images.footer.logoImage, WORD.url);
});

test("a square logo alone is sent as the monogram only, never as the wide logo", () => {
    const payload = buildPayload(client({ monogram: MARK }), growth, NOW);
    assert.equal(payload.hasLogo, true, "either logo counts as having one");
    assert.equal(payload.images.logo, undefined);
    const s = buildSubmission(payload, { plan: "growth" }).submission;
    assert.equal(s.images.logo, undefined);
    assert.equal(s.images.monogram.url, MARK.url);
    const site = siteOf(s);
    assert.equal(site.images.nav.logoImage, MARK.url);
    assert.equal(site.images.footer.logoImage, undefined);
});

test("a wide logo alone stays images.logo, with no monogram", () => {
    const payload = buildPayload(client({ logo: WORD }), growth, NOW);
    assert.equal(payload.hasLogo, true);
    assert.equal(payload.images.monogram, undefined);
    const s = buildSubmission(payload, { plan: "growth" }).submission;
    assert.equal(s.images.monogram, undefined);
    assert.equal(siteOf(s).images.footer.logoImage, WORD.url);
    assert.equal(siteOf(s).images.nav, undefined);
});

test("a monogram that isn't one of our uploads is dropped", () => {
    const payload = buildPayload(client({ monogram: { ...MARK, url: "https://evil.example/x.png" } }), growth, NOW);
    const s = buildSubmission(payload, { plan: "growth" }).submission;
    assert.equal(s.images.monogram, undefined);
});

test("the Logo screen is answered by either logo or by 'Design one for me'", () => {
    assert.equal(isAnswered("logo", client()), false);
    assert.equal(isAnswered("logo", client({ monogram: MARK })), true);
    assert.equal(isAnswered("logo", client({ logo: WORD })), true);
    assert.equal(isAnswered("logo", client({}, { logoChoice: "design" })), true);
});

test("the Review line says which logos were given (W10)", () => {
    assert.equal(logoSummary(client({ monogram: MARK, logo: WORD })), "Square and wide logos");
    assert.equal(logoSummary(client({ monogram: MARK })), "Square logo only");
    assert.equal(logoSummary(client({ logo: WORD })), "Wide logo only");
    assert.equal(logoSummary(client({}, { logoChoice: "design" })), "We'll design one");
    assert.equal(logoSummary(client()), "");
});

test("a saved draft keeps both logos; an older draft's one logo stays the wide logo (D3)", () => {
    const base = initialState("owner@tracewellair.com", "forwarded");
    const both = restoreDraft({ name: "Tracewell", images: { heroSlides: [], monogram: MARK, logo: WORD } }, base);
    assert.deepEqual(both.images.monogram, MARK);
    assert.deepEqual(both.images.logo, WORD);
    const old = restoreDraft({ name: "Tracewell", images: { heroSlides: [], logo: WORD } }, base);
    assert.deepEqual(old.images.logo, WORD);
    assert.equal(old.images.monogram, undefined);
});

test("the shape nudge offers the other box only for a clearly wrong shape (W14, D2)", () => {
    assert.equal(logoShapeNudge("monogram", 1), null);
    assert.equal(logoShapeNudge("monogram", 1.5), null);
    assert.equal(logoShapeNudge("monogram", 3.2), C.logoLooksWide);
    assert.equal(logoShapeNudge("logo", 3.2), null);
    assert.equal(logoShapeNudge("logo", 1.6), null);
    assert.equal(logoShapeNudge("logo", 1), C.logoLooksSquare);
    assert.equal(logoShapeNudge("logo", NaN), null, "not measured yet");
});

test("Move it moves a logo to the other box, swapping if that box has one", () => {
    assert.deepEqual(moveLogo({ heroSlides: [], monogram: WORD }, "monogram"), { heroSlides: [], logo: WORD });
    assert.deepEqual(moveLogo({ heroSlides: [], logo: MARK }, "logo"), { heroSlides: [], monogram: MARK });
    assert.deepEqual(moveLogo({ heroSlides: [], monogram: WORD, logo: MARK }, "monogram"), { heroSlides: [], monogram: MARK, logo: WORD });
});

test("the square example uses the business's own initials (W8)", () => {
    assert.equal(exampleInitials("Tracewell Heating & Air"), "TH");
    assert.equal(exampleInitials("A & B Plumbing"), "AB");
    assert.equal(exampleInitials("Copperline"), "C");
    assert.equal(exampleInitials(""), "");
});
