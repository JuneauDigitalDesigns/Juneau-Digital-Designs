import { NextResponse } from "next/server";
import { upsertSite } from "@jdd/schema";
import { Resend } from "resend";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeCancelSignal, writeSubToSlug } from "@/app/lib/cancel-kv";
import { releaseScheduledChange, subscriptionPeriod } from "@/app/lib/plan-billing";
import { billingIntervalOf } from "@/app/lib/billing-periods.mjs";
import { getPlanChange, isPendingPlanChange, savePlanChange } from "@/app/lib/plan-change";
import { dropBillingCache } from "@/app/lib/portal-kv";
import { CANCEL_EMAIL_ACCESS, CANCEL_EMAIL_NOTICE, cancelEmailFooter } from "@/app/lib/plan-change-copy";
import { brandedEmailHtml } from "@/app/lib/email-template";
import { EMAIL, EMAIL_FONT } from "@/app/lib/email-tokens";
import { SCHEDULES } from "@/app/lib/legal/schedules";
import type { PortalPlan } from "@jdd/schema";

export const runtime = "nodejs";

/** Seconds in one day. */
const DAY_S = 86_400;

/**
 * The first billing period boundary at or after `target` (unix seconds).
 * Steps forward from `current_period_end` by one period at a time.
 */
function firstBoundaryAtOrAfter(
    currentPeriodStart: number,
    currentPeriodEnd: number,
    target: number,
): number {
    const periodDuration = currentPeriodEnd - currentPeriodStart;
    let boundary = currentPeriodEnd;
    while (boundary < target) {
        boundary += periodDuration;
    }
    return boundary;
}

