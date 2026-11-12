"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Warning, X } from "@phosphor-icons/react";
import {
    ALL_DAY,
    APPT_KINDS,
    APPT_KIND_LABEL,
    APPT_LENGTHS,
    LENGTH_LABEL,
    TIME_STEP,
    firstConflict,
    formatTime,
    type Appointment,
    type ApptKind,
} from "@/app/lib/crm-calendar";
import type { CalendarCustomer, CalendarJob } from "./api";

/**
 * Book or change one appointment.
 *
 * The console's MeetingForm, adapted: the same dialog over the page, the same live, advisory
 * overlap check ("warn but allow": Save is never blocked by it), the same 15-minute start
 * picker. The identity fields became a customer and one of their jobs, picked from lists, with
 * the address following whichever was picked last.
 *
 * Used by the calendar page (click a day, "New appointment", Edit) and by the customer record's
 * "Add to calendar" on a job, which opens it with the customer and job already chosen.
 *
 * `aria-modal="true"` matters beyond assistive tech: the customer panel and the phone sheet
 * step aside from the keyboard while a modal dialog is open (see `CustomerPanel`), so Tab and
 * Esc belong to this form when it opens over a record. Portalled to `<body>` for the same reason
 * the review drawer was: over the record's panel, not inside its scroll.
 */

export interface ApptFormValues {
    /** Present: edit that appointment. Absent: book a new one. */
    id?: string;
    customerId: string;
    jobId: string;
    day: string;
    startMinutes: number;
    durationMinutes: number;
    kind: ApptKind;
    address: string;
    notes: string;
}

/** Every start slot at the picker's granularity: 12:00a, 12:15a … 11:45p. */
const TIME_OPTIONS = Array.from({ length: (24 * 60) / TIME_STEP }, (_, i) => i * TIME_STEP);

