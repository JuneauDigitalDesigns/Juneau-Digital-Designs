/**
 * Which card a client is charged on, and keeping it in step after they change it.
 *
 * Pure: takes the Stripe objects as read, no Stripe calls, so the rules have tests.
 *
 * Stripe charges a subscription invoice with the subscription's own `default_payment_method`
 * first, and the Customer's `invoice_settings.default_payment_method` only when the subscription
 * has none. Checkout stores the card on the subscription. So:
 * - the Billing tab shows the subscription's card, else the Customer's (it used to show only the
 *   subscription's, and said "No card is shown" for a client paying with the Customer default);
 * - after the client changes their card on Stripe's page (Q4), which sets the Customer default,
 *   every live subscription still pointing at another card is moved to the new one. Otherwise the
 *   page would show the new card while the next invoice was charged to the old one.
 */

export interface CardFacts {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
}

type PmLike = string | { id?: string; card?: { brand: string; last4: string; exp_month: number; exp_year: number } | null } | null | undefined;

interface SubLike {
    id: string;
    status: string;
    default_payment_method?: PmLike;
    /** A Customer id, an expanded Customer, or a deleted one; read through `customerDefault`. */
    customer?: unknown;
}

/** The expanded Customer's default invoice card, if there is one. */
function customerDefault(customer: unknown): PmLike {
    if (!customer || typeof customer !== "object") return null;
    const c = customer as { deleted?: unknown; invoice_settings?: { default_payment_method?: PmLike } | null };
    if (c.deleted) return null;
    return c.invoice_settings?.default_payment_method ?? null;
}

function cardOf(pm: PmLike): CardFacts | null {
    if (!pm || typeof pm === "string" || !pm.card) return null;
    return { brand: pm.card.brand, last4: pm.card.last4, expMonth: pm.card.exp_month, expYear: pm.card.exp_year };
}

function idOf(pm: PmLike): string | null {
    if (!pm) return null;
    return typeof pm === "string" ? pm : pm.id ?? null;
}

/**
 * The card the next invoice is charged to: the subscription's, else the Customer's default.
 * Needs `default_payment_method` and `customer.invoice_settings.default_payment_method` expanded.
 */
export function cardOnFile(sub: SubLike): CardFacts | null {
    const own = cardOf(sub.default_payment_method);
    if (own || idOf(sub.default_payment_method)) return own;
    return cardOf(customerDefault(sub.customer));
}

/** Statuses that still bill, so their card matters. */
const BILLING_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

/**
 * The subscriptions to move onto `paymentMethodId`, the Customer's new default: every one that
 * still bills and is set to a different card. One with no card of its own already falls back to
 * the Customer default, so it is left alone.
 */
export function subscriptionsToRepoint(subs: SubLike[], paymentMethodId: string): string[] {
    return subs
        .filter((s) => BILLING_STATUSES.has(s.status))
        .filter((s) => {
            const own = idOf(s.default_payment_method);
            return own !== null && own !== paymentMethodId;
        })
        .map((s) => s.id);
}
