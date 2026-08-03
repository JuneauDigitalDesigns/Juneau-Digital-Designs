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
  pageOpenedAt: string; // ISO UTC — when the agreement page mounted
  scrollCompletedAt: string; // ISO UTC — when the reader reached the end of the terms
}

export interface AgreementAudit {
  ip: string;
  userAgent: string;
  signedAt: string; // ISO UTC
  payloadHash: string; // SHA-256 hex
  /** ISO UTC — proves the signer scrolled through the full terms before accepting. */
  scrollCompletedAt: string;
  /** Page open → submit, computed server-side from the two client timestamps. */
  dwellMs: number;
  /**
   * SHA-256 of the canonical terms text for this plan and version. Identifies
   * exactly which words were agreed to, independent of the signer.
   */
  termsHash: string;
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
