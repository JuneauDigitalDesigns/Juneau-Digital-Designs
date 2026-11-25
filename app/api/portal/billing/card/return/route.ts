import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { resolveSubscriptionId } from "@/app/lib/plan-billing";
import { syncCardToSubscriptions } from "@/app/lib/billing-portal";
import { dropBillingCache } from "@/app/lib/portal-kv";

export const runtime = "nodejs";

/**
 * Where Stripe's card page sends the client back. Before showing the Billing tab, every
 * subscription still on the old card is moved onto the new one (`syncCardToSubscriptions`), and
 * the billing cache is dropped so the tab shows the new card at once.
 *
 * A failure here never strands the client: they land on the tab either way, and the
 * `customer.updated` webhook runs the same sync as a backstop.
 */
export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    const slug = new URL(request.url).searchParams.get("site") ?? "";
    const billingPage = new URL(`/portal/settings/billing${slug ? `?site=${encodeURIComponent(slug)}` : ""}`, request.url);
    if (!ctx.ok) return NextResponse.redirect(billingPage, 303);

    try {
        const subscriptionId = await resolveSubscriptionId(ctx.site);
        if (subscriptionId) {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
            const moved = await syncCardToSubscriptions(customerId);
            if (moved.length) console.log("[portal/billing/card] moved onto the new card", moved);
            // Every site this account bills on the same Customer shows the same card.
            for (const s of ctx.account.sites) await dropBillingCache(ctx.account.email, s.slug);
        }
    } catch (e) {
        console.error("[portal/billing/card] sync on return failed", ctx.site.slug, e);
    }
    return NextResponse.redirect(billingPage, 303);
}
