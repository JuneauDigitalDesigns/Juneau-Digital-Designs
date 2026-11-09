import "server-only";
import { Redis } from "@upstash/redis";
import type Stripe from "stripe";
import { createAccount, type OperatorOrder } from "@jdd/schema";
import { stripe } from "./stripe";
import { getPlan, priceIdFor } from "./plans";
import { getSchedule } from "./legal";
import { getAccount, saveAccount } from "./account-store";
// Read-only reuse: plan-billing.ts belongs to the plan-change-review session.
import { getOrCreateCustomerId } from "./plan-billing";
import { deletePayCode, getOrder, saveOrder, transitionOrder } from "./operator-orders";
import { fulfilOperatorPayment } from "./checkout-fulfillment";
import {
    chargeGate,
    chargeIdempotencyKey,
    chargeReceipt,
    classifyChargeError,
    dashboardCustomerUrl,
    isMotoUnavailableError,
    isPaymentMethodId,
    motoRef,
    motoSetupParams,
    nextPaymentAt,
    pickMotoCard,
} from "./moto-charge.mjs";
import { sessionSettled } from "./pay-link.mjs";

/**
 * The card path: the operator types the client's card into Stripe's Dashboard (Stripe's MOTO
 * entry for phone payments) and the agency charges it.
 *
 *   1. `startMotoPayment`: the account and Stripe Customer exist before the Dashboard opens, with
 *      the order's details on the Customer, and the moment is stamped (`startedAt`).
 *   2. The operator adds the card on that Customer's Dashboard page. Only Stripe sees the number.
 *   3. `previewMotoCharge`: the card that arrived after `startedAt`, and the amount, for the
 *      operator to read aloud before charging.
 *   4. `chargeMotoOrder`: the subscription, at the order's period price with the onboarding fee
 *      on its first invoice, charged to that card. Then the same fulfilment a paid link gets.
 *
 * Steps 2 and 3 have a one-screen form (`cardEntryOptions`): once Stripe enables phone-order
 * entry on the account's API, the operator types the card into Stripe's card field inside the
 * wizard, and Charge saves it as a phone order (`motoSetupParams`) and charges it in one go.
 * Until then the wizard keeps the Dashboard form above.
 *
 * The card-path state is kept beside the order, in `jdd:order-charge:{id}`, not on it: the order
 * shape is `@jdd/schema`'s, its parser drops fields it doesn't know, and this state belongs only
 * to the agency.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const STATE_TTL_SECONDS = 60 * 60 * 24 * 30; // as long as an unpaid order lives
const LOCK_TTL_SECONDS = 60;
const stateKey = (orderId: string) => `jdd:order-charge:${orderId}`;
const lockKey = (orderId: string) => `jdd:order-charge-lock:${orderId}`;

export interface MotoState {
    /** When "Enter card" was chosen. Only a card added after this is charged. */
    startedAt: number;
    /** Bumped after each definitive failure, so a retry gets a fresh idempotency key. */
    attempt: number;
    subscriptionId?: string;
}

export class MotoError extends Error {
    constructor(message: string, readonly code: string, readonly status = 400) {
        super(message);
    }
}

async function readState(orderId: string): Promise<MotoState | null> {
    return getRedis().get<MotoState>(stateKey(orderId));
}
async function writeState(orderId: string, state: MotoState): Promise<void> {
    await getRedis().set(stateKey(orderId), state, { ex: STATE_TTL_SECONDS });
}

/**
 * A charge is running (it holds the lock while it talks to Stripe), or one already produced a
 * subscription. Either way a payment link must not go out as well.
 */
export async function motoChargeInFlight(orderId: string): Promise<boolean> {
    const [lock, state] = await Promise.all([getRedis().exists(lockKey(orderId)), readState(orderId)]);
    return Boolean(lock) || Boolean(state?.subscriptionId);
}

export interface CardEntryOptions {
    /** The wizard can take the card in its own Stripe card field: API phone-order entry is on. */
    inline: boolean;
    /** Stripe.js needs it to show the card field; in the same mode (test/live) as the secret key. */
    publishableKey: string | null;
}

let _motoApi: { ok: boolean; until: number } | null = null;

/**
 * Whether the account accepts phone-order (MOTO) entry through the API. Stripe answers
 * `parameter_unknown` for `moto` until it is enabled, so this asks with a SetupIntent that is
 * cancelled straight away: no Customer, no card, nothing to charge. "No" is re-asked every few
 * minutes, so the inline field appears soon after Stripe switches it on; "yes" is kept for an hour.
 */
