import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";

export const runtime = "nodejs";

interface AirtableRecord {
    id: string;
    fields: {
        Date?: string;
        "Caller name"?: string;
        "Caller number"?: string;
        Summary?: string;
        "Duration (seconds)"?: number;
        "Call type"?: string;
        Outcome?: string;
        Site?: string;
    };
}

function maskPhone(raw: string | undefined): string {
    if (!raw) return "Unknown";
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 4) return "***-****";
    return `(***) ***-${digits.slice(-4)}`;
}

export async function GET(request: Request) {
    // The site is resolved from the account, never trusted from the request beyond the
    // slug — which resolvePortalRequest validates against the account's own sites.
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    // Each site carries its own base when it was provisioned independently; enterprise
    // sites share one base and are separated by the `Site` column instead.
    const baseId = ctx.site.airtableBaseId;
    if (!baseId) {
        return NextResponse.json({ calls: [], noData: true });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Airtable not configured" }, { status: 500 });

    // Enterprise sites share one base and are separated by the `Site` column (which holds the
    // provisioning slug, written by onboard.js). Filter server-side so the 200-record cap is
    // per SITE rather than split across the account's sites — and so one site's rows don't
    // travel in the response for another site's view.
    const sharesBase = ctx.account.sites.some(
        (s) => s.slug !== ctx.site.slug && s.airtableBaseId === baseId,
    );
    // The slug is interpolated into an Airtable formula, so escape the quote character even
    // though provisioning slugs are [A-Za-z0-9_-] today — a formula built by concatenation
    // shouldn't depend on a convention enforced somewhere else.
    const safeSlug = ctx.site.slug.replace(/'/g, "\\'");
    const filter = sharesBase
        // Rows predating the tagging fix have no Site value; keep showing them everywhere
        // rather than silently dropping them.
        ? `&filterByFormula=${encodeURIComponent(`OR({Site}='${safeSlug}',{Site}=BLANK())`)}`
        : "";

    const url = `https://api.airtable.com/v0/${baseId}/Call%20Log?maxRecords=200&sort[0][field]=Date&sort[0][direction]=desc${filter}`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        next: { revalidate: 0 },
    });

    if (!res.ok) {
        return NextResponse.json({ error: "Failed to fetch call data" }, { status: 502 });
    }

    const json = await res.json() as { records: AirtableRecord[] };

    const calls = json.records.map((r) => ({
        id: r.id,
        date: r.fields["Date"] ?? null,
        callerName: r.fields["Caller name"] ?? "Unknown",
        callerNumber: maskPhone(r.fields["Caller number"]),
        summary: r.fields["Summary"] ?? null,
        durationSeconds: r.fields["Duration (seconds)"] ?? 0,
        callType: r.fields["Call type"] ?? null,
        outcome: r.fields["Outcome"] ?? null,
        site: r.fields["Site"] ?? null,
    }));

    return NextResponse.json({ calls });
}
