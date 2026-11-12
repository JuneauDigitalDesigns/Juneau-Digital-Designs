"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "@phosphor-icons/react";
import {
    APPT_KIND_LABEL,
    LENGTH_LABEL,
    ALL_DAY,
    formatTime,
    isAllDay,
    shortDayLabel,
    upcoming,
    type Appointment,
} from "@/app/lib/crm-calendar";
import type { Job } from "@/app/lib/crm-jobs";
import type { TaskRow } from "../stages";
import { KIND_HUE } from "../../calendar/MonthGrid";
import { Label } from "./fields";

/**
 * "Coming up", at the top of the Timeline tab: what is next with this customer.
 *
 * The follow-ups used to sit in the details column beside the timeline. When the record grew tabs
 * (2026-11-12) the details went to Contact info, and the follow-ups came here instead, because
 * the Timeline is the tab the record opens on and a reminder nobody sees is no reminder. Xander:
 * "The timeline is definitely the best place for the coming up section."
 *
 * The customer's next bookings from the calendar come first ("Today · 11:00a · Job visit ·
 * Furnace repair"), with "See calendar" beside the heading; then the follow-ups, as before. The
 * tour's "Never forget a follow-up" step anchors on `crm-drawer-tasks` here.
 */
export default function ComingUp({
    tasks,
    siteSlug,
    customerId,
    onChanged,
    appointments = [],
    jobs = [],
    calendarLink,
    today,
    className,
}: {
    tasks: TaskRow[];
    siteSlug: string;
    customerId: string;
    onChanged: () => void;
    /** This customer's calendar appointments. */
    appointments?: Appointment[];
    jobs?: Job[];
    /** Where "See calendar" goes. Absent, there is no link. */
    calendarLink?: string;
    /** The viewer's today, 'YYYY-MM-DD'. */
    today?: string;
    className?: string;
}) {
    const next = today ? upcoming(appointments, today).slice(0, 3) : [];
    return (
        <section
            className={`min-w-0 ${className ?? ""}`}
            style={{ borderColor: "var(--rule)" }}
            aria-labelledby="crm-coming-up"
        >
            <div className="flex items-center gap-3">
                <div id="crm-coming-up">
                    <Label>Coming up</Label>
                </div>
                {calendarLink && (
                    <Link href={calendarLink} className="ml-auto text-[12.5px] font-medium" style={{ color: "var(--accent)" }}>
                        See calendar
                    </Link>
                )}
            </div>
            {next.length > 0 && today && (
                <ul className="list-none m-0 mt-2 p-0 rounded-xl border" style={{ borderColor: "var(--rule)" }}>
                    {next.map((a, i) => {
                        const job = a.jobId ? jobs.find((j) => j.jobId === a.jobId) : null;
                        const detail = [job?.service, a.address].filter(Boolean).join(" · ");
                        return (
                            <li
                                key={a.id}
                                className={`flex items-center gap-2.5 px-3 py-2.5 text-[13px] min-w-0 ${i > 0 ? "border-t" : ""}`}
                                style={{ borderColor: "var(--rule-weak)" }}
                            >
                                <span aria-hidden="true" className="w-1 self-stretch rounded-sm shrink-0" style={{ background: KIND_HUE[a.kind] }} />
                                <span className="shrink-0 text-[11px] whitespace-nowrap" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                                    {shortDayLabel(a.day, today)} · {isAllDay(a) ? LENGTH_LABEL[ALL_DAY] : formatTime(a.startMinutes)}
                                </span>
                                <span className="shrink-0 font-semibold" style={{ color: "var(--fg)" }}>
                                    {APPT_KIND_LABEL[a.kind]}
                                </span>
                                {detail && (
                                    <span className="truncate min-w-0" style={{ color: "var(--fg-2)" }}>
                                        {detail}
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            <div data-tour="crm-drawer-tasks">
                <TaskList tasks={tasks} siteSlug={siteSlug} customerId={customerId} onChanged={onChanged} />
            </div>
        </section>
    );
}

function TaskList({
    tasks,
    siteSlug,
    customerId,
    onChanged,
}: {
    tasks: TaskRow[];
    siteSlug: string;
    customerId: string;
    onChanged: () => void;
}) {
    const [adding, setAdding] = useState(false);
    const [title, setTitle] = useState("");
    const [due, setDue] = useState("");

    async function create() {
        if (!title.trim()) return;
        await fetch(`/api/portal/tasks?site=${encodeURIComponent(siteSlug)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, title: title.trim(), dueAt: due || null }),
        }).catch(() => {});
        setTitle("");
        setDue("");
        setAdding(false);
        onChanged();
    }

    async function toggle(t: TaskRow) {
        await fetch(`/api/portal/tasks?site=${encodeURIComponent(siteSlug)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: t.taskId, done: !t.done }),
        }).catch(() => {});
        onChanged();
    }

    // Captured once on mount rather than read during render: `Date.now()` in the render path is
    // impure, and a task flipping to "Overdue" mid-render because the clock ticked is exactly
    // the unstable output that rule exists to prevent.
    const [now] = useState(() => Date.now());
    const overdue = (t: TaskRow) => t.dueAt && !t.done && new Date(t.dueAt).getTime() < now;

    return (
        <div className="mt-1.5">
            {tasks.map((t) => (
                <div key={t.taskId} className="flex items-center gap-2.5 py-2 text-[13.5px]">
                    <button
                        type="button"
                        onClick={() => toggle(t)}
                        aria-label={t.done ? "Mark not done" : "Mark done"}
                        className="shrink-0 rounded cursor-pointer"
                        style={{
                            width: 15,
                            height: 15,
                            border: "1.5px solid var(--rule-strong)",
                            background: t.done ? "var(--surface)" : "transparent",
                        }}
                    />
                    <span
                        className="min-w-0"
                        style={{
                            color: t.done ? "var(--fg-2)" : "var(--fg)",
                            textDecoration: t.done ? "line-through" : undefined,
                        }}
                    >
                        {t.title}
                    </span>
                    {t.dueAt && (
                        <span
                            className="ml-auto shrink-0 text-[10.5px]"
                            style={{
                                fontFamily: "var(--font-mono)",
                                color: overdue(t) ? "var(--chart-warn)" : "var(--fg-2)",
                            }}
                        >
                            {overdue(t)
                                ? "Overdue"
                                : `Due ${new Date(t.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                        </span>
                    )}
                </div>
            ))}

            {adding ? (
                <div className="mt-2 space-y-2">
                    <input
                        autoFocus
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. send written quote"
                        className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                        style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    />
                    <div className="flex gap-2">
                        <input
                            type="date"
                            value={due}
                            onChange={(e) => setDue(e.target.value)}
                            className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm outline-none"
                            style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        />
                        <button
                            type="button"
                            onClick={create}
                            className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            Add
                        </button>
                    </div>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="mt-2 text-[12.5px] cursor-pointer inline-flex items-center gap-1"
                    style={{ color: "var(--accent)" }}
                >
                    <Plus size={12} weight="bold" /> Add a follow-up
                </button>
            )}
        </div>
    );
}
