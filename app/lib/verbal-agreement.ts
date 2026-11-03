import "server-only";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import type { OperatorOrder } from "@jdd/schema";
import { generateSignedPdf, hashSubmission } from "./pdf-signer";
import { hashAddendumForPlan, hashTermsForPlan } from "./legal/hash";
import { ADDENDUM_VERSION, TERMS_VERSION } from "./legal";
import { buildCallScript, type CallScript } from "./legal/call-script";
import { saveAgreement } from "./kv";
import type {
    AgreementAudit,
    AgreementRecord,
    AgreementSubmission,
    VerbalAcceptance,
} from "./agreement-types";

/**
 * Turn "the client said yes on the call" into an `AgreementRecord`.
 *
 * Deliberately reuses the self-serve machinery — the same terms, the same PDF renderer, the
 * same Blob store and the same agreement record — so a verbally accepted agreement is the same
 * kind of document as a drawn one, and everything downstream (fulfillment, addenda,
 * `masterNeedsResign`, the client email) reads it without knowing the difference.
 */

/** Web-only is a Starter master where the client declined the receptionist. */
function isWebOnly(order: OperatorOrder, kind: "master" | "addendum"): boolean {
    return kind === "master" && order.plan === "starter" && order.receptionistMode === "declined";
}

/** The terms hash the client is agreeing to, for this order and instrument. */
export function termsHashForOrder(order: OperatorOrder, kind: "master" | "addendum"): string {
    return kind === "addendum"
        ? hashAddendumForPlan(order.plan)
        : hashTermsForPlan(order.plan, { webOnly: isWebOnly(order, kind) });
}

/** The read-aloud script for this order. */
export function scriptForOrder(order: OperatorOrder, kind: "master" | "addendum"): CallScript {
    return buildCallScript(order.plan, order.period, { webOnly: isWebOnly(order, kind) });
}

export class TermsChangedError extends Error {
    code = "terms-changed" as const;
}

/**
 * Record the acceptance. The console sends back the script and terms hashes it displayed; both
 * are recomputed here, and a mismatch is refused — a price or terms change between showing the
 * script and ticking the box must not produce an agreement for words nobody heard.
 *
 * Returns the stored record and the PDF bytes (the caller emails the client copy in `after()`).
 */
export async function recordVerbalAcceptance(
    order: OperatorOrder,
    input: {
        kind: "master" | "addendum";
        parentAgreementId?: string;
        operator: string;
        callRef: string;
        scriptHash: string;
        termsHash: string;
    },
): Promise<{ record: AgreementRecord; pdfBytes: Uint8Array }> {
    const script = scriptForOrder(order, input.kind);
    const termsHash = termsHashForOrder(order, input.kind);
    if (script.hash !== input.scriptHash || termsHash !== input.termsHash) {
        throw new TermsChangedError("The terms changed since the script was shown. Reload it and read it again.");
    }

    const id = randomUUID();
    const now = new Date().toISOString();

    const submission: AgreementSubmission = {
        plan: order.plan,
        kind: input.kind,
        ...(input.parentAgreementId ? { parentAgreementId: input.parentAgreementId } : {}),
        clientLegalName: order.client.legalName,
        clientEntityType: order.client.entityType,
        clientAddress: order.client.address,
        signerName: order.client.contactName,
        signerTitle: order.client.contactTitle,
        signerEmail: order.client.email,
        additionalSites: [],
        // No browser, so no page timings. Both are the moment of acceptance, which is the
        // honest value: there was no page, and nothing was scrolled.
        pageOpenedAt: now,
        scrollCompletedAt: now,
        ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
        ...(order.forwardingNumber ? { forwardingNumber: order.forwardingNumber } : {}),
    };

    const verbal: VerbalAcceptance = {
        method: "verbal-operator",
        orderId: order.id,
        operator: input.operator,
        callRef: input.callRef,
        scriptVersion: script.version,
        scriptHash: script.hash,
        confirmedAt: now,
    };

    const audit: AgreementAudit = {
        ip: "operator-call",
        userAgent: "operator-call",
        signedAt: now,
        payloadHash: hashSubmission(submission),
        scrollCompletedAt: now,
        dwellMs: 0,
        termsHash,
    };

    const pdfBytes = await generateSignedPdf(submission, audit, id, verbal);
    const uploaded = await put(`agreements/${id}.pdf`, Buffer.from(pdfBytes), {
        access: "public",
        contentType: "application/pdf",
    });

    const record: AgreementRecord = {
        id,
        plan: order.plan,
        kind: input.kind,
        ...(input.parentAgreementId ? { parentAgreementId: input.parentAgreementId } : {}),
        clientLegalName: submission.clientLegalName,
        clientEntityType: submission.clientEntityType,
        clientAddress: submission.clientAddress,
        signerName: submission.signerName,
        signerTitle: submission.signerTitle,
        signerEmail: submission.signerEmail,
        additionalSites: [],
        ...(order.receptionistMode ? { receptionistMode: order.receptionistMode } : {}),
        ...(order.forwardingNumber ? { forwardingNumber: order.forwardingNumber.trim() } : {}),
        pdfUrl: uploaded.url,
        audit,
        agreementVersion: input.kind === "addendum" ? ADDENDUM_VERSION : TERMS_VERSION,
        acceptance: verbal,
    };

    await saveAgreement(record);
    return { record, pdfBytes };
}
