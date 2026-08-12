import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getAccount, saveAccount } from "@/app/lib/account-store";
import { writeSubToSlug } from "@/app/lib/cancel-kv";
import { changeSubscriptionPlan, inspectSubscriptionPlan } from "@/app/lib/plan-billing";
import { upsertSite, type PortalAccount, type PortalPlan, type PortalSite } from "@jdd/schema";

export const runtime = "nodejs";

const VALID_PLANS: PortalPlan[] = ["starter", "growth", "enterprise"];

/**
 * GET — diagnose without touching anything.
 *
 * Returns the plan on the record beside what Stripe is actually billing. The console renders
 * this; it does not work it out for itself, because "what should Growth cost" belongs next to
 * the code that bills it, not copied into an ops tool that can fall out of step.
 */
export async function GET(request: Request) {
    const gate = authorize(request);
    if (gate) return gate;

    const url = new URL(request.url);
    const email = url.searchParams.get("email")?.trim();
    const slug = url.searchParams.get("slug")?.trim();
    if (!email || !slug) {
        return NextResponse.json({ error: "email and slug are required." }, { status: 400 });
    }

    const found = await findSite(email, slug);
    if ("response" in found) return found.response;

    const inspection = await inspectSubscriptionPlan(found.site, found.site.plan);
    return NextResponse.json({ ok: true, recordPlan: found.site.plan, ...inspection });
}

/**
 * Operator entry point: make Stripe match the plan already on the portal record.
 *
 * The ops console can change a client's tier in KV, but never touches Stripe — it has no auth
 * of any kind and deliberately runs on a restricted read-only Stripe key. So a plan can be
 * changed there and the billing silently left behind, which is how a client ends up using
 * Growth while paying for Starter. This is the console's way to close that gap without
 * holding a write-capable key itself.
 *
 * **No agreement is required here, unlike the client-facing upgrade.** This repairs billing
 * against a tier an operator already set deliberately; demanding a client signature to correct
 * our own mispricing would make the tool unusable at exactly the moment it's needed. The
 * console records the action in its audit log.
 *
 * Authenticated by a shared secret rather than Clerk, because the caller is a machine, not a
 * signed-in client. Same posture as the Stripe webhook.
 */
export async function POST(request: Request) {
    const gate = authorize(request);
    if (gate) return gate;

    let body: { email?: string; slug?: string; plan?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }

    const email = body.email?.trim();
    const slug = body.slug?.trim();
    const plan = body.plan?.trim();

    if (!email || !slug) {
        return NextResponse.json({ error: "email and slug are required." }, { status: 400 });
    }
    if (!plan || !VALID_PLANS.includes(plan as PortalPlan)) {
        return NextResponse.json({ error: "Unknown plan." }, { status: 400 });
    }
    const targetPlan = plan as PortalPlan;

    const found = await findSite(email, slug);
    if ("response" in found) return found.response;
    const { account, site } = found;

    // The caller states the plan it expects to bill, and we check it against the record rather
    // than trusting it. Syncing billing to a tier the portal doesn't actually show would just
    // move the drift rather than fix it.
    if (site.plan !== targetPlan) {
        return NextResponse.json(
            {
                error: `The portal record says "${site.plan}", not "${targetPlan}". Set the plan first, then sync billing.`,
                recordPlan: site.plan,
            },
            { status: 409 },
        );
    }

    const result = await changeSubscriptionPlan({
        slug: site.slug,
        accountEmail: account.email,
        site,
        targetPlan,
        initiatedBy: "operator",
    });

    if (!result.ok) {
        return NextResponse.json({ error: result.message, code: result.code }, { status: 409 });
    }

    const subscriptionId = result.subscriptionId;
    await saveAccount(
        upsertSite(account, { slug: site.slug, stripeSubscriptionId: subscriptionId }, Date.now()),
    );
    try {
        await writeSubToSlug(subscriptionId, site.slug);
    } catch (e) {
        console.error("[ops/plan-sync] sub-to-slug index write failed", subscriptionId, e);
    }

    console.log(
        "[ops/plan-sync]",
        result.changed ? "billing updated" : "already correct",
        account.email,
        site.slug,
        targetPlan,
    );

    return NextResponse.json({
        ok: true,
        changed: result.changed,
        subscriptionId,
        plan: targetPlan,
    });
}

/** Returns a response to send when the caller is not authorised, or null to continue. */
function authorize(request: Request): NextResponse | null {
    const expected = process.env.OPS_SHARED_SECRET;
    if (!expected) {
        // Fail closed. An unset secret must never mean "no check required" on a route that
        // can re-price a subscription.
        console.error("[ops/plan-sync] OPS_SHARED_SECRET is not set — refusing");
        return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }
    if (!secretMatches(request.headers.get("x-ops-secret"), expected)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

/** Constant-time compare so the secret can't be probed a byte at a time. */
function secretMatches(provided: string | null, expected: string): boolean {
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}

type FoundSite = { account: PortalAccount; site: PortalSite } | { response: NextResponse };

async function findSite(email: string, slug: string): Promise<FoundSite> {
    const account = await getAccount(email);
    if (!account) {
        return {
            response: NextResponse.json({ error: "No portal account for that email." }, { status: 404 }),
        };
    }
    const site = account.sites.find((s) => s.slug === slug);
    if (!site) {
        return {
            response: NextResponse.json({ error: "That account has no such site." }, { status: 404 }),
        };
    }
    return { account, site };
}
