import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest, type PortalRequestContext } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { parseJobPatch, parseNewJob } from "@/app/lib/crm-jobs";
import { createJob, deleteJob, syncCustomerValue, updateJob } from "@/app/lib/portal-jobs";
import { deleteAppointmentsForJob } from "@/app/lib/portal-calendar";

export const runtime = "nodejs";

/**
 * A customer's jobs: add, change, delete. Growth and Enterprise only, like the rest of the CRM.
 *
 * Reading them is the customer record's GET (`/api/portal/customers/[id]`), so opening a record
 * stays one request. Every change here re-totals the customer's value, which is what the board
 * shows.
 *
 * Every handler re-checks the `crm` gate: the UI hiding a tab is not a security boundary. Ids
 * from another account resolve to nothing, because every key is account-scoped, and read as 404.
 */

type Ok = Extract<PortalRequestContext, { ok: true }>;

async function open(request: Request): Promise<
    | { ok: true; ctx: Ok; acct: string; slug: string; body: Record<string, unknown> }
    | { ok: false; response: Response }
> {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return { ok: false, response: ctx.response };
    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return { ok: false, response: NextResponse.json({ error: "Not available on this site." }, { status: 403 }) };
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return { ok: false, response: NextResponse.json({ error: "Invalid request body" }, { status: 400 }) };
    }
    return {
        ok: true,
        ctx,
        acct: accountScope(ctx.account.email),
        slug: ctx.site.slug,
        body: (body ?? {}) as Record<string, unknown>,
    };
}

const missing = () => NextResponse.json({ error: "No such job" }, { status: 404 });

export async function POST(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const customerId = typeof o.body.customerId === "string" ? o.body.customerId : null;
    if (!customerId) return NextResponse.json({ error: "customerId is required" }, { status: 400 });

    const fields = parseNewJob(o.body);
    if (!fields.ok) return NextResponse.json({ error: fields.error }, { status: 400 });

    const job = await createJob(o.acct, o.slug, customerId, fields.value);
    if (!job) return NextResponse.json({ error: "No such customer" }, { status: 404 });
    await syncCustomerValue(o.acct, o.slug, customerId, o.ctx.userId);
    return NextResponse.json({ ok: true, job }, { status: 201 });
}

export async function PATCH(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const jobId = typeof o.body.jobId === "string" ? o.body.jobId : null;
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

    // Reads only the job's own fields; `jobId` and any `customerId` are ignored, so a job
    // cannot be moved to another customer by a PATCH.
    const patch = parseJobPatch(o.body);
    if (!patch.ok) return NextResponse.json({ error: patch.error }, { status: 400 });

    const job = await updateJob(o.acct, o.slug, jobId, patch.value);
    if (!job) return missing();
    await syncCustomerValue(o.acct, o.slug, job.customerId, o.ctx.userId);
    return NextResponse.json({ ok: true, job });
}

export async function DELETE(request: Request) {
    const o = await open(request);
    if (!o.ok) return o.response;
    const jobId = typeof o.body.jobId === "string" ? o.body.jobId : null;
    if (!jobId) return NextResponse.json({ error: "jobId is required" }, { status: 400 });

    const job = await deleteJob(o.acct, o.slug, jobId);
    if (!job) return missing();
    // "Delete this job and its visits?": its calendar visits go with it.
    await deleteAppointmentsForJob(o.acct, o.slug, jobId);
    await syncCustomerValue(o.acct, o.slug, job.customerId, o.ctx.userId);
    return NextResponse.json({ ok: true });
}