async function motoApiEnabled(): Promise<boolean> {
    if (_motoApi && _motoApi.until > Date.now()) return _motoApi.ok;
    let ok = false;
    try {
        const probe = await stripe.setupIntents.create({
            payment_method_types: ["card"],
            payment_method_options: { card: { moto: true } },
            metadata: { purpose: "moto-api-check" },
        });
        ok = true;
        await stripe.setupIntents.cancel(probe.id).catch(() => {});
    } catch (e) {
        if (!isMotoUnavailableError(e as { code?: string; param?: string; message?: string })) {
            console.error("[moto] could not check API phone-order entry", e);
        }
    }
    _motoApi = { ok, until: Date.now() + (ok ? 60 * 60_000 : 5 * 60_000) };
    return ok;
}

/** How the wizard takes the card for this account: its own Stripe card field, or the Dashboard. */
export async function cardEntryOptions(): Promise<CardEntryOptions> {
    const secret = process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_LIVE_SECRET_KEY ?? "";
    const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
    // A test card field charging a live key (or the reverse) can only fail; don't offer it.
    const sameMode = /_test_/.test(secret) === /_test_/.test(publishable);
    const publishableKey = publishable.startsWith("pk_") && sameMode ? publishable : null;
    return { inline: Boolean(publishableKey) && (await motoApiEnabled()), publishableKey };
}

export function motoDashboardUrl(customerId: string): string {
    // The same key choice as `lib/stripe.ts`, so the Dashboard opened is in the mode the charge runs in.
    return dashboardCustomerUrl(customerId, process.env.STRIPE_SECRET_KEY ?? process.env.STRIPE_LIVE_SECRET_KEY);
}

/** The order's amount due today, in cents, from Schedule A: the amount read aloud on the call. */
export function orderAmountCents(order: OperatorOrder): { todayCents: number; recurringCents: number } {
    const schedule = getSchedule(order.plan);
    const recurring = order.period === "annual" ? schedule.annualPrice : schedule.monthlyPrice;
    return { todayCents: Math.round((recurring + schedule.onboardingFee) * 100), recurringCents: Math.round(recurring * 100) };
}

function prices(order: OperatorOrder): { recurring: string; onboarding: string | null } {
    const cfg = getPlan(order.plan);
    if (!cfg) throw new MotoError("Unknown plan.", "bad-plan");
    const recurring = priceIdFor(cfg, order.period);
    if (!recurring) {
        throw new MotoError(
            order.period === "annual" ? "Annual billing isn't configured for that plan." : "That plan isn't configured for billing.",
            "no-price",
        );
    }
    return { recurring, onboarding: cfg.onboardingPriceId || null };
}

/**
 * Choose "Enter card". Creates the account and the Customer if they don't exist, writes the
 * order's details onto the Customer, and returns the Customer's Dashboard page.
 *
 * Switching from a payment link expires that link first, so the client can't also pay on their
 * phone while the operator charges the card. A link they have already paid can't be switched.
 *
 * Idempotent: choosing it again keeps the original `startedAt`, so a card already added still
 * counts.
 */
export async function startMotoPayment(order: OperatorOrder): Promise<{ order: OperatorOrder; dashboardUrl: string }> {
    if (!order.agreementId) throw new MotoError("Terms have not been accepted.", "no-agreement");
    prices(order); // refuse early when the plan can't be billed

    if (order.status === "awaiting-payment" && order.payment?.method === "dashboard-moto") {
        const state = await readState(order.id);
        if (state) return { order, dashboardUrl: motoDashboardUrl(order.payment.stripeCustomerId) };
    }
    if (order.status !== "terms-accepted" && order.status !== "awaiting-payment") {
        throw new MotoError(`Can't take a card while the order is ${order.status}.`, "bad-status", 409);
    }

    // A live payment link is closed before the card path opens.
    const sessionId = order.payment?.checkoutSessionId;
    if (order.status === "awaiting-payment" && order.payment?.method === "link" && sessionId) {
        const s = await stripe.checkout.sessions.retrieve(sessionId);
        if (sessionSettled(s)) throw new MotoError("They've already paid on the link.", "already-paid", 409);
        if (s.status === "open") await stripe.checkout.sessions.expire(sessionId);
        if (order.payment.shortCode) await deletePayCode(order.payment.shortCode);
    }

    let account = await getAccount(order.client.email);
    if (!account) {
        account = createAccount(order.client.email);
        await saveAccount(account);
    }
    const customerId = await getOrCreateCustomerId(account);
    await describeCustomer(customerId, order);

    await writeState(order.id, { startedAt: Date.now(), attempt: 0 });
    const payment = { method: "dashboard-moto" as const, stripeCustomerId: customerId };
    const saved =
        order.status === "terms-accepted"
            ? await transitionOrder(order, "awaiting-payment", { kind: "payment-card", text: "Card entry started" }, { payment })
            : await saveOrder({
                  ...order,
                  payment,
                  events: [...order.events, { at: Date.now(), kind: "payment-card", text: "Switched to card entry" }],
              });
    return { order: saved, dashboardUrl: motoDashboardUrl(customerId) };
}

