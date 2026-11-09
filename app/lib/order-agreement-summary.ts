import "server-only";
import type { OperatorOrder } from "@jdd/schema";
import { getAgreement } from "./kv";

export interface OrderAgreementSummary {
    method: "read-aloud" | "agreement-link";
    acceptedAt: string;
    signerName: string;
    signerTitle: string;
    businessName: string;
    version: string;
    emailedTo: string;
}

/** What the wizard's confirmation shows about an order's accepted terms. Nothing sensitive. */
export async function orderAgreementSummary(order: OperatorOrder): Promise<OrderAgreementSummary | null> {
    if (!order.agreementId) return null;
    const record = await getAgreement(order.agreementId);
    if (!record) return null;
    return {
        method: record.acceptance?.method === "verbal-operator" ? "read-aloud" : "agreement-link",
        acceptedAt: record.audit.signedAt,
        signerName: record.signerName,
        signerTitle: record.signerTitle,
        businessName: record.clientLegalName,
        version: record.agreementVersion,
        emailedTo: record.signerEmail,
    };
}
