import "server-only";
import { deletePayCode, getOrder, releaseLinkLock, transitionOrder, waitForLinkLock } from "./operator-orders";

/**
 * Stripe says an order's Checkout Session expired.
 *
 * New link expires the old session itself, then spends a second or two creating the new one, and
 * this webhook used to land in that gap: it matched the still-saved old session and moved the
 * order to `expired`, overwriting the new link, so the link the operator had just been given was
 * dead (test run, 2026-11-09). Taking the same lock waits for that request to finish. The order is
 * then read fresh, and only the session it currently holds can expire it.
 *
 * "retry" means the lock stayed busy: the webhook answers 500 so Stripe delivers it again.
 */
export async function handleOrderSessionExpired(orderId: string, sessionId: string): Promise<"ok" | "retry"> {
    if (!(await waitForLinkLock(orderId))) return "retry";
    try {
        const order = await getOrder(orderId);
        if (order?.status === "awaiting-payment" && order.payment?.checkoutSessionId === sessionId) {
            if (order.payment.shortCode) await deletePayCode(order.payment.shortCode);
            await transitionOrder(order, "expired", { kind: "expired", text: "Payment link expired" });
        }
        return "ok";
    } finally {
        await releaseLinkLock(orderId).catch(() => {});
    }
}
