import { NextResponse } from "next/server";
import { runUsageCycle } from "@/app/lib/usage-billing";

/**
 * Check every growth/enterprise client's Retell call-minute usage.
 *
 * Runs every three days (see vercel.json). Each invocation:
 *   - Pulls the current billing-period usage from the Retell API per agent.
 *   - Sends a warning email to clients at ≥80% and ≥100% of their monthly cap (once each,
 *     deduplicated in KV so a cron overlap can't double-send).
 *   - Creates a Stripe pending invoice item for any overage once the billing period closes
 *     (also idempotent via a KV billed flag — safe to re-run or retry).
 *
 * Can be triggered manually for testing:
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/retell-usage
 *
 * SCHEDULING. Every cron is in vercel.json; the Vercel team is on Pro (confirmed 2026-11-15),
 * which allows 100 cron jobs a project at any interval down to a minute, with per-minute timing.
 * The repo used to assume Hobby (2 cron jobs, at most once a day, and a deployment fails outright
 * on anything more, as it did once in d14497a). If the team ever moves back to Hobby, vercel.json
 * has three entries and one every 15 minutes, so every deployment would fail until it is cut down.
 *
 * This one fires at 09:00 on every third day of the month. It could run daily now; it hasn't been
 * changed because nothing has asked for it.
 *
 * (Cron expressions are described in prose here rather than quoted: an asterisk followed by
 * a slash closes this comment block and breaks the build.)
 *
 * One scheduler per endpoint: two schedulers on one endpoint is not a safety net, it is a double
 * run. The GitHub workflows that ran the demo-call reconcile and the Search Console job were
 * deleted when those moved here (2026-11-15).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Billing cycle processing can take ~30s with several clients + Retell API pages.
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[retell-usage] CRON_SECRET not set");
    return new NextResponse(null, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse(null, { status: 401 });
  }

  const started = Date.now();
  let results;
  try {
    results = await runUsageCycle();
  } catch (e) {
    console.error("[retell-usage] cycle failed", e);
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }

  const tally = {
    processed: results.filter((r) => !r.skipped && !r.error).length,
    skipped: results.filter((r) => r.skipped).length,
    errors: results.filter((r) => r.error).length,
    warned80: results.filter((r) => r.warned80).length,
    warned100: results.filter((r) => r.warned100).length,
    billed: results.filter((r) => r.billed).length,
  };

  console.log("[retell-usage] cycle complete", tally, `${Date.now() - started}ms`);

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    ...tally,
    results,
  });
}
