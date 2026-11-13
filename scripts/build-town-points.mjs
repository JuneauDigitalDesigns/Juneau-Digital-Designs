#!/usr/bin/env node
/**
 * Builds public/geo/places/<STATE>.json from the US Census Bureau's Gazetteer of places (public
 * domain), for the onboarding wizard's photo-town pre-select (app/lib/town-match.ts).
 *
 *   node scripts/build-town-points.mjs <path to 20XX_Gaz_place_national.txt> <output dir> <source note>
 *
 * Reads the tab-separated file as data only (never executes it). Keeps, per place: its name without
 * the Census suffix ("Orlando city" → "Orlando", "Doral CDP" → "Doral"), and its internal point,
 * rounded to 4 decimals (about 11 m). Writes one array per state, sorted by name, plus SOURCE.md.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [input, outDir, note] = process.argv.slice(2);
if (!input || !outDir || !note) {
    console.error("usage: build-town-points.mjs <gazetteer.txt> <outDir> <source note>");
    process.exit(2);
}

// The Census writes the place type after the name; the wizard's towns don't have it. Case-sensitive
// on purpose: the type is lowercase ("Dodge City city"), so a capitalised "City" that is part of the
// name stays ("Carson City").
const SUFFIX = / (city and borough|city|town|village|borough|CDP|municipality|comunidad|zona urbana|urban county|metro township|consolidated government|unified government|metropolitan government|metro government|government|plantation|corporation)( \(balance\))?$/;

const lines = readFileSync(input, "utf8").split(/\r?\n/).filter(Boolean);
const head = lines[0].split("\t").map((h) => h.trim());
const col = (name) => {
    const i = head.indexOf(name);
    if (i < 0) throw new Error(`column ${name} not found`);
    return i;
};
const [cState, cName, cLat, cLng] = [col("USPS"), col("NAME"), col("INTPTLAT"), col("INTPTLONG")];

const byState = new Map();
let kept = 0;
for (const line of lines.slice(1)) {
    const f = line.split("\t");
    const state = (f[cState] ?? "").trim();
    const name = (f[cName] ?? "").trim().replace(SUFFIX, "");
    const lat = Number(f[cLat]);
    const lng = Number(f[cLng]);
    if (!/^[A-Z]{2}$/.test(state) || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push([name, Math.round(lat * 1e4) / 1e4, Math.round(lng * 1e4) / 1e4]);
    kept++;
}

mkdirSync(outDir, { recursive: true });
for (const [state, places] of [...byState].sort()) {
    places.sort((a, b) => a[0].localeCompare(b[0]));
    writeFileSync(join(outDir, `${state}.json`), JSON.stringify(places) + "\n");
}
writeFileSync(
    join(outDir, "SOURCE.md"),
    `# Town centre points\n\n${note}\n\nOne file per state: \`[name, lat, lng]\` per place, the Census "internal point" rounded to 4 decimals, the name without its Census type suffix. Built by \`scripts/build-town-points.mjs\`. Used only in the browser by \`app/lib/town-match.ts\` to pre-select a job photo's town from its GPS; no coordinates are sent anywhere.\n\nStates: ${byState.size}. Places: ${kept}.\n`,
);
console.log(`states ${byState.size}, places ${kept}`);
