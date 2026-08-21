import "server-only";
import { stripe } from "./stripe";
import { getAgreement } from "./kv";
import type { PaymentDetails } from "./notification-email";
import type { AgreementRecord } from "./agreement-types";

/**
 * Everything the operator notification needs about how a client came to exist: what they
 * paid, what they signed, and the signed PDF itself.
 *
 * Lifted out of the anonymous `/api/onboarding` route so the portal route can use it too.
 * That mattered because the portal route was passing `payment: null, agreement: null,
 * agreementPdf: null` — fine while it was the minority path, but deleting the anonymous
 * funnel would have made it the *only* path and silently stripped payment details and the
 * signed agreement out of every operator email from then on.
 *
 * Every lookup fails soft and independently. This runs inside `after()` on a request the
 * client has already been told succeeded; a Stripe hiccup or an expired blob URL should cost
 * a section of an internal email, not the onboarding submission it describes.
 */
export async function gatherClientContext(sessionId: string): Promise<{
    payment: PaymentDetails | null;
    agreement: AgreementRecord | null;
    agreementPdf: Buffer | null;
}> {
    let payment: PaymentDetails | null = null;
    let agreement: AgreementRecord | null = null;
    let agreementPdf: Buffer | null = null;

    if (!sessionId) return { payment, agreement, agreementPdf };

    let agreementId: string | undefined;
    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status === "paid") {
            payment = {
                plan: session.metadata?.plan,
                customerName: session.customer_details?.name,
                customerEmail: session.customer_details?.email,
                amountTotal: session.amount_total,
                subscriptionId:
                    typeof session.subscription === "string" ? session.subscription : undefined,
                sessionId: session.id,
            };
            agreementId = session.metadata?.agreement_id;
        } else {
            console.warn("[client-context] session not paid — skipping payment section", sessionId);
        }
    } catch (e) {
        console.error("[client-context] stripe session lookup failed", sessionId, e);
    }

    if (agreementId) {
        try {
            agreement = await getAgreement(agreementId);
        } catch (e) {
            console.error("[client-context] agreement lookup failed", agreementId, e);
        }
    }

    if (agreement?.pdfUrl) {
        try {
            const res = await fetch(agreement.pdfUrl);
            if (res.ok) agreementPdf = Buffer.from(await res.arrayBuffer());
            else
                console.error(
                    "[client-context] agreement PDF fetch returned",
                    res.status,
                    agreement.pdfUrl,
                );
        } catch (e) {
            console.error("[client-context] agreement PDF fetch failed", agreement.pdfUrl, e);
        }
    }

    return { payment, agreement, agreementPdf };
}
