"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight, Plus } from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import {
    APPT_KINDS,
    APPT_KIND_LABEL,
    ALL_DAY,
    firstConflict,
    formatTime,
    isDay,
    monthLabel,
    shiftMonth,
    todayDay,
    type Appointment,
    type ApptStatus,
} from "@/app/lib/crm-calendar";
import { SectionHeader } from "../ui/Card";
import { FeatureError, FeatureState } from "../ui/FeatureState";
import { fetchCalendar, writeAppointment, type CalendarData, type CalendarFollowUp } from "./api";
import AppointmentForm, { type ApptFormValues } from "./AppointmentForm";
import CalendarStarter from "./CalendarStarter";
import DayList from "./DayList";
import MiniMonth from "./MiniMonth";
import MonthGrid, { KIND_HUE } from "./MonthGrid";

/**
 * The Calendar tab: scheduling and follow-ups (Xander, 2026-11-12).
 *
 * The console's CalendarView, brought into the portal and its look. Same house rules:
 * - **A failed refresh never replaces the view.** The last calendar stays and a line says the
 *   change did not save; a hard error only when there is nothing to show.
 * - **Writes are optimistic** where a snap-back would feel broken (a drag, a status), and the
 *   next read reconciles. Creating waits for the server, which owns the id.
 * - **Overlap warns and never blocks.**
 *
 * Gated on `crm`, like Customers: Growth and Enterprise. Starter gets a page saying what Growth
 * adds. `?day=YYYY-MM-DD` opens on a day, which is how the customer record's "Open in calendar"
 * and "See calendar" land here.
 */

const SAVE_FAILED = "That change didn't save. Please try again.";

/** The day only changes on a reload, so there is nothing to subscribe to. */
const noSubscribe = () => () => {};
const readToday = () => todayDay();

