import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { MotoError, chargeMotoOrder, previewMotoCharge } from "@/app/lib/moto-payment";

export const runtime = "nodejs";

/**
 * The card path's charge (`lib/moto-payment.ts`).
 *
 * GET: the card added on the Stripe customer page since "Enter card" was chosen (brand, last 4
 * and expiry only; the number never leaves Stripe), and the amount. The console shows both for
 * the operator to read aloud before charging.
 *
 * POST `{ amountCents }`: charge it. Only for an order awaiting payment on the card path, and
 * only for the order's own amount: `amountCents` must be the amount the GET returned. Safe to
 * repeat: a second request while one runs is refused, and one after a success returns `paid`
 * without charging again.
 *
 * Responses: 200 `{ outcome: "paid", order }`; 402 `{ outcome: "declined" | "requires_action",
 * error }`, after which nothing was charged; 409 `{ code, error }` when the charge was refused
 * before reaching Stripe.
 */
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    try {
        return NextResponse.json({ ok: true, order, ...(await previewMotoCharge(order)) });
    } catch (e) {
        if (e instanceof MotoError) return NextResponse.json({ error: e.message, code: e.code, order }, { status: e.status });
        console.error("[ops/orders] charge preview failed", id, e);
        return NextResponse.json({ error: "Could not read the card from Stripe." }, { status: 502 });
    }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });

    let body: { amountCents?: unknown } = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const result = await chargeMotoOrder(order, body.amountCents);
        if (result.outcome === "paid") return NextResponse.json({ ok: true, outcome: "paid", order: result.order });
        return NextResponse.json({ ok: false, outcome: result.outcome, error: result.message, order }, { status: 402 });
    } catch (e) {
        if (e instanceof MotoError) return NextResponse.json({ error: e.message, code: e.code, order }, { status: e.status });
        console.error("[ops/orders] charge failed", id, e);
        // Not knowing is not "declined": the charge may have gone through. Charging again is safe
        // (it finds the subscription rather than making another), so that is what the operator does.
        return NextResponse.json(
            { error: "Couldn't confirm the charge with Stripe. Try Charge again: it won't charge twice.", code: "unknown" },
            { status: 502 },
        );
    }
}
