import "server-only";
import { PDFDocument } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { getAddendumForPlan, getSchedule, getTermsForPlan, PROVIDER, WEB_ONLY_SCHEDULE } from "./legal";
import { PdfDoc, renderSections } from "./legal/pdf-renderer";
import { coverPrice } from "./legal/cover";
import type {
  AgreementAcceptance,
  AgreementSubmission,
  AgreementAudit,
  ClickwrapAcceptance,
  VerbalAcceptance,
} from "./agreement-types";

const PROVIDER_SIG_PATH = resolve(process.cwd(), "public", "signature.png");

/**
 * Builds the executed agreement from the structured terms — the same content
 * the client scrolled through on /agreement — then appends an audit-trail page.
 *
 * This replaces the previous approach of stamping a static PDF at fixed x/y
 * coordinates: the terms now have exactly one source, so the document a client
 * reads and the document they sign cannot drift apart.
 */
export async function generateSignedPdf(
  submission: AgreementSubmission,
  audit: AgreementAudit,
  agreementId: string,
  /**
   * How the client accepted. A drawn signature (absent, or `drawn-signature`) prints the image;
   * a ticked box (`clickwrap-self`) or a yes on a sales call (`verbal-operator`) prints an
   * acceptance block in its place, and the audit page records what actually happened. Everything
   * else, the terms included, is the same document.
   */
  acceptance?: AgreementAcceptance,
): Promise<Uint8Array> {
  const verbal = acceptance?.method === "verbal-operator" ? acceptance : undefined;
  const clickwrap = acceptance?.method === "clickwrap-self" ? acceptance : undefined;
  /**
   * Master or addendum, resolved once here.
   *
   * Both are built from the same `Section`/`Block` vocabulary, so everything below this
   * branch — cover, `renderSections`, signature block, audit page — is identical for either.
   * That was the constraint the addendum was authored under, and it is why a second
   * instrument costs one branch instead of a second renderer.
   */
  const isAddendum = submission.kind === "addendum";
  /**
   * Website-only is a Starter-plan master choice. When the client declined the receptionist at
   * signing, the executed PDF must describe the Website-Only schedule — the cover, Schedule A
   * and the terms all have to say what they actually signed, not the standard Starter package.
   * Scoped to the master: the addendum has no web-only variant.
   */
  const webOnly =
    submission.receptionistMode === "declined" && submission.plan === "starter" && !isAddendum;
  const schedule = webOnly ? WEB_ONLY_SCHEDULE : getSchedule(submission.plan);
  const { version, sections } = isAddendum
    ? getAddendumForPlan(schedule, { siteNames: submission.additionalSites })
    : getTermsForPlan(submission.plan, { siteNames: submission.additionalSites, webOnly });

  const doc = await PdfDoc.create();
  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  /* ── Cover ── */
  doc.text(isAddendum ? "SITE ADDENDUM" : "SERVICE AGREEMENT", { size: 18, bold: true, after: 2 });
  doc.text(`${schedule.name.toUpperCase()} PLAN — ${version.toUpperCase()}`, {
    size: 11,
    bold: true,
    after: 8,
  });
  doc.rule();
  doc.space(6);

  doc.text(PROVIDER.legalName, { size: 10.5, bold: true, after: 1 });
  doc.text(`${PROVIDER.addressLine}, ${PROVIDER.cityStateZip}`, { size: 9.5, after: 14 });

  doc.text(
    isAddendum
      ? 'This Site Addendum ("Addendum") is entered into between:'
      : 'This Service Agreement ("Agreement") is entered into between:',
    { size: 9.5, after: 10 },
  );

  doc.text(
    `Provider: ${PROVIDER.legalName}, a Florida limited liability company located at ${PROVIDER.addressLine}, ${PROVIDER.cityStateZip} ("we," "us," or "JDD").`,
    { size: 9.5, after: 8 },
  );
  doc.text(
    `Client: ${submission.clientLegalName}, a ${submission.clientEntityType} located at ${submission.clientAddress} ("you," "your," or "Client").`,
    { size: 9.5, after: 8 },
  );
  doc.text(`Effective Date: ${today}`, { size: 9.5, bold: true, after: 14 });

  doc.callout(
    `PLAN SELECTED: ${schedule.name.toUpperCase()} — ${coverPrice(schedule, submission.billingPeriod)}. ` +
      `THIS ${isAddendum ? "ADDENDUM" : "AGREEMENT"} COVERS ${schedule.siteLabel.toUpperCase()}. ` +
      `IF YOU INTENDED TO SIGN UP FOR A DIFFERENT PLAN, DO NOT SIGN THIS DOCUMENT — CONTACT PROVIDER FOR THE CORRECT ONE.`,
  );

  /* ── Body + Schedule A ── */
  renderSections(doc, sections);

  /* ── Signatures ── */
  doc.newPage();
  doc.text("SIGNATURES", { size: 13, bold: true, after: 3 });
  doc.rule();
  doc.text(
    "By signing below, each party acknowledges that they have read this Agreement in full, understand its terms " +
      "(including the arbitration and class-action waiver), and agree to be bound by it." +
      (submission.plan === "enterprise"
        ? " Client further represents that they have full authority to bind all businesses or entities listed as sites in Schedule A."
        : ""),
    { size: 9.5, after: 18 },
  );

  const providerSig = await doc.pdf.embedPng(await readFile(PROVIDER_SIG_PATH));
  doc.text(`PROVIDER: ${PROVIDER.legalName.toUpperCase()}`, { size: 9.5, bold: true, after: 6 });
  doc.image(providerSig, 150, 46);
  doc.rule();
  doc.labelValue("Name:", PROVIDER.signerName);
  doc.labelValue("Title:", PROVIDER.signerTitle);
  doc.labelValue("Date:", today);

  doc.space(26);

  doc.text("CLIENT:", { size: 9.5, bold: true, after: 6 });
  if (verbal) {
    doc.text(verbalAcceptanceText(submission, verbal), { size: 9.5, after: 8 });
  } else if (clickwrap) {
    doc.text(clickwrapAcceptanceText(submission, clickwrap), { size: 9.5, after: 8 });
  } else {
    const sigBase64 = submission.signatureDataUrl?.split(",")[1] ?? "";
    const clientSig = await doc.pdf.embedPng(Buffer.from(sigBase64, "base64"));
    doc.image(clientSig, 150, 46);
  }
  doc.rule();
  doc.labelValue("Name:", submission.signerName);
  doc.labelValue("Title:", submission.signerTitle);
  doc.labelValue("Business:", submission.clientLegalName);
  doc.labelValue("Email:", submission.signerEmail);
  doc.labelValue("Date:", today);

  /* ── Audit trail (stripped before the client copy is emailed) ── */
  doc.newPage();
  doc.text("AUDIT TRAIL", { size: 16, bold: true, after: 3 });
  doc.rule();
  doc.text(
    verbal
      ? `Verbal acceptance record for Service Agreement ${version}`
      : clickwrap
        ? `Electronic acceptance record for Service Agreement ${version}`
        : `Electronic signature record for Service Agreement ${version}`,
    { size: 9.5, after: 16 },
  );

  // A verbal acceptance has no browser behind it, so the scroll, dwell, IP and user-agent rows
  // would be blank at best and misleading at worst. It records the call instead.
  const acceptanceRows: [string, string][] = verbal
    ? [
        ["Accepted", "Verbally, on a telephone call"],
        ["Recorded at (UTC)", verbal.confirmedAt],
        ["Recorded by (operator)", verbal.operator],
        ["Call reference", verbal.callRef],
        ["Order ID", verbal.orderId],
        ["Script version", verbal.scriptVersion],
        ["Script hash (SHA-256)", verbal.scriptHash],
      ]
    : [
        ["Terms scrolled to end", audit.scrollCompletedAt],
        ["Time on page", formatDuration(audit.dwellMs)],
        clickwrap ? ["Accepted (box ticked) at (UTC)", clickwrap.checkedAt] : ["Signed at (UTC)", audit.signedAt],
        ["IP address", audit.ip],
        ["User agent", audit.userAgent],
      ];

  const rows: [string, string][] = [
    ["Agreement ID", agreementId],
    ["Plan selected", schedule.name.toUpperCase()],
    ["Terms version", version],
    ["Terms hash (SHA-256)", audit.termsHash],
    ["", ""],
    ["Signer name", submission.signerName],
    ["Signer title", submission.signerTitle],
    ["Signer email", submission.signerEmail],
    ["Client business", submission.clientLegalName],
    ["Client entity type", submission.clientEntityType],
    ["Client address", submission.clientAddress],
    ["", ""],
    ...acceptanceRows,
    ["Payload hash (SHA-256)", audit.payloadHash],
  ];

  for (const [label, value] of rows) {
    if (!label && !value) {
      doc.space(8);
      continue;
    }
    doc.labelValue(label, value);
  }

  doc.space(20);
  doc.text(
    verbal
      ? // Legal wording approved by Xander, 2026-11-03 (PLAN §9.4).
        "The client accepted this agreement verbally during a telephone call. The operator read the plan, price, " +
          "billing period, automatic renewal and cancellation terms aloud from the script identified above, the client " +
          "agreed, and the operator recorded that acceptance at the time shown. The full terms, identified by the terms " +
          "hash above, were emailed to the client at the address shown immediately afterwards."
      : clickwrap
        ? "This electronic acceptance complies with the ESIGN Act of 2000 and the Uniform Electronic Transactions Act (UETA). " +
          "The client affirmed intent to be bound by the agreement above by scrolling through the full terms and checking " +
          "the box stating they had read and agree to the Terms of Service on juneaudigitaldesigns.com/agreement. " +
          "The terms hash above identifies the exact text presented to the client at the time of acceptance."
        : "This electronic signature complies with the ESIGN Act of 2000 and the Uniform Electronic Transactions Act (UETA). " +
          "The signer affirmed intent to be bound by the agreement above by scrolling through the full terms, drawing their " +
          "signature on a touch or pointer interface, and checking the acceptance box on juneaudigitaldesigns.com/agreement. " +
          "The terms hash above identifies the exact text presented to the signer at the time of signing.",
    { size: 8.5, after: 0 },
  );

  return doc.finish();
}

