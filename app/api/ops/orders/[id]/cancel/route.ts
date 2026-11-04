import { NextResponse } from "next/server";
import { isOrderPaid } from "@jdd/schema";
import { authorizeOps } from "@/app/lib/ops-auth";
import { deletePayCode, getOrder, releaseSlug, transitionOrder } from "@/app/lib/operator-orders";
import { stripe } from "@/app/lib/stripe";

export const runtime = "nodejs";

/**
 * Cancel an order that hasn't been paid. Expires the live payment link at Stripe first, so a
 * client holding it cannot pay for an order that no longer exists, then frees the Site ID.
 *
 * A paid order can't be cancelled here: that is a subscription cancellation, which has its own
 * path and its own consequences.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (order.status === "cancelled") return NextResponse.json({ ok: true, order });
    if (isOrderPaid(order.status)) {
        return NextResponse.json({ error: "This order is paid. Cancel the subscription instead." }, { status: 409 });
    }

    const sessionId = order.payment?.checkoutSessionId;
    if (sessionId) {
        try {
            const s = await stripe.checkout.sessions.retrieve(sessionId);
            if (s.payment_status === "paid") {
                return NextResponse.json({ error: "They've just paid, so this can't be cancelled.", order }, { status: 409 });
            }
            if (s.status === "open") await stripe.checkout.sessions.expire(sessionId);
        } catch (e) {
            console.error("[ops/orders] cancel: could not expire session", id, e);
            return NextResponse.json({ error: "Could not cancel the payment link, so the order was left open." }, { status: 502 });
        }
    }
    if (order.payment?.shortCode) await deletePayCode(order.payment.shortCode);
    await releaseSlug(order.siteSlug, order.id);

    const saved = await transitionOrder(order, "cancelled", { kind: "cancelled", text: "Order cancelled" });
    return NextResponse.json({ ok: true, order: saved });
}
