/**
 * Reads a JPEG's GPS position from its EXIF block, in the browser, BEFORE app/lib/image-prep.ts
 * re-encodes the photo and drops all metadata (local SEO PR (c), Xander 2026-11-12). The position
 * is used once, in the browser, to pre-select the nearest of the client's own towns (town-match.ts)
 * and is then discarded: it is never stored, put in the draft, or sent anywhere.
 *
 * Only JPEG carries EXIF GPS here (phones save JPEG, or HEIC, which this can't read and which then
 * gets no pre-select). Anything malformed returns null, never throws.
 */

export type GpsPoint = { lat: number; lng: number };

const TAG_GPS_IFD = 0x8825;
const TAG_LAT_REF = 0x0001;
const TAG_LAT = 0x0002;
const TAG_LNG_REF = 0x0003;
const TAG_LNG = 0x0004;

/** The GPS position in a JPEG's bytes, or null when there is none or it can't be read. */
export function readJpegGps(bytes: Uint8Array): GpsPoint | null {
    try {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
        let off = 2;
        while (off + 4 <= view.byteLength) {
            if (view.getUint8(off) !== 0xff) return null;
            const marker = view.getUint8(off + 1);
            if (marker === 0xda || marker === 0xd9) return null; // image data or end: no EXIF before it
            const len = view.getUint16(off + 2);
            if (marker === 0xe1 && len >= 8 && off + 4 + 6 <= view.byteLength) {
                const isExif = view.getUint32(off + 4) === 0x45786966 && view.getUint16(off + 8) === 0x0000; // "Exif\0\0"
                if (isExif) return readTiffGps(view, off + 10, Math.min(off + 2 + len, view.byteLength));
            }
            off += 2 + len;
        }
        return null;
    } catch {
        return null;
    }
}

function readTiffGps(view: DataView, start: number, end: number): GpsPoint | null {
    const order = view.getUint16(start);
    const le = order === 0x4949; // "II"
    if (!le && order !== 0x4d4d) return null; // "MM"
    const u16 = (o: number) => view.getUint16(start + o, le);
    const u32 = (o: number) => view.getUint32(start + o, le);
    const inRange = (o: number, n: number) => start + o >= start && start + o + n <= end;
    if (!inRange(0, 8) || u16(2) !== 42) return null;

    const entries = (ifd: number) => {
        if (!inRange(ifd, 2)) return [];
        const n = u16(ifd);
        const out: { tag: number; type: number; count: number; valueOff: number }[] = [];
        for (let i = 0; i < n; i++) {
            const e = ifd + 2 + i * 12;
            if (!inRange(e, 12)) break;
            out.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 });
        }
        return out;
    };

    const gpsPtr = entries(u32(4)).find((x) => x.tag === TAG_GPS_IFD);
    if (!gpsPtr) return null;
    const gps = entries(u32(gpsPtr.valueOff));
    const ref = (tag: number) => {
        const e = gps.find((x) => x.tag === tag);
        return e && e.type === 2 ? String.fromCharCode(view.getUint8(start + e.valueOff)) : "";
    };
    const dms = (tag: number): number | null => {
        const e = gps.find((x) => x.tag === tag);
        if (!e || e.type !== 5 || e.count !== 3) return null;
        const at = u32(e.valueOff);
        if (!inRange(at, 24)) return null;
        const r = (k: number) => {
            const den = u32(at + k * 8 + 4);
            return den ? u32(at + k * 8) / den : NaN;
        };
        const v = r(0) + r(1) / 60 + r(2) / 3600;
        return Number.isFinite(v) ? v : null;
    };

    const lat = dms(TAG_LAT);
    const lng = dms(TAG_LNG);
    if (lat === null || lng === null) return null;
    const point = { lat: ref(TAG_LAT_REF) === "S" ? -lat : lat, lng: ref(TAG_LNG_REF) === "W" ? -lng : lng };
    if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180 || (point.lat === 0 && point.lng === 0)) return null;
    return point;
}

/** The GPS position of a picked file, or null (not a JPEG, no GPS, or unreadable). */
export async function readFileGps(file: Blob): Promise<GpsPoint | null> {
    if (file.type && file.type !== "image/jpeg") return null;
    // EXIF sits at the start of a JPEG; 256 KB covers it without reading the whole photo.
    const head = new Uint8Array(await file.slice(0, 262_144).arrayBuffer());
    return readJpegGps(head);
}
