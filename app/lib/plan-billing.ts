import "server-only";
import type Stripe from "stripe";
import type { PortalAccount } from "@jdd/schema";
import { stripe } from "./stripe";
import { saveAccount } from "./account-store";
import { getPlan, priceIdFor, type PlanSlug } from "./plans";
import {
    billingIntervalOf,
    downgradeSchedulePhases,
    immediateChangeParams,
    planChangeKind,
    planFromItems,
} from "./billing-periods.mjs";

const PLAN_SLUGS: PlanSlug[] = ["starter", "growth", "enterprise"];

/** The price a plan bills at on a given period, or null when that price isn't configured. */
function expectedPriceIdFor(plan: PlanSlug, interval: "month" | "year"): string | null {
    const cfg = getPlan(plan);
    return cfg ? priceIdFor(cfg, interval === "year" ? "annual" : "monthly") : null;
}

/** Every recurring price this app sells, by plan and period. */
export function planPriceTable(): Record<PlanSlug, { monthly?: string | null; annual?: string | null }> {
    const table = {} as Record<PlanSlug, { monthly?: string | null; annual?: string | null }>;
    for (const slug of PLAN_SLUGS) {
        const cfg = getPlan(slug);
        table[slug] = { monthly: cfg?.monthlyPriceId ?? null, annual: cfg?.annualPriceId ?? null };
    }
    return table;
}

/** Which plan a recurring price belongs to, monthly or annual. Null for a price we don't sell. */
export function planForPriceId(priceId: string): PlanSlug | null {
    return planFromItems([{ price: { id: priceId, recurring: {} } }], planPriceTable()) as PlanSlug | null;
}

/** Which plan a subscription is billed on, from its single recurring item. */
export function planOfSubscription(sub: Stripe.Subscription): PlanSlug | null {
    return planFromItems(sub.items?.data ?? [], planPriceTable()) as PlanSlug | null;
}

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
 * This function does NOT persist `site.plan`. The callers write it once this returns ok, and
 * the `customer.subscription.updated` webhook reconciles from the subscription's price.
 *
 * It only makes changes that take effect NOW: upgrades, and an operator repairing drift. A
 * client downgrade waits for the end of the paid period, so it goes through `scheduleDowngrade`.
 * The update is made with `payment_behavior: "error_if_incomplete"`: if the proration invoice
 * can't be paid, Stripe refuses the change and nothing moves. It used to apply the new price
 * anyway and leave the subscription `past_due`.
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
    | "payment-failed"
    | "scheduled-change"
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
 * The one Stripe Customer this account bills to, creating it if this is their first purchase.
 *
 * Checkout used to pass `customer_email`, which looks nothing up — Stripe mints a brand new
 * Customer for every session. A client who bought three sites therefore had three Customers,
 * three saved cards and three unrelated invoice streams: no way to show them one bill, no way
 * to charge a second site to the card already on file, and nothing for a consolidation to
 * attach to.
 *
 * Resolution order matters. An account predating this field almost certainly *has* a Customer
 * already, reachable through any site's subscription; minting a fresh one would strand their
 * payment method and quietly open a second billing relationship. So: stored id, else recover
 * from a subscription and persist, else create.
 *
 * Writing the recovered id back also un-breaks `usage-billing`, which skips an account
 * outright when it cannot find a customer — true for nearly everyone, because the per-site
 * `stripeCustomerId` was only ever written by the cancellation route.
 */
export async function getOrCreateCustomerId(account: PortalAccount): Promise<string> {
    if (account.stripeCustomerId) return account.stripeCustomerId;

    const recovered = await recoverCustomerId(account);
    if (recovered) {
        await saveAccount({ ...account, stripeCustomerId: recovered, updatedAt: Date.now() });
        console.log("[plan-billing] recovered stripe customer", account.email, recovered);
        return recovered;
    }

    const customer = await stripe.customers.create({
        email: account.email,
        metadata: {
            account_email: account.email,
            ...(account.clerkUserId ? { clerk_user_id: account.clerkUserId } : {}),
        },
    });
    await saveAccount({ ...account, stripeCustomerId: customer.id, updatedAt: Date.now() });
    return customer.id;
}

/**
 * Dig an existing Customer out of whatever billing pointers the account's sites carry.
 *
 * Site-level `stripeCustomerId` first because it costs nothing, then Stripe via a
 * subscription. Returns the first hit: a pre-cutover multi-site client may genuinely have
 * several Customers, and standardising on one of them is the point — Stripe cannot merge
 * them, so the alternative to picking one is not "the right one", it is a fourth one.
 */
