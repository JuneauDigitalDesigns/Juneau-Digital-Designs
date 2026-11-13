import { NextResponse } from "next/server";
import { runSearchConsoleCycle } from "@/app/lib/search-console-job";

/**
 * Nightly: pull each verified client site's Google Search Console data and propose town + service
 * pages from it (L11/L12/L13). See app/lib/search-console-job.ts.
 *
 * Scheduled by .github/workflows/search-console-nightly.yml, NOT vercel.json: the Vercel team is
 * on Hobby, which allows two cron jobs, and both are taken (see app/api/cron/retell-usage).
 *
 * Idempotent: days are overwritten, proposals have stable ids, and the monthly cap is counted in
 * KV, so a late or repeated run changes nothing. The response carries counts only, never a site,
 * a query or a town, because the workflow prints it into the run summary.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://www.juneaudigitaldesigns.com/api/cron/search-console
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// One site is a few Google pages, an Airtable read and a KV pass; the job stops starting new
// sites after 240 s and the cursor carries the rest to the next night.
export const maxDuration = 300;

export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error("[search-console] CRON_SECRET not set");
        return new Response(null, { status: 500 });
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return new Response(null, { status: 401 });
    }
    try {
        const result = await runSearchConsoleCycle();
        console.log("[search-console] cycle complete", result);
        return NextResponse.json({ ok: result.configured && result.failed === 0, ...result });
    } catch (err) {
        console.error("[search-console] cycle failed", err);
        return NextResponse.json({ ok: false, error: "cycle failed; see the function log" }, { status: 500 });
    }
}
