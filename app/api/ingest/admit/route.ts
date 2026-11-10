import { NextResponse } from "next/server";
import { admit } from "@/app/lib/lead-admit";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import { resolveIngestToken } from "@/app/lib/portal-leads";
import { normalizeE164 } from "@/app/lib/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The first call a client site's `/api/contact` makes for a form submission: verify the visitor
 * is a person (Cloudflare Turnstile), apply the per-visitor limits, claim the AI callback, and
 * hand back a single-use admission for the writes that follow. See `lead-admit.ts`.
 *
 * Same token and tenant rule as the other ingest routes: the site comes from the token.
 *
 *   200 { ok, admissionId, callback: "allowed" | "held", verification }
 *   403 { error: "not-verified" }   the form shows approved message A
 *   429 { error: "too-many" }       the form shows approved message B
 *   503                            our store is down; the site places no call
 */

const MAX_BODY_BYTES = 8 * 1024;

const str = (v: unknown, max: number): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
};

export async function POST(request: Request) {
    const auth = request.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;

    let owner;
    try {
        owner = await resolveIngestToken(token);
    } catch {
        return NextResponse.json({ error: "Lead store unavailable" }, { status: 503 });
    }
    if (!owner) {
        console.warn("[ingest/admit] rejected: unknown or missing token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The coarse per-site ceiling every ingest route has, in its own bucket.
    const { success } = await getPortalRatelimit().limit(`ingest-admit:${owner.slug}`);
    if (!success) return NextResponse.json({ error: "too-many" }, { status: 429 });

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

    const phoneRaw = str(body.phone, 40);
    try {
        const result = await admit({
            acctScope: owner.acctScope,
            slug: owner.slug,
            turnstileToken: str(body.turnstileToken, 2048),
            ip: str(body.ip, 64),
            phone: phoneRaw ? normalizeE164(phoneRaw) : null,
            email: str(body.email, 320),
            wantsCallback: body.wantsCallback === true,
            host: str(body.host, 253),
            deployment: str(body.deployment, 20),
            humanCheck: body.humanCheck === "off" ? "off" : body.humanCheck === "on" ? "on" : null,
        });
        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.error === "too-many" ? 429 : 403 });
        }
        return NextResponse.json(result);
    } catch (e) {
        console.error(`[ingest/admit] failed for ${owner.slug}`, e);
        return NextResponse.json({ error: "Lead store unavailable" }, { status: 503 });
    }
}
