import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveDraft, getDraft } from "@/app/lib/onboarding-draft-store";
import { findTaxIdPaths } from "@/app/lib/tax-id-guard.mjs";

export async function GET(request: Request) {
  const ctx = await resolvePortalRequest(request);
  if (!ctx.ok) return ctx.response;

  // `ctx.site` is resolved from `?site=` and validated against the account, so the draft is
  // always scoped to a site this client actually owns.
  const draft = await getDraft(ctx.userId, ctx.site.slug);
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

  /**
   * The draft store is a 30-day TTL in Redis, so nothing tax-ID-shaped may enter it.
   *
   * The A2P identity step keeps its fields out of the wizard's `formData` entirely, which is
   * what actually prevents this; the client refuses the same write before it reaches the
   * network. This is the server's own copy of that refusal, because the client is not where a
   * retention guarantee can live — an older cached bundle, or a direct PUT, reaches here with
   * whatever it likes.
   *
   * A value-shape check rather than a key denylist: it holds through a rename, which is the
   * exact failure a denylist has.
   */
  const leaked = findTaxIdPaths(body.data);
  if (leaked.length) {
    // Paths, never values — this line goes to the runtime logs.
    console.error(`[onboarding-draft] refused: tax-ID-shaped value at ${leaked.join(", ")}`);
    return NextResponse.json({ error: "Draft rejected" }, { status: 422 });
  }

  await saveDraft(ctx.userId, body.data, ctx.site.slug);
  return NextResponse.json({ ok: true });
}
