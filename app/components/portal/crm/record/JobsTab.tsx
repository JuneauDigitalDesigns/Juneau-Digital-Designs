"use client";

import { useEffect, useRef, useState } from "react";
import { CaretDown, Plus } from "@phosphor-icons/react";
import {
    JOB_STATUSES,
    JOB_STATUS_LABEL,
    jobsTotal,
    type Job,
    type JobStatus,
} from "@/app/lib/crm-jobs";
import { formatMoney, type CustomerRow } from "../stages";
import { EditableField } from "./fields";

/**
 * The Jobs tab: every job done (or quoted) for this customer, each with its own status.
 *
 * Xander, 2026-11-12: "records for multiple jobs for the same customer", and "the customer has a
 * status, but then the individual jobs for the customer also have a status". The customer's
 * pipeline stage stays in the header; each job here carries Quoted, Booked, Done, Paid or
 * Cancelled. The total at the top is what the board now shows as the customer's value.
 *
 * Everything saves as you go, like the contact fields: on blur for text, on change for the
 * status. A new job is a draft until its service has words in it, so "Add a job" never leaves a
 * nameless row behind.
 *
 * `renderVisits` and `renderActions` are the calendar's hooks into a job (its booked visits, and
 * "Add to calendar"). This tab does not know the calendar exists.
 */

export const SAVE_FAILED = "That change didn't save. Please try again.";

/** Pill colours: the portal's own text-safe tokens on a light wash of the same hue. */
const STATUS_HUE: Record<JobStatus, string> = {
    quoted: "var(--chart-series-2)",
    booked: "var(--accent)",
    done: "var(--chart-neutral)",
    paid: "var(--chart-pos)",
    cancelled: "var(--fg-3)",
};

type Draft = { service: string; status: JobStatus; amount: string; address: string; notes: string };

