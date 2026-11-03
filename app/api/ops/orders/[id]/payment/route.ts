import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder, transitionOrder } from "@/app/lib/operator-orders";
import { OrderCheckoutError, openOrderCheckout, shortPayUrl } from "@/app/lib/order-checkout";

export const runtime = "nodejs";

/**
 * Open the payment link for an order whose terms were accepted.
 *
 * Link only in v1 (PLAN §1, D1). The card is always typed into Stripe's page, by the client, on
 * their own phone; nothing here or in the console ever sees it. The "Enter card" (MOTO) path
 * waits for Stripe to enable phone payments on the account.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });

    let body: { method?: string } = {};
    try {
        body = await request.json();
    } catch {
        /* empty body = link */
    }
    if ((body.method ?? "link") !== "link") {
        return NextResponse.json({ error: "Entering a card isn't enabled yet.", code: "moto-disabled" }, { status: 400 });
    }

    // Idempotent: a second click while the link is live returns the same link, not a second session.
    if (order.status === "awaiting-payment" && order.payment?.shortCode) {
        return NextResponse.json(linkResponse(order));
    }
    if (order.status !== "terms-accepted") {
        return NextResponse.json({ error: `Can't open a payment link while the order is ${order.status}.`, order }, { status: 409 });
    }

    try {
        const link = await openOrderCheckout(order);
        const saved = await transitionOrder(
            order,
            "awaiting-payment",
            { kind: "payment-link", text: "Payment link created" },
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
        return NextResponse.json(linkResponse(saved));
    } catch (e) {
        if (e instanceof OrderCheckoutError) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: 400 });
        }
        console.error("[ops/orders] payment link failed", id, e);
        return NextResponse.json({ error: "Could not open a payment link." }, { status: 500 });
    }
}

function linkResponse(order: Awaited<ReturnType<typeof getOrder>>) {
    const code = order?.payment?.shortCode ?? "";
    return {
        ok: true,
        order,
        shortUrl: shortPayUrl(code),
        expiresAt: order?.payment?.expiresAt ?? null,
    };
}
