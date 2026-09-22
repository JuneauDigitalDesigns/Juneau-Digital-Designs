import "server-only";
import sharp from "sharp";

const CARD_W = 760;
const CARD_H = 950;

/**
 * Resize and convert an image to WebP for the featured site card (380x475 at 2x, see
 * FeaturedSites.tsx). Used by both the auto-capture (Microlink) path and the client upload
 * path so every blob-stored featured image is a consistent 760x950 WebP regardless of
 * source, instead of shipping whatever dimensions the screenshot service or the client's
 * own file happened to be.
 */
export async function resizeToCard(
    input: Buffer | Uint8Array,
): Promise<{ bytes: Buffer; contentType: "image/webp" }> {
    const bytes = await sharp(input)
        .resize(CARD_W, CARD_H, { fit: "cover", position: "top" })
        .webp({ quality: 82 })
        .toBuffer();
    return { bytes, contentType: "image/webp" };
}
