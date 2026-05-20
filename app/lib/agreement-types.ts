export type PlanSlug = "starter" | "growth" | "enterprise";

export interface AgreementSubmission {
  plan: PlanSlug;
  clientLegalName: string;
  clientEntityType: string;
  clientAddress: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  launchDate?: string; // YYYY-MM-DD (optional — not collected on form)
  additionalSites: string[]; // for Enterprise
  signatureDataUrl: string; // data:image/png;base64,...
}

export interface AgreementAudit {
  ip: string;
  userAgent: string;
  signedAt: string; // ISO UTC
  payloadHash: string; // SHA-256 hex
}

export interface AgreementRecord {
  id: string;
  plan: PlanSlug;
  clientLegalName: string;
  clientEntityType: string;
  clientAddress: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  launchDate?: string;
  additionalSites: string[];
  pdfUrl: string;
  audit: AgreementAudit;
  agreementVersion: string;
}
