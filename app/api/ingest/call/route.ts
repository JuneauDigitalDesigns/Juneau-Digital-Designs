import { after, NextResponse } from "next/server";
import { CALL_ID, notifyOwnerOfCall } from "@/app/lib/call-brief";
import { resolveIngestToken } from "@/app/lib/portal-leads";
import { getPortalRatelimit } from "@/app/lib/portal-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * End-of-call ingest from a client's post-call Make scenario.
 *
 * After the call is logged to Airtable, the clone's HTTP module posts the call's identity and
 * the caller's analysed details here, and this texts the owner the brief — if, at that moment,
 * the owner has SMS consent on file. See `app/lib/call-brief.ts` for why this moved out of Make.
 *
 * ── Auth ────────────────────────────────────────────────────────────────────────────────────
 * The same per-site `LEAD_INGEST_TOKEN` the client site uses for `/api/ingest/lead`, resolved by
 * the same `resolveIngestToken`. The account and slug come from the token, never the body, so a
 * scenario holding one client's token can only ever text that client's owner.
 *
 * ── Never a 5xx because of Twilio ───────────────────────────────────────────────────────────
 * Make retries a non-2xx, and deactivates the scenario after repeated errors — which queues
 * every later call behind it (seen 2026-11-03). So the response depends only on auth and a
 * well-formed body: the text is sent after the response, and a Twilio failure is logged, never
 * returned. A KV outage is the one 503, because then we cannot tell a good token from a bad one
 * and a retry is the right answer. A duplicate delivery is a 200 that sends nothing.
 *
 * ── Body ────────────────────────────────────────────────────────────────────────────────────
 * `application/x-www-form-urlencoded`, because Make encodes form fields itself. A raw JSON body
 * would be assembled by string interpolation, and a caller whose name contains a quote would
 * break it. JSON is accepted too, for tools and tests.
 */

const MAX_BODY_BYTES = 4 * 1024;
const CAP = { name: 200, priority: 20, number: 40 } as const;

const str = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
};

function parseBody(raw: string, contentType: string): Record<string, unknown> | null {
    if (contentType.includes("application/json")) {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return Object.fromEntries(new URLSearchParams(raw));
}

export async function POST(request: Request) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

    let owner;
    try {
        owner = await resolveIngestToken(token);
    } catch {
        return NextResponse.json({ error: "Lead store unavailable" }, { status: 503 });
    }
    if (!owner) {
        console.warn("[ingest/call] rejected: unknown or missing token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Its own bucket, so a burst of calls never spends the web form's budget or the reverse.
    const { success } = await getPortalRatelimit().limit(`ingest-call:${owner.slug}`);
    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }
    const body = parseBody(raw, request.headers.get("content-type") ?? "");
    if (!body) {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const callId = str(body.call_id, 128);
    if (!callId || !CALL_ID.test(callId)) {
        return NextResponse.json({ error: "call_id is required" }, { status: 400 });
    }

    const input = {
        acctScope: owner.acctScope,
        slug: owner.slug,
        callId,
        callerName: str(body.caller_name, CAP.name),
        priority: str(body.caller_priority, CAP.priority),
        callerNumber: str(body.caller_number, CAP.number),
        // The call's Airtable row, so the owner's text can link straight to it (when links are on).
        // Optional: clones made before Make sent it simply get the link-less brief.
        recordId: str(body.airtable_record_id, 32),
    };
    after(() => notifyOwnerOfCall(input));

    return NextResponse.json({ ok: true });
}
