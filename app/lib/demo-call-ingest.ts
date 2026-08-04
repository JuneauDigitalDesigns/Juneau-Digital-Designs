import {
  enqueueLead,
  leadIdForCall,
  upsertDemoCall,
  type DemoCall,
  type PlanInterest,
  type QueuedLead,
} from "@/app/lib/lead-queue";

/**
 * Turn one Retell `call` object into a DemoCall record, and sometimes a lead.
 *
 * Extracted from /api/lead/call so the webhook and the reconciler cron cannot drift. The
 * webhook is the fast path; the cron replays anything Retell failed to deliver. Four calls
 * were lost on 2026-08-04 with a fully healthy handler — Retell simply never delivered them —
 * so the replay path has to produce byte-identical records or the recovered leads would look
 * subtly different from the delivered ones.
 *
 * This function owns gates 4 (idempotency) and 5 (sanitising) only. Authenticity, the agent
 * allowlist and the event filter stay in the route: they are properties of the REQUEST, and
 * the cron reaches this code without a request at all.
 *
 * Writes are allowed to throw. The route maps that to a 500 so Retell retries; the cron
 * catches per call so one bad record cannot abort the batch.
 */

/** Long enough for a real answer, short enough that a card can always render it. */
const MAX_FIELD = 120;
const MAX_SUMMARY = 4000;

export function clean(v: unknown, max = MAX_FIELD): string | null {
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

export type IngestResult =
  /** A new lead entered the funnel. */
  | "lead"
  /** Logged as a call only — no caller name, so there is no way to follow up. */
  | "call"
  /** This call already produced a lead; the record was refreshed, the lead left alone. */
  | "duplicate"
  /** No usable call_id — nothing can be keyed on it. */
  | "invalid";

export async function ingestDemoCall(call: Record<string, unknown>): Promise<IngestResult> {
  const callId = clean(call.call_id, 200);
  if (!callId) return "invalid";

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

  // ── 4. Idempotency ────────────────────────────────────────────────────────
  // The call record is a plain upsert, so a redelivery just overwrites it. The LEAD is the
  // one that must not double — check the reverse index before creating one. This is what
  // makes the cron safe to run every 15 minutes over an overlapping window.
  const existingLeadId = await leadIdForCall(callId);

  if (existingLeadId) {
    await upsertDemoCall({ ...record, leadId: existingLeadId });
    return "duplicate";
  }

  if (!callerName) {
    // No name means no way to follow up, so it stays a logged call and never enters the
    // funnel — a board full of bare phone numbers buries the leads worth working.
    await upsertDemoCall(record);
    return "call";
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
  return "lead";
}
