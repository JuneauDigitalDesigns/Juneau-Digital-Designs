/**
 * Jobs and notes on a customer: the shapes, the vocabulary, and the rules that decide what may be
 * stored. Client-safe on purpose (no Redis, no `server-only`), so the record's Jobs and Notes
 * tabs import the same labels and the same parsing the API enforces. The I/O is
 * `portal-jobs.ts`.
 *
 * Xander, 2026-11-12: "this has records for multiple jobs for the same customer I want to be able
 * to keep track of jobs in this tab and related information to those jobs", and "Overall, the
 * customer has a status, but then the individual jobs for the customer also have a status." So a
 * customer keeps its pipeline stage, and each job carries its own status beside it.
 */

/** In the order a job moves through them. "Paid" was asked for on 2026-11-12. */
export const JOB_STATUSES = ["quoted", "booked", "done", "paid", "cancelled"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
    quoted: "Quoted",
    booked: "Booked",
    done: "Done",
    paid: "Paid",
    cancelled: "Cancelled",
};

export function isJobStatus(v: unknown): v is JobStatus {
    return typeof v === "string" && (JOB_STATUSES as readonly string[]).includes(v);
}

export interface Job {
    jobId: string;
    customerId: string;
    /** What the job is, in the client's words: "Furnace repair". Never empty. */
    service: string;
    status: JobStatus;
    /** Whole dollars, like `Customer.value`: a client types "1850", not "185000". */
    amount: number | null;
    /** Where the work is. Starts as the customer's address; a landlord's jobs can differ. */
    address: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
}

export const SERVICE_MAX = 120;
export const ADDRESS_MAX = 300;
export const NOTES_MAX = 4000;
/** Ten million dollars. Past this a value is a typo, not a job. */
export const AMOUNT_MAX = 10_000_000;

/**
 * What the board shows as a customer's value once they have jobs: the sum of every job that is
 * not cancelled. Null when there are no jobs, so a customer whose value was typed in by hand
 * before jobs existed keeps it until their first job is added.
 *
 * Xander, 2026-11-12: the board showing the jobs total "in place of job value is probably better".
 */
export function jobsTotal(jobs: readonly Pick<Job, "status" | "amount">[]): number | null {
    if (jobs.length === 0) return null;
    let total = 0;
    for (const j of jobs) if (j.status !== "cancelled" && j.amount) total += j.amount;
    return total;
}

/** "$1,250", "1250", 1250 → 1250. Blank → null. Anything else → undefined (refuse it). */
export function parseAmount(v: unknown): number | null | undefined {
    if (v === null || v === undefined) return null;
    if (typeof v === "number") {
        return Number.isFinite(v) && v >= 0 && v <= AMOUNT_MAX ? Math.round(v) : undefined;
    }
    if (typeof v !== "string") return undefined;
    const t = v.replace(/[$,\s]/g, "");
    if (!t) return null;
    if (!/^\d+(\.\d{1,2})?$/.test(t)) return undefined;
    const n = Math.round(Number(t));
    return n <= AMOUNT_MAX ? n : undefined;
}

/** Trimmed and capped, or null when blank. Undefined when it is not text at all. */
function text(v: unknown, max: number): string | null | undefined {
    if (v === null) return null;
    if (typeof v !== "string") return undefined;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
}

export type JobFields = Pick<Job, "service" | "status" | "amount" | "address" | "notes">;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * A new job, from a request body. Only the service is required: the record creates a job the
 * moment its first field has words in it, and the rest follow as the client fills them in.
 */
export function parseNewJob(b: Record<string, unknown>): Parsed<JobFields> {
    const service = text(b.service, SERVICE_MAX);
    if (!service) return { ok: false, error: "A job needs a service." };
    const rest = parseJobPatch(b);
    if (!rest.ok) return rest;
    return {
        ok: true,
        value: {
            status: "quoted",
            amount: null,
            address: null,
            notes: null,
            ...rest.value,
            service,
        },
    };
}

/**
 * The fields a change may carry. Absent means unchanged; blank clears, except the service, which
 * a job always has, so blanking it is refused rather than leaving a row with no name.
 */
export function parseJobPatch(b: Record<string, unknown>): Parsed<Partial<JobFields>> {
    const out: Partial<JobFields> = {};
    if ("service" in b) {
        const s = text(b.service, SERVICE_MAX);
        if (!s) return { ok: false, error: "A job needs a service." };
        out.service = s;
    }
    if ("status" in b) {
        if (!isJobStatus(b.status)) return { ok: false, error: "That isn't a job status." };
        out.status = b.status;
    }
    if ("amount" in b) {
        const a = parseAmount(b.amount);
        if (a === undefined) return { ok: false, error: "That amount isn't a number." };
        out.amount = a;
    }
    for (const [k, max] of [
        ["address", ADDRESS_MAX],
        ["notes", NOTES_MAX],
    ] as const) {
        if (k in b) {
            const t = text(b[k], max);
            if (t === undefined) return { ok: false, error: `Bad ${k}.` };
            out[k] = t;
        }
    }
    return { ok: true, value: out };
}

/* ── notes ────────────────────────────────────────────────────────────────── */

export interface CustomerNote {
    noteId: string;
    customerId: string;
    body: string;
    createdAt: string;
    /** Set when the text was changed after it was written. */
    updatedAt: string | null;
}

/**
 * The one note a customer had before notes were a list.
 *
 * `Customer.note` was a single free-text box. It is shown as the oldest note rather than
 * migrated: nothing is rewritten until the client edits or deletes it, and then the route turns
 * it into a real note (or clears it). Its date is the customer's, the nearest true thing we have.
 */
export const LEGACY_NOTE_ID = "legacy";

export function parseNoteBody(v: unknown): string | null {
    const t = text(v, NOTES_MAX);
    return t ?? null;
}

/** Newest first, with the old single note (if any) at the end as the oldest. */
export function withLegacyNote(
    notes: readonly CustomerNote[],
    customer: { customerId: string; note: string | null; createdAt: string; firstContactAt?: string | null },
): CustomerNote[] {
    const sorted = [...notes].sort((a, b) => time(b.createdAt) - time(a.createdAt));
    if (customer.note?.trim()) {
        sorted.push({
            noteId: LEGACY_NOTE_ID,
            customerId: customer.customerId,
            body: customer.note,
            createdAt: customer.createdAt,
            updatedAt: null,
        });
    }
    return sorted;
}

/**
 * Notes as timeline entries, under "Your notes".
 *
 * Folded in on read, the way calls are, rather than copied into the activity log when written:
 * a copy would keep the old words after an edit, and keep the note after the client deleted it.
 */
export function notesAsTimeline(notes: readonly CustomerNote[]) {
    return notes.map((n) => ({
        id: `note:${n.noteId}`,
        kind: "note" as const,
        at: n.createdAt,
        summary: "You added a note",
        actor: "client" as const,
        meta: { detail: n.body } as Record<string, unknown>,
    }));
}

function time(iso: string): number {
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}
