import { NextResponse, after } from "next/server";
import { authorizeOps } from "@/app/lib/ops-auth";
import { getOrder, transitionOrder } from "@/app/lib/operator-orders";
import { getAccount } from "@/app/lib/account-store";
import { accountFacts } from "@/app/lib/operator-order-input";
import { recordVerbalAcceptance, TermsChangedError } from "@/app/lib/verbal-agreement";
import { stripLastPage } from "@/app/lib/pdf-signer";
import { sendClientAgreementEmail } from "@/app/lib/agreement-email";
import { withTermsLock } from "@/app/lib/agreement-link";
import { orderAgreementSummary } from "@/app/lib/order-agreement-summary";
import { formatUsPhone, normalizeE164 } from "@/app/lib/phone";

export const runtime = "nodejs";

/**
 * The operator ticked "Client verbally agreed".
 *
 * Writes the agreement (verbal acceptance, PDF, record) and emails the client their copy
 * straight away — which doubles as proof, while they are still on the call, that the email
 * address is right before any money moves.
 *
 * `confirmed: true` is required: this records a legal acceptance on someone's behalf, and an
 * accidental POST must not do it.
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
    const gate = authorizeOps(request, "OPS_ORDERS_SECRET", "ops/orders");
    if (gate) return gate;

    const { id } = await ctx.params;
    // One acceptance at a time: the client may be agreeing on their own link right now.
    const response = await withTermsLock(id, () => acceptTerms(request, id));
    return response ?? NextResponse.json({ error: "These terms are being accepted right now." }, { status: 409 });
}

async function acceptTerms(request: Request, id: string) {
    const order = await getOrder(id);
    if (!order) return NextResponse.json({ error: "No such order." }, { status: 404 });
    if (order.status !== "draft") {
        return NextResponse.json({ error: "Terms were already accepted for this order.", order }, { status: 409 });
    }

    let body: { confirmed?: boolean; scriptHash?: string; termsHash?: string; callRef?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    if (body.confirmed !== true || !body.scriptHash || !body.termsHash) {
        return NextResponse.json({ error: "confirmed, scriptHash and termsHash are required." }, { status: 400 });
    }

    // Re-derived rather than trusted from the draft: an addendum must hang off the master the
    // account holds now.
    const facts = accountFacts(await getAccount(order.client.email), order);
    const callRef = body.callRef?.trim() || defaultCallRef(order.client.phone);

    let result: Awaited<ReturnType<typeof recordVerbalAcceptance>>;
    try {
        result = await recordVerbalAcceptance(order, {
            kind: facts.agreementKind,
            ...(facts.parentAgreementId ? { parentAgreementId: facts.parentAgreementId } : {}),
            operator: order.operator,
            callRef,
            scriptHash: body.scriptHash,
            termsHash: body.termsHash,
        });
    } catch (e) {
        if (e instanceof TermsChangedError) {
            return NextResponse.json({ error: e.message, code: e.code }, { status: 409 });
        }
        console.error("[ops/orders] accept-terms failed", id, e);
        return NextResponse.json({ error: "Could not record the agreement." }, { status: 500 });
    }

    const saved = await transitionOrder(
        order,
        "terms-accepted",
        { kind: "terms-accepted", text: `Terms ${result.record.agreementVersion} accepted verbally` },
        { agreementId: result.record.id, agreementKind: facts.agreementKind, callRef },
    );

    // After the response, like /api/agreement: a slow Resend call must not hold the wizard.
    after(() =>
        stripLastPage(result.pdfBytes)
            .then((clientPdf) => sendClientAgreementEmail(result.record, clientPdf))
            .catch((e) => console.error("[ops/orders] terms email failed", id, e)),
    );

    return NextResponse.json({
        ok: true,
        order: saved,
        agreementId: result.record.id,
        emailSentTo: order.client.email,
        agreement: await orderAgreementSummary(saved),
    });
}

/** "Phone call with (407) 555-0143 · 3 Nov 2026, 2:12 PM ET" — editable later in /manage. */
function defaultCallRef(phone: string): string {
    const e164 = normalizeE164(phone);
    const who = e164 ? formatUsPhone(e164) : phone;
    const when = new Date().toLocaleString("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/New_York",
    });
    return `Phone call with ${who} · ${when} ET`;
}
