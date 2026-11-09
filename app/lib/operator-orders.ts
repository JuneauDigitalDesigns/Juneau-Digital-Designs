import "server-only";
import { Redis } from "@upstash/redis";
import { randomBytes } from "node:crypto";
import {
    canTransition,
    isOrderPaid,
    orderByLeadKey,
    orderKey,
    ORDERS_INDEX_KEY,
    payCodeKey,
    slugClaimKey,
    zOperatorOrder,
    type OperatorOrder,
    type OrderStatus,
} from "@jdd/schema";

/**
 * Operator-order store — a client closed by Xander on a sales call.
 *
 * The shape, the legal status moves and the resume logic live in `@jdd/schema`, shared with
 * the console. This module only does I/O, the same split as `account-store.ts`.
 *
 * Keys:
 *   - `jdd:order:{id}`               the record
 *   - `jdd:order-by-lead:{leadId}`   one open order per lead, so create is idempotent
 *   - `jdd:slug-claim:{slug}`        SET NX, so two orders can't take one slug
 *   - `jdd:pay:{code}`               the short payment link
 *   - `jdd:orders:index`             sorted set by creation time, for listing
 *
 * Retention: an unpaid order is an abandoned close, worth seeing for a while and then not.
 * A paid one is the record of who bought what, and is kept with no TTL.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const DRAFT_TTL_SECONDS = 60 * 60 * 24 * 7;
const UNPAID_TTL_SECONDS = 60 * 60 * 24 * 30;

export function newOrderId(): string {
    return `ord_${randomBytes(9).toString("base64url")}`;
}

/** Six characters with no lookalikes (no 0/O, 1/I/L), so it survives being read aloud. */
export function newPayCode(): string {
    const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
    const bytes = randomBytes(6);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export async function getOrder(id: string): Promise<OperatorOrder | null> {
    const raw = await getRedis().get<unknown>(orderKey(id));
    if (!raw) return null;
    const parsed = zOperatorOrder.safeParse(raw);
    if (!parsed.success) {
        console.error("[operator-orders] invalid order record", id, parsed.error.issues);
        return null;
    }
    return parsed.data;
}

export async function getOrderByLead(leadId: string): Promise<OperatorOrder | null> {
    const id = await getRedis().get<string>(orderByLeadKey(leadId));
    return id ? getOrder(id) : null;
}

/**
 * Write an order. When `prev` is given, the status move is checked against the shared
 * transition table and refused if illegal — the one guard that stops a resumed close from
 * re-accepting terms or charging twice, whatever the caller thinks it is doing.
 */
export async function saveOrder(next: OperatorOrder, prev?: OperatorOrder | null): Promise<OperatorOrder> {
    if (prev && !canTransition(prev.status, next.status)) {
        throw Object.assign(new Error(`Illegal order transition ${prev.status} → ${next.status}`), {
            code: "illegal-transition",
        });
    }
    const record = zOperatorOrder.parse({ ...next, updatedAt: Date.now() });
    const redis = getRedis();
    if (isOrderPaid(record.status)) {
        await redis.set(orderKey(record.id), record);
    } else {
        await redis.set(orderKey(record.id), record, {
            ex: record.status === "draft" ? DRAFT_TTL_SECONDS : UNPAID_TTL_SECONDS,
        });
    }
    await Promise.all([
        redis.set(orderByLeadKey(record.leadId), record.id),
        redis.zadd(ORDERS_INDEX_KEY, { score: record.createdAt, member: record.id }),
    ]);
    return record;
}

/** Status change + an event line, in one write. */
export async function transitionOrder(
    order: OperatorOrder,
    status: OrderStatus,
    event: { kind: string; text: string },
    patch: Partial<OperatorOrder> = {},
): Promise<OperatorOrder> {
    const next: OperatorOrder = {
        ...order,
        ...patch,
        status,
        events: [...order.events, { at: Date.now(), ...event }],
    };
    return saveOrder(next, order);
}

/** Every order newest-first, optionally narrowed. Skips ids whose record has expired. */
export async function listOrders(filter: { status?: OrderStatus[]; unconverted?: boolean } = {}): Promise<OperatorOrder[]> {
    const ids = await getRedis().zrange<string[]>(ORDERS_INDEX_KEY, 0, -1, { rev: true });
    const orders: OperatorOrder[] = [];
    for (const id of ids) {
        const order = await getOrder(id);
        if (!order) continue;
        if (filter.status && !filter.status.includes(order.status)) continue;
        if (filter.unconverted && order.convertedAt) continue;
        orders.push(order);
    }
    return orders;
}

/**
 * Reserve a slug for an order. True when this order holds it (now or already). The claim is
 * what stops two closes in flight from both picking `rivera-plumbing` before either has a
 * portal site or a `clients/` folder to collide with.
 */
export async function claimSlug(slug: string, orderId: string): Promise<boolean> {
    const redis = getRedis();
    const ok = await redis.set(slugClaimKey(slug), orderId, { nx: true });
    if (ok) return true;
    return (await redis.get<string>(slugClaimKey(slug))) === orderId;
}

/** Release a claim, but only this order's — never another order's claim on the same slug. */
export async function releaseSlug(slug: string, orderId: string): Promise<void> {
    const redis = getRedis();
    if ((await redis.get<string>(slugClaimKey(slug))) === orderId) {
        await redis.del(slugClaimKey(slug));
    }
}

const LINK_LOCK_SECONDS = 30;
const linkLockKey = (orderId: string) => `jdd:order-link-lock:${orderId}`;

/**
 * Only one request at a time may open a payment link for an order. "Does it already have a link?"
 * and "create one" are two steps, so two requests at once (two console tabs, or React's dev
 * double effect) both found none and opened two Checkout Sessions, one of them orphaned at
 * Stripe: found in the 2026-11-08 test run.
 */
export async function acquireLinkLock(orderId: string): Promise<boolean> {
    return (await getRedis().set(linkLockKey(orderId), Date.now(), { nx: true, ex: LINK_LOCK_SECONDS })) !== null;
}

export async function releaseLinkLock(orderId: string): Promise<void> {
    await getRedis().del(linkLockKey(orderId));
}

/** The link lock, waiting for a request that holds it to finish. False if it stays busy. */
export async function waitForLinkLock(orderId: string, waitMs = 12_000): Promise<boolean> {
    const deadline = Date.now() + waitMs;
    while (!(await acquireLinkLock(orderId))) {
        if (Date.now() > deadline) return false;
        await new Promise((r) => setTimeout(r, 200));
    }
    return true;
}

const FULFIL_LOCK_SECONDS = 60;
const fulfilLockKey = (orderId: string) => `jdd:order-fulfil-lock:${orderId}`;

/**
 * One fulfilment at a time per order. Stripe delivers webhooks concurrently, and each delivery
 * read the order as not yet fulfilled and sent its own portal invitation: on 2026-11-08 two went
 * out 38 ms apart, the client got one and the order recorded the other, so Resend invite would
 * have revoked the wrong link.
 */
export async function acquireFulfilLock(orderId: string): Promise<boolean> {
    return (await getRedis().set(fulfilLockKey(orderId), Date.now(), { nx: true, ex: FULFIL_LOCK_SECONDS })) !== null;
}

export async function releaseFulfilLock(orderId: string): Promise<void> {
    await getRedis().del(fulfilLockKey(orderId));
}

export async function savePayCode(code: string, orderId: string, expiresAt: number): Promise<void> {
    const ttl = Math.max(60, Math.floor((expiresAt - Date.now()) / 1000));
    await getRedis().set(payCodeKey(code), orderId, { ex: ttl });
}

export async function getOrderIdForPayCode(code: string): Promise<string | null> {
    return getRedis().get<string>(payCodeKey(code));
}

export async function deletePayCode(code: string): Promise<void> {
    await getRedis().del(payCodeKey(code));
}
