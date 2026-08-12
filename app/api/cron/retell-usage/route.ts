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
 * SCHEDULING, AND WHY IT LOOKS LIKE THIS. The Vercel team is on the **Hobby** plan, which
 * allows at most 2 cron jobs and rejects any expression firing more than once a day, failing
 * the deployment outright rather than warning. That has already turned a push red once (see
 * d14497a), so this is load-bearing, not trivia.
 *
 * The schedule in vercel.json fires at 09:00 on every third day of the month, so it never
 * fires twice in one day. That is valid on Hobby today and stays valid on Pro. Nothing here
 * has to change when the plan is upgraded.
 *
 * (Cron expressions are described in prose here rather than quoted: an asterisk followed by
 * a slash closes this comment block and breaks the build.)
 *
 * What upgrading to Pro would unlock, if wanted:
 *   - `/api/cron/reconcile-demo-calls` runs from `.github/workflows/reconcile-demo-calls.yml`
 *     every 15 minutes, only because Hobby could not schedule it. On Pro it may move back
 *     into vercel.json, but delete the workflow in the same commit if it does. Two schedulers
 *     on one endpoint is not a safety net, it is a double run.
 *   - This job could move to daily or hourly instead of every third day.
 *
 * Until then: do not add a sub-daily entry to vercel.json.
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
