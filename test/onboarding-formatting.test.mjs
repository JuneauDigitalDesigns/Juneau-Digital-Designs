/**
 * Input formatting in the onboarding wizard (Xander, 2026-11-12): "We don't want to stop anyone
 * from typing in what they wish to the form, but we do want to make sure that if that
 * information comes through, it's formatted correctly." Each rule runs when a field loses focus
 * and again in buildPayload; anything a rule can't read is returned as typed.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    fmtEmail,
    fmtLicense,
    fmtPhone,
    fmtPrice,
    fmtProfileUrl,
    fmtRating,
    fmtText,
    fmtWebsite,
    fmtWholeNumber,
    fmtYear,
} from "../app/components/onboarding/wizard/formatting.ts";
import { buildPayload, initialState } from "../app/components/onboarding/wizard/model.ts";

test("phone: the shared @jdd/schema display format; unreadable numbers stay as typed", () => {
    assert.equal(fmtPhone("4075550142"), "(407) 555-0142");
    assert.equal(fmtPhone("+1 407.555.0142"), "(407) 555-0142");
    assert.equal(fmtPhone(" 407-555-0142 "), "(407) 555-0142");
    assert.equal(fmtPhone("call the office"), "call the office");
    assert.equal(fmtPhone(""), "");
});

test("email: no spaces, lowercase", () => {
    assert.equal(fmtEmail("  Marcus@RidgelineAir.com "), "marcus@ridgelineair.com");
    assert.equal(fmtEmail("marcus @ridgelineair.com"), "marcus@ridgelineair.com");
});

test("price: a number gets $ and commas, a range gets 'to', words stay", () => {
    assert.equal(fmtPrice("1500"), "$1,500");
    assert.equal(fmtPrice("$1500"), "$1,500");
    assert.equal(fmtPrice("150.00"), "$150");
    assert.equal(fmtPrice("149.99"), "$149.99");
    assert.equal(fmtPrice(" 89 "), "$89");
    assert.equal(fmtPrice("150-200"), "$150 to $200");
    assert.equal(fmtPrice("$150 - $2000"), "$150 to $2,000");
    assert.equal(fmtPrice("150 to 200"), "$150 to $200");
    assert.equal(fmtPrice("Free quote"), "Free quote");
    assert.equal(fmtPrice("from 99"), "from 99", "mixed words are left as typed");
    assert.equal(fmtPrice(""), "");
});

test("website: bare lowercase host and path, no scheme, www or trailing slash", () => {
    assert.equal(fmtWebsite("https://www.RidgelineAir.com/"), "ridgelineair.com");
    assert.equal(fmtWebsite(" http://ridgelineair.com/services/ "), "ridgelineair.com/services");
    assert.equal(fmtWebsite("ridgelineair.com"), "ridgelineair.com");
    assert.equal(fmtWebsite(""), "");
});

test("profile and review links: spaces removed, https added when missing", () => {
    assert.equal(fmtProfileUrl("g.page/ridgeline"), "https://g.page/ridgeline");
    assert.equal(fmtProfileUrl(" https://www.facebook.com/ridgeline "), "https://www.facebook.com/ridgeline");
    assert.equal(fmtProfileUrl("http://yelp.com/biz/x"), "http://yelp.com/biz/x");
    assert.equal(fmtProfileUrl(""), "");
});

test("year established: the four-digit year, else as typed", () => {
    assert.equal(fmtYear("since 2009"), "2009");
    assert.equal(fmtYear(" 2009 "), "2009");
    assert.equal(fmtYear("a long time"), "a long time");
});

test("license: uppercase, single spaces", () => {
    assert.equal(fmtLicense(" cac  1812345 "), "CAC 1812345");
});

test("rating: 0 to 5, one decimal; out of range stays as typed", () => {
    assert.equal(fmtRating("4,9"), "4.9");
    assert.equal(fmtRating("4.90 stars"), "4.9");
    assert.equal(fmtRating("5"), "5");
    assert.equal(fmtRating("4.85"), "4.9");
    assert.equal(fmtRating("9"), "9");
    assert.equal(fmtRating("great"), "great");
});

test("whole numbers (review count, travel radius): digits only", () => {
    assert.equal(fmtWholeNumber("212 reviews"), "212");
    assert.equal(fmtWholeNumber("1,200"), "1200");
    assert.equal(fmtWholeNumber("25 miles"), "25");
    assert.equal(fmtWholeNumber("lots"), "lots");
});

test("other text: trimmed, single spaces, one line", () => {
    assert.equal(fmtText("  Marcus   Bell \n"), "Marcus Bell");
});

test("the payload carries formatted values even if a field never lost focus", () => {
    const st = {
        ...initialState("x@y.co", "forwarded"),
        trade: "hvac",
        name: "  Ridgeline   Heating ",
        phone: "4075550142",
        email: " Marcus@RidgelineAir.com ",
        address: "2140 Edgewater Dr, Orlando, FL 32804",
        website: "https://www.RidgelineAir.com/",
        established: "since 2009",
        license: "cac 1812345",
        rating: "4,9",
        reviewCount: "212 reviews",
        services: [{ name: "AC Installation & Service", tag: "Cooling" }],
        serviceFacts: { "AC Installation & Service": { included: [], typicalJobs: [], areasMode: "", areas: [], brands: [], priceFrom: "1500", duration: "", photos: [], questions: [] } },
    };
    const p = buildPayload(st, { plan: "growth", signedMode: "forwarded" }, new Date("2026-11-12T12:00:00Z"));
    assert.equal(p.brandName, "Ridgeline Heating");
    assert.equal(p.phone, "(407) 555-0142");
    assert.equal(p.email, "marcus@ridgelineair.com");
    assert.equal(p.existingWebsiteUrl, "ridgelineair.com");
    assert.equal(p.established, "2009");
    assert.equal(p.license, "CAC 1812345");
    assert.equal(p.serviceList[0].priceFrom, "$1,500");
    const rating = p.stats.find((x) => x.key === "rating");
    if (rating) assert.equal(rating.value, "4.9★ from 212 reviews");
});