export default function AppointmentForm({
    initial,
    customers,
    jobs,
    appointments,
    names,
    busy,
    onSubmit,
    onCancel,
}: {
    initial: ApptFormValues;
    customers: CalendarCustomer[];
    jobs: CalendarJob[];
    /** Every appointment, for the overlap check. */
    appointments: Appointment[];
    names: Record<string, string | null>;
    busy: boolean;
    onSubmit: (v: ApptFormValues) => void;
    onCancel: () => void;
}) {
    const isEdit = Boolean(initial.id);
    const [v, setV] = useState(initial);
    const set = <K extends keyof ApptFormValues>(k: K, val: ApptFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
    const allDay = v.durationMinutes >= ALL_DAY;

    const theirJobs = jobs.filter((j) => j.customerId === v.customerId);

    const conflict = useMemo(
        () =>
            v.day
                ? firstConflict(
                      { day: v.day, startMinutes: allDay ? 0 : v.startMinutes, durationMinutes: v.durationMinutes },
                      appointments,
                      v.id,
                  )
                : null,
        [v.day, v.startMinutes, v.durationMinutes, v.id, allDay, appointments],
    );

    const first = useRef<HTMLSelectElement>(null);
    const onCancelRef = useRef(onCancel);
    useEffect(() => {
        onCancelRef.current = onCancel;
    }, [onCancel]);
    useEffect(() => {
        first.current?.focus({ preventScroll: true });
        // Capture, so Esc closes this and not the record underneath it.
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return;
            e.preventDefault();
            e.stopPropagation();
            onCancelRef.current();
        };
        document.addEventListener("keydown", onKey, true);
        return () => document.removeEventListener("keydown", onKey, true);
    }, []);

    const canSave = Boolean(v.day && v.customerId) && !busy;

    const field = "w-full rounded-lg border px-2.5 text-[14px] outline-none";
    const fieldStyle = { minHeight: 40, background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" };
    const lab = "block text-[11.5px] mb-1";
    const labStyle = { color: "var(--fg-2)" };

    const form = (
        // `portal-scope` for the tokens, since `<body>` is outside the portal's scope. That class
        // also paints the page background at full height, which would hide whatever is behind
        // the scrim, so both are undone inline.
        <div
            className="portal-scope fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4"
            style={{ background: "transparent", minHeight: 0 }}
        >
            <div className="absolute inset-0" style={{ background: "rgba(13,17,23,0.32)" }} onClick={onCancel} aria-hidden="true" />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="appt-form-title"
                className="relative w-full sm:max-w-[560px] max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl overflow-hidden"
                style={{ background: "var(--elev-1)", boxShadow: "var(--glass-shadow)", fontFamily: "var(--font-body)" }}
            >
                <div className="flex items-center px-5 py-4 border-b" style={{ borderColor: "var(--rule)" }}>
                    <h2 id="appt-form-title" className="m-0 text-[18px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}>
                        {isEdit ? "Edit appointment" : "New appointment"}
                    </h2>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label="Close"
                        className="portal-hit ml-auto w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer"
                        style={{ color: "var(--fg-2)" }}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 grid grid-cols-6 gap-3.5">
                    <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="appt-customer" className={lab} style={labStyle}>
                            Customer
                        </label>
                        <select
                            ref={first}
                            id="appt-customer"
                            value={v.customerId}
                            onChange={(e) => {
                                const c = customers.find((x) => x.customerId === e.target.value);
                                setV((p) => ({ ...p, customerId: e.target.value, jobId: "", address: c?.address ?? p.address }));
                            }}
                            className={field}
                            style={fieldStyle}
                        >
                            {!v.customerId && <option value="" />}
                            {customers.map((c) => (
                                <option key={c.customerId} value={c.customerId}>
                                    {c.name ?? names[c.customerId] ?? "Customer"}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-6 sm:col-span-3">
                        <label htmlFor="appt-job" className={lab} style={labStyle}>
                            Job
                        </label>
                        <select
                            id="appt-job"
                            value={v.jobId}
                            onChange={(e) => {
                                const j = theirJobs.find((x) => x.jobId === e.target.value);
                                setV((p) => ({ ...p, jobId: e.target.value, address: j?.address ?? p.address }));
                            }}
                            className={field}
                            style={fieldStyle}
                        >
                            <option value="">No job</option>
                            {theirJobs.map((j) => (
                                <option key={j.jobId} value={j.jobId}>
                                    {j.service}
                                </option>
                            ))}
                        </select>
                    </div>

                    <fieldset className="col-span-6 m-0 p-0 border-0 min-w-0">
                        <legend className={lab} style={labStyle}>
                            What
                        </legend>
                        <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border overflow-hidden" style={{ borderColor: "var(--rule-strong)" }}>
                            {APPT_KINDS.map((k) => {
                                const on = v.kind === k;
                                return (
                                    <button
                                        key={k}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => set("kind", k)}
                                        className="text-[13px] cursor-pointer border-r last:border-r-0"
                                        style={{
                                            minHeight: 40,
                                            borderColor: "var(--rule)",
                                            fontWeight: on ? 600 : 400,
                                            background: on ? "var(--accent)" : "var(--elev-1)",
                                            color: on ? "var(--on-accent)" : "var(--fg-2)",
                                        }}
                                    >
                                        {APPT_KIND_LABEL[k]}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>

                    <div className="col-span-6 sm:col-span-2">
                        <label htmlFor="appt-day" className={lab} style={labStyle}>
                            Day
                        </label>
                        <input id="appt-day" type="date" value={v.day} onChange={(e) => set("day", e.target.value)} className={field} style={fieldStyle} />
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                        <label htmlFor="appt-start" className={lab} style={labStyle}>
                            Start
                        </label>
                        <select
                            id="appt-start"
                            value={allDay ? 0 : v.startMinutes}
                            disabled={allDay}
                            onChange={(e) => set("startMinutes", Number(e.target.value))}
                            className={`${field} disabled:opacity-50`}
                            style={fieldStyle}
                        >
                            {TIME_OPTIONS.map((m) => (
                                <option key={m} value={m}>
                                    {formatTime(m)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="col-span-3 sm:col-span-2">
                        <label htmlFor="appt-length" className={lab} style={labStyle}>
                            Length
                        </label>
                        <select
                            id="appt-length"
                            value={v.durationMinutes}
                            onChange={(e) => set("durationMinutes", Number(e.target.value))}
                            className={field}
                            style={fieldStyle}
                        >
                            {APPT_LENGTHS.map((l) => (
                                <option key={l} value={l}>
                                    {LENGTH_LABEL[l]}
                                </option>
                            ))}
                        </select>
                    </div>

                    {conflict && (
                        <p
                            role="status"
                            className="col-span-6 m-0 flex gap-2 items-start rounded-lg px-3 py-2 text-[12.5px]"
                            style={{ color: "var(--chart-warn)", background: "color-mix(in srgb, var(--chart-warn) 8%, transparent)" }}
                        >
                            <Warning size={14} className="shrink-0 mt-px" aria-hidden="true" />
                            This overlaps {(conflict.customerId && names[conflict.customerId]) || APPT_KIND_LABEL[conflict.kind]} at{" "}
                            {formatTime(conflict.startMinutes)}. You can still save it.
                        </p>
                    )}

                    <div className="col-span-6">
                        <label htmlFor="appt-address" className={lab} style={labStyle}>
                            Address
                        </label>
                        <input id="appt-address" value={v.address} onChange={(e) => set("address", e.target.value)} className={`${field} px-3`} style={fieldStyle} />
                    </div>
                    <div className="col-span-6">
                        <label htmlFor="appt-notes" className={lab} style={labStyle}>
                            Notes
                        </label>
                        <textarea
                            id="appt-notes"
                            rows={2}
                            value={v.notes}
                            onChange={(e) => set("notes", e.target.value)}
                            className="w-full rounded-lg border px-3 py-2 text-[14px] outline-none resize-y"
                            style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        />
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-5 py-3.5 border-t" style={{ borderColor: "var(--rule)" }}>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-lg border px-4 text-[13.5px] cursor-pointer"
                        style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!canSave}
                        onClick={() => onSubmit(v)}
                        className="rounded-lg px-5 text-[13.5px] font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ minHeight: 44, background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );

    // Over whatever opened it (the record's panel included), not inside its scroll.
    return typeof document === "undefined" ? null : createPortal(form, document.body);
}
