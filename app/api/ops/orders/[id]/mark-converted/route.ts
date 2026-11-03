import { NextResponse } from "next/server";
import { isOrderPaid } from "@jdd/schema";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder, saveOrder } from "@/app/lib/operator-orders";

export const runtime = "nodejs";

/**
 * The console has created `clients/<slug>/` and linked the lead. Recorded here so the console's
 * "paid but not yet converted" sweep stops picking this order up.
 *
 * Idempotent: the first `convertedAt` is kept.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (!isOrderPaid(order.status)) {
        return NextResponse.json({ error: "The order isn't paid yet." }, { status: 409 });
    }
    if (order.convertedAt) return NextResponse.json({ ok: true, order });

    const saved = await saveOrder(
        {
            ...order,
            convertedAt: Date.now(),
            events: [...order.events, { at: Date.now(), kind: "converted", text: `Client folder ${order.siteSlug} created` }],
        },
        order,
    );
    return NextResponse.json({ ok: true, order: saved });
}
