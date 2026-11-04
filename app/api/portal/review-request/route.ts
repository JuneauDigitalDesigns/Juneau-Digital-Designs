import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { normalizeE164 } from "@/app/lib/phone";
import { sendSms } from "@/app/lib/twilio";
import { appendActivity, findCustomerByPhone, recordReviewSend } from "@/app/lib/portal-crm";
import { reviewRequestActivity } from "@/app/lib/review-message";
import {
    canSendReview,
    composeReviewMessage,
    resolveReviewConfig,
    type ReviewBlockReason,
} from "@/app/lib/review-request";

export const runtime = "nodejs";

/**
 * Send one Google-review request text to a caller.
 *
 * Manual, one-per-number, decoupled from pipeline stage. The hard compliance rules live in
 * `lib/review-request.ts`; this route is the HTTP edge: authenticate, check the guard, compose
 * the server-authoritative message (link + STOP appended here), send, and record the permanent
 * block. See the compliance note in `review-request.ts` before changing anything.
 */

const REASON_MESSAGE: Record<ReviewBlockReason, string> = {
    "no-review-link":
        "Your Google review link isn't set up yet — contact Juneau Digital Designs and we'll add it.",
    "no-number": "We don't have a mobile number for this caller, so we can't text them.",
    "already-sent": "You've already sent a review request to this caller.",
    "opted-out": "This caller has opted out of texts, so we can't message them.",
};

/** 409 for the permanent blocks (a real conflict), 400/422 for configuration. */
function statusFor(reason: ReviewBlockReason): number {
    return reason === "already-sent" || reason === "opted-out" ? 409 : 422;
}

export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // A review request is customer-facing SMS, so it rides the same gate as the chat: the
    // client's own A2P campaign must have verified. Before that, carriers filter a message
    // containing a review URL rather than delivering it.
    const gate = siteFeature(ctx.site, "messaging");
    if (gate.state !== "ready") {
        const reason =
            gate.state === "not-on-plan"
                ? "Review requests come with Growth."
                : "Review requests turn on once the carriers approve your business registration.";
        return NextResponse.json({ error: reason, state: gate.state }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;

    const phone = normalizeE164(typeof b.phone === "string" ? b.phone : "");
    const clientBody = typeof b.messageBody === "string" ? b.messageBody : "";

    const acct = accountScope(ctx.account.email);
    const { reviewUrl, fromNumber } = resolveReviewConfig(ctx.site);

    const check = await canSendReview(acct, phone, reviewUrl);
    if (!check.allowed) {
        const reason: ReviewBlockReason = check.reason;
        return NextResponse.json({ error: REASON_MESSAGE[reason], reason }, { status: statusFor(reason) });
    }

    // `check.allowed` guarantees both are present, but narrow for the type checker.
    if (!phone || !reviewUrl) {
        return NextResponse.json({ error: REASON_MESSAGE["no-review-link"] }, { status: 422 });
    }

    const message = composeReviewMessage(clientBody, reviewUrl);
    const statusCallback = process.env.TWILIO_STATUS_CALLBACK_URL || undefined;

    let sid: string | null = null;
    try {
        const serviceSid = (ctx.site as { messagingServiceSid?: string | null }).messagingServiceSid;
        if (!serviceSid || !fromNumber) {
            console.error(`[review-request] ${ctx.site.slug} is messaging-ready but missing sender config`);
            return NextResponse.json(
                { error: "We couldn't send that just now. Please try again shortly." },
                { status: 502 },
            );
        }
        const res = await sendSms({
            to: phone,
            body: message,
            lane: "customer",
            messagingServiceSid: serviceSid,
            from: fromNumber,
            statusCallback,
        });
        sid = res.sid;
    } catch (e) {
        console.error(`[review-request] send failed for ${ctx.site.slug}`, e);
        return NextResponse.json(
            { error: "We couldn't send that just now. Please try again in a moment." },
            { status: 502 },
        );
    }

    const review = await recordReviewSend({
        acctScope: acct,
        e164: phone,
        sentBy: ctx.userId,
        siteSlug: ctx.site.slug,
        messageSid: sid,
        deliveryStatus: sid ? "queued" : "unknown",
    });

    /**
     * Put it on the customer's history too.
     *
     * The send is recorded against the number, which is what enforces one-per-customer; this
     * is the other half, so the record shows that they were asked. The customer is found by
     * number rather than taken from the request: this route is given a phone number, the
     * dialog can be opened from more than one place, and an id from a browser is not something
     * to write someone else's history from.
     *
     * No customer is an ordinary outcome — a review can be requested for a caller who was
     * never promoted — so there is simply nothing to append. Failing here would also be
     * wrong: the text has already gone, and reporting a send as failed because a note did
     * not save would invite a second one, which the guard would then refuse.
     */
    try {
        const customer = await findCustomerByPhone(acct, ctx.site.slug, phone);
        if (customer) {
            await appendActivity(acct, ctx.site.slug, customer.customerId, {
                ...reviewRequestActivity(customer.name),
                meta: { messageSid: sid },
            });
        }
    } catch (e) {
        console.error(`[review-request] sent, but the timeline note failed for ${ctx.site.slug}`, e);
    }

    return NextResponse.json({ ok: true, review });
}
