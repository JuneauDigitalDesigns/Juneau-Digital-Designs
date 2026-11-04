import { NextResponse, after } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder, saveOrder } from "@/app/lib/operator-orders";
import { getAccount } from "@/app/lib/account-store";
import { resendPortalInvite } from "@/app/lib/portal-invite";
import { sendWelcomeEmail } from "@/app/lib/welcome-email";

export const runtime = "nodejs";

/**
 * Resend invite: revoke the open Clerk invitation, issue a new one, and re-send the welcome
 * email that carries it. The one recovery path for a lost or expired link — and the reason no
 * one is ever tempted to email a password instead.
 *
 * Refused once the client has signed in (there is nothing left to invite them to), and for a
 * client who already had a login (they were never invited).
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (order.status !== "fulfilled" || !order.invite) {
        return NextResponse.json({ error: "No invite has been sent for this order yet." }, { status: 409 });
    }
    if (order.invite.kind === "existing-login") {
        return NextResponse.json({ error: "This client already has a login. They sign in as usual." }, { status: 409 });
    }
    const account = await getAccount(order.client.email);
    if (account?.clerkUserId) {
        return NextResponse.json({ error: "They've already signed in." }, { status: 409 });
    }

    try {
        const invite = await resendPortalInvite(order.client.email, order.siteSlug, order.invite.invitationId);
        const now = Date.now();
        const saved = await saveOrder(
            {
                ...order,
                invite:
                    invite.kind === "invitation"
                        ? { kind: "invitation", invitationId: invite.invitationId, sentAt: now }
                        : { kind: "existing-login", sentAt: now },
                events: [...order.events, { at: now, kind: "invite", text: "Portal invite re-sent" }],
            },
            order,
        );
        after(() =>
            sendWelcomeEmail({
                signerEmail: order.client.email,
                signerName: order.client.contactName,
                clientLegalName: order.client.legalName,
                plan: order.plan,
                ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
                ...(order.forwardingNumber ? { forwardingNumber: order.forwardingNumber } : {}),
                siteSlug: order.siteSlug,
                ...(invite.kind === "invitation" ? { inviteUrl: invite.url } : { existingLogin: true }),
            }).catch((e) => console.error("[ops/orders] resend welcome failed", id, e)),
        );
        return NextResponse.json({ ok: true, order: saved, sentTo: order.client.email });
    } catch (e) {
        console.error("[ops/orders] resend invite failed", id, e);
        return NextResponse.json({ error: "Could not resend the invite." }, { status: 500 });
    }
}
