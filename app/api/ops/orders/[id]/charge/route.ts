import { NextResponse } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder } from "@/app/lib/operator-orders";
import { MotoError, chargeMotoOrder, detectMotoCard, previewMotoCharge } from "@/app/lib/moto-payment";

export const runtime = "nodejs";

/**
 * The card path's charge (`lib/moto-payment.ts`).
 *
 * GET ?detect=1: has a card been added since "Enter card" was chosen? { cardAdded } only. The
 * console polls this while the card is being typed into Stripe.
 *
 * GET: the checkout. The card added (brand, last 4 and expiry; the number never leaves Stripe),
 * the amount, Stripe's own preview of it, the renewal date and the statement descriptor.
 *
 * POST `{ amountCents, paymentMethodId? }`: charge it. `paymentMethodId` is the card typed into the
 * wizard's Stripe card field (a `pm_…` id from Stripe.js); without it, the card added on the
 * Dashboard page is charged. Only for an order awaiting payment on the card path, and
 * only for the order's own amount: `amountCents` must be the amount the GET returned. Safe to
 * repeat: a second request while one runs is refused, and one after a success returns `paid`
 * without charging again.
 *
 * Responses: 200 `{ outcome: "paid", order, receipt, statementDescriptor }`; 402 `{ outcome: "declined" | "requires_action",
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
        const detect = new URL(request.url).searchParams.get("detect") === "1";
        if (detect) return NextResponse.json({ ok: true, ...(await detectMotoCard(order)) });
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

    let body: { amountCents?: unknown; paymentMethodId?: unknown } = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    try {
        const result = await chargeMotoOrder(order, body.amountCents, body.paymentMethodId);
        if (result.outcome === "paid") return NextResponse.json({ ok: true, ...result });
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
