import { NextResponse } from "next/server";
import { verify as verifyRetellSignature } from "retell-sdk";
import { ingestDemoCall } from "@/app/lib/demo-call-ingest";

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

/**
 * Verify the `x-retell-signature` header using Retell's OWN implementation.
 *
 * This was originally hand-rolled as `HMAC-SHA256(apiKey, rawBody)` compared against a bare
 * hex header. That is not Retell's scheme, and every real delivery 401'd for two days while
 * looking perfectly healthy in tests — because the tests signed with the same wrong function
 * they verified with. A self-consistent mistake passes every test you write around it.
 *
 * The real format (retell-sdk/lib/webhook_auth.js) is:
 *
 *     header: v=<timestamp>,d=<hex>
 *     digest: HMAC-SHA256(apiKey, rawBody + timestamp)   ← timestamp appended to the body
 *     plus a 5-minute freshness window, which is genuine replay protection the hand-rolled
 *     version did not have at all.
 *
 * So: call the vendor's verifier rather than re-deriving it. A signature check is exactly the
 * wrong place to save a dependency — it fails closed and silent, which is the failure mode
 * you cannot see.
 *
 * The body must still be the exact bytes received; parsing and re-serializing would change
 * whitespace and key order and the digest would never match.
 */
async function signatureValid(raw: string, header: string | null, apiKey: string): Promise<boolean> {
  if (!header) return false;
  try {
    return await verifyRetellSignature(raw, apiKey, header);
  } catch {
    // A malformed header makes the verifier throw; that's a rejection, not a 500.
    return false;
  }
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
  if (!(await signatureValid(raw, req.headers.get("x-retell-signature"), apiKey))) {
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

  // ── 4 + 5. Idempotency and sanitising ─────────────────────────────────────
  // Shared with the reconciler cron (app/lib/demo-call-ingest.ts) so a replayed call and a
  // delivered one produce the same record.
  try {
    const result = await ingestDemoCall(call);
    if (result === "invalid") return new NextResponse(null, { status: 400 });
  } catch (e) {
    // ── 6. Fail closed, stay quiet ────────────────────────────────────────
    // A 500 makes Retell retry, which is what we want for a transient KV blip.
    console.error("[/api/lead/call] write failed", e);
    return new NextResponse(null, { status: 500 });
  }

  return new NextResponse(null, { status: 200 });
}
