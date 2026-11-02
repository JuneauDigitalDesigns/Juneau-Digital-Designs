import { NextResponse } from "next/server";
import { reconstructPublicUrl, validateTwilioSignature } from "@/app/lib/twilio";
import { getNumberOwner, markReviewDelivery, type ReviewDeliveryStatus } from "@/app/lib/portal-crm";

export const runtime = "nodejs";

/**
 * Twilio message status callbacks for review-request sends.
 *
 * Twilio POSTs here as a message moves queued → sent → delivered (or undelivered/failed), when
 * the review-request send passes `StatusCallback`. We record the latest status against the
 * recipient's number so the portal can show "delivered" / "failed".
 *
 * Signature is validated against this route's own URL — `TWILIO_STATUS_CALLBACK_URL` when set,
 * reconstructed from forwarded headers otherwise. It deliberately does NOT use
 * `publicWebhookUrl`, which would return `SMS_WEBHOOK_URL` (the inbound route) and never match.
 *
 * To enable: set the send's StatusCallback (via `TWILIO_STATUS_CALLBACK_URL`) to this path.
 */

function mapStatus(twilio: string): ReviewDeliveryStatus {
    switch (twilio) {
        case "queued":
        case "accepted":
        case "scheduled":
        case "sending":
            return "queued";
        case "sent":
            return "sent";
        case "delivered":
            return "delivered";
        case "undelivered":
            return "undelivered";
        case "failed":
            return "failed";
        default:
            return "unknown";
    }
}

export async function POST(request: Request) {
    const raw = await request.text();
    const params: Record<string, string> = {};
    for (const [key, value] of new URLSearchParams(raw)) params[key] = value;

    const valid = validateTwilioSignature({
        url: process.env.TWILIO_STATUS_CALLBACK_URL ?? reconstructPublicUrl(request),
        params,
        signature: request.headers.get("x-twilio-signature"),
    });
    if (!valid) {
        console.warn("[twilio-status] rejected: bad or missing signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const to = params.To ?? "";
    const from = params.From ?? "";
    const status = params.MessageStatus ?? params.SmsStatus ?? "";
    const sid = params.MessageSid ?? params.SmsSid ?? null;

    // `To` is the customer; `From` is the client's number, which is what identifies the owning
    // account. Delivery records are account-scoped, so without the sender there is nothing to
    // write against.
    if (to && from && status) {
        const owner = await getNumberOwner(from);
        if (owner) {
            await markReviewDelivery(owner.acctScope, to, mapStatus(status), sid);
        }
    }

    // 204: nothing to say back, and a body would just be noise Twilio ignores.
    return new NextResponse(null, { status: 204 });
}
