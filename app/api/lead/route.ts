import { NextResponse } from "next/server";
import {
  enqueueLead,
  type PlanInterest,
  type QueuedLead,
} from "@/app/lib/lead-queue";

/**
 * Interest form → lead queue.
 *
 * This is a public, unauthenticated endpoint on a deployed site, so nothing that lands
 * here is trusted: every field is trimmed, length-capped, and coerced before it reaches
 * KV. The cap matters more than it looks — the console renders these strings on a
 * Kanban card, and an unbounded "business name" is a layout bug at best.
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

const PLANS: PlanInterest[] = ["starter", "growth", "enterprise"];
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
    activity: [
      {
        at: now,
        kind: "created",
        text: `Interest form submitted${planInterest ? ` — asked about ${planInterest}` : ""}`,
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
