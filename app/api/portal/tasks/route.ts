import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { createTask, setTaskDone, appendActivity } from "@/app/lib/portal-crm";

export const runtime = "nodejs";

/** Follow-up reminders on a customer. Create, or tick off. */
export async function POST(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return ctx.response;

    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return NextResponse.json({ error: "Not available on this site." }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const b = (body ?? {}) as Record<string, unknown>;
    const acct = accountScope(ctx.account.email);
    const slug = ctx.site.slug;

    // Toggle an existing task.
    if (typeof b.taskId === "string") {
        const updated = await setTaskDone(acct, slug, b.taskId, Boolean(b.done));
        if (!updated) return NextResponse.json({ error: "No such task" }, { status: 404 });
        return NextResponse.json({ ok: true, task: updated });
    }

    const customerId = typeof b.customerId === "string" ? b.customerId : null;
    const title = typeof b.title === "string" ? b.title.trim() : "";
    if (!customerId || !title) {
        return NextResponse.json({ error: "customerId and title are required" }, { status: 400 });
    }

    const dueAt = typeof b.dueAt === "string" && b.dueAt.trim() ? b.dueAt.trim() : null;
    const task = await createTask(acct, slug, customerId, title, dueAt);

    await appendActivity(acct, slug, customerId, {
        kind: "task",
        summary: `Follow-up added: ${task.title}`,
        actor: "client",
        meta: { dueAt },
    });

    return NextResponse.json({ ok: true, task }, { status: 201 });
}
