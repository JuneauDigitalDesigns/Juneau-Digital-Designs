import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<NextResponse> {
    const body = (await request.json()) as HandleUploadBody;

    try {
        const jsonResponse = await handleUpload({
            body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                // Sanitize the incoming pathname: take only the basename and strip
                // any path traversal sequences or null bytes before forcing the
                // onboarding/ prefix. This prevents clients from writing blobs
                // outside the intended folder regardless of what pathname they send.
                const rawBase = (pathname ?? "upload")
                    .replace(/\\/g, "/")
                    .split("/")
                    .pop() ?? "upload";

                const safeBase = rawBase
                    .replace(/\.\./g, "")
                    .replace(/\0/g, "")
                    .trim() || "upload";

                return {
                    allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
                    maximumSizeInBytes: 10_485_760, // 10 MB
                    addRandomSuffix: true,
                    pathname: `onboarding/${safeBase}`,
                    tokenPayload: JSON.stringify({}),
                };
            },
            onUploadCompleted: async ({ blob }) => {
                // No database to update — the client receives the URL synchronously
                // from upload() and stores it in form state before final submission.
                console.log("Onboarding upload completed:", blob.url);
            },
        });

        return NextResponse.json(jsonResponse);
    } catch (error) {
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 400 }
        );
    }
}
