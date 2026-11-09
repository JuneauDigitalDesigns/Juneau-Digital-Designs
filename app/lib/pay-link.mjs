/**
 * Where a short payment link (`/pay/ABC234`) goes. Pure, so the test runs it.
 *
 * Null for every kind of miss: unknown, paid, cancelled, expired, replaced. The page shows one
 * identical response for all of them, so a code reveals nothing about the order behind it.
 *
 * @param {{ status: string, payment?: { shortCode?: string, checkoutUrl?: string } } | null} order
 * @param {string} code
 * @returns {string | null}
 */
export function payLinkTarget(order, code) {
  if (order?.status !== "awaiting-payment") return null;
  if (order.payment?.shortCode !== code) return null;
  return order.payment.checkoutUrl || null;
}

export const PAY_CODE = /^[A-Z0-9]{6}$/;
