import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { resizeToCard } from "@/app/lib/image-resize";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getUploadRatelimit } from "@/app/lib/portal-kv";
import { accountKey, safeBasename, sniffImageType } from "@/app/lib/upload-guard";

export const runtime = "nodejs";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
// Matches the console publish route's cap.
const MAX_BYTES = 8_388_608; // 8 MB

/**
 * Client-uploaded showcase image, for a client who opts to supply their own image rather
 * than an auto-captured screenshot.
 *
 * Proxied through this route rather than the `@vercel/blob/client` direct-to-Blob token
 * flow it used before: every featured image needs the same server-side resize/WebP pass
 * that `captureScreenshot` gets (see app/lib/image-resize.ts), and a direct-to-Blob upload
 * never gives the server the original bytes to resize — the browser hands them straight to
 * Blob storage. Routing the file through this handler instead is what makes the resize
 * possible.
 *
 * Hardened 2026-11-11 (Xander), the same way as /api/upload. The proxy only required a Clerk
 * sign-in, so any signed-in user could store a file. Now:
 * - the signed-in user's portal account must hold the site (`resolvePortalRequest`): 401 signed
 *   out, 403 with no account or for a `?site=` of a different account;
 * - the upload rate limit (`getUploadRatelimit`, shared with onboarding photos): 429;
 * - the file's own bytes must be JPEG, PNG or WebP, whatever type the browser declared (an SVG
 *   claiming to be a PNG is refused), and at most 8 MB;
 * - it is stored under `featured/<account key>/<site slug>/`, a hash of the account's email,
 *   never the email itself. The resize re-encodes to WebP, which also drops any metadata.
 * The error strings are unchanged, plus the portal guard's own (shared with every portal route).
 */
export async function POST(request: Request): Promise<NextResponse> {
    const ctx = await resolvePortalRequest(request, getUploadRatelimit());
    if (!ctx.ok) return ctx.response;
    const { account, site } = ctx;

    // `resolveSite` falls back to the account's first site for a slug it doesn't hold; an upload
    // naming a site of a different account is refused instead.
    const requested = new URL(request.url).searchParams.get("site");
    if (requested && site.slug !== requested) {
        return NextResponse.json({ error: "No portal access" }, { status: 403 });
    }

    let form: FormData;
    try {
        form = await request.formData();
    } catch {
        return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "File too large" }, { status: 400 });
    }

    try {
        const rawBytes = Buffer.from(await file.arrayBuffer());
        // The declared type is the browser's claim; the first bytes are the file.
        if (!sniffImageType(rawBytes.subarray(0, 16))) {
            return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
        }
        const { bytes, contentType } = await resizeToCard(rawBytes);
        const blob = await put(`featured/${accountKey(account.email)}/${site.slug}/${safeBasename(file.name)}`, bytes, {
            access: "public",
            addRandomSuffix: true,
            contentType,
        });
        return NextResponse.json({ url: blob.url });
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 },
        );
    }
}
