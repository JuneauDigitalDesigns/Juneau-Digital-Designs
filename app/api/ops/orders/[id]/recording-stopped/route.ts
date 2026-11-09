import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { getAgreement } from "@/app/lib/kv";
import { withTermsLock } from "@/app/lib/agreement-link";
import { markRecordingStopped } from "@/app/lib/order-recording";
import { orderAgreementSummary } from "@/app/lib/order-agreement-summary";

export const runtime = "nodejs";

/** The operator ticked "Recording stopped". Payment can't begin until this has happened. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const response = await withTermsLock(id, async () => {
        const order = await getOrder(id);
        const record = order?.agreementId ? await getAgreement(order.agreementId) : null;
        if (!order || !record) return NextResponse.json({ error: "No accepted agreement on this order." }, { status: 404 });
        await markRecordingStopped(record, Date.now());
        return NextResponse.json({ ok: true, order, agreement: await orderAgreementSummary(order) });
    });
    return response ?? NextResponse.json({ error: "This agreement is being updated. Try again." }, { status: 409 });
}