/**
 * Put the order's details on the Customer, so the Dashboard page the operator opens is plainly
 * this client's. Fills only what is empty, so an existing client's billing details are never
 * overwritten by a later order; `order_id` always names the latest order.
 */
async function describeCustomer(customerId: string, order: OperatorOrder): Promise<void> {
    const c = await stripe.customers.retrieve(customerId);
    if ("deleted" in c && c.deleted) throw new MotoError("That client's Stripe customer was deleted.", "customer-deleted", 409);
    const customer = c as Stripe.Customer;
    await stripe.customers.update(customerId, {
        ...(customer.name ? {} : { name: order.client.legalName }),
        ...(customer.phone ? {} : { phone: order.client.phone }),
        // The order holds the address as one line, as the agreement prints it.
        ...(customer.address?.line1 ? {} : { address: { line1: order.client.address } }),
        metadata: { order_id: order.id, account_email: order.client.email },
    });
}

export interface ChargePreview {
    card: { id: string; brand: string; last4: string; expMonth: number | null; expYear: number | null } | null;
    amountCents: number;
    recurringCents: number;
    period: OperatorOrder["period"];
    /** Stripe's own figure for the first invoice. Charging is refused unless it equals `amountCents`. */
    stripeAmountCents: number | null;
    /** When the next charge falls if the card is charged now: a month or a year on, same day. */
    nextPaymentAt: number;
    /** What the client's bank statement will show, from the Stripe account's settings. */
    statementDescriptor: string | null;
}

export type ChargeReceipt = ReturnType<typeof chargeReceipt>;

let _descriptor: { value: string | null } | null = null;
/** The account's statement descriptor, read once per instance; null when it can't be read. */
async function statementDescriptor(): Promise<string | null> {
    if (_descriptor) return _descriptor.value;
    try {
        const account = await stripe.accounts.retrieveCurrent();
        _descriptor = { value: account.settings?.payments?.statement_descriptor || null };
    } catch (e) {
        console.error("[moto] could not read the statement descriptor", e);
        return null; // not cached: try again next time
    }
    return _descriptor.value;
}

async function findCard(order: OperatorOrder, state: MotoState) {
    const customerId = order.payment?.stripeCustomerId ?? "";
    const list = await stripe.customers.listPaymentMethods(customerId, { type: "card", limit: 20 });
    return pickMotoCard(list.data, state.startedAt);
}

async function stripePreviewCents(order: OperatorOrder): Promise<number | null> {
    const { recurring, onboarding } = prices(order);
    try {
        const preview = await stripe.invoices.createPreview({
            customer: order.payment?.stripeCustomerId ?? "",
            subscription_details: { items: [{ price: recurring }] },
            ...(onboarding ? { invoice_items: [{ price: onboarding }] } : {}),
        });
        return preview.amount_due;
    } catch (e) {
        console.error("[moto] invoice preview failed", order.id, e);
        return null;
    }
}

/**
 * Has a card been added to the Customer since "Enter card" was chosen? Yes or no, and nothing
 * else: the console polls this while the operator types the card into Stripe, so it is one
 * Stripe read and returns no detail about the card.
 */
export async function detectMotoCard(order: OperatorOrder): Promise<{ cardAdded: boolean }> {
    const state = await readState(order.id);
    if (order.payment?.method !== "dashboard-moto" || !state) {
        throw new MotoError("Choose Enter card first.", "not-card", 409);
    }
    return { cardAdded: Boolean(await findCard(order, state)) };
}

