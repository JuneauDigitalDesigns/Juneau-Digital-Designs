import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { getAgreement } from "@/app/lib/kv";
import { openRecording } from "@/app/lib/recording-store";

export const runtime = "nodejs";

/** The recording's bytes, for the operator. Streamed: a Function's buffered response stops at 4.5 MB. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    const recording = order?.agreementId ? (await getAgreement(order.agreementId))?.recording : null;
    if (!recording) return NextResponse.json({ error: "No recording attached to this order." }, { status: 404 });

    const stream = await openRecording(recording.pathname);
    if (!stream) return NextResponse.json({ error: "Could not read the recording." }, { status: 502 });
    return new Response(stream, {
        headers: {
            "content-type": recording.contentType,
            "content-length": String(recording.sizeBytes),
            "content-disposition": `attachment; filename="${recording.fileName.replace(/[^\w.-]+/g, "_")}"`,
            "cache-control": "no-store",
        },
    });
}