export default function CalendarSection({ site }: { site: PortalSiteProps }) {
    const gate = site.features.crm;
    const params = useSearchParams();

    /**
     * "Today" is the viewer's own day, so it is only ever read in the browser.
     *
     * The page is server-rendered first, on a server whose clock is UTC: for a client in the
     * evening that is already tomorrow, and a "today" read during render would draw one day on
     * the server and another in the browser. The server snapshot is null and the page waits for
     * the browser's. Read once; a calendar left open past midnight keeps yesterday's highlight
     * until it is reloaded, as the console's does.
     */
    const today = useSyncExternalStore(noSubscribe, readToday, () => null);
    const asked = params.get("day");
    // Null until picked: the asked-for day, else today, once today is known.
    const [picked, setSelected] = useState<string | null>(() => (isDay(asked) ? asked : null));
    const [shown, setYm] = useState<string | null>(null);
    const [highlight, setHighlight] = useState<string | null>(null);

    const [data, setData] = useState<CalendarData | null>(null);
    const [failed, setFailed] = useState(false);
    const [warning, setWarning] = useState<string | null>(null);
    const [form, setForm] = useState<ApptFormValues | null>(null);
    const [busy, setBusy] = useState(false);
    const hasData = useRef(false);

    const load = useCallback(async () => {
        const next = await fetchCalendar(site.slug);
        if (next) {
            hasData.current = true;
            setData(next);
            setFailed(false);
        } else if (!hasData.current) {
            setFailed(true);
        } else {
            setWarning(SAVE_FAILED);
        }
    }, [site.slug]);

    // The first read. Later reads (after a change) go through `load`.
    useEffect(() => {
        if (gate.state !== "ready") return;
        let cancelled = false;
        fetchCalendar(site.slug).then((next) => {
            if (cancelled) return;
            if (next) {
                hasData.current = true;
                setData(next);
            } else setFailed(true);
        });
        return () => {
            cancelled = true;
        };
    }, [gate.state, site.slug]);

    const selected = picked ?? today ?? "";
    const ym = shown ?? selected.slice(0, 7);

    const pick = (day: string) => {
        setSelected(day);
        setHighlight(null);
        if (day.slice(0, 7) !== ym) setYm(day.slice(0, 7));
    };

    const blank = (day: string): ApptFormValues => {
        const first = data?.customers[0];
        return {
            customerId: first?.customerId ?? "",
            jobId: "",
            day,
            startMinutes: 9 * 60,
            durationMinutes: 60,
            kind: APPT_KINDS[0],
            address: first?.address ?? "",
            notes: "",
        };
    };

    /** Optimistic: the bar moves now, and goes back if the server says no. */
    const patch = useCallback(
        async (id: string, change: Partial<Appointment>) => {
            setWarning(null);
            setData((d) => d && { ...d, appointments: d.appointments.map((a) => (a.id === id ? { ...a, ...change } : a)) });
            const res = await writeAppointment(site.slug, "PATCH", { id, ...change });
            if (!res) setWarning(SAVE_FAILED);
            void load();
        },
        [site.slug, load],
    );

    async function submit(v: ApptFormValues) {
        setBusy(true);
        setWarning(null);
        const body = {
            customerId: v.customerId || null,
            jobId: v.jobId || null,
            day: v.day,
            startMinutes: v.durationMinutes >= ALL_DAY ? 0 : v.startMinutes,
            durationMinutes: v.durationMinutes,
            kind: v.kind,
            address: v.address,
            notes: v.notes,
        };
        const res = await writeAppointment(site.slug, v.id ? "PATCH" : "POST", v.id ? { id: v.id, ...body } : body);
        setBusy(false);
        if (!res) {
            setWarning(SAVE_FAILED);
            return;
        }
        setForm(null);
        pick(v.day);
        void load();
    }

    async function remove(a: Appointment) {
        setData((d) => d && { ...d, appointments: d.appointments.filter((x) => x.id !== a.id) });
        if (!(await writeAppointment(site.slug, "DELETE", { id: a.id }))) setWarning(SAVE_FAILED);
        void load();
    }

    async function followUpDone(f: CalendarFollowUp) {
        setData((d) => d && { ...d, followUps: d.followUps.filter((x) => x.taskId !== f.taskId) });
        const res = await fetch(`/api/portal/tasks?site=${encodeURIComponent(site.slug)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: f.taskId, done: true }),
        }).catch(() => null);
        if (!res?.ok) setWarning(SAVE_FAILED);
        void load();
    }

    /** A bar dragged to another day keeps its time; a clash is pointed out, never refused. */
    function move(id: string, day: string) {
        const a = data?.appointments.find((x) => x.id === id);
        if (!a || !data) return;
        const clash = firstConflict({ ...a, day }, data.appointments, id);
        void patch(id, { day });
        pick(day);
        setHighlight(id);
        if (clash) {
            const who = (clash.customerId && data.names[clash.customerId]) || APPT_KIND_LABEL[clash.kind];
            setWarning(`This overlaps ${who} at ${formatTime(clash.startMinutes)}.`);
        }
    }

    // ── gating ──────────────────────────────────────────────────────────────
    if (gate.state === "not-on-plan") return <CalendarStarter siteSlug={site.slug} />;
    if (gate.state !== "ready") {
        return (
            <div className="space-y-6">
                <SectionHeader title="Calendar" />
                <FeatureState feature="crm" availability={gate} />
            </div>
        );
    }
    if (failed && !data) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Calendar" />
                <FeatureError onRetry={() => void load()} />
            </div>
        );
    }

    // The server render, and the browser's first, before "today" is known.
    if (!today) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Calendar" />
                <div className="h-[560px] rounded-2xl animate-pulse" style={{ background: "var(--surface)" }} />
            </div>
        );
    }

    const appointments = data?.appointments ?? [];
    const followUps = data?.followUps ?? [];
    const names = data?.names ?? {};

    return (
        <div className="space-y-5 min-w-0">
            <div>
                <SectionHeader title="Calendar" />
                <p className="m-0 mt-1 text-[13.5px]" style={{ color: "var(--fg-2)" }}>
                    Jobs, estimates and follow-ups, all in one place.
                </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
                <button
                    type="button"
                    aria-label="Previous month"
                    onClick={() => setYm(shiftMonth(ym, -1))}
                    className="portal-hit w-11 h-11 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center cursor-pointer"
                    style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", background: "var(--elev-1)" }}
                >
                    <CaretLeft size={14} />
                </button>
                <h2 className="m-0 text-[18px] font-bold min-w-[150px] text-center" style={{ color: "var(--fg)" }} aria-live="polite">
                    {monthLabel(ym)}
                </h2>
                <button
                    type="button"
                    aria-label="Next month"
                    onClick={() => setYm(shiftMonth(ym, 1))}
                    className="portal-hit w-11 h-11 sm:w-9 sm:h-9 rounded-lg border flex items-center justify-center cursor-pointer"
                    style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", background: "var(--elev-1)" }}
                >
                    <CaretRight size={14} />
                </button>
                <button
                    type="button"
                    onClick={() => today && pick(today)}
                    className="rounded-lg border px-3 text-[13px] font-medium cursor-pointer"
                    style={{ minHeight: 36, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}
                >
                    Today
                </button>

                <ul className="hidden md:flex list-none m-0 p-0 ml-3 gap-3.5 text-[12px]" style={{ color: "var(--fg-2)" }} aria-label="Key">
                    {(["visit", "estimate", "callback"] as const).map((k) => (
                        <li key={k} className="inline-flex items-center gap-1.5">
                            <span aria-hidden="true" className="w-[9px] h-[9px] rounded-[3px]" style={{ background: KIND_HUE[k] }} />
                            {APPT_KIND_LABEL[k]}
                        </li>
                    ))}
                    <li className="inline-flex items-center gap-1.5">
                        <span aria-hidden="true" className="w-[9px] h-[9px] rounded-[2px]" style={{ border: `1.5px solid ${KIND_HUE.followup}` }} />
                        Follow-up
                    </li>
                </ul>

                <button
                    type="button"
                    onClick={() => setForm(blank(selected))}
                    data-tour="cal-new"
                    disabled={!data || data.customers.length === 0}
                    className="ml-auto rounded-lg px-4 text-[13.5px] font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ minHeight: 40, background: "var(--accent)", color: "var(--on-accent)" }}
                >
                    <Plus size={13} weight="bold" /> New appointment
                </button>
            </div>

            {warning && (
                <p role="alert" className="m-0 text-[13px]" style={{ color: "var(--chart-warn)" }}>
                    {warning}
                </p>
            )}

            <div className="flex flex-col lg:flex-row gap-4 min-w-0">
                <div className="flex-1 min-w-0" data-tour="cal-month">
                    <div className="hidden md:block">
                        <MonthGrid
                            ym={ym}
                            today={today}
                            selected={selected}
                            appointments={appointments}
                            followUps={followUps}
                            names={names}
                            onSelect={pick}
                            onOpen={(day, id) => {
                                pick(day);
                                setHighlight(id);
                            }}
                            onMove={move}
                        />
                    </div>
                    <div className="md:hidden">
                        <MiniMonth
                            ym={ym}
                            today={today}
                            selected={selected}
                            appointments={appointments}
                            followUps={followUps}
                            onSelect={pick}
                        />
                    </div>
                </div>
                <DayList
                    className="lg:w-[300px] lg:shrink-0 lg:self-start"
                    day={selected}
                    today={today}
                    siteSlug={site.slug}
                    appointments={appointments}
                    followUps={followUps}
                    names={names}
                    jobs={data?.jobs ?? []}
                    highlight={highlight}
                    onStatus={(a, s: ApptStatus) => void patch(a.id, { status: s })}
                    onEdit={(a) =>
                        setForm({
                            id: a.id,
                            customerId: a.customerId ?? "",
                            jobId: a.jobId ?? "",
                            day: a.day,
                            startMinutes: a.startMinutes,
                            durationMinutes: a.durationMinutes,
                            kind: a.kind,
                            address: a.address ?? "",
                            notes: a.notes ?? "",
                        })
                    }
                    onDelete={(a) => void remove(a)}
                    onDone={(f) => void followUpDone(f)}
                    onBook={() => setForm(blank(selected))}
                />
            </div>

            {form && data && (
                <AppointmentForm
                    initial={form}
                    customers={data.customers}
                    jobs={data.jobs}
                    appointments={data.appointments}
                    names={data.names}
                    busy={busy}
                    onSubmit={(v) => void submit(v)}
                    onCancel={() => setForm(null)}
                />
            )}
        </div>
    );
}
