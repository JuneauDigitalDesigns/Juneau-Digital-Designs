import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder, saveOrder, transitionOrder } from "@/app/lib/operator-orders";
import { OrderCheckoutError, openOrderCheckout, shortPayUrl } from "@/app/lib/order-checkout";
import { MotoError, motoChargeInFlight, startMotoPayment } from "@/app/lib/moto-payment";

export const runtime = "nodejs";

/**
 * Choose how an order whose terms were accepted is paid.
 *
 *   - `{ method: "link" }` (the default): a Checkout Session the client pays on their own phone.
 *   - `{ method: "dashboard-moto" }`: the card path (`lib/moto-payment.ts`). The Customer is
 *     created now and its Stripe Dashboard page returned; the operator types the card there.
 *
 * Either way the card is only ever typed into Stripe, never into this app or the console.
 * Switching is allowed while the order awaits payment and before anything is charged, and each
 * switch closes the other method first, so there is never a link and a card charge both live.
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
    const method = body.method ?? "link";
    if (method === "dashboard-moto") {
        try {
            const { order: saved, dashboardUrl } = await startMotoPayment(order);
            return NextResponse.json({ ok: true, order: saved, dashboardUrl });
        } catch (e) {
            if (e instanceof MotoError) return NextResponse.json({ error: e.message, code: e.code, order }, { status: e.status });
            console.error("[ops/orders] card entry failed", id, e);
            return NextResponse.json({ error: "Could not set up card entry." }, { status: 500 });
        }
    }
    if (method !== "link") return NextResponse.json({ error: "Unknown payment method." }, { status: 400 });

    // Idempotent: a second click while the link is live returns the same link, not a second session.
    if (order.status === "awaiting-payment" && order.payment?.method === "link" && order.payment.shortCode) {
        return NextResponse.json(linkResponse(order));
    }
    // From the card path back to a link ("Use a payment link instead"): only if no charge is
    // running, since that charge could still succeed after the link goes out.
    const fromCard = order.status === "awaiting-payment" && order.payment?.method === "dashboard-moto";
    if (fromCard && (await motoChargeInFlight(order.id))) {
        return NextResponse.json({ error: "A card charge is in progress. Wait for it to finish.", order }, { status: 409 });
    }
    if (order.status !== "terms-accepted" && !fromCard) {
        return NextResponse.json({ error: `Can't open a payment link while the order is ${order.status}.`, order }, { status: 409 });
    }

    try {
        const link = await openOrderCheckout(order);
        const payment = {
            method: "link" as const,
            stripeCustomerId: link.customerId,
            checkoutSessionId: link.sessionId,
            checkoutUrl: link.url,
            shortCode: link.shortCode,
            expiresAt: link.expiresAt,
        };
        const saved = fromCard
            ? await saveOrder({
                  ...order,
                  payment,
                  events: [...order.events, { at: Date.now(), kind: "payment-link", text: "Switched to a payment link" }],
              })
            : await transitionOrder(order, "awaiting-payment", { kind: "payment-link", text: "Payment link created" }, { payment });
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
