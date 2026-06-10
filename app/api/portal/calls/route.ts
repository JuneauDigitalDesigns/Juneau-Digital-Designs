import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getPortalRatelimit } from "@/app/lib/portal-kv";
import type { PortalUserMetadata } from "@/app/portal/page";

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

export async function GET() {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Rate limit
    const rl = getPortalRatelimit();
    const { success } = await rl.limit(userId);
    if (!success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

    // Read metadata from Clerk — never from request params
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const meta = user.publicMetadata as Partial<PortalUserMetadata>;

    if (!meta.airtableBaseId) {
        return NextResponse.json({ calls: [], noData: true });
    }

    const apiKey = process.env.AIRTABLE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Airtable not configured" }, { status: 500 });

    const url = `https://api.airtable.com/v0/${meta.airtableBaseId}/Call%20Log?maxRecords=200&sort[0][field]=Date&sort[0][direction]=desc`;
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
