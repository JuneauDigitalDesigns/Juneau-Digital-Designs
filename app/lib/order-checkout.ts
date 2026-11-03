import "server-only";
import { createAccount, type OperatorOrder } from "@jdd/schema";
import { stripe } from "./stripe";
import { getPlan, priceIdFor } from "./plans";
import { getAccount, saveAccount } from "./account-store";
import { getOrCreateCustomerId } from "./plan-billing";
import { newPayCode, savePayCode } from "./operator-orders";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://juneaudigitaldesigns.com";
const LINK_TTL_SECONDS = 60 * 60 * 24; // Stripe's maximum for a Checkout Session

export class OrderCheckoutError extends Error {
    constructor(message: string, readonly code: string) {
        super(message);
    }
}

/**
 * Open the Checkout Session an operator-closed client pays through, on their own phone.
 *
 * The same charges as self-serve `/api/checkout` — the recurring price for the period plus the
 * one-time onboarding fee, in one Session — so an operator close can never be priced
 * differently from the website. What differs is everything about identity: there is no signed-in
 * buyer, so the account is the order's email (created here if new, unlinked to any login, the
 * same record `/start` creates), and the metadata carries `order_id` instead of `purchase_id`.
 * That one key is what routes fulfilment to the operator path.
 *
 * Two Stripe-side choices this path adds, both from the design:
 *   - `consent_collection.terms_of_service: "required"`: the client ticks the ToS box on Stripe's
 *     page themselves, which is stronger evidence than the operator's verbal tick. Needs the ToS
 *     URL set in Stripe's public details, or Stripe refuses to create the session.
 *   - `request_three_d_secure: "any"`: ask for 3-D Secure on this first, on-session payment so a
 *     fraud chargeback can shift to the issuer. Renewals are off-session and are not challenged.
 */
export async function openOrderCheckout(order: OperatorOrder): Promise<{
    customerId: string;
    sessionId: string;
    url: string;
    shortCode: string;
    expiresAt: number;
}> {
    if (!order.agreementId) throw new OrderCheckoutError("Terms have not been accepted.", "no-agreement");

    const cfg = getPlan(order.plan);
    if (!cfg) throw new OrderCheckoutError("Unknown plan.", "bad-plan");
    const recurring = priceIdFor(cfg, order.period);
    if (!recurring) {
        throw new OrderCheckoutError(
            order.period === "annual" ? "Annual billing isn't configured for that plan." : "That plan isn't configured for billing.",
            "no-price",
        );
    }
    const line_items: { price: string; quantity: number }[] = [{ price: recurring, quantity: 1 }];
    if (cfg.onboardingPriceId) {
        line_items.push({ price: cfg.onboardingPriceId, quantity: 1 });
    } else {
        // Same stance as /api/checkout: loud, not fatal.
        console.error("[order-checkout] no onboarding price configured for", cfg.slug);
    }

    let account = await getAccount(order.client.email);
    if (!account) {
        account = createAccount(order.client.email);
        await saveAccount(account);
    }
    const customerId = await getOrCreateCustomerId(account);

    const expiresAtSeconds = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS - 60;
    const metadata = {
        order_id: order.id,
        agreement_id: order.agreementId,
        plan: order.plan,
        period: order.period,
        site_slug: order.siteSlug,
    };

    const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items,
        customer: customerId,
        success_url: `${SITE_URL}/checkout/thanks`,
        cancel_url: `${SITE_URL}/checkout/thanks?cancelled=1`,
        metadata,
        subscription_data: { metadata },
        consent_collection: { terms_of_service: "required" },
        payment_method_options: { card: { request_three_d_secure: "any" } },
        expires_at: expiresAtSeconds,
    });
    if (!session.url) throw new OrderCheckoutError("Stripe returned no checkout URL.", "no-url");

    const shortCode = newPayCode();
    const expiresAt = expiresAtSeconds * 1000;
    await savePayCode(shortCode, order.id, expiresAt);

    return { customerId, sessionId: session.id, url: session.url, shortCode, expiresAt };
}

/** The link read aloud / copied: `juneaudigitaldesigns.com/pay/ABC234`. */
export function shortPayUrl(code: string): string {
    return `${SITE_URL.replace(/^https?:\/\//, "")}/pay/${code}`;
}
