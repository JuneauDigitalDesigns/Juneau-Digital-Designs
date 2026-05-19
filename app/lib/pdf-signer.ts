import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { FIELDS } from "./pdf-field-positions";
import type { AgreementSubmission, AgreementAudit } from "./agreement-types";

const MSA_PATH = resolve(process.cwd(), "public", "legal", "msa-v2.pdf");

const PLAN_PRICING: Record<string, { monthly: string; setup: string }> = {
  starter:    { monthly: "$117", setup: "$100" },
  growth:     { monthly: "$297", setup: "—" },
  enterprise: { monthly: "$697", setup: "—" },
};

/**
 * Loads the unsigned MSA, stamps the client's info + signature image onto the
 * existing fields, and appends an audit-trail page. Returns the resulting PDF
 * bytes for upload to Vercel Blob.
 */
export async function generateSignedPdf(
  submission: AgreementSubmission,
  audit: AgreementAudit,
  agreementId: string,
): Promise<Uint8Array> {
  const original = await readFile(MSA_PATH);
  const pdf = await PDFDocument.load(original);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pages = pdf.getPages();
  if (pages.length < 13) {
    throw new Error(`Expected ≥13 pages in MSA, got ${pages.length}`);
  }

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });

  // ── Page 1: Header ──
  const p1 = pages[0];
  draw(p1, submission.clientLegalName, FIELDS.page1_clientName, font);
  draw(p1, submission.clientEntityType, FIELDS.page1_clientEntity, font);
  draw(p1, submission.clientAddress, FIELDS.page1_clientAddress, font);
  draw(p1, today, FIELDS.page1_effectiveDate, font);

  // ── Page 11: Client signature block ──
  const p11 = pages[10];

  // Embed signature PNG
  const sigDataUrl = submission.signatureDataUrl;
  if (sigDataUrl.startsWith("data:image/png;base64,")) {
    const sigBytes = Buffer.from(sigDataUrl.split(",")[1], "base64");
    const sigImage = await pdf.embedPng(sigBytes);
    const s = FIELDS.page11_clientSigImage;
    p11.drawImage(sigImage, { x: s.x, y: s.y, width: s.width, height: s.height });
  }

  draw(p11, submission.signerName, FIELDS.page11_clientName, font);
  draw(p11, submission.signerTitle, FIELDS.page11_clientTitle, font);
  draw(p11, submission.clientLegalName, FIELDS.page11_clientBusiness, font);
  draw(p11, today, FIELDS.page11_clientDate, font);

  // ── Page 13: Schedule A selections ──
  const p13 = pages[12];
  const pricing = PLAN_PRICING[submission.plan];

  const planBoxes = {
    starter:    FIELDS.page13_planCheckboxStarter,
    growth:     FIELDS.page13_planCheckboxGrowth,
    enterprise: FIELDS.page13_planCheckboxEnterprise,
  };
  const box = planBoxes[submission.plan];
  p13.drawText("x", { x: box.x, y: box.y, size: 12, font: fontBold });

  draw(p13, pricing.monthly, FIELDS.page13_monthlyFee, font);
  draw(p13, pricing.setup,   FIELDS.page13_setupFee,   font);
  draw(p13, formatDate(submission.launchDate), FIELDS.page13_launchDate, font);

  if (submission.plan === "enterprise") {
    const [s1 = "", s2 = "", s3 = ""] = submission.additionalSites;
    if (s1) draw(p13, s1, FIELDS.page13_site1, font);
    if (s2) draw(p13, s2, FIELDS.page13_site2, font);
    if (s3) draw(p13, s3, FIELDS.page13_site3, font);
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
  audit_p.drawText("Electronic signature record for Master Services Agreement v2.0", {
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

// ── helpers ──

type FieldPos = { x: number; y: number; fontSize?: number };

function draw(page: ReturnType<PDFDocument["getPages"]>[number], text: string, pos: FieldPos, font: Awaited<ReturnType<PDFDocument["embedFont"]>>) {
  page.drawText(text, { x: pos.x, y: pos.y, size: pos.fontSize ?? 11, font });
}

function formatDate(yyyymmdd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyymmdd)) return yyyymmdd;
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  });
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
