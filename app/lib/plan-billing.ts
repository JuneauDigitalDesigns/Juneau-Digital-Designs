import "server-only";
import { stripe } from "./stripe";
import { getPlan, type PlanSlug } from "./plans";

/**
 * The one place a subscription's plan changes.
 *
 * There are two ways a client's tier moves: they upgrade themselves from the portal, or an
 * operator repairs billing drift from the ops console. Both end here. That is deliberate —
 * "change what someone pays" is exactly the logic you do not want two copies of, because the
 * copies drift and only one of them gets the bug fix.
 *
 * The ops console does **not** call Stripe itself. It has no auth of any kind and runs on a
 * restricted read-only Stripe key on purpose (see `opsSecrets.ts` there); giving it a
 * write-capable key to re-price subscriptions would be a much larger blast radius than the
 * feature needs. It calls the operator route in this app instead, which is deployed,
 * authenticated by a shared secret, and already holds the write key.
 *
 * This function does NOT persist `site.plan`. Stripe is the source of truth for what someone
 * pays for, so the record is written by the `customer.subscription.updated` webhook. If the
 * proration invoice fails, no event arrives and the record keeps saying what the client is
 * actually being billed.
 */

export interface PlanChangeInput {
    /** Site slug and account email travel into Stripe metadata so the webhook can find the record. */
    slug: string;
    accountEmail: string;
    site: { stripeSubscriptionId?: string; sessionId?: string };
    targetPlan: PlanSlug;
    /**
     * The signed agreement authorising this tier. Required for a client-initiated change;
     * absent for operator drift repair, which corrects billing to match a plan that was
     * already set deliberately rather than selling anything new.
     */
    agreementId?: string;
    initiatedBy: "client" | "operator";
}

export type PlanChangeResult =
    | { ok: true; subscriptionId: string; changed: boolean }
    | { ok: false; code: PlanChangeFailure; message: string };

export type PlanChangeFailure =
    | "no-price"
    | "no-subscription"
    | "inactive"
    | "ambiguous-items"
    | "stripe-error";

/**
 * Is there anything for `resolveSubscriptionId` to resolve?
 *
 * Pure and synchronous — deliberately no Stripe call, so this can gate a UI without a network
 * round trip. It answers the cheap half of "can this site self-serve upgrade?": whether we
 * hold any pointer to a subscription at all.
 *
 * This exists because the upgrade flow used to discover the answer *last* — after the client
 * had read and signed a Growth agreement and been emailed a copy of it. The information was
 * sitting on the account record the whole time. One definition, used by the CTA, the
 * agreement page and the upgrade route, so the three can never disagree about who may
 * upgrade.
 *
 * A false here is not a pricing state, it is a data-integrity anomaly: a live client should
 * always have a subscription on file. Callers should say "contact us", not "buy something".
 */
export function hasBillingLink(site: {
    stripeSubscriptionId?: string;
    sessionId?: string;
}): boolean {
    return Boolean(site.stripeSubscriptionId || site.sessionId);
}

export type UpgradeBlock = "not-starter" | "pending-onboarding" | "no-billing-link";

/**
 * May this client upgrade this site themselves, right now?
 *
 * One definition for all three layers — the CTA, the agreement page and the upgrade route —
 * so they cannot disagree about who is allowed to sign. Returns the *reason* rather than a
 * boolean, because each layer words the refusal differently.
 *
 * Note what is deliberately **not** here: being live. Billing and provisioning are
 * independent tracks — a client can buy Growth while their site is still being built, and
 * the build finishes when it finishes. Only `pending-onboarding` is refused, because there
 * is genuinely nothing yet to attach a receptionist to, and the fix is theirs (finish the
 * form) rather than ours.
 */
export function upgradeBlockReason(site: {
    plan: string;
    status: string;
    stripeSubscriptionId?: string;
    sessionId?: string;
}): UpgradeBlock | null {
    if (site.plan !== "starter") return "not-starter";
    if (site.status === "pending-onboarding") return "pending-onboarding";
    if (!hasBillingLink(site)) return "no-billing-link";
    return null;
}

/**
 * Resolve the subscription id, falling back to the checkout session for older records.
 *
 * The id was historically only persisted when a client cancelled, so a record created before
 * that can only be traced through its session. Callers should persist whatever this returns.
 */
export async function resolveSubscriptionId(site: {
    stripeSubscriptionId?: string;
    sessionId?: string;
}): Promise<string | null> {
    if (site.stripeSubscriptionId) return site.stripeSubscriptionId;
    if (!site.sessionId) return null;

    try {
        const session = await stripe.checkout.sessions.retrieve(site.sessionId, {
            expand: ["subscription"],
        });
        const sub = session.subscription;
        return sub && typeof sub === "object" && "id" in sub ? sub.id : null;
    } catch (e) {
        console.error("[plan-billing] session lookup failed", site.sessionId, e);
        return null;
    }
}

