import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { generateSignedPdf, hashSubmission, stripLastPage } from "@/app/lib/pdf-signer";
import { saveAgreement } from "@/app/lib/kv";
import { sendSignedAgreementEmails } from "@/app/lib/agreement-email";
import type {
  AgreementAudit,
  AgreementRecord,
  AgreementSubmission,
  PlanSlug,
} from "@/app/lib/agreement-types";

export const runtime = "nodejs";

const VALID_PLANS: PlanSlug[] = ["starter", "growth", "enterprise"];

export async function POST(req: Request) {
  let body: AgreementSubmission;
  try {
    body = (await req.json()) as AgreementSubmission;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const err = validate(body);
  if (err) return NextResponse.json({ error: err }, { status: 400 });

  const id = randomUUID();
  const audit: AgreementAudit = {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent") || "unknown",
    signedAt: new Date().toISOString(),
    payloadHash: hashSubmission(body),
  };

  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generateSignedPdf(body, audit, id);
  } catch (e) {
    console.error("[/api/agreement] pdf generation failed", e);
    return NextResponse.json({ error: "Could not generate signed PDF" }, { status: 500 });
  }

  let pdfUrl: string;
  try {
    const filename = `agreements/${id}.pdf`;
    const uploaded = await put(filename, Buffer.from(pdfBytes), {
      access: "public",
      contentType: "application/pdf",
    });
    pdfUrl = uploaded.url;
  } catch (e) {
    console.error("[/api/agreement] blob upload failed", e);
    return NextResponse.json({ error: "Could not store signed PDF" }, { status: 500 });
  }

  const record: AgreementRecord = {
    id,
    plan: body.plan,
    clientLegalName: body.clientLegalName,
    clientEntityType: body.clientEntityType,
    clientAddress: body.clientAddress,
    signerName: body.signerName,
    signerTitle: body.signerTitle,
    signerEmail: body.signerEmail,
    additionalSites: body.additionalSites,
    pdfUrl,
    audit,
    agreementVersion: "v3.1",
  };

  try {
    await saveAgreement(record);
  } catch (e) {
    console.error("[/api/agreement] KV save failed", e);
    return NextResponse.json({ error: "Could not save agreement record" }, { status: 500 });
  }

  // Email is fire-and-forget; failure is logged but doesn't block the response.
  // Strip the audit-trail page before sending to the client.
  stripLastPage(pdfBytes)
    .then((clientPdfBytes) => sendSignedAgreementEmails(record, clientPdfBytes))
    .catch((e) => console.error("[/api/agreement] email failed", e));

  return NextResponse.json({ agreement_id: id, pdf_url: pdfUrl });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function validate(body: AgreementSubmission): string | null {
  if (!VALID_PLANS.includes(body.plan)) return "Invalid plan";
  if (!nonEmpty(body.clientLegalName)) return "Missing client legal name";
  if (!nonEmpty(body.clientEntityType)) return "Missing entity type";
  if (!nonEmpty(body.clientAddress)) return "Missing client address";
  if (!nonEmpty(body.signerName)) return "Missing signer name";
  if (!nonEmpty(body.signerTitle)) return "Missing signer title";
  if (!validEmail(body.signerEmail)) return "Invalid signer email";
  if (!body.signatureDataUrl?.startsWith("data:image/png;base64,")) {
    return "Missing or invalid signature";
  }
  if (body.plan === "enterprise") {
    const sites = (body.additionalSites || []).filter(nonEmpty);
    if (sites.length < 2) return "Enterprise requires at least 2 site names";
  }
  return null;
}

function nonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function validEmail(s: unknown): s is string {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}
