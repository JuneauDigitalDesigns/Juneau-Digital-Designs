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
  /**
   * Present when this signature authorises an in-portal upgrade rather than a new purchase.
   *
   * Not trusted for authorization — the upgrade route re-resolves the slug against the
   * signed-in account. It is used only to decide whether to hold the client email until the
   * plan change actually goes through.
   */
  upgradeSlug?: string;
  /**
   * Optional opt-in to post-call summary texts. Deliberately separate from the agreement
   * acceptance: the service is sold, delivered, and billed identically whether this is
   * checked or not, which is what "consent is not a condition of purchase" has to mean in
   * the code and not just in the sentence beside the box.
   *
   * Neither field lands on AgreementRecord. Consent has its own append-only store with no
   * TTL (lib/sms-consent.ts) because the agreement record is discarded after 30 days.
   */
  smsConsent?: boolean;
  /** E.164 destination for call alerts. Only meaningful when smsConsent is true. */
  alertPhone?: string;
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
  /**
   * Set when this agreement was signed to authorise an in-portal upgrade, and cleared once
   * Stripe confirms the plan actually changed.
   *
   * A signature is persisted the moment it's given — the legal artefact has to survive
   * whatever happens next. But the *client email* used to go out at the same moment, so a
   * failed upgrade left them holding a Growth agreement for a plan they were never moved to.
   * The email now waits for the charge, and a record still flagged here is an orphan: signed,
   * not upgraded, and someone needs to look at it.
   */
  pendingUpgrade?: boolean;
  /** Slug the upgrade was for. Only meaningful alongside `pendingUpgrade`. */
  upgradeSlug?: string;
}
