"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import {
    APPT_KIND_LABEL,
    APPT_STATUSES,
    APPT_STATUS_LABEL,
    compareByStart,
    dayHeadingLabel,
    formatSpan,
    type Appointment,
    type ApptStatus,
} from "@/app/lib/crm-calendar";
import { customerHref, type CalendarFollowUp, type CalendarJob } from "./api";
import { KIND_HUE } from "./MonthGrid";

/**
 * One day, in full: what is booked and what is due, with what you can do about each.
 *
 * Beside the grid on a desktop, under the small month on a phone. Each appointment carries its
 * status (Scheduled, Done, Cancelled, No-show: the console's four), a way to the customer, Edit
 * and Delete. Each follow-up due that day can be ticked off here.
 */
export default function DayList({
    day,
    today,
    siteSlug,
    appointments,
    followUps,
    names,
    jobs,
    highlight,
    onStatus,
    onEdit,
    onDelete,
    onDone,
    onBook,
    className,
}: {
    day: string;
    today: string;
    siteSlug: string;
    appointments: Appointment[];
    followUps: CalendarFollowUp[];
    names: Record<string, string | null>;
    jobs: CalendarJob[];
    /** An item picked from the grid, drawn with a ring so the eye finds it. */
    highlight: string | null;
    onStatus: (a: Appointment, s: ApptStatus) => void;
    onEdit: (a: Appointment) => void;
    onDelete: (a: Appointment) => void;
    onDone: (f: CalendarFollowUp) => void;
    onBook: () => void;
    className?: string;
}) {
    const list = appointments.filter((a) => a.day === day).sort(compareByStart);
    const due = followUps.filter((f) => f.dueAt === day);
    const jobOf = (id: string | null) => (id ? jobs.find((j) => j.jobId === id) ?? null : null);

    return (
        <section
            aria-labelledby="cal-day-heading"
            data-tour="cal-day"
            className={`rounded-2xl border p-4 flex flex-col gap-3 ${className ?? ""}`}
            style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
        >
            <h2 id="cal-day-heading" className="m-0 text-[15px] font-bold" style={{ color: "var(--fg)" }}>
                {dayHeadingLabel(day, today)}
            </h2>

            {list.length === 0 && due.length === 0 && (
                <p className="m-0 text-[13px]" style={{ color: "var(--fg-2)" }}>
                    Nothing booked.
                </p>
            )}

            {list.map((a) => (
                <ApptCard
                    key={a.id}
                    appt={a}
                    name={a.customerId ? names[a.customerId] ?? null : null}
                    job={jobOf(a.jobId)}
                    siteSlug={siteSlug}
                    highlighted={highlight === a.id}
                    onStatus={(s) => onStatus(a, s)}
                    onEdit={() => onEdit(a)}
                    onDelete={() => onDelete(a)}
                />
            ))}

            {due.map((f) => (
                <article
                    key={f.taskId}
                    className="rounded-xl border p-3 flex flex-col gap-1.5"
                    style={{
                        borderColor: "var(--rule)",
                        borderLeft: `4px solid ${KIND_HUE.followup}`,
                        boxShadow: highlight === f.taskId ? "0 0 0 2px var(--accent)" : undefined,
                    }}
                >
                    <div className="flex items-baseline gap-2">
                        <b className="text-[13.5px]" style={{ color: "var(--fg)" }}>
                            Follow-up
                        </b>
                        <span className="ml-auto text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                            {day === today
                                ? "Due today"
                                : `Due ${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        </span>
                    </div>
                    <Link href={customerHref(siteSlug, f.customerId)} className="text-[13.5px] font-semibold" style={{ color: "var(--accent)" }}>
                        {names[f.customerId] ?? ""}
                    </Link>
                    <p className="m-0 text-[12.5px]" style={{ color: "var(--fg-2)" }}>
                        {f.title}
                    </p>
                    <div className="flex gap-4 text-[12.5px]">
                        <button type="button" onClick={() => onDone(f)} className="cursor-pointer" style={{ color: "var(--accent)" }}>
                            Mark done
                        </button>
                        <Link href={customerHref(siteSlug, f.customerId)} style={{ color: "var(--accent)" }}>
                            Open customer
                        </Link>
                    </div>
                </article>
            ))}

            <button
                type="button"
                onClick={onBook}
                className="rounded-xl border border-dashed text-[13px] font-medium inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--accent)" }}
            >
                <Plus size={13} weight="bold" /> Book something on this day
            </button>
        </section>
    );
}

function ApptCard({
    appt,
    name,
    job,
    siteSlug,
    highlighted,
    onStatus,
    onEdit,
    onDelete,
}: {
    appt: Appointment;
    name: string | null;
    job: CalendarJob | null;
    siteSlug: string;
    highlighted: boolean;
    onStatus: (s: ApptStatus) => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    const [asking, setAsking] = useState(false);
    const detail = [job?.service, appt.address].filter(Boolean).join(" · ");

    return (
        <article
            className="rounded-xl border p-3 flex flex-col gap-2"
            style={{
                borderColor: "var(--rule)",
                borderLeft: `4px solid ${appt.status === "no-show" ? "var(--chart-neg)" : KIND_HUE[appt.kind]}`,
                boxShadow: highlighted ? "0 0 0 2px var(--accent)" : undefined,
            }}
        >
            <div className="flex items-baseline gap-2">
                <b className="text-[13.5px]" style={{ color: "var(--fg)" }}>
                    {APPT_KIND_LABEL[appt.kind]}
                </b>
                <span className="ml-auto text-[11px] whitespace-nowrap" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                    {formatSpan(appt)}
                </span>
            </div>
            {appt.customerId && name && (
                <Link href={customerHref(siteSlug, appt.customerId)} className="text-[13.5px] font-semibold" style={{ color: "var(--accent)" }}>
                    {name}
                </Link>
            )}
            {detail && (
                <p className="m-0 text-[12.5px] leading-snug" style={{ color: "var(--fg-2)" }}>
                    {detail}
                </p>
            )}
            {appt.notes && (
                <p className="m-0 text-[12.5px] leading-snug whitespace-pre-wrap" style={{ color: "var(--fg-2)" }}>
                    {appt.notes}
                </p>
            )}
            <div role="group" aria-label="Status" className="flex flex-wrap gap-1">
                {APPT_STATUSES.map((s) => {
                    const on = appt.status === s;
                    return (
                        <button
                            key={s}
                            type="button"
                            aria-pressed={on}
                            onClick={() => !on && onStatus(s)}
                            className="rounded-full border px-2.5 text-[11.5px] cursor-pointer"
                            style={{
                                minHeight: 28,
                                borderColor: on ? "var(--fg)" : "var(--rule-strong)",
                                background: on ? "var(--fg)" : "var(--elev-1)",
                                color: on ? "var(--elev-1)" : "var(--fg-2)",
                            }}
                        >
                            {APPT_STATUS_LABEL[s]}
                        </button>
                    );
                })}
            </div>
            {asking ? (
                <div className="flex flex-wrap items-center gap-3 text-[12.5px]" role="group" aria-label="Delete appointment">
                    <span style={{ color: "var(--fg)" }}>Delete this appointment?</span>
                    <button type="button" onClick={onDelete} className="font-semibold cursor-pointer" style={{ color: "var(--chart-neg)" }}>
                        Delete
                    </button>
                    <button type="button" onClick={() => setAsking(false)} className="cursor-pointer" style={{ color: "var(--fg-2)" }}>
                        Keep it
                    </button>
                </div>
            ) : (
                <div className="flex gap-4 text-[12.5px]">
                    {appt.customerId && (
                        <Link href={customerHref(siteSlug, appt.customerId)} style={{ color: "var(--accent)" }}>
                            Open customer
                        </Link>
                    )}
                    <button type="button" onClick={onEdit} className="cursor-pointer" style={{ color: "var(--accent)" }}>
                        Edit
                    </button>
                    <button type="button" onClick={() => setAsking(true)} className="cursor-pointer" style={{ color: "var(--fg-2)" }}>
                        Delete
                    </button>
                </div>
            )}
        </article>
    );
}
