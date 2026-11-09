import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { getAgreement } from "@/app/lib/kv";
import { stripLastPage } from "@/app/lib/pdf-signer";

export const runtime = "nodejs";

/**
 * The accepted agreement, as the client's own copy: the audit page (IP address, browser, hashes)
 * is removed, because this is shown on a screen the client can see.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    const record = order?.agreementId ? await getAgreement(order.agreementId) : null;
    if (!record) return NextResponse.json({ error: "No accepted agreement on this order." }, { status: 404 });

    const res = await fetch(record.pdfUrl, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ error: "Could not read the agreement file." }, { status: 502 });
    const copy = await stripLastPage(new Uint8Array(await res.arrayBuffer()));
    return new NextResponse(Buffer.from(copy), {
        headers: { "content-type": "application/pdf", "content-disposition": "inline", "cache-control": "no-store" },
    });
}