export default function JobsTab({
    customer,
    jobs,
    siteSlug,
    onChanged,
    renderMeta,
    renderVisits,
    renderActions,
    className,
}: {
    customer: CustomerRow;
    jobs: Job[];
    siteSlug: string;
    /** Re-read the record (and the board) after a change landed. */
    onChanged: () => void;
    /** The line under a job's name, after its address. The calendar puts the next visit here. */
    renderMeta?: (job: Job) => React.ReactNode;
    renderVisits?: (job: Job) => React.ReactNode;
    renderActions?: (job: Job) => React.ReactNode;
    className?: string;
}) {
    const [open, setOpen] = useState<string | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function send(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
        setError(null);
        const res = await fetch(`/api/portal/jobs?site=${encodeURIComponent(siteSlug)}`, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }).catch(() => null);
        const json = res ? await res.json().catch(() => ({})) : {};
        if (!res?.ok) {
            setError(SAVE_FAILED);
            return null;
        }
        onChanged();
        return json as { job?: Job };
    }

    const total = jobsTotal(jobs);

    return (
        <div className={`flex flex-col gap-3.5 min-w-0 ${className ?? ""}`}>
            <div className="flex items-center gap-3 flex-wrap">
                {jobs.length > 0 && (
                    <p className="m-0 text-[13px]" style={{ color: "var(--fg-2)" }}>
                        <b className="text-[15px]" style={{ color: "var(--fg)" }}>
                            {formatMoney(total ?? 0)}
                        </b>{" "}
                        across {jobs.length} {jobs.length === 1 ? "job" : "jobs"}
                    </p>
                )}
                <button
                    type="button"
                    disabled={draft !== null}
                    onClick={() => {
                        setDraft({
                            service: "",
                            status: "quoted",
                            amount: "",
                            address: customer.address ?? "",
                            notes: "",
                        });
                        setOpen(null);
                    }}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: 40, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}
                >
                    <Plus size={13} weight="bold" /> Add a job
                </button>
            </div>

            {error && (
                <p role="alert" className="m-0 text-[12.5px]" style={{ color: "var(--chart-neg)" }}>
                    {error}
                </p>
            )}

            {draft && (
                <JobCard>
                    <JobEditor
                        key="draft"
                        idPrefix="job-new"
                        value={draft}
                        autoFocus
                        onField={async (k, v) => {
                            const next = { ...draft, [k]: v };
                            setDraft(next);
                            // A draft becomes a job the moment it has a name.
                            if (!next.service.trim()) return true;
                            const made = await send("POST", { customerId: customer.customerId, ...next });
                            if (!made?.job) return false;
                            setDraft(null);
                            setOpen(made.job.jobId);
                            return true;
                        }}
                        footer={
                            <button
                                type="button"
                                onClick={() => setDraft(null)}
                                className="text-[12.5px] cursor-pointer"
                                style={{ color: "var(--fg-2)" }}
                            >
                                Cancel
                            </button>
                        }
                    />
                </JobCard>
            )}

            {jobs.length === 0 && !draft && (
                <div className="py-8 text-center">
                    <p className="m-0 text-[14px] font-semibold" style={{ color: "var(--fg)" }}>
                        No jobs yet
                    </p>
                    <p className="m-0 mt-1 text-[13px] mx-auto" style={{ color: "var(--fg-2)", maxWidth: "48ch" }}>
                        Add each job you do for them here: what it was, where, and what it came to.
                    </p>
                </div>
            )}

            {jobs.map((job) => {
                const isOpen = open === job.jobId;
                return (
                    <JobCard key={job.jobId}>
                        <div className="flex items-stretch">
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                onClick={() => setOpen(isOpen ? null : job.jobId)}
                                className="flex-1 min-w-0 flex items-center gap-3.5 px-4 py-3.5 text-left cursor-pointer"
                            >
                                <span className="flex-1 min-w-0">
                                    <span
                                        className="block text-[14.5px] font-semibold truncate"
                                        style={{
                                            color: "var(--fg)",
                                            textDecoration: job.status === "cancelled" ? "line-through" : undefined,
                                        }}
                                    >
                                        {job.service}
                                    </span>
                                    <span className="block text-[12.5px] mt-0.5 truncate" style={{ color: "var(--fg-2)" }}>
                                        {[renderMeta?.(job), job.address].filter(Boolean).map((part, i) => (
                                            <span key={i}>
                                                {i > 0 && " · "}
                                                {part}
                                            </span>
                                        ))}
                                    </span>
                                </span>
                                <StatusPill status={job.status} />
                                <span
                                    className="shrink-0 w-[72px] text-right text-[14px] font-semibold"
                                    style={{ color: "var(--fg)" }}
                                >
                                    {formatMoney(job.amount) ?? ""}
                                </span>
                                <CaretDown
                                    size={13}
                                    aria-hidden="true"
                                    style={{
                                        color: "var(--fg-3)",
                                        transform: isOpen ? "rotate(180deg)" : undefined,
                                        flexShrink: 0,
                                    }}
                                />
                            </button>
                            {renderActions && (
                                <div className="shrink-0 flex items-center pr-3">{renderActions(job)}</div>
                            )}
                        </div>
                        {isOpen && (
                            <div className="border-t" style={{ borderColor: "var(--rule)" }}>
                                <JobEditor
                                    key={job.jobId}
                                    idPrefix={`job-${job.jobId}`}
                                    value={{
                                        service: job.service,
                                        status: job.status,
                                        amount: job.amount === null ? "" : formatMoney(job.amount) ?? "",
                                        address: job.address ?? "",
                                        notes: job.notes ?? "",
                                    }}
                                    onField={async (k, v) =>
                                        Boolean(await send("PATCH", { jobId: job.jobId, [k]: v }))
                                    }
                                    visits={renderVisits?.(job)}
                                    footer={
                                        <DeleteJob onDelete={() => void send("DELETE", { jobId: job.jobId })} />
                                    }
                                />
                            </div>
                        )}
                    </JobCard>
                );
            })}
        </div>
    );
}

function JobCard({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-xl border overflow-hidden min-w-0"
            style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}
        >
            {children}
        </div>
    );
}

/**
 * Contrast, measured as text on its 9% wash over white: series-2 #7c3aed 5.0:1, accent #2563eb
 * 4.6:1, chart-neutral #5b6b80 4.9:1, chart-pos #136f32 5.5:1, fg-3 #656b73 4.8:1. All clear
 * AA for this 10.5px label.
 */
