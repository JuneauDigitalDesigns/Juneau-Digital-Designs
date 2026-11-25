import { NextResponse } from "next/server";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { resolveSubscriptionId } from "@/app/lib/plan-billing";
import { cardPageConfigured, createCardSession } from "@/app/lib/billing-portal";

export const runtime = "nodejs";

/**
 * Update card (Q4): returns the URL of a Stripe page where the signed-in client changes the card
 * their subscription is charged to. The page comes back to `./return`, which moves the
 * subscription onto the new card before showing the Billing tab again.
 *
 * The Stripe Customer is read from the site's own subscription, never from the request, so a
 * client can only ever reach their own card.
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (!cardPageConfigured()) {
        return NextResponse.json({ error: "Card changes aren't set up yet." }, { status: 503 });
    }

    const subscriptionId = await resolveSubscriptionId(ctx.site);
    if (!subscriptionId) {
        return NextResponse.json({ error: "We couldn't find a subscription for this site." }, { status: 404 });
    }

    try {
        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
        const origin = new URL(request.url).origin;
        const back = `${origin}/api/portal/billing/card/return?site=${encodeURIComponent(ctx.site.slug)}`;
        const url = await createCardSession(customerId, back);
        return NextResponse.json({ ok: true, url });
    } catch (e) {
        console.error("[portal/billing/card] session failed", subscriptionId, e);
        return NextResponse.json({ error: "We couldn't open the card page just now." }, { status: 502 });
    }
}
