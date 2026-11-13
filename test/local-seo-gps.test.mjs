/**
 * Local SEO PR (c): pre-selecting a job photo's town from its GPS (Xander, 2026-11-12: "Yes, use
 * the Census list"). The position is read in the browser before the photo is cleaned, matched to the
 * nearest of the client's OWN towns using Census town centre points served from our own site, and
 * then forgotten. Only a town (or nothing) ever reaches the wizard's state.
 *
 * Run: `npm test`
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { readJpegGps } from "../app/lib/exif-gps.ts";
import { MAX_MILES, guessPhotoTown, milesBetween, nearestOwnTown, stateFromAddress } from "../app/lib/town-match.ts";

/** A minimal JPEG whose EXIF holds a GPS position, in either byte order. */
function jpegWithGps({ lat, lng, littleEndian = true }) {
    const le = littleEndian;
    const tiff = [];
    const u16 = (v) => (le ? [v & 255, v >> 8] : [v >> 8, v & 255]);
    const u32 = (v) => (le ? [v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24] : [v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255]);
    const dms = (x) => {
        const a = Math.abs(x);
        const d = Math.floor(a);
        const m = Math.floor((a - d) * 60);
        const s = Math.round(((a - d) * 60 - m) * 60 * 100);
        return [...u32(d), ...u32(1), ...u32(m), ...u32(1), ...u32(s), ...u32(100)];
    };
    // Layout: header(8) | IFD0 @8: 1 entry (18) | GPS IFD @26: 4 entries (54) | lat @80 (24) | lng @104 (24)
    tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
    tiff.push(...u16(1), ...u16(0x8825), ...u16(4), ...u32(1), ...u32(26), ...u32(0));
    const ref = (c) => [c.charCodeAt(0), 0, 0, 0];
    tiff.push(...u16(4));
    tiff.push(...u16(1), ...u16(2), ...u32(2), ...ref(lat < 0 ? "S" : "N"));
    tiff.push(...u16(2), ...u16(5), ...u32(3), ...u32(80));
    tiff.push(...u16(3), ...u16(2), ...u32(2), ...ref(lng < 0 ? "W" : "E"));
    tiff.push(...u16(4), ...u16(5), ...u32(3), ...u32(104));
    tiff.push(...u32(0));
    tiff.push(...dms(lat), ...dms(lng));
    const exif = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
    const len = exif.length + 2;
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...exif, 0xff, 0xd9]);
}

const PLACES = [
    ["Orlando", 28.4772, -81.337],
    ["Winter Park", 28.5989, -81.3442],
    ["Maitland", 28.6278, -81.3631],
    ["Saint Cloud", 28.2294, -81.2831],
    ["Tampa", 27.9701, -82.4797],
];
const TOWNS = ["Orlando", "Winter Park", "Maitland", "St. Cloud", "College Park"];

test("reads a JPEG's GPS position, in either byte order", () => {
    for (const littleEndian of [true, false]) {
        const p = readJpegGps(jpegWithGps({ lat: 28.5983, lng: -81.3445, littleEndian }));
        assert.ok(p, `byte order ${littleEndian ? "II" : "MM"}`);
        assert.ok(Math.abs(p.lat - 28.5983) < 0.001 && Math.abs(p.lng + 81.3445) < 0.001, JSON.stringify(p));
    }
});

