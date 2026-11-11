import { createHash } from "node:crypto";

/**
 * Shared by the two routes that store a client's image in the public Blob store:
 * `/api/upload` (onboarding photos) and `/api/portal/featured/upload` (the showcase image).
 * Both require a signed-in portal account (`resolvePortalRequest`) and the upload rate limit
 * (`getUploadRatelimit`); these are the path and content checks they share. 2026-11-11.
 */

/**
 * An opaque, stable per-account path segment. The account's email is its key, but a Blob URL is
 * public, so only a hash of it ever goes in a path.
 */
export function accountKey(email: string): string {
    return createHash("sha256").update(`jdd-upload:${email.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

/** Basename only, with path traversal and null bytes stripped. */
export function safeBasename(pathname: string | null | undefined): string {
    const rawBase = (pathname ?? "upload").replace(/\\/g, "/").split("/").pop() ?? "upload";
    return rawBase.replace(/\.\./g, "").replace(/\0/g, "").trim() || "upload";
}

export type SniffedImage = "image/jpeg" | "image/png" | "image/webp";

/**
 * What an image's first bytes say it is: JPEG, PNG or WebP, or null for anything else (SVG,
 * HTML, text, GIF, HEIC). A browser-declared `File.type` is the client's claim; this is the file.
 */
export function sniffImageType(head: Uint8Array): SniffedImage | null {
    if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg";
    const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (head.length >= 8 && png.every((b, i) => head[i] === b)) return "image/png";
    const ascii = (from: number, to: number) => String.fromCharCode(...head.subarray(from, to));
    if (head.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
    return null;
}
