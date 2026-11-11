import { createHash } from "node:crypto";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { getUploadRatelimit } from "@/app/lib/portal-kv";

/**
 * Issues the Vercel Blob client token the onboarding wizard uploads each photo with (the
 * `upload()` call in app/components/onboarding/onboardingpageclient.tsx is its only caller).
 *
 * Until 2026-11-11 it issued a token to anyone, signed in or not, so anyone could write into the
 * public Blob store (Xander: "Yes, fix it"). Now:
 * - a signed-in Clerk user whose portal account holds the site is required (`resolvePortalRequest`,
 *   the same guard as every /api/portal/* route): 401 signed out, 403 with no account or when
 *   `?site=` is a site of a different account;
 * - uploads are rate limited per user (`getUploadRatelimit`): 429;
 * - only image names are accepted (the wizard re-encodes everything to JPEG, PNG or WebP before
 *   upload, app/lib/image-prep.ts), and the token itself is limited to those types and 10 MB, so
 *   Blob refuses anything else even if the name lies; SVG stays refused;
 * - files land under a per-account prefix: `onboarding/<account key>/<site slug>/<name>`, where
 *   the account key is a hash of the account's email, never the email itself;
 * - only token requests are handled. No upload-completed callback is registered, so none is
 *   accepted (the callback only logged).
 */

export const runtime = "nodejs";

const ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10_485_760; // 10 MB, the wizard's own cap (app/lib/image-prep.ts)
const IMAGE_NAME = /\.(jpe?g|png|webp)$/i;

/** An opaque, stable per-account path segment. The email is the account key but is never public. */
function accountKey(email: string): string {
    return createHash("sha256").update(`jdd-upload:${email.trim().toLowerCase()}`).digest("hex").slice(0, 16);
}

/** Basename only, with path traversal and null bytes stripped. */
function safeBasename(pathname: string | null | undefined): string {
    const rawBase = (pathname ?? "upload").replace(/\\/g, "/").split("/").pop() ?? "upload";
    return rawBase.replace(/\.\./g, "").replace(/\0/g, "").trim() || "upload";
}

const bad = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(request: Request): Promise<NextResponse> {
    let body: HandleUploadBody;
    try {
        body = (await request.json()) as HandleUploadBody;
    } catch {
        return bad(400, "Invalid request");
    }
    if (body?.type !== "blob.generate-client-token") return bad(400, "Invalid request");

    const ctx = await resolvePortalRequest(request, getUploadRatelimit());
    if (!ctx.ok) return ctx.response;
    const { account, site } = ctx;

    // `resolveSite` falls back to the account's first site for a slug it doesn't hold. That is
    // fine for reading the portal, but an upload for a site of a different account is refused.
    const requested = new URL(request.url).searchParams.get("site");
    if (requested && site.slug !== requested) return bad(403, "No portal access");

    const name = safeBasename(body.payload?.pathname);
    if (!IMAGE_NAME.test(name)) return bad(400, "Unsupported file type");

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async () => ({
                allowedContentTypes: ALLOWED_CONTENT_TYPES,
                maximumSizeInBytes: MAX_BYTES,
                addRandomSuffix: true,
                pathname: `onboarding/${accountKey(account.email)}/${site.slug}/${name}`,
                tokenPayload: JSON.stringify({}),
            }),
        });
        return NextResponse.json(jsonResponse);
    } catch (error) {
        return bad(400, (error as Error).message);
    }
}
