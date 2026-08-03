import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveDraft, getDraft } from "@/app/lib/onboarding-draft-store";

export async function GET(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  const draft = await getDraft(ctx.userId);
  return NextResponse.json({ data: draft?.data ?? null, savedAt: draft?.savedAt ?? null });
}

export async function PUT(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  let body: { data?: Record<string, unknown> };
  try {
    body = (await request.json()) as { data?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "Missing data" }, { status: 400 });
  }

  await saveDraft(ctx.userId, body.data);
  return NextResponse.json({ ok: true });
}
