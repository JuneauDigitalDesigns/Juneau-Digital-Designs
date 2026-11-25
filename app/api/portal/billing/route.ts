import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { planItemOfSubscription, subscriptionPeriod } from "@/app/lib/plan-billing";
import { getPlanChange } from "@/app/lib/plan-change";
import { accountScope, billingKey, getCached, setCached, BILLING_TTL } from "@/app/lib/portal-kv";
import { billingStatus, type BillingStatusKind } from "@/app/lib/billing-tab";
import { cardOnFile } from "@/app/lib/billing-card";
import { cardPageConfigured } from "@/app/lib/billing-portal";

export const runtime = "nodejs";

/**
 * Read-only billing summary for Settings › Plan & billing.
 *
 * The portal already had cancellation but no way to see what you were paying, when you'd
 * next be charged, or what you'd been charged before — so the only money-related thing a
 * client could do was quit. This is the other half.
 *
 * Nothing here mutates. Cancellation stays in its own route, behind its type-the-name
 * confirmation, and the card change goes through Stripe's own page (`/api/portal/billing/card`).
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

interface InvoiceRow {
    id: string;
    number: string | null;
    created: number;
    amountPaid: number;
    amountRemaining: number;
    currency: string;
    status: string | null;
    url: string | null;
    pdf: string | null;
}

/**
 * The Next payment tile: the real next invoice, not the list price.
 *
 * - Active: Stripe's preview of the renewal invoice, so call-minute overage already waiting to
 *   be billed is in it. The tile used to show the plan price, which hid the overage until it
 *   was charged.
 * - Payment overdue: what is still owed on the open invoice, "due now".
 * - Cancelling, cancelled or inactive: none (the tile says so in approved words).
 */
async function nextPaymentFor(
    sub: Stripe.Subscription,
    kind: BillingStatusKind,
    invoices: InvoiceRow[],
    period: { start: number; end: number } | null,
): Promise<{ amount: number; currency: string; dueAt: number | null; dueNow: boolean } | null> {
    if (kind === "overdue") {
        const open = invoices.find((i) => i.status === "open" && i.amountRemaining > 0);
        return open ? { amount: open.amountRemaining, currency: open.currency, dueAt: null, dueNow: true } : null;
    }
    if (kind !== "active") return null;
    try {
        const preview = await stripe.invoices.createPreview({ subscription: sub.id });
        return {
            amount: preview.amount_due,
            currency: preview.currency,
            dueAt: period ? period.end * 1000 : null,
            dueNow: false,
        };
    } catch (e) {
        // The tile falls back to the plan price rather than the page failing.
        console.error("[portal/billing] invoice preview failed", sub.id, e);
        return null;
    }
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // Billing changes at most monthly, and this is a few Stripe round trips. Account-scoped:
    // the payload carries amounts, card last-4 and invoice links.
    const cacheKey = billingKey(accountScope(ctx.account.email), ctx.site.slug);
    const hit = await getCached<Record<string, unknown>>(cacheKey);
    if (hit) return NextResponse.json(hit);

    const subscriptionId = await resolveSubscriptionId(ctx.site);

    // A client pays monthly from checkout, so a site still being built has a subscription, and
    // the tab shows it like any other (Q5: they can cancel it too). Only a site with nothing to
    // show yet gets the "once your site is live" note. This used to return that note for every
    // site that wasn't live, subscription or not.
    if (!subscriptionId && ctx.site.status !== "live") {
        return NextResponse.json({ state: "pending-build", plan: ctx.site.plan });
    }

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
            // Both, so the card shown is the one Stripe will charge (`cardOnFile`).
            expand: ["default_payment_method", "customer.invoice_settings.default_payment_method"],
        });
    } catch (e) {
        console.error("[portal/billing] subscription retrieve failed", subscriptionId, e);
        return NextResponse.json(
            { state: "error", error: "We couldn't load your billing details just now." },
            { status: 502 },
        );
    }

    // The plan's price, not whichever item Stripe lists first: an add-on can sit beside it.
    const price = planItemOfSubscription(sub)?.price;

    // Nullable on purpose: this used to multiply the raw field by 1000, and once Stripe moved
    // it onto the subscription item that produced `NaN` as the client's renewal date.
    const period = subscriptionPeriod(sub);

    const planChange = await getPlanChange(ctx.account.email, ctx.site.slug);
    const card = cardOnFile(sub);
    const status = billingStatus({
        status: sub.status,
        cancelAt: sub.cancel_at ? sub.cancel_at * 1000 : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        periodEnd: period ? period.end * 1000 : null,
        requestedEndsAt: ctx.site.cancelEffectiveAt ?? null,
    });

    let invoices: InvoiceRow[] = [];
    try {
        const list = await stripe.invoices.list({ subscription: subscriptionId, limit: 12 });
        invoices = list.data.map((inv) => ({
            id: inv.id ?? "",
            number: inv.number ?? null,
            created: inv.created * 1000,
            amountPaid: inv.amount_paid,
            amountRemaining: inv.amount_remaining,
            currency: inv.currency,
            status: inv.status ?? null,
            // Stripe's hosted invoice page: the tab's "View" link, beside "PDF".
            url: inv.hosted_invoice_url ?? null,
            pdf: inv.invoice_pdf ?? null,
        }));
    } catch (e) {
        // A missing invoice history shouldn't hide the plan and next-charge date.
        console.error("[portal/billing] invoice list failed", subscriptionId, e);
    }

    const nextPayment = await nextPaymentFor(sub, status.kind, invoices, period);

    // Enterprise: one subscription pays for every site on it, so the tab lists them all.
    const sitesOnPlan =
        ctx.site.plan === "enterprise"
            ? ctx.account.sites
                  .filter((s) => s.plan === "enterprise" && (s.stripeSubscriptionId === subscriptionId || s.slug === ctx.site.slug))
                  .map((s) => s.name ?? s.slug)
            : [];

    const payload = {
        state: "ready",
        plan: ctx.site.plan,
        status: sub.status,
        statusKind: status.kind,
        endsAt: status.endsAt ?? null,
        amount: price?.unit_amount ?? null,
        currency: price?.currency ?? "usd",
        interval: price?.recurring?.interval ?? null,
        currentPeriodStart: period ? period.start * 1000 : null,
        currentPeriodEnd: period ? period.end * 1000 : null,
        cancelAt: sub.cancel_at ? sub.cancel_at * 1000 : null,
        // For "Your subscription ended on {date}.": when Stripe actually ended it.
        endedAt: sub.ended_at ? sub.ended_at * 1000 : null,
        nextPayment,
        sitesOnPlan,
        // Q4: "Update card" only shows when the Stripe card page is set up for it.
        canUpdateCard: cardPageConfigured(),
        // Only once accepted and scheduled: a request still awaiting the client's acceptance
        // is not a change they have agreed to.
        pendingPlanChange:
            planChange?.status === "scheduled"
                ? { fromPlan: planChange.fromPlan, toPlan: planChange.toPlan, effectiveAt: planChange.effectiveAt }
                : null,
        paymentMethod: card,
        invoices,
        fetchedAt: Date.now(),
    };

    // Only the ready payload is cached — the error branches above return without touching
    // the cache, so a Stripe blip isn't replayed for twelve hours.
    await setCached(cacheKey, BILLING_TTL, payload);
    return NextResponse.json(payload);
}
