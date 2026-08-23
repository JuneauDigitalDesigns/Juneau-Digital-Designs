import { NextResponse } from "next/server";
import { ingestDemoCall, type IngestResult } from "@/app/lib/demo-call-ingest";

/**
 * Replay any demo call Retell did not deliver.
 *
 * The webhook at /api/lead/call is the fast path, and it works — verified against production
 * with signed probes. But on 2026-08-04 four calls never arrived while the handler, its env,
 * its key and the agent's webhook_url were all correct, and nothing raised a flag: a
 * webhook-only design fails silently, so the first sign of trouble is a salesperson noticing
 * an empty board hours later.
 *
 * Retell keeps the calls and their analysis, so the fix is to stop treating delivery as the
 * only way data arrives. This lists recent calls for the demo agent and pushes anything
 * missing through the same ingest the webhook uses. Idempotency lives in ingestDemoCall
 * (reverse call→lead index + upsert), so overlapping windows are free and re-running is safe.
 *
 * Invoked by Vercel cron (see vercel.json), or by hand with ?since=<epoch-ms> to backfill.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Overlaps the daily cron with two hours to spare.
 *
 * Hobby does not guarantee the firing minute, so an exactly-24h window can leave an
 * uncovered gap between two runs that drift apart — precisely the calls this exists to
 * catch. Re-ingesting a call already seen costs one KV read, so the overlap is nearly free.
 */
const DEFAULT_LOOKBACK_MS = 26 * 60 * 60 * 1000;
/** Retell caps page size; keep well under it and paginate. */
const PAGE_SIZE = 100;
/** Stops a bad `since` from walking the entire call history. */
const MAX_PAGES = 20;

interface RetellCall extends Record<string, unknown> {
  call_id?: string;
  start_timestamp?: number;
  call_analysis?: unknown;
}

async function listCallsSince(
  apiKey: string,
  agentId: string,
  since: number,
  until: number,
): Promise<RetellCall[]> {
  const out: RetellCall[] = [];
  let paginationKey: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch("https://api.retellai.com/v2/list-calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        filter_criteria: { agent_id: [agentId] },
        sort_order: "descending",
        limit: PAGE_SIZE,
        ...(paginationKey ? { pagination_key: paginationKey } : {}),
      }),
    });
    if (!res.ok) {
      throw new Error(`Retell list-calls failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
    }

    const page_ = (await res.json()) as RetellCall[];
    if (!Array.isArray(page_) || page_.length === 0) break;

    for (const c of page_) {
      // Descending order, so the first call older than the window ends the walk.
      if (typeof c.start_timestamp === "number" && c.start_timestamp < since) return out;
      if (typeof c.start_timestamp === "number" && c.start_timestamp > until) continue;
      out.push(c);
    }

    if (page_.length < PAGE_SIZE) break;
    paginationKey = page_[page_.length - 1]?.call_id;
    if (!paginationKey) break;
  }
  return out;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const apiKey = process.env.RETELL_API_KEY;
  const agentId = process.env.DEMO_RETELL_AGENT_ID;

  if (!secret || !apiKey || !agentId) {
    console.error("[reconcile-demo-calls] CRON_SECRET, RETELL_API_KEY or DEMO_RETELL_AGENT_ID not set");
    return new NextResponse(null, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  // ?since / ?until are epoch-ms bounds on call start time, for targeted backfills. The cron
  // itself passes neither and just sweeps the default lookback.
  const params = new URL(req.url).searchParams;
  const num = (v: string | null, fallback: number) => {
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : fallback;
  };
  const since = num(params.get("since"), Date.now() - DEFAULT_LOOKBACK_MS);
  const until = num(params.get("until"), Number.MAX_SAFE_INTEGER);

  const tally: Record<IngestResult | "skipped" | "failed", number> = {
    lead: 0,
    call: 0,
    duplicate: 0,
    invalid: 0,
    skipped: 0,
    failed: 0,
  };

  let calls: RetellCall[];
  try {
    calls = await listCallsSince(apiKey, agentId, since, until);
  } catch (e) {
    console.error("[reconcile-demo-calls] list failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 502 });
  }

  const created: string[] = [];
  for (const call of calls) {
    // Analysis is asynchronous — a call that just ended has none yet. Skip rather than
    // ingest, or it would land as a nameless logged call and never be revisited.
    if (!call.call_analysis) {
      tally.skipped++;
      continue;
    }
    try {
      const result = await ingestDemoCall(call);
      tally[result]++;
      if (result === "lead" && typeof call.call_id === "string") created.push(call.call_id);
    } catch (e) {
      // One bad record must not abort the batch; the next run retries it.
      tally.failed++;
      console.error(`[reconcile-demo-calls] ingest failed for ${call.call_id}`, e);
    }
  }

  if (tally.lead > 0) {
    console.log(`[reconcile-demo-calls] recovered ${tally.lead} lead(s): ${created.join(", ")}`);
  }
  return NextResponse.json({
    ok: true,
    since: new Date(since).toISOString(),
    ...(until !== Number.MAX_SAFE_INTEGER ? { until: new Date(until).toISOString() } : {}),
    scanned: calls.length,
    ...tally,
    created,
  });
}