async function recoverCustomerId(account: PortalAccount): Promise<string | null> {
    for (const site of account.sites) {
        if (site.stripeCustomerId) return site.stripeCustomerId;
    }

    for (const site of account.sites) {
        const subscriptionId = await resolveSubscriptionId(site);
        if (!subscriptionId) continue;
        try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const customer = sub.customer;
            const id = typeof customer === "string" ? customer : customer?.id;
            if (id) return id;
        } catch (e) {
            console.error("[plan-billing] customer recovery failed", site.slug, subscriptionId, e);
        }
    }

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

/**
 * The subscription's current billing period, in epoch **seconds**.
 *
 * Stripe moved `current_period_start` / `current_period_end` off the Subscription object and
 * onto each subscription item. `stripe.ts` pins no `apiVersion`, so the SDK default already
 * has that change and the old top-level fields come back `undefined`.
 *
 * Five call sites read those fields through a cast carrying the comment "the SDK's
 * intersection type drops these in some TS configs". That was a misdiagnosis: the type lacks
 * the field because the field is gone. The cast silenced the compiler and turned a breaking
 * API change into a silent `undefined`, which is why nothing ever threw. The damage was the
 * usage tile hiding itself, the overage cron bailing on every run, a `NaN` renewal date on the
 * billing route, and a cancellation date computed from `NaN`.
 *
 * Items first, then the legacy top-level fields, so this stays correct on either API version.
 * Returns null rather than a partial period: every caller has to handle "unknown" anyway, and
 * a half-resolved window silently produces wrong money.
 *
 * If you are tempted to add `sub as unknown as { current_period_end: number }` anywhere, this
 * is the function you actually want.
 */
export function subscriptionPeriod(
    sub: Stripe.Subscription,
): { start: number; end: number } | null {
    const item = sub.items?.data?.[0] as
        | { current_period_start?: number; current_period_end?: number }
        | undefined;
    const legacy = sub as unknown as {
        current_period_start?: number;
        current_period_end?: number;
    };

    const start = item?.current_period_start ?? legacy.current_period_start;
    const end = item?.current_period_end ?? legacy.current_period_end;

    if (typeof start !== "number" || typeof end !== "number") return null;
    return { start, end };
}

/**
 * The billing period a site's live subscription is on, for the signing page of an in-place plan
 * change. The accepted agreement's cover states the price on that period, so an annual client
 * moving plan must not be shown, and sign, the monthly one (which is what happened when the period
 * came from a query string the upgrade link never set). Null when it can't be read; the caller
 * refuses rather than guessing.
 */
