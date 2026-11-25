import { NextResponse } from "next/server";
import {
  enqueueLead,
  type PlanInterest,
  type QueuedLead,
} from "@/app/lib/lead-queue";
import { checkAgencyLead, type AgencyLeadCheck } from "@/app/lib/agency-lead-gate";
import { requestHost } from "@/app/lib/turnstile-verify";

/**
 * Interest form → lead queue.
 *
 * This is a public, unauthenticated endpoint on a deployed site, so nothing that lands
 * here is trusted: every field is trimmed, length-capped, and coerced before it reaches
 * KV. The cap matters more than it looks — the console renders these strings on a
 * Kanban card, and an unbounded "business name" is a layout bug at best.
 *
 * Since 2026-11-19 it first checks a person sent it (Cloudflare Turnstile, `agency-lead-gate.ts`):
 * a failed check is refused with 403 `not-verified`, one visitor sending again and again with 429
 * `too-many`, and a lead that couldn't be checked is kept, marked unverified on its card.
 *
 * It does NOT trigger a callback. The demo agent is a separate entry point the visitor
 * dials themselves (see /api/lead/call); placing an outbound call off a web form is a
 * consent problem this deliberately avoids.
 */

/** Long enough for a real business name, short enough to never break a card. */
const MAX_FIELD = 120;
const MAX_NOTE = 1000;

function clean(v: unknown, max = MAX_FIELD): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

const PLANS: PlanInterest[] = ["website", "starter", "growth", "enterprise"];
function coercePlan(v: unknown): PlanInterest | null {
  return typeof v === "string" && (PLANS as string[]).includes(v)
    ? (v as PlanInterest)
    : null;
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = clean(body.name);
  const businessName = clean(body.businessName);
  const phone = clean(body.phone, 40);
  const email = clean(body.email);
  const note = clean(body.note, MAX_NOTE);
  const planInterest = coercePlan(body.planInterest);

  if (!name || !businessName || !phone) {
    return NextResponse.json(
      { error: "Name, business name, and phone are required." },
      { status: 400 },
    );
  }

  let check: AgencyLeadCheck;
  try {
    check = await checkAgencyLead({
      token: typeof body.turnstileToken === "string" ? body.turnstileToken.slice(0, 2048) : null,
      status: typeof body.turnstileStatus === "string" ? body.turnstileStatus : null,
      ip: clientIp(req),
      host: requestHost(req),
    });
  } catch (e) {
    // The limiter's store is down. Saving the lead below needs the same store and will say so.
    console.error("[/api/lead] human check limiter failed", e);
    check = { ok: true, verification: "unverified" };
  }
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.error === "too-many" ? 429 : 403 });
  }
  const unverified = check.verification === "unverified";

  const now = Date.now();
  const lead: QueuedLead = {
    id: crypto.randomUUID(),
    receivedAt: now,
    source: "form",
    stage: "new",
    name,
    businessName,
    phone,
    ...(email ? { email } : {}),
    planInterest,
    ...(note ? { note } : {}),
    verification: check.verification,
    activity: [
      {
        at: now,
        kind: "created",
        // The card's foot shows the last activity, so a lead nobody could check says so there.
        text: `Interest form submitted${planInterest ? ` — asked about ${planInterest}` : ""}${unverified ? ". Unverified: the human check couldn't run." : ""}`,
      },
    ],
  };

  try {
    await enqueueLead(lead);
  } catch (e) {
    // KV missing is a deployment problem, not the visitor's — say so without detail and
    // don't pretend the submission succeeded.
    console.error("[/api/lead] enqueue failed", e);
    return NextResponse.json(
      { error: "Couldn't save that just now. Please call us instead." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}

/** The visitor's IP, as Vercel reports it: the first hop of x-forwarded-for. */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : req.headers.get("x-real-ip")) || null;
}
