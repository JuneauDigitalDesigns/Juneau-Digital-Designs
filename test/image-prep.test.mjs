/**
 * The pure parts of the browser image clean-up (app/lib/image-prep.ts): which files may proceed,
 * the size an image is drawn at, what it is encoded as, and the approved HEIC wording.
 * `prepareImage` itself needs a real browser canvas; it was checked by hand in one.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    ACCEPT_ATTR,
    HEIC_REFUSED,
    MAX_EDGE,
    TOO_BIG,
    TYPE_REFUSED,
    fitWithin,
    isHeic,
    outputTypes,
    precheck,
    renamed,
} from "../app/lib/image-prep.ts";

const f = (name, type, size = 1000) => ({ name, type, size });

test("the plain types and HEIC proceed; SVG, GIF and others are refused", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) assert.equal(precheck(f("a", t)), null, t);
    assert.equal(precheck(f("IMG_0001.HEIC", "")), null, "HEIC with no type (Windows) goes by extension");
    assert.equal(precheck(f("logo.svg", "image/svg+xml")), TYPE_REFUSED);
    assert.equal(precheck(f("a.gif", "image/gif")), TYPE_REFUSED);
    assert.equal(precheck(f("notes.txt", "text/plain")), TYPE_REFUSED);
});

test("the 10 MB cap is checked on the original file", () => {
    assert.equal(precheck(f("a.jpg", "image/jpeg", 10_485_760)), null);
    assert.equal(precheck(f("a.jpg", "image/jpeg", 10_485_761)), TOO_BIG);
});

test("HEIC is recognised by type or by extension", () => {
    assert.ok(isHeic(f("x", "image/heic")));
    assert.ok(isHeic(f("x.heif", "")));
    assert.ok(!isHeic(f("x.jpg", "image/jpeg")));
});

test("the long edge is capped at 2560px and never enlarged", () => {
    assert.equal(MAX_EDGE, 2560);
    assert.deepEqual(fitWithin(4032, 3024), { width: 2560, height: 1920 });
    assert.deepEqual(fitWithin(3024, 4032), { width: 1920, height: 2560 });
    assert.deepEqual(fitWithin(800, 600), { width: 800, height: 600 });
    assert.deepEqual(fitWithin(2560, 10), { width: 2560, height: 10 });
    assert.deepEqual(fitWithin(100000, 1), { width: 2560, height: 1 });
});

test("photos become JPEG; the logo keeps transparency and never becomes JPEG", () => {
    assert.deepEqual(outputTypes("photo"), ["image/jpeg"]);
    assert.deepEqual(outputTypes("logo"), ["image/webp", "image/png"]);
    assert.ok(!outputTypes("logo").includes("image/jpeg"));
});

test("the uploaded name keeps the stem and matches the new encoding", () => {
    assert.equal(renamed("IMG_0001.HEIC", "image/jpeg"), "IMG_0001.jpg");
    assert.equal(renamed("logo.png", "image/webp"), "logo.webp");
    assert.equal(renamed("logo", "image/png"), "logo.png");
    assert.equal(renamed(".jpg", "image/jpeg"), "photo.jpg");
});

test("the chooser offers HEIC, and the refusal is the approved wording", () => {
    assert.match(ACCEPT_ATTR, /image\/heic/);
    assert.match(ACCEPT_ATTR, /\.heic/);
    assert.doesNotMatch(ACCEPT_ATTR, /svg/);
    assert.equal(HEIC_REFUSED, "This photo is in HEIC format, which we can't open here. Save it as a JPG or PNG and try again.");
});
