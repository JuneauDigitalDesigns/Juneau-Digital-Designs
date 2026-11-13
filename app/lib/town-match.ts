import type { GpsPoint } from "./exif-gps";

/**
 * Matches a photo's GPS position to the nearest of the client's OWN towns (local SEO PR (c),
 * Xander 2026-11-12: "Yes, use the Census list"). Everything runs in the browser:
 * - town centre points come from the US Census Bureau's 2024 Gazetteer of places (public domain),
 *   one small file per state under /geo/places/<STATE>.json on our own site
 *   (scripts/build-town-points.mjs), loaded only for the state in the client's address;
 * - the photo's position is compared against those points and then discarded; it never leaves
 *   the browser and is never stored;
 * - the result only ever picks one of the client's towns, within MAX_MILES of its centre; anything
 *   farther, or a town the Census doesn't list (a neighbourhood, say), picks nothing. The client
 *   sees the pre-selected chip and can change it.
 */

/** [name as the Census writes it, without its "city"/"town"/"CDP" suffix, lat, lng] */
export type PlacePoint = [name: string, lat: number, lng: number];

/** How close a photo must be to a town's centre to pre-select it. */
export const MAX_MILES = 10;

/** The two-letter state in an address like "2140 Edgewater Dr, Orlando, FL 32804", or "". */
export function stateFromAddress(address: string): string {
    const m = /\b([A-Z]{2})\s*,?\s*\d{5}(?:-\d{4})?\b/.exec((address ?? "").toUpperCase());
    return m ? m[1] : "";
}

const norm = (s: string) => s.toLowerCase().replace(/^st\.?\s/, "saint ").replace(/[^a-z0-9]+/g, " ").trim();

/** Great-circle distance in miles. */
export function milesBetween(a: GpsPoint, b: GpsPoint): number {
    const rad = (d: number) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The nearest of `towns` (the client's own, in their spelling) to `point`, or "" when none of them
 * is a known place within MAX_MILES. Ties keep the client's order.
 */
export function nearestOwnTown(point: GpsPoint, towns: string[], places: PlacePoint[], maxMiles = MAX_MILES): string {
    const byName = new Map<string, GpsPoint>();
    for (const [name, lat, lng] of places) if (!byName.has(norm(name))) byName.set(norm(name), { lat, lng });
    let best = "";
    let bestMiles = Infinity;
    for (const town of towns) {
        const centre = byName.get(norm(town));
        if (!centre) continue;
        const d = milesBetween(point, centre);
        if (d <= maxMiles && d < bestMiles) {
            best = town;
            bestMiles = d;
        }
    }
    return best;
}

const cache = new Map<string, Promise<PlacePoint[]>>();

/** One state's places, from our own site, fetched once per page. [] when unavailable. */
export function loadStatePlaces(state: string): Promise<PlacePoint[]> {
    const st = (state ?? "").toUpperCase();
    if (!/^[A-Z]{2}$/.test(st)) return Promise.resolve([]);
    let p = cache.get(st);
    if (!p) {
        p = fetch(`/geo/places/${st}.json`)
            .then((r) => (r.ok ? (r.json() as Promise<PlacePoint[]>) : []))
            .catch(() => []);
        cache.set(st, p);
    }
    return p;
}

/**
 * The town to pre-select for a picked job photo: its GPS, read in the browser before the photo is
 * cleaned, matched to the nearest of the client's own towns. "" when there's no GPS, no state in
 * the address, no place data, or no own town within MAX_MILES. Never throws.
 */
export async function guessPhotoTown(
    file: Blob,
    towns: string[],
    address: string,
    deps: { readGps?: (f: Blob) => Promise<GpsPoint | null>; load?: (state: string) => Promise<PlacePoint[]> } = {},
): Promise<string> {
    try {
        if (!towns.length) return "";
        const state = stateFromAddress(address);
        if (!state) return "";
        const readGps = deps.readGps ?? (await import("./exif-gps")).readFileGps;
        const point = await readGps(file);
        if (!point) return "";
        const places = await (deps.load ?? loadStatePlaces)(state);
        return places.length ? nearestOwnTown(point, towns, places) : "";
    } catch {
        return "";
    }
}
