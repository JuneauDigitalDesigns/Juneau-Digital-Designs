import "server-only";
import { stripe } from "./stripe";
import { subscriptionsToRepoint } from "./billing-card";

/**
 * Update card (Q4, approved 2026-11-16): the client changes their card on Stripe's own page, a
 * Billing Portal session limited to "update payment method" (no cancelling, no plan switching,
 * no invoices there), and comes back to Settings › Plan & billing.
 *
 * The session uses a portal configuration made for this, named by
 * `STRIPE_BILLING_PORTAL_CONFIG_ID` (`scripts/create-billing-portal-config.mjs` makes one, in test
 * mode first). Without it the button doesn't show, and the tab keeps today's "email us and we'll
 * send a secure link" line. Stripe's default configuration is never used: it allows cancelling,
 * which would skip the portal's own cancel flow, its records and both emails.
 */
export function cardPageConfigured(): boolean {
    return Boolean(process.env.STRIPE_BILLING_PORTAL_CONFIG_ID);
}

/** A Stripe page where the client changes their card, returning to `returnUrl`. */
export async function createCardSession(customerId: string, returnUrl: string): Promise<string> {
    const configuration = process.env.STRIPE_BILLING_PORTAL_CONFIG_ID;
    if (!configuration) throw new Error("STRIPE_BILLING_PORTAL_CONFIG_ID is not set");
    const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        configuration,
        return_url: returnUrl,
        // Straight into the card form, and straight back once the card is saved.
        flow_data: {
            type: "payment_method_update",
            after_completion: { type: "redirect", redirect: { return_url: returnUrl } },
        },
    });
    return session.url;
}

/**
 * After a card change: move every subscription that still bills onto the Customer's new default
 * card (`subscriptionsToRepoint`). Stripe's page sets the Customer default, but a subscription
 * with its own card (Checkout puts it there) is charged to that one first.
 *
 * Idempotent: a subscription already on the new card is left alone, so the return route and the
 * `customer.updated` webhook can both run it. Returns the subscriptions it moved.
 */
export async function syncCardToSubscriptions(customerId: string): Promise<string[]> {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return [];
    const pm = customer.invoice_settings?.default_payment_method;
    const pmId = typeof pm === "string" ? pm : pm?.id;
    if (!pmId) return [];

    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
    const moved = subscriptionsToRepoint(subs.data, pmId);
    for (const id of moved) {
        await stripe.subscriptions.update(id, { default_payment_method: pmId });
    }
    return moved;
}
