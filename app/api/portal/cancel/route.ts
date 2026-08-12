import { NextResponse } from "next/server";
import { upsertSite } from "@jdd/schema";
import { Resend } from "resend";
import { stripe } from "@/app/lib/stripe";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";
import { writeCancelSignal, writeSubToSlug } from "@/app/lib/cancel-kv";
import { subscriptionPeriod } from "@/app/lib/plan-billing";
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
        return NextResponse.json({ error: "Business name does not match — cancellation blocked" }, { status: 422 });
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
    const noticeDays = SCHEDULES[plan]?.cancellationNoticeDays ?? 30;

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

    const nowS = Math.floor(Date.now() / 1000);
    const target = nowS + noticeDays * DAY_S;
    const cancelAtS = firstBoundaryAtOrAfter(period.start, period.end, target);

    // ── Schedule cancellation in Stripe ──────────────────────────────────────

    try {
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

    const accountWithSub = upsertSite(ctx.account, {
        slug: ctx.site.slug,
        stripeSubscriptionId: subscriptionId,
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        cancelRequestedAt: now,
        cancelEffectiveAt: effectiveAtMs,
    }, now);
    await saveAccount(accountWithSub);

    // ── Write cancel signal + reverse index ──────────────────────────────────

    await writeCancelSignal({
        slug: ctx.site.slug,
        siteName,
        plan: ctx.site.plan,
        accountEmail: ctx.account.email,
        requestedAt: now,
        effectiveAt: effectiveAtMs,
        stripeSubscriptionId: subscriptionId,
    }).catch(() => {});

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
            subtitle: `${siteName} — ${plan.charAt(0).toUpperCase() + plan.slice(1)} plan`,
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
                            <td style="padding:4px 0;font-size:13px;color:${EMAIL.ink};">${plan} (${noticeDays}-day notice)</td>
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
            subject: `[JDD] Cancellation request — ${siteName}`,
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
                    Your subscription stays active and you keep full access until that date.
                    Your final charge will be on the last billing date before ${effectiveDateStr}.
                </p>
                <p style="color:${EMAIL.fg3};font-size:13px;margin:0;">
                    Per Section 14 of your agreement, this written notice confirms your
                    ${noticeDays}-day termination period begins today.
                    If you have questions, reply to this email.
                </p>
            `,
            footerNote: `This email serves as written notice of termination per the Juneau Digital Designs Master Services Agreement, Section 14. Cancellation request submitted ${new Date().toISOString().slice(0, 10)}.`,
        });

        await resend.emails.send({
            from: fromEmail,
            to: [ctx.account.email],
            subject: `Your cancellation request — ${siteName}`,
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