test("no GPS, not a JPEG, or broken bytes: no position, never an error", () => {
    assert.equal(readJpegGps(new Uint8Array([0xff, 0xd8, 0xff, 0xd9])), null);
    assert.equal(readJpegGps(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null);
    const broken = jpegWithGps({ lat: 28.5, lng: -81.3 }).slice(0, 40);
    assert.equal(readJpegGps(broken), null);
});

test("the state comes from the client's address", () => {
    assert.equal(stateFromAddress("2140 Edgewater Dr, Orlando, FL 32804"), "FL");
    assert.equal(stateFromAddress("12 Main St, Portland, ME 04101-1234"), "ME");
    assert.equal(stateFromAddress("no state here"), "");
});

test("distances are right enough to pick a town", () => {
    const miles = milesBetween({ lat: 28.4772, lng: -81.337 }, { lat: 28.5989, lng: -81.3442 });
    assert.ok(miles > 8 && miles < 9, String(miles));
});

test("picks the nearest of the client's OWN towns, within 10 miles, in their spelling", () => {
    assert.equal(MAX_MILES, 10);
    assert.equal(nearestOwnTown({ lat: 28.6, lng: -81.345 }, TOWNS, PLACES), "Winter Park");
    assert.equal(nearestOwnTown({ lat: 28.2294, lng: -81.2831 }, TOWNS, PLACES), "St. Cloud", "St. matches Saint");
    assert.equal(nearestOwnTown({ lat: 27.9701, lng: -82.4797 }, TOWNS, PLACES), "", "Tampa isn't one of their towns");
    assert.equal(nearestOwnTown({ lat: 30.33, lng: -81.66 }, TOWNS, PLACES), "", "too far from all of them");
    assert.equal(nearestOwnTown({ lat: 28.55, lng: -81.4 }, ["College Park"], PLACES), "", "a neighbourhood the Census doesn't list");
});

test("the guess: a town or nothing, never an error", async () => {
    const at = (lat, lng) => async () => ({ lat, lng });
    const load = async (st) => (st === "FL" ? PLACES : []);
    const addr = "2140 Edgewater Dr, Orlando, FL 32804";
    assert.equal(await guessPhotoTown(new Blob(), TOWNS, addr, { readGps: at(28.6, -81.345), load }), "Winter Park");
    assert.equal(await guessPhotoTown(new Blob(), [], addr, { readGps: at(28.6, -81.345), load }), "", "no towns");
    assert.equal(await guessPhotoTown(new Blob(), TOWNS, "Orlando", { readGps: at(28.6, -81.345), load }), "", "no state");
    assert.equal(await guessPhotoTown(new Blob(), TOWNS, addr, { readGps: async () => null, load }), "", "no GPS");
    assert.equal(await guessPhotoTown(new Blob(), TOWNS, addr, { readGps: async () => { throw new Error("x"); }, load }), "");
    const loaded = [];
    await guessPhotoTown(new Blob(), TOWNS, addr, { readGps: at(28.6, -81.345), load: async (st) => (loaded.push(st), PLACES) });
    assert.deepEqual(loaded, ["FL"], "only the client's state is loaded");
});

test("the wizard reads GPS before the clean-up, for job photos only, and keeps only the town", () => {
    const src = readFileSync(new URL("../app/components/onboarding/onboardingpageclient.tsx", import.meta.url), "utf8");
    const fn = src.slice(src.indexOf("async function uploadFile"), src.indexOf("export default function"));
    assert.ok(fn.indexOf("guessTown(file)") > 0 && fn.indexOf("guessTown(file)") < fn.indexOf("prepareImage(file"), "GPS is read before the photo is cleaned");
    assert.match(fn, /\.\.\.\(town \? \{ town \} : \{\}\)/);
    assert.doesNotMatch(fn, /\blat\b|\blng\b/, "no coordinates are kept");
    assert.match(src, /const isJobPhoto = slot === "hero" \|\| slot\.startsWith\("svc:"\);/);
});

test("the build script turns a Gazetteer file into small per-state files", () => {
    const dir = mkdtempSync(join(tmpdir(), "gaz-"));
    const input = join(dir, "gaz.txt");
    writeFileSync(input, [
        "USPS\tGEOID\tANSICODE\tNAME\tLSAD\tFUNCSTAT\tALAND\tAWATER\tALAND_SQMI\tAWATER_SQMI\tINTPTLAT\tINTPTLONG",
        "FL\t1253000\t1\tOrlando city\t25\tA\t1\t1\t1\t1\t28.477215\t-81.337039",
        "FL\t1278300\t1\tWinter Park city\t25\tA\t1\t1\t1\t1\t28.598921\t-81.344201",
        "FL\t1218575\t1\tDoral CDP\t57\tS\t1\t1\t1\t1\t25.81\t-80.35",
        "ME\t2360545\t1\tPortland city\t25\tA\t1\t1\t1\t1\t43.66\t-70.26",
        "NV\t3209700\t1\tCarson City\t25\tA\t1\t1\t1\t1\t39.15\t-119.74",
    ].join("\n"));
    const out = join(dir, "out");
    execFileSync(process.execPath, [new URL("../scripts/build-town-points.mjs", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"), input, out, "Test source."]);
    assert.deepEqual(JSON.parse(readFileSync(join(out, "FL.json"), "utf8")), [["Doral", 25.81, -80.35], ["Orlando", 28.4772, -81.337], ["Winter Park", 28.5989, -81.3442]]);
    assert.deepEqual(JSON.parse(readFileSync(join(out, "ME.json"), "utf8")), [["Portland", 43.66, -70.26]]);
    assert.deepEqual(JSON.parse(readFileSync(join(out, "NV.json"), "utf8")), [["Carson City", 39.15, -119.74]], "a capitalised City in the name stays");
    assert.match(readFileSync(join(out, "SOURCE.md"), "utf8"), /Test source\./);
});
