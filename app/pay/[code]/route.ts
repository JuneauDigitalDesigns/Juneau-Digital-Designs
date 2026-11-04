import { NextResponse } from "next/server";
import { getOrder, getOrderIdForPayCode } from "@/app/lib/operator-orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `juneaudigitaldesigns.com/pay/ABC234` → the order's Stripe Checkout page.
 *
 * Exists because a Checkout URL is several hundred characters and this one is read aloud or
 * typed on a phone during a call. The code is six characters from an alphabet with no
 * lookalikes, lives exactly as long as the session, and points at nothing once the order is
 * paid, cancelled or expired. It reveals nothing either way: any miss is the same plain 404.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ code: string }> }) {
    const { code } = await ctx.params;
    const normalized = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(normalized)) return notFound();

    const orderId = await getOrderIdForPayCode(normalized);
    const order = orderId ? await getOrder(orderId) : null;
    const url = order?.payment?.checkoutUrl;
    if (!order || order.status !== "awaiting-payment" || order.payment?.shortCode !== normalized || !url) {
        return notFound();
    }
    return NextResponse.redirect(url, 302);
}

function notFound() {
    return new NextResponse("This payment link isn't active. Ask us for a new one.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
    });
}