/** The checkout: the card that will be charged, the amount, and when it renews. */
export async function previewMotoCharge(order: OperatorOrder): Promise<ChargePreview> {
    const state = await readState(order.id);
    if (order.payment?.method !== "dashboard-moto" || !state) {
        throw new MotoError("Choose Enter card first.", "not-card", 409);
    }
    const [pm, stripeAmountCents, descriptor] = await Promise.all([
        findCard(order, state),
        stripePreviewCents(order),
        statementDescriptor(),
    ]);
    const { todayCents, recurringCents } = orderAmountCents(order);
    return {
        card: pm
            ? {
                  id: pm.id,
                  brand: pm.card?.brand ?? "card",
                  last4: pm.card?.last4 ?? "",
                  expMonth: pm.card?.exp_month ?? null,
                  expYear: pm.card?.exp_year ?? null,
              }
            : null,
        amountCents: todayCents,
        recurringCents,
        period: order.period,
        stripeAmountCents,
        nextPaymentAt: nextPaymentAt(Date.now(), order.period),
        statementDescriptor: descriptor,
    };
}

export type ChargeOutcome =
    | { outcome: "paid"; order: OperatorOrder; receipt: ChargeReceipt | null; statementDescriptor: string | null }
    | { outcome: "requires_action" | "declined"; message: string };

/**
 * Charge the card. Only while the order is awaiting payment on the card path, and only the
 * order's amount: `amountCents` is what the console showed, and it must equal both the order's
 * Schedule A amount and Stripe's preview of the first invoice.
 *
 * Can't charge twice:
 *   - a lock (`SET NX`) refuses a second request while one is in flight;
 *   - a subscription already made for this order (a crash after Stripe charged, or a retry after
 *     a timeout) is found and fulfilled instead of creating another;
 *   - the create itself carries an idempotency key per attempt, so even a request that slipped
 *     past both gets Stripe's first answer back.
 *
 * `error_if_incomplete`: if the first invoice can't be paid (declined, or the bank wants 3-D
 * Secure, which can't be done on a phone call) Stripe creates no subscription and charges nothing.
 */