/** The block printed where a drawn signature would go. Wording approved 2026-11-03 (PLAN §9.4). */
function verbalAcceptanceText(submission: AgreementSubmission, verbal: VerbalAcceptance): string {
  const at = new Date(verbal.confirmedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
  return (
    `Accepted by verbal consent during a telephone call on ${at} ET. The terms summarised above were read to ` +
    `${submission.signerName} (${submission.signerEmail}), who agreed to them. Acceptance was recorded by ` +
    `${PROVIDER.legalName} (operator: ${verbal.operator}). Call reference: ${verbal.callRef}.`
  );
}

/** The block printed where a drawn signature would go, for a ticked box. */
function clickwrapAcceptanceText(submission: AgreementSubmission, clickwrap: ClickwrapAcceptance): string {
  const at = new Date(clickwrap.checkedAt).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/New_York",
  });
  return (
    `Accepted electronically on ${at} ET by ${submission.signerName} (${submission.signerEmail}), ` +
    `who checked the box stating they had read and agree to the Terms of Service.`
  );
}

/** SHA-256 of the canonicalized submission, excluding the large signature blob. */
export function hashSubmission(submission: AgreementSubmission): string {
  const { signatureDataUrl: _sig, ...rest } = submission;
  const canon = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash("sha256").update(canon).digest("hex");
}

/**
 * Returns a copy of the PDF with the last page (audit trail) removed.
 * Used to produce the client-facing copy that excludes internal audit data.
 */
export async function stripLastPage(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const src = await PDFDocument.load(pdfBytes);
  const pageCount = src.getPageCount();
  const dest = await PDFDocument.create();
  const indices = Array.from({ length: pageCount - 1 }, (_, i) => i);
  const copied = await dest.copyPages(src, indices);
  copied.forEach((p) => dest.addPage(p));
  return dest.save();
}

function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "unknown";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}m ${s}s (${ms} ms)` : `${s}s (${ms} ms)`;
}
