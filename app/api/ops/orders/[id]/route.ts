import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { termsView } from "@/app/lib/operator-order-input";
import { stripe } from "@/app/lib/stripe";
import { provisionPaidSession } from "@/app/lib/checkout-fulfillment";

export const runtime = "nodejs";

/** How long to trust the webhook before asking Stripe directly. */
const RECONCILE_AFTER_MS = 20_000;

/**
 * One order, as the console's wizard polls it while the client pays.
 *
 * Usually a plain read: the Stripe webhook moves the order to paid. But the webhook is
 * asynchronous and occasionally late, so an order still awaiting payment a little while after
 * its link went out is checked against Stripe here, and a paid session is fulfilled through the
 * same idempotent `provisionPaidSession` the webhook and the success page use. Running it from
 * more than one place is safe for the reason documented there.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    let order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });

    const sessionId = order.payment?.checkoutSessionId;
    const lastTouched = order.updatedAt;
    if (order.status === "awaiting-payment" && sessionId && Date.now() - lastTouched > RECONCILE_AFTER_MS) {
        try {
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status === "paid") {
                await provisionPaidSession(session);
                order = (await getOrder(id)) ?? order;
            }
        } catch (e) {
            // A failed reconcile is not an error for the caller: the webhook will still land.
            console.error("[ops/orders] reconcile failed", id, e);
        }
    }

    return NextResponse.json({
        ok: true,
        order,
        ...termsView(order, order.agreementKind ?? "master"),
    });
}