export async function chargeMotoOrder(
    order: OperatorOrder,
    requestedCents: unknown,
    /** The card typed into the wizard's Stripe card field, as Stripe.js tokenised it. */
    paymentMethodId?: unknown,
): Promise<ChargeOutcome> {
    if (paymentMethodId != null && !isPaymentMethodId(paymentMethodId)) {
        throw new MotoError("That isn't a card from Stripe's card field.", "bad-card", 400);
    }
    const state = await readState(order.id);
    if (order.status === "paid" || order.status === "fulfilled") {
        // Already charged (a repeat request, a reopened wizard): the receipt again, never a charge.
        const sub = state?.subscriptionId
            ? await stripe.subscriptions
                  .retrieve(state.subscriptionId, { expand: ["latest_invoice", "default_payment_method"] })
                  .catch(() => null)
            : null;
        return paid(order, sub);
    }
    if (!state) throw new MotoError("Choose Enter card first.", "not-card", 409);

    const locked = await getRedis().set(lockKey(order.id), Date.now(), { nx: true, ex: LOCK_TTL_SECONDS });
    if (!locked) throw new MotoError("A charge for this order is already in progress.", "charge-in-progress", 409);

    try {
        const customerId = order.payment?.stripeCustomerId ?? "";

        const existing = await existingSubscription(order, customerId);
        if (existing) return paid(await fulfil(order, existing, state), existing);

        const { todayCents } = orderAmountCents(order);
        const previewCents = await stripePreviewCents(order);
        const gate = chargeGate({
            status: order.status,
            method: order.payment?.method,
            expectedCents: todayCents,
            requestedCents,
            previewCents,
        });
        if (!gate.ok) throw new MotoError(gate.message, gate.code, 409);

        // The card field's card, or the newest one added on the Dashboard page since Enter card.
        let pmId: string;
        if (typeof paymentMethodId === "string") {
            pmId = paymentMethodId;
        } else {
            const pm = await findCard(order, state);
            if (!pm) throw new MotoError("No card has been added on the Stripe customer page yet.", "no-card", 409);
            pmId = pm.id;
        }

        const { recurring, onboarding } = prices(order);
        let sub: Stripe.Subscription;
        try {
            if (typeof paymentMethodId === "string") {
                // Save the typed card to the Customer as a phone order, then charge it below. Keyed
                // on the card, so a retried request attaches it once.
                const si = await stripe.setupIntents.create(
                    motoSetupParams({ customerId, paymentMethodId, orderId: order.id }) as Stripe.SetupIntentCreateParams,
                    { idempotencyKey: `jdd-order-card-setup:${order.id}:${paymentMethodId}` },
                );
                if (si.status !== "succeeded") {
                    throw Object.assign(new Error(`Card setup ended ${si.status}`), { type: "StripeCardError", code: "authentication_required" });
                }
            }
            sub = await stripe.subscriptions.create(
                {
                    customer: customerId,
                    items: [{ price: recurring }],
                    ...(onboarding ? { add_invoice_items: [{ price: onboarding }] } : {}),
                    default_payment_method: pmId,
                    payment_behavior: "error_if_incomplete",
                    off_session: true,
                    metadata: {
                        order_id: order.id,
                        agreement_id: order.agreementId ?? "",
                        plan: order.plan,
                        period: order.period,
                        site_slug: order.siteSlug,
                        payment_method: "dashboard-moto",
                    },
                    expand: ["latest_invoice", "default_payment_method"],
                },
                { idempotencyKey: chargeIdempotencyKey(order.id, state.attempt) },
            );
        } catch (e) {
            if (isMotoUnavailableError(e as { code?: string; param?: string; message?: string })) {
                throw new MotoError("Card entry in the wizard isn't switched on for this Stripe account yet. Add the card in Stripe instead.", "moto-unavailable", 409);
            }
            const kind = classifyChargeError(e as { type?: string; code?: string; decline_code?: string });
            if (kind === "error") throw e;
            await writeState(order.id, { ...state, attempt: state.attempt + 1 });
            const event =
                kind === "requires_action"
                    ? { kind: "payment-card-auth", text: "Card needs bank verification. Nothing was charged" }
                    : { kind: "payment-card-declined", text: "Card declined. Nothing was charged" };
            await saveOrder({ ...order, events: [...order.events, { at: Date.now(), ...event }] });
            return kind === "requires_action"
                ? { outcome: "requires_action", message: "This card needs bank verification. Use a payment link instead. Nothing was charged." }
                : { outcome: "declined", message: `The card was declined. Nothing was charged.${declineDetail(e)}` };
        }
        return paid(await fulfil(order, sub, state), sub);
    } finally {
        await getRedis().del(lockKey(order.id)).catch(() => {});
    }
}

async function paid(order: OperatorOrder, sub: Stripe.Subscription | null): Promise<ChargeOutcome> {
    return {
        outcome: "paid",
        order,
        receipt: sub ? chargeReceipt(sub) : null,
        statementDescriptor: await statementDescriptor(),
    };
}

function declineDetail(e: unknown): string {
    const msg = (e as { message?: string })?.message;
    return msg ? ` Stripe said: ${msg}` : "";
}

/** A live subscription this order already made: the charge went through before. */
async function existingSubscription(order: OperatorOrder, customerId: string): Promise<Stripe.Subscription | null> {
    const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20, expand: ["data.latest_invoice", "data.default_payment_method"] });
    return (
        list.data.find(
            (s) => s.metadata?.order_id === order.id && (s.status === "active" || s.status === "trialing" || s.status === "past_due"),
        ) ?? null
    );
}

async function fulfil(order: OperatorOrder, sub: Stripe.Subscription, state: MotoState): Promise<OperatorOrder> {
    const invoice = typeof sub.latest_invoice === "object" ? sub.latest_invoice : null;
    const amountPaid = invoice?.amount_paid ?? undefined;
    const { todayCents } = orderAmountCents(order);
    if (amountPaid != null && amountPaid !== todayCents) {
        // Can't happen past the gate; if it ever does, it must be loud.
        console.error("[moto] charged amount differs from the order", order.id, sub.id, amountPaid, todayCents);
    }
    await writeState(order.id, { ...state, subscriptionId: sub.id });
    await fulfilOperatorPayment(order.id, {
        ref: motoRef(sub.id),
        customerId: order.payment?.stripeCustomerId,
        subscriptionId: sub.id,
        ...(amountPaid != null ? { amountTotal: amountPaid } : {}),
        recordSubscriptionOnSite: true,
    });
    return (await getOrder(order.id)) ?? order;
}
