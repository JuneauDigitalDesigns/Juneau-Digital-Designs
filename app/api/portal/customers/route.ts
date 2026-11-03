import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest, type PortalRequestContext } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import {
    createCustomer,
    isPipelineStage,
    isStale,
    listCustomers,
    listTasks,
    unreadCustomerIds,
    updateCustomer,
    appendActivity,
    type CustomerPatch,
} from "@/app/lib/portal-crm";

export const runtime = "nodejs";

/**
 * The customer CRM. Growth and Enterprise only.
 *
 * Every handler re-checks the `crm` gate server-side — never relying on the UI having hidden a
 * button, because the UI is not a security boundary.
 */

type Ok = Extract<PortalRequestContext, { ok: true }>;

function guard(ctx: Ok): NextResponse | null {
    const gate = siteFeature(ctx.site, "crm");
    if (gate.state !== "ready") {
        return NextResponse.json(
            { error: "The customer board isn't available on this site.", state: gate.state },
            { status: 403 },
        );
    }
    return null;
}

export async function GET(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const denied = guard(ctx);
    if (denied) return denied;

    const acct = accountScope(ctx.account.email);
    const slug = ctx.site.slug;

    const [customers, unread, tasks] = await Promise.all([
        listCustomers(acct, slug),
        unreadCustomerIds(acct, slug),
        listTasks(acct, slug),
    ]);

    const now = Date.now();
    const openTasksBy = new Map<string, number>();
    const overdueBy = new Map<string, number>();
    for (const t of tasks) {
        if (t.done) continue;
        openTasksBy.set(t.customerId, (openTasksBy.get(t.customerId) ?? 0) + 1);
        if (t.dueAt && new Date(t.dueAt).getTime() < now) {
            overdueBy.set(t.customerId, (overdueBy.get(t.customerId) ?? 0) + 1);
        }
    }

    // Staleness and unread are derived here rather than stored, so they can never go out of
    // date with the record they describe.
    const rows = customers.map((c) => ({
        ...c,
        stale: isStale(c.stage, c.stageChangedAt, now),
        unread: unread.has(c.customerId),
        openTasks: openTasksBy.get(c.customerId) ?? 0,
        overdueTasks: overdueBy.get(c.customerId) ?? 0,
    }));

    return NextResponse.json({
        state: "ready",
        customers: rows,
        messagingReady: siteFeature(ctx.site, "messaging").state === "ready",
        messagingState: siteFeature(ctx.site, "messaging").state,
        reviewLinkConfigured: Boolean(
            (ctx.site as { googleReviewUrl?: string }).googleReviewUrl?.trim(),
        ),
    });
}

/** Promote an inbox item, or add a customer by hand. */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const denied = guard(ctx);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;

    const str = (v: unknown): string | null =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;

    /**
     * The note is the one field here that carries prose rather than an identifier.
     *
     * It ran through the 300-character clamp above, while `PATCH` has always allowed 4000 — so
     * promoting a call whose summary ran long cut it, silently, at the only moment the client
     * could not tell what had been removed. Same ceiling as PATCH now.
     */
    const noteStr = (v: unknown): string | null =>
        typeof v === "string" && v.trim() ? v.trim().slice(0, 4000) : null;

    const source = b.source === "call" || b.source === "web-form" ? b.source : "manual";
    const name = str(b.name);
    const phone = str(b.phone);

    // A customer with neither a name nor a number is not a customer.
    if (!name && !phone) {
        return NextResponse.json(
            { error: "Add a name or a phone number." },
            { status: 400 },
        );
    }

    // An ISO string we wrote ourselves, but it arrives from a browser, so it is checked like
    // anything else — a junk date would otherwise become the record's createdAt.
    const when = typeof b.firstContactAt === "string" ? b.firstContactAt : null;
    const firstContactAt = when && !Number.isNaN(new Date(when).getTime()) ? when : null;

    const tags = Array.isArray(b.tags)
        ? b.tags
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().slice(0, 40))
              .filter(Boolean)
              .slice(0, 12)
        : [];

    const acct = accountScope(ctx.account.email);
    const { customer, existed } = await createCustomer(
        acct,
        ctx.site.slug,
        {
            name,
            phone,
            email: str(b.email),
            address: str(b.address),
            note: noteStr(b.note),
            tags,
            source,
            sourceRef: str(b.sourceRef),
            firstContactAt,
        },
        ctx.userId,
    );

    if (!existed) {
        await appendActivity(acct, ctx.site.slug, customer.customerId, {
            kind: source === "manual" ? "note" : source,
            summary:
                source === "manual"
                    ? "Added to your customers"
                    : "Added to your customers from your inbox",
            actor: "client",
        });
    }

    return NextResponse.json({ ok: true, customer, existed }, { status: existed ? 200 : 201 });
}

export async function PATCH(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;
    const denied = guard(ctx);
    if (denied) return denied;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;

    const customerId = typeof b.customerId === "string" ? b.customerId : null;
    if (!customerId) {
        return NextResponse.json({ error: "customerId is required" }, { status: 400 });
    }

    const patch: CustomerPatch = {};
    if (b.stage !== undefined) {
        if (!isPipelineStage(b.stage)) {
            return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
        }
        patch.stage = b.stage;
    }
    if (b.name !== undefined) patch.name = b.name === null ? null : String(b.name).slice(0, 200);
    if (b.phone !== undefined) patch.phone = b.phone === null ? null : String(b.phone).slice(0, 40);
    if (b.email !== undefined) patch.email = b.email === null ? null : String(b.email).slice(0, 200);
    if (b.address !== undefined)
        patch.address = b.address === null ? null : String(b.address).slice(0, 300);
    if (b.note !== undefined) patch.note = b.note === null ? null : String(b.note).slice(0, 4000);
    if (b.archived !== undefined) patch.archived = Boolean(b.archived);
    if (b.value !== undefined) {
        if (b.value === null) patch.value = null;
        else {
            const n = Number(b.value);
            if (!Number.isFinite(n) || n < 0) {
                return NextResponse.json({ error: "Invalid value" }, { status: 400 });
            }
            patch.value = Math.round(n);
        }
    }
    if (b.tags !== undefined) {
        if (!Array.isArray(b.tags)) {
            return NextResponse.json({ error: "Invalid tags" }, { status: 400 });
        }
        patch.tags = b.tags
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().slice(0, 40))
            .filter(Boolean)
            .slice(0, 12);
    }

    if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const updated = await updateCustomer(
        accountScope(ctx.account.email),
        ctx.site.slug,
        customerId,
        patch,
        ctx.userId,
    );
    if (!updated.ok) {
        // 409, not 404: the record is fine, the number is the problem. Worded for a client
        // correcting a typo, who needs to know where the number already went.
        if (updated.reason === "phone-taken") {
            return NextResponse.json(
                { error: "Another customer already has that phone number." },
                { status: 409 },
            );
        }
        return NextResponse.json({ error: "No such customer" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, customer: updated.customer });
}
