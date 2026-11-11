export type PlanSlug = "starter" | "growth" | "enterprise";

/**
 * Which instrument is being signed.
 *
 * `master` is the full Service Agreement, signed once per account. `addendum` is the
 * one-page Site Addendum a returning client signs for each later site: it adopts the master
 * by reference and carries its own contracting entity, because a second site is often bought
 * by a different LLC and re-signing the master would overwrite the first entity's details.
 */
export type AgreementKind = "master" | "addendum";

/**
 * How the client wants their phone handled, captured at signing.
 *
 * The same three values the portal onboarding form and `@jdd/schema`'s `PortalSite` already
 * use, so the choice made here flows straight through to the site record without translation:
 *   - `forwarded`  — keep their existing advertised number and forward it to the JDD number.
 *   - `published`  — use the JDD-provisioned number as their business number.
 *   - `declined`   — website only, no receptionist. Starter plan only.
 */
export type ReceptionistMode = "forwarded" | "published" | "declined";

export interface AgreementSubmission {
  plan: PlanSlug;
  /**
   * Absent means `master`. Defaulting rather than requiring keeps every existing caller —
   * and any signature in flight across a deploy — valid without a migration.
   */
  kind?: AgreementKind;
  /** The master this addendum hangs off. Required for `addendum`, meaningless otherwise. */
  parentAgreementId?: string;
  clientLegalName: string;
  clientEntityType: string;
  clientAddress: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  launchDate?: string; // YYYY-MM-DD (optional — not collected on form)
  additionalSites: string[]; // for Enterprise
  /**
   * data:image/png;base64,… — the drawn signature.
   *
   * No longer collected: self-serve accepts with `termsAccepted` (2026-11-03) and an
   * operator-closed client accepts by voice. Still accepted from a page loaded before the
   * signature pad was removed, so a client mid-signing across the deploy isn't turned away.
   */
  signatureDataUrl?: string;
  /**
   * The client ticked "I have read and agree" on the self-serve page. Required unless a legacy
   * signature is present (`agreement-validate.mjs` holds the rule).
   */
  termsAccepted?: boolean;
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
   * Set when an existing client is accepting a lower plan's terms for a scheduled downgrade.
   * Like `upgradeSlug`, not an authorization claim: `/api/portal/downgrade` re-resolves the slug
   * against the signed-in account. It holds the client email until the change is scheduled.
   */
  downgradeSlug?: string;
  /**
   * Set when this Enterprise agreement authorises moving the account's Growth sites onto
   * Enterprise. Holds the client email until `/api/portal/consolidate` has made the move.
   */
  consolidate?: boolean;
  /**
   * Set when a website-only Starter client is switching the AI receptionist on: the standard
   * Starter terms with a phone choice. Holds the client email until `/api/portal/receptionist`
   * has recorded the change. Like the slugs above, not an authorization claim.
   */
  receptionistSlug?: string;
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
  /**
   * The version of the consent wording shown beside the box (`SmsConsentCopy.version`), sent
   * with `smsConsent`. Absent from a page loaded before the wording followed the campaign switch,
   * which showed v2.
   */
  smsConsentVersion?: string;
  /**
   * How the client wants their phone handled, chosen on the signing page.
   *
   * Required for a new Starter/Growth purchase (not upgrades, and not Enterprise, which defers
   * the per-site choice to the onboarding form). `declined` is only valid on Starter: Growth
   * and Enterprise are receptionist plans with no website-only variant.
   */
  receptionistMode?: ReceptionistMode;
  /**
   * The existing business line to forward, in whatever the client typed. Only collected when
   * `receptionistMode` is `forwarded`. Stored on the record so the welcome email and the
   * console know which number the client intends to forward from.
   */
  forwardingNumber?: string;
  /**
   * The billing period the client chose, printed on the PDF cover. Absent (legacy links,
   * upgrades) prints both prices: the cover must never state a period nobody picked.
   */
  billingPeriod?: "monthly" | "annual";
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

/**
 * Verbal acceptance on a sales call, recorded by the operator on the client's behalf.
 *
 * Carries what makes it evidence rather than an assertion: which order it authorised, who
 * recorded it, the call it happened on, and the hash of the exact script that was read aloud
 * (alongside `audit.termsHash` for the full terms the client was emailed).
 */
export interface VerbalAcceptance {
  method: "verbal-operator";
  orderId: string;
  operator: string;
  callRef: string;
  scriptVersion: string;
  scriptHash: string;
  /** ISO UTC — when the operator recorded the client's yes. */
  confirmedAt: string;
  /** ISO UTC — when the operator ticked "Client consented to recording". Absent before 2026-11-09. */
  recordingConsentAt?: string;
  /** ISO UTC — when the operator ticked "Recording stopped". Payment waits for it. */
  recordingStoppedAt?: string;
}

/** The call recording attached to a read-aloud agreement, held in the private store. */
export interface AgreementRecording {
  pathname: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** SHA-256 of the bytes as they were uploaded, so the file can be shown to be unaltered. */
  sha256: string;
  attachedAt: string;
}

/**
 * The client ticked "I have read and agree" on the self-serve agreement page (since 2026-11-03,
 * replacing the drawn signature). Who ticked it is the signer on the record; this adds when and
 * from where. Which words they agreed to is `audit.termsHash` + `agreementVersion`.
 */
export interface ClickwrapAcceptance {
  method: "clickwrap-self";
  /** ISO UTC — when the server received the ticked box. */
  checkedAt: string;
  ip: string;
  userAgent: string;
  /** Set when it was accepted through an operator order's private link. */
  orderId?: string;
  /** Where it was accepted, when that isn't the self-serve agreement page. */
  via?: string;
}

export type AgreementAcceptance = { method: "drawn-signature" } | VerbalAcceptance | ClickwrapAcceptance;

export interface AgreementRecord {
  id: string;
  plan: PlanSlug;
  /** Absent on records written before the master/addendum split — treat as `master`. */
  kind?: AgreementKind;
  /** Set on addenda. The master whose terms this instrument adopts by reference. */
  parentAgreementId?: string;
  clientLegalName: string;
  clientEntityType: string;
  clientAddress: string;
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  launchDate?: string;
  additionalSites: string[];
  /** The phone-handling choice captured at signing. See `AgreementSubmission.receptionistMode`. */
  receptionistMode?: ReceptionistMode;
  /** The existing line to forward, when `receptionistMode` is `forwarded`. */
  forwardingNumber?: string;
  /** The billing period printed on the cover. See `AgreementSubmission.billingPeriod`. */
  billingPeriod?: "monthly" | "annual";
  /** The private store's URL. Unusable without the store's token; read through `agreement-store`. */
  pdfUrl: string;
  audit: AgreementAudit;
  agreementVersion: string;
  /**
   * How the terms were accepted. Absent means a drawn signature — every record written before
   * operator closes existed — so no stored agreement needs migrating to stay valid.
   */
  acceptance?: AgreementAcceptance;
  /** The call recording, once attached from /manage. Read-aloud acceptances only. */
  recording?: AgreementRecording;
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
  /**
   * The same hold for a downgrade: accepted from the link the console request emailed, and
   * emailed to the client only once `/api/portal/downgrade` has scheduled the change.
   */
  pendingDowngrade?: boolean;
  /** Slug the downgrade is for. Only meaningful alongside `pendingDowngrade`. */
  downgradeSlug?: string;
  /**
   * The portal account that was signed in when this was accepted, taken from the session, not
   * the form. Plan-change routes bind on it (`acceptedBy`), since a held agreement isn't recorded
   * as the account's master until the change goes through.
   */
  accountEmail?: string;
  /**
   * The same hold for a Growth → Enterprise move. The client used to be emailed the Enterprise
   * agreement the moment they accepted it, before the move was known to be possible or paid for.
   */
  pendingConsolidation?: boolean;
  /** The same hold for switching the receptionist on, and the site it is for. */
  pendingReceptionist?: boolean;
  receptionistSlug?: string;
}
