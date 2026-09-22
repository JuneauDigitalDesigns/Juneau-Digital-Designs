import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { resizeToCard } from "@/app/lib/image-resize";

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
 */
export async function POST(request: Request): Promise<NextResponse> {
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

    // Same sanitization as before: basename only, path traversal and null bytes stripped,
    // prefix forced regardless of what the filename claims.
    const rawBase = file.name.replace(/\\/g, "/").split("/").pop() ?? "upload";
    const safeBase = rawBase.replace(/\.\./g, "").replace(/\0/g, "").trim() || "upload";

    try {
        const rawBytes = Buffer.from(await file.arrayBuffer());
        const { bytes, contentType } = await resizeToCard(rawBytes);
        const blob = await put(`featured/${safeBase}`, bytes, {
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