export async function billingPeriodOfSite(site: {
    stripeSubscriptionId?: string;
    sessionId?: string;
}): Promise<"monthly" | "annual" | null> {
    const subscriptionId = await resolveSubscriptionId(site);
    if (!subscriptionId) return null;
    try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const recurring = sub.items.data.filter((i) => i.price.recurring !== null);
        if (recurring.length !== 1) return null;
        return billingIntervalOf(recurring[0].price.recurring) === "year" ? "annual" : "monthly";
    } catch (e) {
        console.error("[plan-billing] could not read billing period", subscriptionId, e);
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
    // Before the subscription is read, the expectation can only be the monthly price.
    let expectedPriceId = getPlan(recordPlan)?.monthlyPriceId ?? null;
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
        // The right price for this plan depends on the period the client bills on. Comparing
        // every subscription to the MONTHLY price flagged every annual client as drift — paying
        // for one tier and using another — when they were billed exactly right.
        expectedPriceId = expectedPriceIdFor(recordPlan, billingIntervalOf(price?.recurring));

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
    if (!plan) {
        console.error("[plan-billing] unknown plan", targetPlan);
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

        // Swap the recurring item only. An onboarding fee is a one-time price, not a recurring
        // one, and replacing it would charge the client for onboarding a second time. This
        // matters more than it used to: every tier carries an onboarding fee since 2026-10-12,
        // where previously only Starter did, so every plan change now has one to protect.
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

        /**
         * Stay on the period the client bills on. This used to swap to the target plan's
         * MONTHLY price unconditionally, so an annual client who upgraded was silently moved to
         * monthly billing with the unused year credited back. An annual client moves to the
         * target plan's ANNUAL price; if that isn't configured the change is refused rather
         * than quietly changing how often they pay.
         */
        const interval = billingIntervalOf(recurring[0].price.recurring);
        const targetPriceId = expectedPriceIdFor(targetPlan, interval);
        if (!targetPriceId) {
            console.error("[plan-billing] no", interval, "price configured for", targetPlan);
            return {
                ok: false,
                code: "no-price",
                message:
                    interval === "year"
                        ? "Annual billing isn't configured for that plan, so the change wasn't made."
                        : "That plan isn't configured for billing.",
            };
        }

        // Already there. Report success without touching Stripe, so a retry, a double click or
        // an operator syncing an already-correct subscription cannot raise a second invoice.
        if (recurring[0].price.id === targetPriceId) {
            return { ok: true, subscriptionId, changed: false };
        }

        // A downgrade is waiting for the period end. Changing the price underneath it would
        // leave the schedule to put it back at the phase change, so the operator cancels the
        // scheduled change first.
        if (subscription.schedule) {
            return {
                ok: false,
                code: "scheduled-change",
                message:
                    "This subscription has a scheduled plan change. Cancel that first, then change the plan.",
            };
        }

        await stripe.subscriptions.update(subscriptionId, {
            items: [{ id: recurring[0].id, price: targetPriceId }],
            /**
             * Bill the difference now rather than at the next cycle, and refuse the change if the
             * card doesn't pay (`immediateChangeParams`). For a client, they have just accepted
             * the new terms; for an operator, the billing is wrong and every day it stays wrong
             * costs money. An operator's annual downgrade gives no credit for the paid year.
             */
            ...immediateChangeParams({
                interval,
                fromPlan: planForPriceId(recurring[0].price.id),
                toPlan: targetPlan,
            }),
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
        if (isPaymentFailure(e)) {
            console.warn("[plan-billing] payment failed, change not applied", subscriptionId, e);
            return {
                ok: false,
                code: "payment-failed",
                message: "The card was declined, so the plan was not changed and nothing was charged.",
            };
        }
        console.error("[plan-billing] stripe update failed", subscriptionId, e);
        return {
            ok: false,
            code: "stripe-error",
            message: "Stripe rejected the change. Nothing has been charged.",
        };
    }
}

/** A 402 from `error_if_incomplete`: the card was declined and the update was not applied. */
function isPaymentFailure(e: unknown): boolean {
    const err = e as { type?: string; statusCode?: number } | null;
    return err?.type === "StripeCardError" || err?.statusCode === 402;
}

export type DowngradeResult =
    | {
          ok: true;
          subscriptionId: string;
          scheduleId: string;
          /** When the lower plan starts, epoch ms: the end of the period already paid for. */
          effectiveAt: number;
          interval: "month" | "year";
      }
    | { ok: false; code: DowngradeFailure; message: string };

export type DowngradeFailure =
    | "no-price"
    | "no-subscription"
    | "inactive"
    | "ambiguous-items"
    | "not-a-downgrade"
    | "cancel-pending"
    | "no-period"
    | "stripe-error";

/**
 * Where a site's subscription stands for a downgrade, read without changing anything: the plan
 * it bills on, its period, and when a downgrade asked for now would take effect.
 *
 * The console calls this (through `/api/ops/plan-change`) before the client is emailed, so the
 * date in that email is the date the schedule will use.
 */
export async function downgradePreview(
    site: { stripeSubscriptionId?: string; sessionId?: string },
    targetPlan: PlanSlug,
): Promise<
    | { ok: true; subscriptionId: string; effectiveAt: number; interval: "month" | "year"; fromPlan: PlanSlug }
    | { ok: false; code: DowngradeFailure; message: string }
> {
    const subscriptionId = await resolveSubscriptionId(site);
    if (!subscriptionId) {
        return { ok: false, code: "no-subscription", message: "We couldn't find a Stripe subscription for this site." };
    }
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const checked = checkDowngradable(subscription, targetPlan);
        if (!checked.ok) return checked;
        return {
            ok: true,
            subscriptionId,
            effectiveAt: checked.period.end * 1000,
            interval: checked.interval,
            fromPlan: checked.fromPlan,
        };
    } catch (e) {
        console.error("[plan-billing] downgrade preview failed", subscriptionId, e);
        return { ok: false, code: "stripe-error", message: "Couldn't read the subscription from Stripe." };
    }
}

/** The checks a downgrade needs, shared by the preview and the real thing. */
function checkDowngradable(
    subscription: Stripe.Subscription,
    targetPlan: PlanSlug,
):
    | {
          ok: true;
          item: Stripe.SubscriptionItem;
          interval: "month" | "year";
          targetPriceId: string;
          fromPlan: PlanSlug;
          period: { start: number; end: number };
      }
    | { ok: false; code: DowngradeFailure; message: string } {
    if (subscription.status !== "active" && subscription.status !== "trialing") {
        return {
            ok: false,
            code: "inactive",
            message: `That subscription is ${subscription.status}, so its plan can't be changed.`,
        };
    }
    if (subscription.cancel_at || subscription.cancel_at_period_end) {
        return {
            ok: false,
            code: "cancel-pending",
            message: "This subscription is already set to cancel, so there is nothing to downgrade.",
        };
    }

    const recurring = subscription.items.data.filter((i) => i.price.recurring !== null);
    if (recurring.length !== 1) {
        return {
            ok: false,
            code: "ambiguous-items",
            message:
                "This subscription doesn't have a single recurring item, so it needs changing by hand in Stripe.",
        };
    }

    const fromPlan = planForPriceId(recurring[0].price.id);
    if (!fromPlan || planChangeKind(fromPlan, targetPlan) !== "downgrade") {
        return { ok: false, code: "not-a-downgrade", message: `That subscription isn't on a plan above ${targetPlan}.` };
    }

    const interval = billingIntervalOf(recurring[0].price.recurring);
    const targetPriceId = expectedPriceIdFor(targetPlan, interval);
    if (!targetPriceId) {
        return {
            ok: false,
            code: "no-price",
            message:
                interval === "year"
                    ? "Annual billing isn't configured for that plan, so the change wasn't made."
                    : "That plan isn't configured for billing.",
        };
    }

    const period = subscriptionPeriod(subscription);
    if (!period) {
        return { ok: false, code: "no-period", message: "Couldn't read the subscription's billing period." };
    }

    return { ok: true, item: recurring[0], interval, targetPriceId, fromPlan, period };
}

/**
 * Move a subscription to a lower plan at the end of the period the client has already paid for.
 *
 * Contract v5.3 §15.4, approved 2026-11-04: a downgrade "takes effect at the end of the current
 * billing period, and fees already paid for that period are not credited or refunded". The
 * previous code swapped the price at once: on monthly it credited the unused time, and on both
 * periods the client lost the higher plan the day the change was made.
 *
 * A Stripe subscription schedule does it instead (`downgradeSchedulePhases`): the current price
 * to the period end, then the lower price, with no proration either side. Nothing is charged or
 * credited now; the renewal is billed at the lower price; and when the second phase begins Stripe
 * fires `customer.subscription.updated`, which is what moves `PortalSite.plan`.
 *
 * Does not touch the site record. The caller records the pending change.
 */
export async function scheduleDowngrade(input: {
    slug: string;
    accountEmail: string;
    site: { stripeSubscriptionId?: string; sessionId?: string };
    targetPlan: PlanSlug;
    agreementId?: string;
}): Promise<DowngradeResult> {
    const { slug, accountEmail, site, targetPlan, agreementId } = input;

    const subscriptionId = await resolveSubscriptionId(site);
    if (!subscriptionId) {
        return { ok: false, code: "no-subscription", message: "We couldn't find a Stripe subscription for this site." };
    }

    let createdScheduleId: string | null = null;
    try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const checked = checkDowngradable(subscription, targetPlan);
        if (!checked.ok) return checked;
        const { item, interval, targetPriceId, period } = checked;

        // A schedule already attached (an earlier request for this site, or one made in the
        // Dashboard) is released first, so the phases below start from the subscription as it
        // is now rather than from a plan someone else set up.
        const existing = scheduleIdOf(subscription);
        if (existing) await stripe.subscriptionSchedules.release(existing);

        const schedule = await stripe.subscriptionSchedules.create({ from_subscription: subscriptionId });
        createdScheduleId = schedule.id;
        const currentPhaseStart = schedule.phases[0]?.start_date ?? period.start;

        await stripe.subscriptionSchedules.update(schedule.id, {
            end_behavior: "release",
            phases: downgradeSchedulePhases({
                currentPhaseStart,
                periodEnd: period.end,
                currentPriceId: item.price.id,
                targetPriceId,
                interval,
                metadata: {
                    ...(subscription.metadata ?? {}),
                    plan: targetPlan,
                    site_slug: slug,
                    account_email: accountEmail,
                    plan_changed_by: "client",
                    ...(agreementId ? { agreement_id: agreementId } : {}),
                },
            }) as Stripe.SubscriptionScheduleUpdateParams.Phase[],
            metadata: { kind: "downgrade", site_slug: slug, account_email: accountEmail, to_plan: targetPlan },
        });

        return { ok: true, subscriptionId, scheduleId: schedule.id, effectiveAt: period.end * 1000, interval };
    } catch (e) {
        console.error("[plan-billing] downgrade schedule failed", subscriptionId, e);
        // A schedule created but not configured carries the subscription on unchanged, but it
        // would also block every later change. Release it so the subscription is as it was.
        if (createdScheduleId) {
            const id = createdScheduleId;
            await stripe.subscriptionSchedules
                .release(id)
                .catch((err) => console.error("[plan-billing] could not release half-made schedule", id, err));
        }
        return { ok: false, code: "stripe-error", message: "Stripe rejected the change. Nothing has changed." };
    }
}

/**
 * Withdraw a scheduled plan change: release the subscription from its schedule, so it carries on
 * at its current price. Returns false when there was nothing to release.
 */
export async function releaseScheduledChange(subscriptionId: string): Promise<boolean> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const scheduleId = scheduleIdOf(subscription);
    if (!scheduleId) return false;
    await stripe.subscriptionSchedules.release(scheduleId);
    return true;
}

function scheduleIdOf(subscription: Stripe.Subscription): string | null {
    const s = subscription.schedule;
    if (!s) return null;
    return typeof s === "string" ? s : s.id;
}
