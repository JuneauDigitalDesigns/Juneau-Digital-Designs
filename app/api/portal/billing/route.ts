import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope, billingKey, getCached, setCached, BILLING_TTL } from "@/app/lib/portal-kv";

export const runtime = "nodejs";

/**
 * Read-only billing summary.
 *
 * The portal already had cancellation but no way to see what you were paying, when you'd
 * next be charged, or what you'd been charged before — so the only money-related thing a
 * client could do was quit. This is the other half.
 *
 * Nothing here mutates. Cancellation stays in its own route, behind its type-the-name
 * confirmation.
 */

/** Resolve the subscription id, falling back to the checkout session for older records. */
async function resolveSubscriptionId(site: {
    stripeSubscriptionId?: string;
    sessionId?: string;
}): Promise<string | null> {
    if (site.stripeSubscriptionId) return site.stripeSubscriptionId;
    if (!site.sessionId) return null;

    // Same lazy resolution the cancel route does — a record created before the
    // subscription id was persisted can still find it via the checkout session.
    try {
        const session = await stripe.checkout.sessions.retrieve(site.sessionId, {
            expand: ["subscription"],
        });
        const sub = session.subscription;
        return sub && typeof sub === "object" && "id" in sub ? sub.id : null;
    } catch (e) {
        console.error("[portal/billing] session lookup failed", site.sessionId, e);
        return null;
    }
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // A site that hasn't gone live has no billing story worth telling yet.
    if (ctx.site.status !== "live") {
        return NextResponse.json({ state: "pending-build", plan: ctx.site.plan });
    }

    // Billing changes at most monthly, and this is two Stripe round trips. Account-scoped:
    // the payload carries amounts, card last-4 and invoice links.
    const cacheKey = billingKey(accountScope(ctx.account.email), ctx.site.slug);
    const hit = await getCached<Record<string, unknown>>(cacheKey);
    if (hit) return NextResponse.json(hit);

    const subscriptionId = await resolveSubscriptionId(ctx.site);
    if (!subscriptionId) {
        // Two very different situations hide behind "no subscription", and telling them
        // apart matters: one is our unfinished work, the other is a permanent fact.
        //
        //   Went through checkout (sessionId / customer on file) but we can't resolve the
        //   subscription  → we lost the link. Ours to fix, and we say so.
        //
        //   No trace of checkout at all → this site is not billed through the portal.
        //   Comped accounts, manually-invoiced clients, and provisioning test sites all
        //   land here. Promising them we're "finishing setup" is a promise nothing will
        //   ever keep.
        const everPaid = Boolean(ctx.site.sessionId || ctx.site.stripeCustomerId);
        return NextResponse.json({
            state: everPaid ? "connecting" : "not-billed",
            plan: ctx.site.plan,
        });
    }

    let sub: Stripe.Subscription;
    try {
        sub = await stripe.subscriptions.retrieve(subscriptionId, {
            expand: ["default_payment_method"],
        });
    } catch (e) {
        console.error("[portal/billing] subscription retrieve failed", subscriptionId, e);
        return NextResponse.json(
            { state: "error", error: "We couldn't load your billing details just now." },
            { status: 502 },
        );
    }

    const item = sub.items.data[0];
    const price = item?.price;

    // The SDK's intersection type drops these in some TS configs — same cast the cancel
    // route uses.
    const periods = sub as unknown as { current_period_end: number };

    const pm = sub.default_payment_method;
    const card = pm && typeof pm === "object" && "card" in pm ? pm.card : null;

    let invoices: Array<{
        id: string;
        number: string | null;
        created: number;
        amountPaid: number;
        currency: string;
        status: string | null;
        url: string | null;
        pdf: string | null;
    }> = [];

    try {
        const list = await stripe.invoices.list({ subscription: subscriptionId, limit: 12 });
        invoices = list.data.map((inv) => ({
            id: inv.id ?? "",
            number: inv.number ?? null,
            created: inv.created * 1000,
            amountPaid: inv.amount_paid,
            currency: inv.currency,
            status: inv.status ?? null,
            url: inv.hosted_invoice_url ?? null,
            pdf: inv.invoice_pdf ?? null,
        }));
    } catch (e) {
        // A missing invoice history shouldn't hide the plan and next-charge date.
        console.error("[portal/billing] invoice list failed", subscriptionId, e);
    }

    const payload = {
        state: "ready",
        plan: ctx.site.plan,
        status: sub.status,
        amount: price?.unit_amount ?? null,
        currency: price?.currency ?? "usd",
        interval: price?.recurring?.interval ?? null,
        currentPeriodEnd: periods.current_period_end * 1000,
        cancelAt: sub.cancel_at ? sub.cancel_at * 1000 : null,
        paymentMethod: card ? { brand: card.brand, last4: card.last4, expMonth: card.exp_month, expYear: card.exp_year } : null,
        invoices,
        fetchedAt: Date.now(),
    };

    // Only the ready payload is cached — the error branches above return without touching
    // the cache, so a Stripe blip isn't replayed for twelve hours.
    await setCached(cacheKey, BILLING_TTL, payload);
    return NextResponse.json(payload);
}