function formatDate(unixMs: number): string {
    return new Date(unixMs).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
    });
}

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // Only live sites can be cancelled — a "building" site has no subscription to cancel.
    if (ctx.site.status !== "live") {
        return NextResponse.json({ error: "Site is not active" }, { status: 409 });
    }

    // Reject if already cancelled.
    if (ctx.site.cancelRequestedAt) {
        return NextResponse.json(
            {
                error: "Cancellation already requested",
                effectiveAt: ctx.site.cancelEffectiveAt,
            },
            { status: 409 },
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const { confirm } = body as Record<string, unknown>;
    const siteName = ctx.site.name ?? ctx.site.slug;

    // The confirm field must match the site's business name (case-insensitive).
    if (typeof confirm !== "string" || confirm.trim().toLowerCase() !== siteName.toLowerCase()) {
        return NextResponse.json({ error: "Business name does not match, so cancellation is blocked" }, { status: 422 });
    }

    // ── Resolve the Stripe subscription ──────────────────────────────────────

    let subscriptionId = ctx.site.stripeSubscriptionId;
    let customerId = ctx.site.stripeCustomerId;

    if (!subscriptionId && ctx.site.sessionId) {
        // First cancellation for a pre-feature record — resolve via the checkout session.
        try {
            const session = await stripe.checkout.sessions.retrieve(ctx.site.sessionId, {
                expand: ["subscription"],
            });
            const sub = session.subscription;
            if (sub && typeof sub === "object" && "id" in sub) {
                subscriptionId = sub.id;
                customerId = typeof session.customer === "string"
                    ? session.customer
                    : (session.customer as { id: string } | null)?.id;
            }
        } catch (e) {
            console.error("[portal/cancel] failed to resolve subscription from session", ctx.site.sessionId, e);
        }
    }

    if (!subscriptionId) {
        return NextResponse.json(
            { error: "Could not find a subscription to cancel. Please contact support." },
            { status: 400 },
        );
    }

    // ── Compute the cancel_at boundary ───────────────────────────────────────

    const plan = ctx.site.plan as PortalPlan;
    /**
     * Zero on every plan since 2026-10-12: month to month, no minimum term.
     *
     * The arithmetic below degenerates correctly rather than needing to change. At 0 the
     * target is now, so `firstBoundaryAtOrAfter` returns the end of the period the client has
     * already paid for, which is exactly the contracted behaviour.
     *
     * The fallback is 0, not 30. A `?? 30` would reintroduce a 30-day notice period for any
     * plan slug this lookup failed to resolve, which is the one direction the mistake is
     * expensive: it would bill a cancelling client for a month the agreement does not entitle
     * us to.
     */
    const noticeDays = SCHEDULES[plan]?.cancellationNoticeDays ?? 0;

    let sub: Awaited<ReturnType<typeof stripe.subscriptions.retrieve>>;
    try {
        sub = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (e) {
        console.error("[portal/cancel] failed to retrieve subscription", subscriptionId, e);
        return NextResponse.json({ error: "Could not retrieve subscription. Please contact support." }, { status: 500 });
    }

    // Refuse rather than guess. This previously read the period through a cast, and once
    // Stripe moved those fields onto the subscription item it silently became `NaN`, which
    // would schedule a cancellation at an unknown date. A notice period is a contract term,
    // so an unresolvable period is an error, not something to default through.
    const period = subscriptionPeriod(sub);
    if (!period) {
        console.error("[portal/cancel] no billing period on subscription", subscriptionId);
        return NextResponse.json(
            { error: "Could not determine your billing period. Please contact support." },
            { status: 500 },
        );
    }

    const recurringItem = sub.items.data.find((i) => i.price.recurring !== null);
    const interval = billingIntervalOf(recurringItem?.price.recurring);

    const nowS = Math.floor(Date.now() / 1000);
    const target = nowS + noticeDays * DAY_S;
    const cancelAtS = firstBoundaryAtOrAfter(period.start, period.end, target);

    // ── Schedule cancellation in Stripe ──────────────────────────────────────

    try {
        // A downgrade scheduled for the period end is superseded: the subscription now ends
        // then instead. A subscription still attached to a schedule is managed by it, so it is
        // released first, and the pending change is marked withdrawn.
        if (sub.schedule) {
            await releaseScheduledChange(subscriptionId);
            const pending = await getPlanChange(ctx.account.email, ctx.site.slug);
            if (isPendingPlanChange(pending)) await savePlanChange({ ...pending, status: "cancelled" });
        }
        await stripe.subscriptions.update(subscriptionId, {
            cancel_at: cancelAtS,
        });
    } catch (e) {
        console.error("[portal/cancel] stripe update failed", subscriptionId, e);
        return NextResponse.json({ error: "Failed to schedule cancellation. Please contact support." }, { status: 500 });
    }

    // ── Persist to the account record ────────────────────────────────────────

    const now = Date.now();
    const effectiveAtMs = cancelAtS * 1000;

    /**
     * Every site the subscription pays for ends on that date, not just the one the client
     * cancelled from. On Enterprise one subscription covers every site in the bundle (the card
     * says so), and marking only one left the rest reading live, with no billing behind them and
     * no teardown signal. Starter and Growth have one site per subscription, so this is just
     * that site.
     */
    const ending = ctx.account.sites.filter(
        (s) =>
            s.slug === ctx.site.slug ||
            (ctx.site.plan === "enterprise" && s.plan === "enterprise" && s.stripeSubscriptionId === subscriptionId),
    );

    let accountWithSub = ctx.account;
    for (const s of ending) {
        accountWithSub = upsertSite(accountWithSub, {
            slug: s.slug,
            stripeSubscriptionId: subscriptionId,
            ...(customerId ? { stripeCustomerId: customerId } : {}),
            cancelRequestedAt: now,
            cancelEffectiveAt: effectiveAtMs,
        }, now);
    }
    await saveAccount(accountWithSub);

    // ── Write cancel signal + reverse index ──────────────────────────────────

    for (const s of ending) {
        await writeCancelSignal({
            slug: s.slug,
            siteName: s.name ?? s.slug,
            plan: s.plan,
            accountEmail: ctx.account.email,
            requestedAt: now,
            effectiveAt: effectiveAtMs,
            stripeSubscriptionId: subscriptionId,
        }).catch(() => {});
        await dropBillingCache(ctx.account.email, s.slug);
    }

    await writeSubToSlug(subscriptionId, ctx.site.slug).catch(() => {});

    // ── Notify Xander ────────────────────────────────────────────────────────

    const effectiveDateStr = formatDate(effectiveAtMs);

    const resendKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.QUOTE_TO_EMAIL;
    const fromEmail = process.env.QUOTE_FROM_EMAIL || "onboarding@resend.dev";

    if (resendKey && toEmail) {
        const resend = new Resend(resendKey);

        const opsHtml = brandedEmailHtml({
            title: "Cancellation Request",
            subtitle: `${siteName}, ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
            body: `
                <p style="margin:0 0 16px;color:${EMAIL.ink};">
                    <strong>${siteName}</strong> (${ctx.account.email}) has requested cancellation via the portal.
                </p>
                <div style="background:${EMAIL.panelInset};border-radius:8px;padding:14px 16px;margin-bottom:16px;">
                    <table cellpadding="0" cellspacing="0" style="width:100%">
                        <tr>
                            <td style="padding:4px 12px 4px 0;color:${EMAIL.fg3};font-size:13px;white-space:nowrap;">Slug</td>
                            <td style="padding:4px 0;font-size:13px;color:${EMAIL.ink};">${ctx.site.slug}</td>
                        </tr>
                        <tr>
                            <td style="padding:4px 12px 4px 0;color:${EMAIL.fg3};font-size:13px;white-space:nowrap;">Plan</td>
                            <td style="padding:4px 0;font-size:13px;color:${EMAIL.ink};">${plan}, cancels at the end of the paid ${interval}${ending.length > 1 ? ` (${ending.length} sites: ${ending.map((s) => s.slug).join(", ")})` : ""}</td>
                        </tr>
                        <tr>
                            <td style="padding:4px 12px 4px 0;color:${EMAIL.fg3};font-size:13px;white-space:nowrap;">Subscription</td>
                            <td style="padding:4px 0;font-size:13px;color:${EMAIL.ink};">${subscriptionId}</td>
                        </tr>
                        <tr>
                            <td style="padding:4px 12px 4px 0;color:${EMAIL.fg3};font-size:13px;white-space:nowrap;">Effective date</td>
                            <td style="padding:4px 0;font-size:13px;color:${EMAIL.ink};font-weight:600;">${effectiveDateStr}</td>
                        </tr>
                    </table>
                </div>
                <p style="color:${EMAIL.fg3};font-size:13px;margin:0;">
                    Run the teardown from the console once the effective date passes.
                </p>
            `,
        });

        await resend.emails.send({
            from: fromEmail,
            to: [toEmail],
            subject: `[JDD] Cancellation request: ${siteName}`,
            html: opsHtml,
        }).catch((e: unknown) => {
            console.error("[portal/cancel] ops notification failed", e);
        });

        // Client receipt — this is the written notice the MSA requires.
        const clientHtml = brandedEmailHtml({
            title: "Cancellation Confirmed",
            subtitle: siteName,
            body: `
                <p style="margin:0 0 16px;color:${EMAIL.ink};">
                    We have received your cancellation request for <strong>${siteName}</strong>.
                </p>
                <div style="background:${EMAIL.panelInset};border-radius:8px;padding:14px 16px;margin-bottom:16px;">
                    <p style="margin:0 0 8px;font-family:${EMAIL_FONT.display};font-size:15px;font-weight:600;color:${EMAIL.ink};">
                        Your service ends on
                    </p>
                    <p style="margin:0;font-size:24px;font-weight:700;color:${EMAIL.accent2};">
                        ${effectiveDateStr}
                    </p>
                </div>
                <p style="color:${EMAIL.ink};font-size:14px;margin:0 0 12px;">
                    ${CANCEL_EMAIL_ACCESS}
                </p>
                <p style="color:${EMAIL.fg3};font-size:13px;margin:0;">
                    ${CANCEL_EMAIL_NOTICE}
                </p>
            `,
            // No section number and no notice period: v5.3 has none, and Term is §14 on Starter
            // and Growth but §15 on Enterprise. Wording approved by Xander 2026-11-04.
            footerNote: cancelEmailFooter(new Date().toISOString().slice(0, 10)),
        });

        await resend.emails.send({
            from: fromEmail,
            to: [ctx.account.email],
            subject: `Your cancellation request: ${siteName}`,
            html: clientHtml,
        }).catch((e: unknown) => {
            console.error("[portal/cancel] client receipt failed", e);
        });
    }

    return NextResponse.json({
        ok: true,
        effectiveAt: effectiveAtMs,
        effectiveDate: effectiveDateStr,
    });
}
