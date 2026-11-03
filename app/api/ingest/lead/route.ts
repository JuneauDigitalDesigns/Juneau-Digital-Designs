import { after, NextResponse } from "next/server";
import { alertsOwnerAtIngest, notifyOwnerOfLead } from "@/app/lib/lead-alert";
import { recordLead, resolveIngestToken } from "@/app/lib/portal-leads";
import { getPortalRatelimit } from "@/app/lib/portal-kv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lead ingest from a client site's `/api/contact`.
 *
 * ── Why the auth is a per-client token and not `OPS_SHARED_SECRET` ──────────────────────────
 * `/api/ops/*` uses one global secret, which is right there: one caller, the ops console. It is
 * wrong here. Every client site would hold a credential able to write leads into *any* account,
 * so one compromised client repo would be a cross-tenant write. Each site gets its own token,
 * and **the account and slug are resolved from the token, never read from the body** — a site
 * that could name its own slug could post into another client's portal.
 *
 * ── Why the client site posts here rather than the browser ──────────────────────────────────
 * The form posts same-origin to the client site's own `/api/contact`, which forwards here
 * server-side. Posting straight from the browser would need CORS, would put this endpoint in
 * front of the open internet with no same-origin signal, and would expose the token to anyone
 * who views source.
 *
 * ── Failing closed ──────────────────────────────────────────────────────────────────────────
 * A rejected lead returns a non-2xx so the client site's route returns 502 and the form tells
 * the visitor to call instead. That is deliberately louder than the Resend path it replaces,
 * which failed silently and lost 100% of leads on a fresh client (see the plan's §0).
 */

/** Keys the caller maps onto first-class columns; everything else lands in `fields`. */
const KNOWN = new Set(["name", "phone", "email", "message", "callbackPlaced", "_honeypot"]);

const MAX_BODY_BYTES = 8 * 1024;
const CAP = { name: 200, email: 320, message: 2000, phone: 40, field: 500 } as const;

const str = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
};

export async function POST(request: Request) {
    // Length-check before parsing: a 50 MB body should cost us a header read, not a JSON parse.
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
        // KV is down. This is ours, not the caller's — 503 so the client site surfaces a retryable
        // failure rather than telling us the token is bad.
        return NextResponse.json({ error: "Lead store unavailable" }, { status: 503 });
    }
    if (!owner) {
        console.warn("[ingest/lead] rejected: unknown or missing token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit per token, after auth so an unauthenticated flood cannot consume a client's
    // budget. A public form is a spam vector that Resend used to absorb for us.
    const { success } = await getPortalRatelimit().limit(`ingest:${owner.slug}`);
    if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: Record<string, unknown>;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
        body = parsed as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    // Honeypot: a bot filling a hidden field gets a 200 and no write. Returning an error would
    // tell it which field gave it away.
    if (str(body._honeypot, 10)) {
        return NextResponse.json({ ok: true, leadId: null });
    }

    const phoneRaw = str(body.phone, CAP.phone);
    const email = str(body.email, CAP.email);

    // A lead with no reachable contact is not a lead. Reject rather than store something the
    // owner can only look at.
    if (!phoneRaw && !email) {
        return NextResponse.json(
            { error: "A phone number or email address is required" },
            { status: 400 },
        );
    }

    // Everything the form sent that isn't a first-class column, so adding a field to the form
    // never needs a change here. The `consent` object from the SMS-consent workstream lands here
    // until it becomes part of the released `WebLead` contract — captured, not discarded.
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
        if (KNOWN.has(k)) continue;
        if (v === null || v === undefined) continue;
        const value =
            typeof v === "object" ? JSON.stringify(v).slice(0, CAP.field) : str(v, CAP.field);
        if (value) fields[k.slice(0, 64)] = value;
    }

    const name = str(body.name, CAP.name);

    const callbackPlaced = body.callbackPlaced === true;

    let lead;
    try {
        lead = await recordLead({
            acctScope: owner.acctScope,
            slug: owner.slug,
            name,
            phoneRaw,
            email,
            message: str(body.message, CAP.message),
            fields,
            callbackPlaced,
        });
    } catch (e) {
        console.error(`[ingest/lead] write failed for ${owner.slug}`, e);
        return NextResponse.json({ error: "Could not record the lead" }, { status: 502 });
    }

    // Only once the lead is stored, and after the response. Outside the try on purpose: the
    // owner's text is best-effort, and nothing about it may turn a recorded lead into a 502 —
    // the visitor would be told it didn't send and post it again.
    if (alertsOwnerAtIngest(callbackPlaced)) {
        after(() => notifyOwnerOfLead({ acctScope: owner.acctScope, slug: owner.slug, name }));
    }

    return NextResponse.json({ ok: true, leadId: lead.leadId });
}
