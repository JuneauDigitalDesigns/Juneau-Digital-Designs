import "server-only";
import { Redis } from "@upstash/redis";
import type { OperatorOrder } from "@jdd/schema";
import { getAccount } from "./account-store";
import { getAddendumForPlan, getSchedule, getTermsForPlan } from "./legal";
import type { Section } from "./legal/types";
import { accountFacts } from "./operator-order-input";
import { getOrder, transitionOrder } from "./operator-orders";
import { recordClickwrapOrderAcceptance, termsHashForOrder } from "./verbal-agreement";
import { agreementLinkState, newAgreeCode, orderDocFingerprint } from "./agreement-link.mjs";

/**
 * The private link an order's client uses to read and agree to the full agreement themselves,
 * instead of having a summary read to them on the call.
 *
 * The link lives beside the order, not on it: the order's shape belongs to `@jdd/schema`, whose
 * parser drops fields it doesn't know, and this state is the agency's alone.
 *
 * Agreeing records the same `AgreementRecord` a verbal acceptance does, through the same code, so
 * fulfilment attaches it to the account and site with no idea which path produced it.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const LINK_TTL_SECONDS = 60 * 60 * 24;
/** Kept a week once used, so the client reloading the page still sees it was recorded. */
const ACCEPTED_TTL_SECONDS = 60 * 60 * 24 * 7;
const TERMS_LOCK_SECONDS = 60;

const linkKey = (code: string) => `jdd:agree:${code}`;
const orderLinkKey = (orderId: string) => `jdd:order-agree:${orderId}`;
const termsLockKey = (orderId: string) => `jdd:order-terms-lock:${orderId}`;

export interface AgreementLink {
    orderId: string;
    fingerprint: string;
    createdAt: number;
    expiresAt: number;
    acceptedAt?: number;
}

/**
 * Only one acceptance at a time per order. Read aloud and the client's own page can land together,
 * and each would otherwise find the order still in draft and write its own agreement.
 */
export async function withTermsLock<T>(orderId: string, fn: () => Promise<T>): Promise<T | null> {
    const held = await getRedis().set(termsLockKey(orderId), Date.now(), { nx: true, ex: TERMS_LOCK_SECONDS });
    if (held === null) return null;
    try {
        return await fn();
    } finally {
        await getRedis().del(termsLockKey(orderId)).catch(() => {});
    }
}

async function fingerprintFor(order: OperatorOrder): Promise<{ fingerprint: string; kind: "master" | "addendum"; termsHash: string; parentAgreementId?: string }> {
    const facts = accountFacts(await getAccount(order.client.email), order);
    const termsHash = termsHashForOrder(order, facts.agreementKind);
    return {
        fingerprint: orderDocFingerprint(order, termsHash),
        kind: facts.agreementKind,
        termsHash,
        ...(facts.parentAgreementId ? { parentAgreementId: facts.parentAgreementId } : {}),
    };
}

async function readLink(code: string): Promise<AgreementLink | null> {
    return getRedis().get<AgreementLink>(linkKey(code));
}

/**
 * The order's link. Reuses a live one unless `fresh` asks for a replacement (which kills the old
 * one) or the order has changed since it was made.
 */
export async function createAgreementLink(order: OperatorOrder, opts: { fresh?: boolean } = {}): Promise<{ code: string; expiresAt: number }> {
    const { fingerprint } = await fingerprintFor(order);
    const redis = getRedis();
    const currentCode = await redis.get<string>(orderLinkKey(order.id));
    if (currentCode) {
        const current = await readLink(currentCode);
        if (!opts.fresh && current && agreementLinkState({ link: current, order, fingerprint, nowMs: Date.now() }) === "active") {
            return { code: currentCode, expiresAt: current.expiresAt };
        }
        await redis.del(linkKey(currentCode));
    }
    const code = newAgreeCode();
    const createdAt = Date.now();
    const expiresAt = createdAt + LINK_TTL_SECONDS * 1000;
    const link: AgreementLink = { orderId: order.id, fingerprint, createdAt, expiresAt };
    await Promise.all([
        redis.set(linkKey(code), link, { ex: LINK_TTL_SECONDS }),
        redis.set(orderLinkKey(order.id), code, { ex: LINK_TTL_SECONDS }),
    ]);
    return { code, expiresAt };
}

/** Everything the client's page needs, or just the state when there's nothing to show. */
export async function resolveAgreementLink(code: string): Promise<
    | { state: "inactive" }
    | { state: "accepted"; order: OperatorOrder }
    | { state: "active"; order: OperatorOrder; sections: Section[]; termsHash: string; version: string }
> {
    const link = await readLink(code);
    const order = link ? await getOrder(link.orderId) : null;
    if (!link || !order) return { state: "inactive" };
    const { fingerprint, kind, termsHash } = await fingerprintFor(order);
    const state = agreementLinkState({ link, order, fingerprint, nowMs: Date.now() });
    if (state === "inactive") return { state };
    if (state === "accepted") return { state, order };
    const doc =
        kind === "addendum"
            ? getAddendumForPlan(getSchedule(order.plan))
            : getTermsForPlan(order.plan, { webOnly: order.plan === "starter" && order.receptionistMode === "declined" });
    return { state, order, sections: doc.sections, termsHash, version: doc.version };
}

export class AgreementLinkError extends Error {
    constructor(message: string, readonly code: string, readonly status = 409) {
        super(message);
    }
}

/**
 * The client ticked the box. Re-checks everything under the lock, records the agreement the same
 * way a verbal one is recorded, moves the order on, and marks the link used.
 */
export async function acceptAgreementLink(
    code: string,
    input: { pageOpenedAt: string; scrollCompletedAt: string; ip: string; userAgent: string; path: string },
) {
    const link = await readLink(code);
    if (!link) throw new AgreementLinkError("This link is no longer active.", "inactive", 410);

    const outcome = await withTermsLock(link.orderId, async () => {
        const order = await getOrder(link.orderId);
        if (!order) throw new AgreementLinkError("This link is no longer active.", "inactive", 410);
        const { fingerprint, kind, parentAgreementId } = await fingerprintFor(order);
        const fresh = await readLink(code);
        const state = agreementLinkState({ link: fresh, order, fingerprint, nowMs: Date.now() });
        if (state === "accepted") return { order, result: null };
        if (state !== "active") throw new AgreementLinkError("This link is no longer active.", "inactive", 410);

        const result = await recordClickwrapOrderAcceptance(order, {
            kind,
            ...(parentAgreementId ? { parentAgreementId } : {}),
            ...input,
        });
        const saved = await transitionOrder(
            order,
            "terms-accepted",
            { kind: "terms-accepted", text: `Terms ${result.record.agreementVersion} accepted online` },
            { agreementId: result.record.id, agreementKind: kind },
        );
        await getRedis().set(linkKey(code), { ...link, acceptedAt: Date.now() }, { ex: ACCEPTED_TTL_SECONDS });
        return { order: saved, result };
    });
    if (!outcome) throw new AgreementLinkError("This agreement is being recorded. Reload the page in a moment.", "in-progress");
    return outcome;
}
