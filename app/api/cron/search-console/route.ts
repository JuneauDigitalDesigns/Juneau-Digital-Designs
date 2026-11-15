import { NextResponse, after } from "next/server";
import { INVOCATION_BUDGET_MS, runSearchConsoleInvocation } from "@/app/lib/search-console-job";

/**
 * Weekly: pull each verified client site's Google Search Console data and propose town + service
 * pages from it (L11/L12/L13). See app/lib/search-console-job.ts.
 *
 * Scheduled by vercel.json, Monday 08:00 UTC (3 a.m. EST, 4 a.m. EDT). It used to be a nightly
 * GitHub Actions schedule, which GitHub never once fired (2026-11-15), and the team is on Pro, so
 * Vercel runs it. One scheduler per endpoint: don't add a workflow beside it.
 *
 * A run works through every site, however many invocations that takes:
 *   - the cron's invocation works until its budget, answers with counts, and if sites are left
 *     asks for the next invocation (`?run=<id>`) after its response;
 *   - a continuation is answered at once with 202 and does its work after the response, so the
 *     invocation that asked never waits on it; it asks for the next one the same way.
 * Each invocation holds the run lease, so a doubled request is harmless, and only the one that
 * finishes the last site records the completed run the console watches.
 *
 * Idempotent: days are overwritten, proposals have stable ids, and the monthly cap is counted in
 * KV, so a late or repeated run changes nothing. The response carries counts only, never a site,
 * a query or a town.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://www.juneaudigitaldesigns.com/api/cron/search-console
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Pro with Fluid compute allows up to 800 s. The job starts no new site after its budget (10 min
// by default), which leaves time for the last site; the rest continue in the next invocation.
export const maxDuration = 800;

function budgetMs(): number {
    const raw = process.env.SEARCH_CONSOLE_INVOCATION_BUDGET_MS;
    const n = Number(raw);
    return raw && Number.isFinite(n) && n >= 0 ? n : INVOCATION_BUDGET_MS;
}

/**
 * Ask for the next invocation of a run. Retries twice; a redirect counts as a refusal, since
 * following one cross-origin would drop the Authorization header. If none is accepted, the run
 * stays unfinished, no completed run is recorded, and the console flags it after 8 days.
 */
async function requestContinuation(origin: string, runId: string): Promise<void> {
    const url = `${origin}/api/cron/search-console?run=${encodeURIComponent(runId)}`;
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const res = await fetch(url, {
                headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
                cache: "no-store",
                redirect: "manual",
                signal: AbortSignal.timeout(15_000),
            });
            if (res.status === 202) return;
            console.error("[search-console] continuation refused", res.status);
        } catch (err) {
            console.error("[search-console] continuation not sent", String(err));
        }
        if (attempt < 3) await new Promise((r) => setTimeout(r, 2_000 * attempt));
    }
    console.error("[search-console] continuation never started; the run stays unfinished");
}

async function continueRun(origin: string, runId: string): Promise<void> {
    try {
        const out = await runSearchConsoleInvocation({ runId, budgetMs: budgetMs() });
        console.log("[search-console] invocation", out.status, out.result);
        if (out.status === "continuing" && out.runId) await requestContinuation(origin, out.runId);
    } catch (err) {
        console.error("[search-console] continuation failed", err);
    }
}

export async function GET(req: Request) {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
        console.error("[search-console] CRON_SECRET not set");
        return new Response(null, { status: 500 });
    }
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
        return new Response(null, { status: 401 });
    }
    const url = new URL(req.url);
    const runId = url.searchParams.get("run");
    if (runId) {
        after(() => continueRun(url.origin, runId));
        return NextResponse.json({ accepted: true }, { status: 202 });
    }
    try {
        const out = await runSearchConsoleInvocation({ budgetMs: budgetMs() });
        console.log("[search-console] invocation", out.status, out.result);
        if (out.status === "continuing" && out.runId) {
            const next = out.runId;
            after(() => requestContinuation(url.origin, next));
        }
        const ok = out.status === "busy" || out.status === "stale" || (out.result.configured && out.result.failed === 0);
        return NextResponse.json({ ok, status: out.status, ...out.result });
    } catch (err) {
        console.error("[search-console] invocation failed", err);
        return NextResponse.json({ ok: false, error: "invocation failed; see the function log" }, { status: 500 });
    }
}
