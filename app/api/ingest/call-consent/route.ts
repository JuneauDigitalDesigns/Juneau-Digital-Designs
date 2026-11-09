import { NextResponse } from "next/server";
import { recordCallConsent } from "@/app/lib/call-consent";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import { resolveIngestToken } from "@/app/lib/portal-leads";
import { normalizeE164 } from "@/app/lib/phone";
import { hashConsentText } from "@/app/lib/sms-consent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Saves a visitor's consent to an AI callback, sent by a client site's `/api/contact` before it
 * dials. Same token and tenant rule as `/api/ingest/lead`: the account and slug come from the
 * token, never the body.
 *
 * Any non-2xx means the site must not place the call. It records the lead instead, so a failure
 * here costs a callback, never the lead.
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
        return NextResponse.json({ error: "Consent store unavailable" }, { status: 503 });
    }
    if (!owner) {
        console.warn("[ingest/call-consent] rejected: unknown or missing token");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Its own budget, so a burst of leads can't use up the allowance that lets callbacks happen.
    const { success } = await getPortalRatelimit().limit(`ingest-call-consent:${owner.slug}`);
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

    const phone = normalizeE164(typeof body.phone === "string" ? body.phone : "");
    const text = str(body.text, 1000);
    const textHash = str(body.textHash, 64);
    const textVersion = str(body.textVersion, 64);
    const businessName = str(body.businessName, 200);

    if (!phone || !text || !textHash || !textVersion || !businessName) {
        return NextResponse.json({ error: "Incomplete consent record" }, { status: 400 });
    }
    // A record whose hash doesn't cover its own words proves nothing, so it is never stored.
    if (hashConsentText(text) !== textHash) {
        return NextResponse.json({ error: "Hash does not match wording" }, { status: 400 });
    }

    try {
        const event = await recordCallConsent({
            slug: owner.slug,
            acctScope: owner.acctScope,
            phone,
            name: str(body.name, 200),
            businessName,
            text,
            textHash,
            textVersion,
            clientCapturedAt: str(body.capturedAt, 40),
            pageUrl: str(body.pageUrl, 500),
            ip: str(body.ip, 64) ?? "unknown",
            userAgent: str(body.userAgent, 500) ?? "unknown",
        });
        return NextResponse.json({ ok: true, id: event.id });
    } catch (e) {
        console.error(`[ingest/call-consent] write failed for ${owner.slug}`, e);
        return NextResponse.json({ error: "Could not record consent" }, { status: 502 });
    }
}