export function StatusPill({ status }: { status: JobStatus }) {
    const hue = STATUS_HUE[status];
    return (
        <span
            className="shrink-0 text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
                fontFamily: "var(--font-mono)",
                color: hue,
                background: `color-mix(in srgb, ${hue} 9%, transparent)`,
            }}
        >
            {JOB_STATUS_LABEL[status]}
        </span>
    );
}

function JobEditor({
    idPrefix,
    value,
    onField,
    footer,
    visits,
    autoFocus = false,
}: {
    idPrefix: string;
    value: Draft;
    /** Saves one field. Resolves false when it was refused, so the field puts its old value back. */
    onField: (k: keyof Draft, v: string) => Promise<boolean>;
    footer: React.ReactNode;
    visits?: React.ReactNode;
    autoFocus?: boolean;
}) {
    // A new job opens with its name field ready to type into. Once, on mount.
    const serviceRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (autoFocus) serviceRef.current?.querySelector("input")?.focus({ preventScroll: true });
    }, [autoFocus]);

    return (
        <div className="p-4 grid grid-cols-[minmax(0,1fr)] @2xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3">
            <div className="min-w-0" ref={serviceRef}>
                <EditableField
                    id={`${idPrefix}-service`}
                    label="Service"
                    value={value.service}
                    placeholder="e.g. Furnace repair"
                    onSave={(v) => onField("service", v)}
                />
            </div>
            <div className="min-w-0">
                <label htmlFor={`${idPrefix}-status`} className="block text-[11.5px] mb-px" style={{ color: "var(--fg-2)" }}>
                    Status
                </label>
                <select
                    id={`${idPrefix}-status`}
                    value={value.status}
                    onChange={(e) => void onField("status", e.target.value)}
                    className="w-full rounded-lg border px-2.5 text-[13.5px] outline-none cursor-pointer"
                    style={{
                        minHeight: 38,
                        background: "var(--bg)",
                        borderColor: "var(--rule-strong)",
                        color: "var(--fg)",
                    }}
                >
                    {JOB_STATUSES.map((s) => (
                        <option key={s} value={s}>
                            {JOB_STATUS_LABEL[s]}
                        </option>
                    ))}
                </select>
            </div>
            <EditableField
                id={`${idPrefix}-amount`}
                label="Amount"
                value={value.amount}
                placeholder="$0"
                onSave={(v) => onField("amount", v)}
            />
            <div className="min-w-0 @2xl:col-span-3">
                <EditableField
                    id={`${idPrefix}-address`}
                    label="Address"
                    value={value.address}
                    onSave={(v) => onField("address", v)}
                />
            </div>
            <div className="min-w-0 @2xl:col-span-3">
                <EditableField
                    id={`${idPrefix}-notes`}
                    label="Job notes"
                    multiline
                    value={value.notes}
                    onSave={(v) => onField("notes", v)}
                />
            </div>
            {visits && <div className="min-w-0 @2xl:col-span-3">{visits}</div>}
            <div className="min-w-0 @2xl:col-span-3 flex items-center gap-3 pt-1">
                {footer}
                <span className="ml-auto text-[12px]" style={{ color: "var(--fg-3)" }}>
                    Changes save as you go.
                </span>
            </div>
        </div>
    );
}

function DeleteJob({ onDelete }: { onDelete: () => void }) {
    const [asking, setAsking] = useState(false);
    if (!asking) {
        return (
            <button
                type="button"
                onClick={() => setAsking(true)}
                className="text-[12.5px] cursor-pointer"
                style={{ color: "var(--chart-neg)" }}
            >
                Delete job
            </button>
        );
    }
    return (
        <span className="inline-flex items-center gap-3 text-[12.5px] flex-wrap" role="group" aria-label="Delete job">
            <span style={{ color: "var(--fg)" }}>Delete this job and its visits?</span>
            <button
                type="button"
                onClick={onDelete}
                className="font-semibold cursor-pointer"
                style={{ color: "var(--chart-neg)" }}
            >
                Delete
            </button>
            <button type="button" onClick={() => setAsking(false)} className="cursor-pointer" style={{ color: "var(--fg-2)" }}>
                Keep it
            </button>
        </span>
    );
}
