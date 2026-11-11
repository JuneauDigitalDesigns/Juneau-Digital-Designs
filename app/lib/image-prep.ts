/**
 * Cleans a photo in the browser before the onboarding wizard uploads it (2026-11-11, Xander:
 * "Yes, as recommended", proposed by the templates session).
 *
 * Every image is decoded and redrawn on a canvas, then re-encoded. That:
 * - drops all metadata, including a phone photo's GPS position (the Blob store is public);
 * - applies the EXIF orientation, so sideways phone photos come out upright;
 * - shrinks the long edge to MAX_EDGE (never enlarges), so uploads are quick on mobile data.
 *
 * Photos become JPEG. The logo keeps its transparency: WebP where the browser can encode it,
 * otherwise PNG, never JPEG. HEIC (iPhone) files are accepted only where the browser can decode
 * them (Safari); elsewhere the client sees HEIC_REFUSED, approved word for word. SVG stays refused.
 *
 * The pure helpers are tested in test/image-prep.test.mjs; `prepareImage` needs a real browser.
 */

export const MAX_EDGE = 2560;
export const MAX_UPLOAD_BYTES = 10_485_760; // 10 MB, checked on the original file
export const PHOTO_QUALITY = 0.86;

/** Approved word for word by Xander, 2026-11-11. */
export const HEIC_REFUSED = "This photo is in HEIC format, which we can't open here. Save it as a JPG or PNG and try again.";
/** The wizard's existing messages, unchanged. */
export const TYPE_REFUSED = "Only JPEG, PNG, and WebP images are allowed.";
export const TOO_BIG = "File must be 10 MB or smaller.";

const PLAIN_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HEIC_TYPES = ["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"];

/** What the file chooser offers: the plain types plus HEIC (by type and by extension). */
export const ACCEPT_ATTR = [...PLAIN_TYPES, "image/heic", "image/heif", ".heic", ".heif"].join(",");

type FileLike = { name: string; type: string; size: number };

/** HEIC by type, or by extension where the OS gives no type (common on Windows). */
export function isHeic(f: FileLike): boolean {
    return HEIC_TYPES.includes(f.type.toLowerCase()) || /\.(heic|heif)$/i.test(f.name);
}

/** The error to show before trying to decode, or null when the file may proceed. */
export function precheck(f: FileLike): string | null {
    if (!PLAIN_TYPES.includes(f.type) && !isHeic(f)) return TYPE_REFUSED;
    if (f.size > MAX_UPLOAD_BYTES) return TOO_BIG;
    return null;
}

/** The size to draw at: the long edge capped at `max`, never enlarged, at least 1px. */
export function fitWithin(w: number, h: number, max = MAX_EDGE): { width: number; height: number } {
    const long = Math.max(w, h);
    if (long <= max) return { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) };
    const k = max / long;
    return { width: Math.max(1, Math.round(w * k)), height: Math.max(1, Math.round(h * k)) };
}

export type PrepKind = "photo" | "logo";

/** The encodings to try, in order. A logo never becomes JPEG. */
export function outputTypes(kind: PrepKind): string[] {
    return kind === "logo" ? ["image/webp", "image/png"] : ["image/jpeg"];
}

/** The uploaded file's name: same stem, extension matching what it was encoded as. */
export function renamed(name: string, type: string): string {
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    const stem = name.replace(/\.[^./\\]+$/, "").trim() || "photo";
    return `${stem}.${ext}`;
}

async function decode(file: Blob): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number; close: () => void }> {
    if (typeof createImageBitmap === "function") {
        try {
            const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
            return { width: bmp.width, height: bmp.height, draw: (c, w, h) => c.drawImage(bmp, 0, 0, w, h), close: () => bmp.close() };
        } catch {
            // Fall through to <img>, which some browsers decode when createImageBitmap won't.
        }
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        await img.decode();
        // Browsers apply EXIF orientation to <img> by default (image-orientation: from-image).
        return { width: img.naturalWidth, height: img.naturalHeight, draw: (c, w, h) => c.drawImage(img, 0, 0, w, h), close: () => URL.revokeObjectURL(url) };
    } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}

export class PrepError extends Error {}

/**
 * Decode, orient, shrink and re-encode one image. Throws PrepError with the message to show.
 * The result never carries the original's metadata.
 */
export async function prepareImage(file: File, kind: PrepKind): Promise<File> {
    const early = precheck(file);
    if (early) throw new PrepError(early);
    let src;
    try {
        src = await decode(file);
    } catch {
        throw new PrepError(isHeic(file) ? HEIC_REFUSED : "Upload failed. Please try again.");
    }
    try {
        const { width, height } = fitWithin(src.width, src.height);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new PrepError("Upload failed. Please try again.");
        if (kind === "photo") {
            // JPEG has no transparency: a see-through PNG would otherwise turn black.
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, width, height);
        }
        ctx.imageSmoothingQuality = "high";
        src.draw(ctx, width, height);
        for (const type of outputTypes(kind)) {
            const blob = await toBlob(canvas, type, PHOTO_QUALITY);
            // A browser that can't encode `type` quietly returns PNG; only accept what was asked.
            if (blob && blob.type === type) return new File([blob], renamed(file.name, type), { type });
        }
        throw new PrepError("Upload failed. Please try again.");
    } finally {
        src.close();
    }
}
