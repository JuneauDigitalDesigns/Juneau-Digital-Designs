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
    /** Read-aloud only. Null when there is nothing to show (an agreement link, or an older record). */
    call: {
        callRef: string;
        operator: string;
        scriptVersion: string;
        scriptHash: string;
        termsHash: string;
        recordingConsentAt: string | null;
        recordingStoppedAt: string | null;
        recording: { fileName: string; sizeBytes: number; sha256: string; attachedAt: string } | null;
    } | null;
}

/** What the wizard's confirmation shows about an order's accepted terms. Nothing sensitive. */
export async function orderAgreementSummary(order: OperatorOrder): Promise<OrderAgreementSummary | null> {
    if (!order.agreementId) return null;
    const record = await getAgreement(order.agreementId);
    if (!record) return null;
    const verbal = record.acceptance?.method === "verbal-operator" ? record.acceptance : null;
    return {
        method: record.acceptance?.method === "verbal-operator" ? "read-aloud" : "agreement-link",
        acceptedAt: record.audit.signedAt,
        signerName: record.signerName,
        signerTitle: record.signerTitle,
        businessName: record.clientLegalName,
        version: record.agreementVersion,
        emailedTo: record.signerEmail,
        call: verbal
            ? {
                  callRef: verbal.callRef,
                  operator: verbal.operator,
                  scriptVersion: verbal.scriptVersion,
                  scriptHash: verbal.scriptHash,
                  termsHash: record.audit.termsHash,
                  recordingConsentAt: verbal.recordingConsentAt ?? null,
                  recordingStoppedAt: verbal.recordingStoppedAt ?? null,
                  // The storage path stays on this side.
                  recording: record.recording
                      ? {
                            fileName: record.recording.fileName,
                            sizeBytes: record.recording.sizeBytes,
                            sha256: record.recording.sha256,
                            attachedAt: record.recording.attachedAt,
                        }
                      : null,
              }
            : null,
    };
}
