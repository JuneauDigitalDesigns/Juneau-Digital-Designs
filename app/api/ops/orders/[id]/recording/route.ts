import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { getAgreement, updateAgreement } from "@/app/lib/kv";
import { withTermsLock } from "@/app/lib/agreement-link";
import { recordingAttachRefusal } from "@/app/lib/order-recording";
import { MAX_RECORDING_BYTES, newRecordingPathname, recordingPrefix, recordingStat, recordingUploadToken } from "@/app/lib/recording-store";

export const runtime = "nodejs";

interface Body {
    step?: unknown;
    fileName?: unknown;
    contentType?: unknown;
    sizeBytes?: unknown;
    pathname?: unknown;
    sha256?: unknown;
}

const isMedia = (v: unknown): v is string => typeof v === "string" && /^(video|audio)\/[\w.+-]+$/i.test(v);
const isSize = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0 && v <= MAX_RECORDING_BYTES;
const isSha = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const refuse = (error: string, status = 409) => NextResponse.json({ error }, { status });

/**
 * Attach the call's recording to the order's agreement, in two steps because the file itself
 * can't pass through this app (`lib/recording-store.ts`).
 *
 *   - `{ step: "begin", fileName, contentType, sizeBytes }`: returns the pathname and a token for it.
 *   - `{ step: "complete", pathname, fileName, contentType, sizeBytes, sha256 }`: after the upload.
 *     Confirms the blob is there at that size, then writes it onto the agreement.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    let body: Body;
    try {
        body = await request.json();
    } catch {
        return refuse("Invalid request.", 400);
    }
    const fileName = typeof body.fileName === "string" ? body.fileName.trim().slice(0, 200) : "";
    if (!fileName) return refuse("fileName is required.", 400);
    if (!isMedia(body.contentType)) return refuse("The file must be video or audio.", 400);
    if (!isSize(body.sizeBytes)) return refuse("The file size is missing or too large.", 400);
    const { contentType, sizeBytes } = body;

    if (body.step === "begin") {
        const order = await getOrder(id);
        const record = order?.agreementId ? await getAgreement(order.agreementId) : null;
        if (!record) return refuse("No accepted agreement on this order.", 404);
        const refusal = recordingAttachRefusal(record);
        if (refusal) return refuse(refusal);
        const pathname = newRecordingPathname(record.id, fileName);
        return NextResponse.json({ ok: true, pathname, uploadToken: await recordingUploadToken(pathname) });
    }

    if (body.step !== "complete") return refuse("Unknown step.", 400);
    if (!isSha(body.sha256)) return refuse("sha256 must be 64 lowercase hex characters.", 400);
    const { sha256, pathname } = body;
    if (typeof pathname !== "string") return refuse("pathname is required.", 400);

    const response = await withTermsLock(id, async () => {
        const order = await getOrder(id);
        const record = order?.agreementId ? await getAgreement(order.agreementId) : null;
        if (!record) return refuse("No accepted agreement on this order.", 404);
        const refusal = recordingAttachRefusal(record);
        if (refusal) return refuse(refusal);
        // Only a path issued for this agreement: a caller must not be able to point one client's
        // agreement at another client's recording.
        if (!pathname.startsWith(recordingPrefix(record.id)) || pathname.includes("..")) return refuse("That upload is not for this agreement.");
        const stat = await recordingStat(pathname);
        if (!stat) return refuse("The upload was not found in the store.");
        if (stat.size !== sizeBytes) return refuse("The stored file is not the size that was sent.");

        const next = { ...record, recording: { pathname, fileName, contentType, sizeBytes, sha256, attachedAt: new Date().toISOString() } };
        await updateAgreement(next);
        return NextResponse.json({ ok: true, recording: { fileName, contentType, sizeBytes, sha256, attachedAt: next.recording.attachedAt } });
    });
    return response ?? refuse("This agreement is being updated. Try again.");
}
