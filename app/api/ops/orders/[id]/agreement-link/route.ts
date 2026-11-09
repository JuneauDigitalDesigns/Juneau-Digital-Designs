import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { createAgreementLink } from "@/app/lib/agreement-link";
import { shortAgreeUrl } from "@/app/lib/order-checkout";

export const runtime = "nodejs";

/**
 * The private link for an order's client to read and agree to the full agreement themselves.
 * Idempotent while the link is live and the order unchanged. `{ fresh: true }` replaces it.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (order.status !== "draft") {
        return NextResponse.json({ error: "Terms were already accepted for this order.", order }, { status: 409 });
    }

    const body = (await request.json().catch(() => ({}))) as { fresh?: boolean };
    const { code, expiresAt } = await createAgreementLink(order, { fresh: body.fresh === true });
    return NextResponse.json({ ok: true, order, shortUrl: shortAgreeUrl(code), expiresAt });
}
