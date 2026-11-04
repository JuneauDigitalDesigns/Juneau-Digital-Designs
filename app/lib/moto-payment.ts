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
    classifyChargeError,
    dashboardCustomerUrl,
    motoRef,
    pickMotoCard,
} from "./moto-charge.mjs";

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
        if (s.payment_status === "paid") throw new MotoError("They've already paid on the link.", "already-paid", 409);
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

/** The card to be charged and the amount, for the operator to confirm and read aloud. */
export async function previewMotoCharge(order: OperatorOrder): Promise<ChargePreview> {
    const state = await readState(order.id);
    if (order.payment?.method !== "dashboard-moto" || !state) {
        throw new MotoError("Choose Enter card first.", "not-card", 409);
    }
    const [pm, stripeAmountCents] = await Promise.all([findCard(order, state), stripePreviewCents(order)]);
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
    };
}

export type ChargeOutcome =
    | { outcome: "paid"; order: OperatorOrder }
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
export async function chargeMotoOrder(order: OperatorOrder, requestedCents: unknown): Promise<ChargeOutcome> {
    if (order.status === "paid" || order.status === "fulfilled") return { outcome: "paid", order };

    const state = await readState(order.id);
    if (!state) throw new MotoError("Choose Enter card first.", "not-card", 409);

    const locked = await getRedis().set(lockKey(order.id), Date.now(), { nx: true, ex: LOCK_TTL_SECONDS });
    if (!locked) throw new MotoError("A charge for this order is already in progress.", "charge-in-progress", 409);

    try {
        const customerId = order.payment?.stripeCustomerId ?? "";

        const existing = await existingSubscription(order, customerId);
        if (existing) return { outcome: "paid", order: await fulfil(order, existing, state) };

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

        const pm = await findCard(order, state);
        if (!pm) throw new MotoError("No card has been added on the Stripe customer page yet.", "no-card", 409);

        const { recurring, onboarding } = prices(order);
        let sub: Stripe.Subscription;
        try {
            sub = await stripe.subscriptions.create(
                {
                    customer: customerId,
                    items: [{ price: recurring }],
                    ...(onboarding ? { add_invoice_items: [{ price: onboarding }] } : {}),
                    default_payment_method: pm.id,
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
                    expand: ["latest_invoice"],
                },
                { idempotencyKey: chargeIdempotencyKey(order.id, state.attempt) },
            );
        } catch (e) {
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
        return { outcome: "paid", order: await fulfil(order, sub, state) };
    } finally {
        await getRedis().del(lockKey(order.id)).catch(() => {});
    }
}

function declineDetail(e: unknown): string {
    const msg = (e as { message?: string })?.message;
    return msg ? ` Stripe said: ${msg}` : "";
}

/** A live subscription this order already made: the charge went through before. */
async function existingSubscription(order: OperatorOrder, customerId: string): Promise<Stripe.Subscription | null> {
    const list = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20, expand: ["data.latest_invoice"] });
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