export interface PlanInspection {
    subscriptionId: string | null;
    subscriptionStatus: string | null;
    /** The recurring price the client is actually being billed on. */
    currentPriceId: string | null;
    currentAmount: number | null;
    currentInterval: string | null;
    /** The price the portal record's plan says they should be on. */
    expectedPriceId: string | null;
    /** False means the client is using one tier and paying for another. */
    matches: boolean;
}

/**
 * Read-only: does Stripe agree with the plan on the portal record?
 *
 * Lives here rather than in the ops console so that "what should this plan cost" has exactly
 * one definition. The console renders the answer; it does not compute it, and so cannot drift
 * from the prices this app actually bills.
 */
export async function inspectSubscriptionPlan(
    site: { stripeSubscriptionId?: string; sessionId?: string },
    recordPlan: PlanSlug,
): Promise<PlanInspection> {
    const expectedPriceId = getPlan(recordPlan)?.monthlyPriceId ?? null;
    const empty: PlanInspection = {
        subscriptionId: null,
        subscriptionStatus: null,
        currentPriceId: null,
        currentAmount: null,
        currentInterval: null,
        expectedPriceId,
        matches: false,
    };

    const subscriptionId = await resolveSubscriptionId(site);
    if (!subscriptionId) return empty;

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const recurring = subscription.items.data.filter((i) => i.price.recurring !== null);
        const price = recurring.length === 1 ? recurring[0].price : null;

        return {
            subscriptionId,
            subscriptionStatus: subscription.status,
            currentPriceId: price?.id ?? null,
            currentAmount: price?.unit_amount ?? null,
            currentInterval: price?.recurring?.interval ?? null,
            expectedPriceId,
            matches: Boolean(price && expectedPriceId && price.id === expectedPriceId),
        };
    } catch (e) {
        console.error("[plan-billing] inspect failed", subscriptionId, e);
        return { ...empty, subscriptionId };
    }
}

export async function changeSubscriptionPlan(input: PlanChangeInput): Promise<PlanChangeResult> {
    const { slug, accountEmail, site, targetPlan, agreementId, initiatedBy } = input;

    const plan = getPlan(targetPlan);
    if (!plan?.monthlyPriceId) {
        console.error("[plan-billing] no monthly price configured for", targetPlan);
        return { ok: false, code: "no-price", message: "That plan isn't configured for billing." };
    }

    const subscriptionId = await resolveSubscriptionId(site);
    if (!subscriptionId) {
        return {
            ok: false,
            code: "no-subscription",
            message: "We couldn't find a Stripe subscription for this site.",
        };
    }

    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        if (subscription.status !== "active" && subscription.status !== "trialing") {
            return {
                ok: false,
                code: "inactive",
                message: `That subscription is ${subscription.status}, so its plan can't be changed.`,
            };
        }

        // Swap the recurring item only. Starter's one-time onboarding fee is not a recurring
        // price, and replacing it would re-bill setup.
        const recurring = subscription.items.data.filter((i) => i.price.recurring !== null);
        if (recurring.length !== 1) {
            console.error(
                "[plan-billing] expected exactly one recurring item",
                subscriptionId,
                recurring.map((i) => i.price.id),
            );
            return {
                ok: false,
                code: "ambiguous-items",
                message:
                    "This subscription doesn't have a single recurring item, so it needs changing by hand in Stripe.",
            };
        }

        // Already there. Report success without touching Stripe, so a retry, a double click or
        // an operator syncing an already-correct subscription cannot raise a second invoice.
        if (recurring[0].price.id === plan.monthlyPriceId) {
            return { ok: true, subscriptionId, changed: false };
        }

        await stripe.subscriptions.update(subscriptionId, {
            items: [{ id: recurring[0].id, price: plan.monthlyPriceId }],
            // Bill the difference now rather than at the next cycle. For a client, they have
            // just signed and clicked upgrade; for an operator, the whole point is that the
            // billing is currently wrong and every day it stays wrong costs money.
            proration_behavior: "always_invoice",
            // The webhook has only a subscription to work from, and the sub→slug index is
            // written on cancellation rather than purchase. Carrying the slug and email here
            // is what lets `customer.subscription.updated` find the record to write. Requiring
            // both also scopes that handler to real plan changes: a first purchase sets `plan`
            // in metadata but never these.
            metadata: {
                ...(subscription.metadata ?? {}),
                plan: targetPlan,
                site_slug: slug,
                account_email: accountEmail,
                plan_changed_by: initiatedBy,
                ...(agreementId ? { agreement_id: agreementId } : {}),
            },
        });

        return { ok: true, subscriptionId, changed: true };
    } catch (e) {
        console.error("[plan-billing] stripe update failed", subscriptionId, e);
        return {
            ok: false,
            code: "stripe-error",
            message: "Stripe rejected the change. Nothing has been charged.",
        };
    }
}
