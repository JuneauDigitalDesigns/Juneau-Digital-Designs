import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { sendSms } from "@/app/lib/twilio";
import { checkSpokenConsent } from "@/app/lib/spoken-consent-check";
import { NOT_AGREED_MESSAGE } from "@/app/lib/spoken-consent";
import {
    appendMessage,
    getCustomer,
    getReviewSend,
    setNumberOwner,
    setOwnerEmail,
    updateCustomer,
    type Message,
} from "@/app/lib/portal-crm";

export const runtime = "nodejs";

/**
 * Text a customer from the client's own business number.
 *
 * ── Compliance ──────────────────────────────────────────────────────────────────────────────
 * The client may message someone who contacted them — an established business relationship,
 * and what their `CUSTOMER_CARE` campaign's registered MessageFlow describes. Enforced here:
 *
 *  • `messaging` gate — requires growth/enterprise **and** a verified A2P campaign. Sending
 *    before the campaign verifies would be filtered by carriers, not delivered.
 *  • The recipient must already be a customer with a number, i.e. someone who reached out.
 *  • An opted-out recipient is blocked outright.
 *  • So is one who said no on a call, or never answered when asked (`spoken-consent.ts`).
 *  • Sends go through the client's **own** Messaging Service, so Advanced Opt-Out applies.
 *  • **There is no bulk path.** One request sends one message to one customer, by design.
 */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    const gate = siteFeature(ctx.site, "messaging");
    if (gate.state !== "ready") {
        const reason =
            gate.state === "not-on-plan"
                ? "Texting your customers comes with Growth."
                : "Texting turns on once the carriers approve your business registration.";
        return NextResponse.json({ error: reason, state: gate.state }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;

    const customerId = typeof b.customerId === "string" ? b.customerId : null;
    const text = typeof b.body === "string" ? b.body.trim() : "";
    if (!customerId || !text) {
        return NextResponse.json({ error: "customerId and body are required" }, { status: 400 });
    }
    if (text.length > 1000) {
        return NextResponse.json({ error: "That message is too long." }, { status: 400 });
    }

    const acct = accountScope(ctx.account.email);
    const slug = ctx.site.slug;

    const customer = await getCustomer(acct, slug, customerId);
    if (!customer) return NextResponse.json({ error: "No such customer" }, { status: 404 });
    if (!customer.phone) {
        return NextResponse.json(
            { error: "We don't have a mobile number for this customer." },
            { status: 422 },
        );
    }

    // An opt-out is recorded against the number by the inbound webhook. Honour it everywhere.
    const review = await getReviewSend(acct, customer.phone);
    if (review?.optedOut) {
        return NextResponse.json(
            { error: "This customer has opted out of texts, so we can't message them." },
            { status: 409 },
        );
    }

    const spoken = await checkSpokenConsent(ctx, customer.phone);
    if (spoken === "declined") {
        return NextResponse.json(
            { error: "This customer has opted out of texts, so we can't message them." },
            { status: 409 },
        );
    }
    if (spoken === "not-agreed") {
        return NextResponse.json({ error: NOT_AGREED_MESSAGE }, { status: 409 });
    }
    if (spoken === "unavailable") {
        return NextResponse.json(
            { error: "We couldn't send that just now. Please try again in a moment." },
            { status: 502 },
        );
    }

    const site = ctx.site as { twilioNumber?: string | null; messagingServiceSid?: string | null };
    if (!site.twilioNumber || !site.messagingServiceSid) {
        console.error(`[portal/messages] ${slug} is messaging-ready but missing sender config`);
        return NextResponse.json(
            { error: "We couldn't send that just now. Please try again shortly." },
            { status: 502 },
        );
    }

    let sid: string | null = null;
    try {
        const res = await sendSms({
            to: customer.phone,
            body: text,
            lane: "customer",
            messagingServiceSid: site.messagingServiceSid,
            from: site.twilioNumber,
            statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || undefined,
        });
        sid = res.sid;
    } catch (e) {
        console.error(`[portal/messages] send failed for ${slug}`, e);
        return NextResponse.json(
            { error: "We couldn't send that just now. Please try again in a moment." },
            { status: 502 },
        );
    }

    const now = new Date().toISOString();
    const message: Omit<Message, "id"> = {
        direction: "out",
        body: text,
        at: now,
        messageSid: sid,
        status: sid ? "queued" : "sent",
        sentBy: ctx.userId,
    };
    const saved = await appendMessage(acct, slug, customerId, message);

    // Keep the inbound webhook able to route replies back to this site, and self-heal the index
    // if provisioning never wrote it. The owner's address is stored under their own scope so
    // the webhook can check SMS consent before notifying them of a reply.
    await setNumberOwner(site.twilioNumber, { acctScope: acct, slug });
    await setOwnerEmail(acct, ctx.account.email);

    await updateCustomer(acct, slug, customerId, { lastContactAt: now }, ctx.userId);

    return NextResponse.json({ ok: true, message: saved });
}
