import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  enqueueLead,
  leadIdForCall,
  upsertDemoCall,
  type DemoCall,
  type PlanInterest,
  type QueuedLead,
} from "@/app/lib/lead-queue";

/**
 * Retell post-call webhook → demo call log, and sometimes a lead.
 *
 * This is the only publicly reachable WRITE path in the leads feature. Everything else is
 * either the local-only console or a flow the visitor drove themselves. It writes straight
 * into the KV that backs the funnel, so it is gated in layers, and each layer exists to
 * stop a different thing:
 *
 *   1. signature      — someone who isn't Retell
 *   2. agent allowlist— Retell, but one of the CLIENT agents, not our demo
 *   3. event filter    — our agent, but an event with no analysis on it yet
 *   4. idempotency     — the same real call delivered twice
 *   5. field sanitising— a real call where the caller said something absurd
 *   6. quiet failures  — anyone probing to learn how the above works
 *
 * A valid signature alone is NOT authorization: every client agent provisioned by
 * onboard.js signs with the same account key, so without step 2 a customer's call log
 * could manufacture JDD leads.
 */

export const runtime = "nodejs";

/** Long enough for a real answer, short enough that a card can always render it. */
const MAX_FIELD = 120;
const MAX_SUMMARY = 4000;

function clean(v: unknown, max = MAX_FIELD): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || t.toLowerCase() === "null" || t.toLowerCase() === "n/a") return null;
  return t.slice(0, max);
}

const PLANS: PlanInterest[] = ["starter", "growth", "enterprise"];
function coercePlan(v: unknown): PlanInterest | null {
  if (typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return (PLANS as string[]).includes(t) ? (t as PlanInterest) : null;
}

/**
 * Retell signs with HMAC-SHA256 over the RAW body, keyed with the API key.
 *
 * The body must be the exact bytes received — parsing to JSON and re-serializing changes
 * key order and whitespace, and the digest would never match again. Compared in constant
 * time so the check can't be walked byte-by-byte with a timer.
 */
function signatureValid(raw: string, header: string | null, apiKey: string): boolean {
  if (!header) return false;
  // Some senders prefix the algorithm ("v1=..."); take the last field either way.
  const provided = header.includes("=") ? header.split("=").pop()!.trim() : header.trim();
  const expected = createHmac("sha256", apiKey).update(raw, "utf8").digest("hex");

  const a = Buffer.from(provided, "hex");
  const b = Buffer.from(expected, "hex");
  // timingSafeEqual throws on a length mismatch, which would itself leak a bit.
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const apiKey = process.env.RETELL_API_KEY;
  const demoAgentId = process.env.DEMO_RETELL_AGENT_ID;

  if (!apiKey || !demoAgentId) {
    // Misconfiguration, not an attack. Loud in the log, blank to the caller.
    console.error("[/api/lead/call] RETELL_API_KEY or DEMO_RETELL_AGENT_ID not set");
    return new NextResponse(null, { status: 500 });
  }

  const raw = await req.text();

  // ── 1. Authenticity ───────────────────────────────────────────────────────
  if (!signatureValid(raw, req.headers.get("x-retell-signature"), apiKey)) {
    console.warn("[/api/lead/call] rejected: bad or missing signature");
    return new NextResponse(null, { status: 401 });
  }

  let payload: {
    event?: string;
    call?: Record<string, unknown>;
  };
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const call = (payload.call ?? {}) as Record<string, unknown>;
  const agentId = typeof call.agent_id === "string" ? call.agent_id : null;

  // ── 2. Authorization ──────────────────────────────────────────────────────
  // 200, not 403: this IS a legitimate delivery from our own Retell account, just from a
  // client's agent rather than the demo. A non-2xx would make Retell retry it forever.
  if (agentId !== demoAgentId) {
    return new NextResponse(null, { status: 200 });
  }

  // ── 3. Event filter ───────────────────────────────────────────────────────
  // Only call_analyzed carries post_call_analysis_data. Acting on call_ended would create
  // cards with every extracted field empty.
  if (payload.event !== "call_analyzed") {
    return new NextResponse(null, { status: 200 });
  }

  const callId = clean(call.call_id, 200);
  if (!callId) return new NextResponse(null, { status: 400 });

  // ── 5. Sanitise (applied before anything is stored) ───────────────────────
  const analysis = (call.call_analysis ?? {}) as Record<string, unknown>;
  const custom = (analysis.custom_analysis_data ?? {}) as Record<string, unknown>;

  const startMs = typeof call.start_timestamp === "number" ? call.start_timestamp : Date.now();
  const endMs = typeof call.end_timestamp === "number" ? call.end_timestamp : null;

  const record: DemoCall = {
    callId,
    at: startMs,
    fromNumber: clean(call.from_number, 40),
    durationMs: endMs && endMs > startMs ? endMs - startMs : null,
    outcome: clean(custom.call_outcome),
    disconnectionReason: clean(call.disconnection_reason),
    summary: clean(analysis.call_summary, MAX_SUMMARY),
    recordingUrl: clean(call.recording_url, 2000),
  };

  const callerName = clean(custom.caller_name);
  const businessName = clean(custom.business_name);
  const callerEmail = clean(custom.caller_email);
  const trade = clean(custom.trade);
  const planInterest = coercePlan(custom.plan_interest);

  try {
    // ── 4. Idempotency ──────────────────────────────────────────────────────
    // The call record is a plain upsert, so a redelivery just overwrites it. The LEAD is
    // the one that must not double — check the reverse index before creating one.
    const existingLeadId = await leadIdForCall(callId);

    if (!callerName || existingLeadId) {
      // No name means no way to follow up, so it stays a logged call and never enters the
      // funnel — a board full of bare phone numbers buries the leads worth working.
      await upsertDemoCall({ ...record, ...(existingLeadId ? { leadId: existingLeadId } : {}) });
      return new NextResponse(null, { status: 200 });
    }

    const lead: QueuedLead = {
      id: crypto.randomUUID(),
      receivedAt: startMs,
      source: "call",
      // A four-minute conversation with our agent is not a cold lead. Entering at
      // "qualified" is what keeps New meaning "hasn't heard it yet".
      stage: "qualified",
      name: callerName,
      businessName: businessName ?? callerName,
      phone: record.fromNumber ?? "",
      ...(callerEmail ? { email: callerEmail } : {}),
      planInterest,
      ...(trade ? { trade } : {}),
      callId,
      activity: [
        {
          at: startMs,
          kind: "call",
          text: `Called the demo agent${record.outcome ? ` — ${record.outcome}` : ""}`,
        },
      ],
    };

    await enqueueLead(lead);
    await upsertDemoCall({ ...record, leadId: lead.id });
  } catch (e) {
    // ── 6. Fail closed, stay quiet ────────────────────────────────────────
    // A 500 makes Retell retry, which is what we want for a transient KV blip.
    console.error("[/api/lead/call] write failed", e);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
