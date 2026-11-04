import { NextResponse } from "next/server";
import type { PortalAccount, PortalSite } from "@jdd/schema";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getAccount } from "@/app/lib/account-store";
import { downgradePreview, releaseScheduledChange } from "@/app/lib/plan-billing";
import { getPlanChange, isPendingPlanChange, savePlanChange, type PlanChangeRecord } from "@/app/lib/plan-change";
import { sendDowngradeAcceptEmail } from "@/app/lib/plan-change-email";
import { dropBillingCache } from "@/app/lib/portal-kv";

export const runtime = "nodejs";

/**
 * Operator entry point for a client-requested downgrade (Growth → Starter).
 *
 * The console calls this instead of flipping the plan itself. Contract v5.3 §15.4 puts a
 * downgrade at the end of the period the client has paid for, with no credit, and §15.2 has the
 * client accept a new agreement for the new plan. So nothing changes here except that the
 * request is recorded and the client is emailed a link to accept the Starter terms. Their
 * acceptance (`/api/portal/downgrade`) creates the Stripe schedule, and the price moves at the
 * period end, when the webhook moves `PortalSite.plan`.
 *
 *   GET     ?email&slug           the pending change, if any
 *   POST    { email, slug, plan } ask for it (re-POSTing while awaiting acceptance re-sends the email)
 *   DELETE  { email, slug }       withdraw it, releasing the Stripe schedule if one was made
 *
 * Same shared secret as plan-sync. The console never writes to Stripe.
 */

const SUPPORTED: Record<string, PortalSite["plan"]> = { starter: "growth" };

export async function GET(request: Request) {
    const gate = authorizeOps(request, "OPS_SHARED_SECRET", "ops/plan-change");
    if (gate) return gate;

    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim();
    const slug = url.searchParams.get("slug")?.trim();
    if (!email || !slug) {
        return NextResponse.json({ error: "email and slug are required." }, { status: 400 });
    }
    const found = await findSite(email, slug);
    if ("response" in found) return found.response;

    const record = await getPlanChange(found.account.email, slug);
    return NextResponse.json({ ok: true, recordPlan: found.site.plan, planChange: record });
}

export async function POST(request: Request) {
    const gate = authorizeOps(request, "OPS_SHARED_SECRET", "ops/plan-change");
    if (gate) return gate;

    let body: { email?: string; slug?: string; plan?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const email = body.email?.trim();
    const slug = body.slug?.trim();
    const toPlan = body.plan?.trim() ?? "";
    if (!email || !slug) {
        return NextResponse.json({ error: "email and slug are required." }, { status: 400 });
    }
    const requiredFrom = SUPPORTED[toPlan];
    if (!requiredFrom) {
        return NextResponse.json({ error: "Only a downgrade to starter can be scheduled here." }, { status: 400 });
    }

    const found = await findSite(email, slug);
    if ("response" in found) return found.response;
    const { account, site } = found;

    if (site.plan !== requiredFrom) {
        return NextResponse.json(
            { error: `The portal record says "${site.plan}", so there is no ${requiredFrom} → ${toPlan} change to make.` },
            { status: 409 },
        );
    }
    if (site.cancelRequestedAt) {
        return NextResponse.json({ error: "This site is already set to cancel." }, { status: 409 });
    }

    const existing = await getPlanChange(account.email, slug);
    if (existing?.status === "scheduled") {
        return NextResponse.json(
            { error: "A downgrade is already scheduled for this site.", planChange: existing },
            { status: 409 },
        );
    }

    // Read the subscription now so the date in the email is the one the schedule will use.
    const preview = await downgradePreview(site, toPlan as PortalSite["plan"]);
    if (!preview.ok) {
        return NextResponse.json({ error: preview.message, code: preview.code }, { status: 409 });
    }

    const now = Date.now();
    const record: PlanChangeRecord = {
        accountEmail: account.email,
        slug,
        fromPlan: site.plan,
        toPlan: toPlan as PortalSite["plan"],
        status: "awaiting-acceptance",
        effectiveAt: preview.effectiveAt,
        interval: preview.interval,
        subscriptionId: preview.subscriptionId,
        requestedAt: existing?.status === "awaiting-acceptance" ? existing.requestedAt : now,
        requestedBy: "operator",
        updatedAt: now,
    };
    await savePlanChange(record);

    const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;
    await sendDowngradeAcceptEmail({
        to: account.email,
        siteName: site.name ?? site.slug,
        fromPlan: record.fromPlan,
        toPlan: record.toPlan,
        effectiveAt: record.effectiveAt,
        interval: record.interval,
        acceptUrl: `${origin}/agreement?plan=${record.toPlan}&downgrade=${encodeURIComponent(slug)}`,
    });

    console.log("[ops/plan-change] downgrade requested", account.email, slug, record.toPlan, record.effectiveAt);
    return NextResponse.json({ ok: true, planChange: record });
}

export async function DELETE(request: Request) {
    const gate = authorizeOps(request, "OPS_SHARED_SECRET", "ops/plan-change");
    if (gate) return gate;

    let body: { email?: string; slug?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const email = body.email?.trim();
    const slug = body.slug?.trim();
    if (!email || !slug) {
        return NextResponse.json({ error: "email and slug are required." }, { status: 400 });
    }
    const found = await findSite(email, slug);
    if ("response" in found) return found.response;

    const record = await getPlanChange(found.account.email, slug);
    if (!isPendingPlanChange(record)) {
        return NextResponse.json({ error: "There is no pending plan change for this site." }, { status: 404 });
    }

    if (record.status === "scheduled") {
        try {
            await releaseScheduledChange(record.subscriptionId);
        } catch (e) {
            console.error("[ops/plan-change] release failed", record.subscriptionId, e);
            return NextResponse.json(
                { error: "Stripe would not release the schedule, so the change is still scheduled." },
                { status: 502 },
            );
        }
    }
    const cancelled: PlanChangeRecord = { ...record, status: "cancelled" };
    await savePlanChange(cancelled);
    await dropBillingCache(found.account.email, slug);
    console.log("[ops/plan-change] withdrawn", found.account.email, slug);
    return NextResponse.json({ ok: true, planChange: cancelled });
}

type FoundSite = { account: PortalAccount; site: PortalSite } | { response: NextResponse };

async function findSite(email: string, slug: string): Promise<FoundSite> {
    const account = await getAccount(email);
    if (!account) {
        return { response: NextResponse.json({ error: "No portal account for that email." }, { status: 404 }) };
    }
    const site = account.sites.find((s) => s.slug === slug);
    if (!site) {
        return { response: NextResponse.json({ error: "That account has no such site." }, { status: 404 }) };
    }
    return { account, site };
}
