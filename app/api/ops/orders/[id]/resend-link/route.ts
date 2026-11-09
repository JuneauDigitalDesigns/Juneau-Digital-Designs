import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { acquireLinkLock, deletePayCode, getOrder, releaseLinkLock, transitionOrder } from "@/app/lib/operator-orders";
import { checkoutRefusal } from "@/app/lib/order-link.mjs";
import { OrderCheckoutError, openOrderCheckout, shortPayUrl } from "@/app/lib/order-checkout";
import { stripe } from "@/app/lib/stripe";

export const runtime = "nodejs";

/**
 * A fresh payment link: the old one expired, or the client lost it.
 *
 * A live link is expired at Stripe first, so exactly one link can ever be paid. Two open
 * sessions for one order would let a client pay twice.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    if (!(await acquireLinkLock(id))) {
        return NextResponse.json({ error: "A payment link is already being created. Try again in a moment.", code: "link-in-progress" }, { status: 409 });
    }
    try {
        return await resend(id);
    } finally {
        await releaseLinkLock(id).catch(() => {});
    }
}

async function resend(id: string) {
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (order.status !== "awaiting-payment" && order.status !== "expired") {
        return NextResponse.json({ error: `Can't resend a link while the order is ${order.status}.`, order }, { status: 409 });
    }

    const oldSession = order.payment?.checkoutSessionId;
    if (order.status === "awaiting-payment" && oldSession) {
        try {
            const s = await stripe.checkout.sessions.retrieve(oldSession);
            if (s.payment_status === "paid") {
                return NextResponse.json({ error: "They've already paid.", order }, { status: 409 });
            }
            if (s.status === "open") await stripe.checkout.sessions.expire(oldSession);
        } catch (e) {
            console.error("[ops/orders] could not expire the old session", id, e);
            return NextResponse.json({ error: "Could not cancel the old link, so no new one was made." }, { status: 502 });
        }
    }
    if (order.payment?.shortCode) await deletePayCode(order.payment.shortCode);

    try {
        const link = await openOrderCheckout(order);
        const saved = await transitionOrder(
            order,
            "awaiting-payment",
            { kind: "payment-link", text: "New payment link created" },
            {
                payment: {
                    method: "link",
                    stripeCustomerId: link.customerId,
                    checkoutSessionId: link.sessionId,
                    checkoutUrl: link.url,
                    shortCode: link.shortCode,
                    expiresAt: link.expiresAt,
                },
            },
        );
        return NextResponse.json({ ok: true, order: saved, shortUrl: shortPayUrl(link.shortCode), expiresAt: link.expiresAt });
    } catch (e) {
        if (e instanceof OrderCheckoutError) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
        }
        console.error("[ops/orders] resend link failed", id, e);
        const refusal = checkoutRefusal(e as { type?: string; param?: string; message?: string });
        if (refusal) return NextResponse.json({ error: refusal.message, code: refusal.code }, { status: 502 });
        return NextResponse.json({ error: "Could not open a payment link." }, { status: 500 });
    }
}
