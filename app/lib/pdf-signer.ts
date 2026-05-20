import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { PLAN_FIELDS } from "./pdf-field-positions";
import type { AgreementSubmission, AgreementAudit } from "./agreement-types";

const PROVIDER_SIG_PATH = resolve(process.cwd(), "public", "signature.png");

const PDF_PATHS: Record<"starter" | "growth" | "enterprise", string> = {
  starter:    resolve(process.cwd(), "public", "legal", "JDD_agreement_starter_v3.1.pdf"),
  growth:     resolve(process.cwd(), "public", "legal", "JDD_agreement_growth_v3.1.pdf"),
  enterprise: resolve(process.cwd(), "public", "legal", "JDD_agreement_enterprise_v3.1.pdf"),
};

const PLAN_MIN_PAGES: Record<"starter" | "growth" | "enterprise", number> = {
  starter:    16,
  growth:     20,
  enterprise: 23,
};

/**
 * Loads the plan-specific unsigned MSA, stamps the client's info + signature
 * image onto the existing fields, and appends an audit-trail page. Returns
 * the resulting PDF bytes for upload to Vercel Blob.
 */
export async function generateSignedPdf(
  submission: AgreementSubmission,
  audit: AgreementAudit,
  agreementId: string,
): Promise<Uint8Array> {
  const pdfPath = PDF_PATHS[submission.plan];
  const original = await readFile(pdfPath);
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages = pdf.getPages();
  const minPages = PLAN_MIN_PAGES[submission.plan];
  if (pages.length < minPages) {
    throw new Error(`Expected ≥${minPages} pages in ${submission.plan} MSA, got ${pages.length}`);
  }

  const F = PLAN_FIELDS[submission.plan];

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });

  // ── Page 1: Header ──
  const p1 = pages[0];
  draw(p1, submission.clientLegalName, F.page1_clientName, font);
  draw(p1, submission.clientEntityType, F.page1_clientEntity, font);
  draw(p1, submission.clientAddress, F.page1_clientAddress, font);
  draw(p1, today, F.page1_effectiveDate, font);

  // ── Provider (JDD) signature block ──
  const providerSigBytes = await readFile(PROVIDER_SIG_PATH);
  const providerSigImage = await pdf.embedPng(providerSigBytes);
  const pProvider = pages[F.provider_sigImage.page - 1];
  pProvider.drawImage(providerSigImage, {
    x: F.provider_sigImage.x,
    y: F.provider_sigImage.y,
    width: F.provider_sigImage.width,
    height: F.provider_sigImage.height,
  });
  draw(pProvider, "Xander Juneau", F.provider_name, font);
  draw(pProvider, "Founder", F.provider_title, font);
  draw(pProvider, today, F.provider_date, font);

  // ── Signature block — page A: sig image + signer name ──
  const pSigA = pages[F.sigA_clientSigImage.page - 1];
  const sigDataUrl = submission.signatureDataUrl;
  if (sigDataUrl.startsWith("data:image/png;base64,")) {
    const sigBytes = Buffer.from(sigDataUrl.split(",")[1], "base64");
    const sigImage = await pdf.embedPng(sigBytes);
    const s = F.sigA_clientSigImage;
    pSigA.drawImage(sigImage, { x: s.x, y: s.y, width: s.width, height: s.height });
  }
  draw(pSigA, submission.signerName, F.sigA_clientName, font);

  // ── Signature block — page B: title / business / date ──
  const pSigB = pages[F.sigB_clientTitle.page - 1];
  draw(pSigB, submission.signerTitle, F.sigB_clientTitle, font);
  draw(pSigB, submission.clientLegalName, F.sigB_clientBusiness, font);
  draw(pSigB, today, F.sigB_clientDate, font);

  // ── Schedule A: site names (enterprise only) ──
  if (submission.plan === "enterprise") {
    const [s1 = "", s2 = "", s3 = ""] = submission.additionalSites;
    if (s1 && F.schedA_site1) draw(pages[F.schedA_site1.page - 1], s1, F.schedA_site1, font);
    if (s2 && F.schedA_site2) draw(pages[F.schedA_site2.page - 1], s2, F.schedA_site2, font);
    if (s3 && F.schedA_site3) draw(pages[F.schedA_site3.page - 1], s3, F.schedA_site3, font);
  }

  // ── Append audit-trail page ──
  const audit_p = pdf.addPage([612, 792]);
  let y = 740;
  audit_p.drawText("AUDIT TRAIL", { x: 72, y, size: 18, font: fontBold });
  y -= 6;
  audit_p.drawLine({
    start: { x: 72, y: y - 8 },
    end:   { x: 540, y: y - 8 },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  y -= 32;
  audit_p.drawText("Electronic signature record for Master Services Agreement v3.1", {
    x: 72, y, size: 11, font,
  });
  y -= 30;

  const rows: [string, string][] = [
    ["Agreement ID",          agreementId],
    ["Plan selected",         submission.plan.toUpperCase()],
    ["",                      ""],
    ["Signer name",           submission.signerName],
    ["Signer title",          submission.signerTitle],
    ["Signer email",          submission.signerEmail],
    ["Client business",       submission.clientLegalName],
    ["Client entity type",    submission.clientEntityType],
    ["Client address",        submission.clientAddress],
    ["",                      ""],
    ["Signed at (UTC)",       audit.signedAt],
    ["IP address",            audit.ip],
    ["User agent",            truncate(audit.userAgent, 75)],
    ["Payload hash (SHA-256)", audit.payloadHash],
  ];

  for (const [label, value] of rows) {
    if (label === "" && value === "") {
      y -= 8;
      continue;
    }
    audit_p.drawText(label, { x: 72, y, size: 9, font: fontBold });
    audit_p.drawText(value, { x: 220, y, size: 9, font });
    y -= 14;
  }

  y -= 24;
  const gray = rgb(0.32, 0.32, 0.32);
  const legalLines = [
    "This electronic signature complies with the ESIGN Act of 2000 and the Uniform",
    "Electronic Transactions Act (UETA). The signer affirmed intent to be bound by the",
    "agreement above by drawing their signature on a touch/pointer interface and checking",
    "the acceptance box on juneaudigitaldesigns.com/agreement.",
  ];
  for (const line of legalLines) {
    audit_p.drawText(line, { x: 72, y, size: 9, font, color: gray });
    y -= 12;
  }

  return pdf.save();
}

/** SHA-256 hash of canonicalized submission (excluding the large signature blob). */
export function hashSubmission(submission: AgreementSubmission): string {
  const { signatureDataUrl: _sig, ...rest } = submission;
  const canon = JSON.stringify(rest, Object.keys(rest).sort());
  return createHash("sha256").update(canon).digest("hex");
}

/**
 * Returns a copy of the PDF with the last page (audit trail) removed.
 * Copies all pages except the last into a fresh document — reliable across all pdf-lib versions.
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

// ── helpers ──

type FieldPos = { x: number; y: number; fontSize?: number };

function draw(page: ReturnType<PDFDocument["getPages"]>[number], text: string, pos: FieldPos, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  page.drawText(text, { x: pos.x, y: pos.y, size: pos.fontSize ?? 11, font });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}