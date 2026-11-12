import type { Appointment, ApptFields } from "@/app/lib/crm-calendar";
import type { JobStatus } from "@/app/lib/crm-jobs";

/**
 * The calendar's client half of `/api/portal/appointments`. Shared by the calendar page and the
 * customer record's "Add to calendar", so both read and write the same way.
 */

export interface CalendarCustomer {
    customerId: string;
    name: string | null;
    address: string | null;
}

export interface CalendarJob {
    jobId: string;
    customerId: string;
    service: string;
    address: string | null;
    status: JobStatus;
}

export interface CalendarFollowUp {
    taskId: string;
    customerId: string;
    title: string;
    /** 'YYYY-MM-DD'. */
    dueAt: string;
}

export interface CalendarData {
    appointments: Appointment[];
    followUps: CalendarFollowUp[];
    customers: CalendarCustomer[];
    /** Every customer's name by id, archived ones too, so old appointments still read. */
    names: Record<string, string | null>;
    jobs: CalendarJob[];
}

const q = (slug: string) => `?site=${encodeURIComponent(slug)}`;

export async function fetchCalendar(slug: string): Promise<CalendarData | null> {
    const res = await fetch(`/api/portal/appointments${q(slug)}`, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return null;
    const json = (await res.json().catch(() => null)) as CalendarData | null;
    return json?.appointments ? json : null;
}

/** Create (no `id`), change (with `id`), or delete. Null when it did not land. */
export async function writeAppointment(
    slug: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Partial<ApptFields> & { id?: string },
): Promise<Appointment | true | null> {
    const res = await fetch(`/api/portal/appointments${q(slug)}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) return null;
    const json = (await res.json().catch(() => ({}))) as { appointment?: Appointment };
    return json.appointment ?? true;
}

/** Where "Open customer" goes: their record, over the board. */
export function customerHref(slug: string, customerId: string): string {
    return `/portal/customers?site=${encodeURIComponent(slug)}&open=${encodeURIComponent(customerId)}`;
}

/** Where "Open in calendar" and "See calendar" go: the calendar, on a given day. */
export function calendarHref(slug: string, day?: string): string {
    return `/portal/calendar?site=${encodeURIComponent(slug)}${day ? `&day=${day}` : ""}`;
}
