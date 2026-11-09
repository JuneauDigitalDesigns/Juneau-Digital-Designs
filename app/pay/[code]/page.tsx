import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getOrder, getOrderIdForPayCode } from "@/app/lib/operator-orders";
import { PAY_CODE, payLinkTarget } from "@/app/lib/pay-link.mjs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "Payment link | Juneau Digital Designs",
    robots: { index: false, follow: false },
};

/**
 * `juneaudigitaldesigns.com/pay/ABC234` → the order's Stripe Checkout page.
 *
 * Exists because a Checkout URL is several hundred characters and this one is read aloud or
 * typed on a phone during a call. The code is six characters from an alphabet with no
 * lookalikes, lives exactly as long as the session, and points at nothing once the order is
 * paid, cancelled or expired. It reveals nothing either way: any miss is the same 404 page.
 */
export default async function PayLinkPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const normalized = code.trim().toUpperCase();
    const orderId = PAY_CODE.test(normalized) ? await getOrderIdForPayCode(normalized) : null;
    const order = orderId ? await getOrder(orderId) : null;
    const url = payLinkTarget(order, normalized);
    if (!url) notFound();
    redirect(url);
}
