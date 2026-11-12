import { NextResponse } from "next/server";
import { siteFeature } from "@jdd/schema";
import { resolvePortalRequest } from "@/app/lib/portal-account";
import { accountScope } from "@/app/lib/portal-kv";
import { getCustomer, listCustomers, listTasks } from "@/app/lib/portal-crm";
import { getJob, listSiteJobs } from "@/app/lib/portal-jobs";
import { parseApptPatch, parseNewAppt } from "@/app/lib/crm-calendar";
import {
    createAppointment,
    deleteAppointment,
    getAppointment,
    listAppointments,
    updateAppointment,
} from "@/app/lib/portal-calendar";

export const runtime = "nodejs";

/**
 * The portal calendar. Growth and Enterprise only: it is part of the CRM, behind the same `crm`
 * gate as Customers, re-checked on every handler.
 *
 * GET is everything the calendar page draws in one request: the appointments, the open
 * follow-ups that have a due date (they show on their day), and the customers and jobs the form
 * offers. Names are resolved on read, never copied onto an appointment, so renaming a customer
 * renames them on the calendar too.
 */

async function context(request: Request) {
    const ctx = await resolvePortalRequest(request);
    if (!ctx.ok) return { ok: false as const, response: ctx.response };
    if (siteFeature(ctx.site, "crm").state !== "ready") {
        return {
            ok: false as const,
            response: NextResponse.json({ error: "Not available on this site." }, { status: 403 }),
        };
    }
    return { ok: true as const, acct: accountScope(ctx.account.email), slug: ctx.site.slug };
}

async function body(request: Request): Promise<Record<string, unknown> | null> {
    try {
        const b = await request.json();
        return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
    } catch {
        return null;
    }
}

const bad = (error: string) => NextResponse.json({ error }, { status: 400 });
const missing = () => NextResponse.json({ error: "No such appointment" }, { status: 404 });

/**
 * The customer and job an appointment points at must be this account's, and the job must be
 * that customer's. A 404 for a customer we cannot see (as for a job or note), a 400 for a job
 * booked against the wrong customer.
 */
async function checkLinks(
    acct: string,
    slug: string,
    customerId: string | null,
    jobId: string | null,
): Promise<NextResponse | null> {
    if (customerId && !(await getCustomer(acct, slug, customerId))) {
        return NextResponse.json({ error: "No such customer" }, { status: 404 });
    }
    if (jobId) {
        const job = await getJob(acct, slug, jobId);
        if (!job || job.customerId !== customerId) return bad("That job isn't this customer's.");
    }
    return null;
}

export async function GET(request: Request) {
    const c = await context(request);
    if (!c.ok) return c.response;

    const [appointments, customers, tasks, jobs] = await Promise.all([
        listAppointments(c.acct, c.slug),
        listCustomers(c.acct, c.slug),
        listTasks(c.acct, c.slug),
        listSiteJobs(c.acct, c.slug),
    ]);
    const live = new Set(customers.map((cu) => cu.customerId));

    return NextResponse.json({
        state: "ready",
        appointments,
        followUps: tasks
            .filter((t) => !t.done && t.dueAt && live.has(t.customerId))
            .map((t) => ({ taskId: t.taskId, customerId: t.customerId, title: t.title, dueAt: t.dueAt!.slice(0, 10) })),
        customers: customers
            .filter((cu) => !cu.archived)
            .map((cu) => ({ customerId: cu.customerId, name: cu.name, address: cu.address }))
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
        // Archived customers' names still resolve for appointments already on the calendar.
        names: Object.fromEntries(customers.map((cu) => [cu.customerId, cu.name])),
        jobs: jobs
            .filter((j) => live.has(j.customerId))
            .map((j) => ({ jobId: j.jobId, customerId: j.customerId, service: j.service, address: j.address, status: j.status })),
    });
}

export async function POST(request: Request) {
    const c = await context(request);
    if (!c.ok) return c.response;
    const b = await body(request);
    if (!b) return bad("Invalid request body");

    const parsed = parseNewAppt(b);
    if (!parsed.ok) return bad(parsed.error);
    const denied = await checkLinks(c.acct, c.slug, parsed.value.customerId, parsed.value.jobId);
    if (denied) return denied;

    const appointment = await createAppointment(c.acct, c.slug, parsed.value);
    return NextResponse.json({ ok: true, appointment }, { status: 201 });
}

export async function PATCH(request: Request) {
    const c = await context(request);
    if (!c.ok) return c.response;
    const b = await body(request);
    if (!b) return bad("Invalid request body");
    const id = typeof b.id === "string" ? b.id : null;
    if (!id) return bad("id is required");

    const existing = await getAppointment(c.acct, c.slug, id);
    if (!existing) return missing();
    const parsed = parseApptPatch(b);
    if (!parsed.ok) return bad(parsed.error);

    const customerId = parsed.value.customerId !== undefined ? parsed.value.customerId : existing.customerId;
    const jobId = parsed.value.jobId !== undefined ? parsed.value.jobId : existing.jobId;
    if (parsed.value.customerId !== undefined || parsed.value.jobId !== undefined) {
        const denied = await checkLinks(c.acct, c.slug, customerId, customerId ? jobId : null);
        if (denied) return denied;
    }

    const appointment = await updateAppointment(c.acct, c.slug, id, parsed.value);
    if (!appointment) return missing();
    return NextResponse.json({ ok: true, appointment });
}

export async function DELETE(request: Request) {
    const c = await context(request);
    if (!c.ok) return c.response;
    const b = await body(request);
    const id = typeof b?.id === "string" ? b.id : null;
    if (!id) return bad("id is required");
    if (!(await deleteAppointment(c.acct, c.slug, id))) return missing();
    return NextResponse.json({ ok: true });
}
