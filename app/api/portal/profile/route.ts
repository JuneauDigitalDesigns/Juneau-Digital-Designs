import { NextResponse } from "next/server";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { saveAccount } from "@/app/lib/account-store";

export const runtime = "nodejs";

export async function PUT(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
        return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const { contactName, contactPhone } = body as Record<string, unknown>;

    // Both fields are optional; a call with neither is a no-op but valid.
    const name = typeof contactName === "string" ? contactName.trim() : undefined;
    const phone = typeof contactPhone === "string" ? contactPhone.trim() : undefined;

    // Validate lengths to prevent runaway writes.
    if (name !== undefined && name.length > 120) {
        return NextResponse.json({ error: "Name too long" }, { status: 400 });
    }
    if (phone !== undefined && phone.length > 30) {
        return NextResponse.json({ error: "Phone too long" }, { status: 400 });
    }

    const now = Date.now();
    const updated = {
        ...ctx.account,
        updatedAt: now,
        profile: {
            ...ctx.account.profile,
            ...(name !== undefined ? { contactName: name } : {}),
            ...(phone !== undefined ? { contactPhone: phone } : {}),
            updatedAt: now,
        },
    };
    await saveAccount(updated);

    return NextResponse.json({ ok: true, profile: updated.profile });
}
