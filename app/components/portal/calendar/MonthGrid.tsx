"use client";

import { useMemo, useState } from "react";
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    pointerWithin,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    compareByStart,
    formatTime,
    isAllDay,
    monthMatrix,
    LENGTH_LABEL,
    ALL_DAY,
    APPT_KIND_LABEL,
    type Appointment,
    type ApptKind,
} from "@/app/lib/crm-calendar";
import type { CalendarFollowUp } from "./api";

/**
 * The month as a grid you can drag appointments around.
 *
 * The console's MonthGrid, in portal tokens: one DndContext, day cells are droppables,
 * appointment bars are draggables, and `PointerSensor` with a 5px activation distance lets a
 * press that barely moves fall through to a click instead of starting a drag. Dropping a bar on
 * another day changes only its day and keeps its time; the caller checks for a clash and saves.
 * Bars within a day are always in time order, never hand-ordered.
 *
 * Follow-ups show on their due day as outlined bars. They are tasks, not appointments, so they
 * do not drag: their due date is changed where they were set.
 *
 * Desktop and tablet only. On a phone the calendar is a compact month with dots (`MiniMonth`),
 * because a 7-column grid of bars at 375px is unreadable and dragging fights scrolling.
 */

/** Each kind's colour, from the portal's chart tokens. Also used by the legend and the day list. */
export const KIND_HUE: Record<ApptKind | "followup", string> = {
    visit: "var(--accent)",
    estimate: "var(--chart-series-2)",
    callback: "var(--chart-pos)",
    other: "var(--chart-neutral)",
    followup: "var(--chart-warn)",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MonthGrid({
    ym,
    today,
    selected,
    appointments,
    followUps,
    names,
    onSelect,
    onOpen,
    onMove,
}: {
    /** The month shown, 'YYYY-MM'. */
    ym: string;
    today: string;
    selected: string;
    appointments: Appointment[];
    followUps: CalendarFollowUp[];
    names: Record<string, string | null>;
    onSelect: (day: string) => void;
    /** A bar was clicked: show its day, with it picked out. */
    onOpen: (day: string, id: string) => void;
    onMove: (id: string, day: string) => void;
}) {
    const [y, m] = ym.split("-").map(Number);
    const weeks = useMemo(() => monthMatrix(y, m - 1), [y, m]);
    const [dragging, setDragging] = useState<string | null>(null);

    const byDay = useMemo(() => {
        const map = new Map<string, Appointment[]>();
        for (const a of appointments) map.set(a.day, [...(map.get(a.day) ?? []), a]);
        for (const list of map.values()) list.sort(compareByStart);
        return map;
    }, [appointments]);
    const dueByDay = useMemo(() => {
        const map = new Map<string, CalendarFollowUp[]>();
        for (const f of followUps) map.set(f.dueAt, [...(map.get(f.dueAt) ?? []), f]);
        return map;
    }, [followUps]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
    const active = dragging ? appointments.find((a) => a.id === dragging) ?? null : null;

    function onDragEnd(e: DragEndEvent) {
        setDragging(null);
        const id = String(e.active.id);
        const to = e.over ? String(e.over.id) : null;
        const a = appointments.find((x) => x.id === id);
        if (a && to && to !== a.day) onMove(id, to);
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={(e) => setDragging(String(e.active.id))}
            onDragEnd={onDragEnd}
            onDragCancel={() => setDragging(null)}
        >
            <div
                className="rounded-2xl border overflow-hidden"
                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
            >
                <div className="grid grid-cols-7 border-b" style={{ background: "var(--bg)", borderColor: "var(--rule)" }}>
                    {DOW.map((d) => (
                        <div
                            key={d}
                            className="px-2.5 py-2 text-[10.5px] uppercase tracking-wider"
                            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
                        >
                            {d}
                        </div>
                    ))}
                </div>
                {weeks.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                        {week.map(({ day, inMonth }) => (
                            <DayCell
                                key={day}
                                day={day}
                                inMonth={inMonth}
                                isToday={day === today}
                                isSelected={day === selected}
                                isPast={day < today}
                                appointments={byDay.get(day) ?? []}
                                followUps={dueByDay.get(day) ?? []}
                                names={names}
                                onSelect={onSelect}
                                onOpen={onOpen}
                            />
                        ))}
                    </div>
                ))}
            </div>
            <DragOverlay dropAnimation={null}>
                {active && (
                    <div className="w-[180px] cursor-grabbing">
                        <Bar appt={active} name={active.customerId ? names[active.customerId] ?? null : null} lifted />
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
}

function DayCell({
    day,
    inMonth,
    isToday,
    isSelected,
    isPast,
    appointments,
    followUps,
    names,
    onSelect,
    onOpen,
}: {
    day: string;
    inMonth: boolean;
    isToday: boolean;
    isSelected: boolean;
    isPast: boolean;
    appointments: Appointment[];
    followUps: CalendarFollowUp[];
    names: Record<string, string | null>;
    onSelect: (day: string) => void;
    onOpen: (day: string, id: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: day });
    const n = Number(day.slice(8));

    return (
        <div
            ref={setNodeRef}
            className="relative h-[118px] flex flex-col gap-[3px] px-1.5 pt-1.5 pb-1 border-r border-b last:border-r-0 min-w-0 overflow-hidden"
            style={{
                borderColor: "var(--rule-weak)",
                background: isOver
                    ? "var(--accent-glow)"
                    : !inMonth
                      ? "var(--bg)"
                      : isPast
                        ? "color-mix(in srgb, var(--bg) 45%, var(--elev-1))"
                        : "var(--elev-1)",
                boxShadow: isSelected ? "inset 0 0 0 2px var(--accent)" : undefined,
            }}
        >
            {/* The day number is the cell's button: it picks the day for the list beside the
                grid, where "Book something on this day" is. A whole-cell click target would
                swallow the bars' own clicks. */}
            <button
                type="button"
                onClick={() => onSelect(day)}
                aria-pressed={isSelected}
                aria-label={new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                })}
                className="self-start rounded-md px-1.5 py-0.5 text-[12px] font-semibold cursor-pointer"
                style={{
                    background: isToday ? "var(--accent)" : "transparent",
                    color: isToday ? "var(--on-accent)" : inMonth ? "var(--fg)" : "var(--fg-3)",
                }}
            >
                {n}
            </button>
            <div className="flex flex-col gap-[3px] min-h-0 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                {appointments.map((a) => (
                    <DraggableBar
                        key={a.id}
                        appt={a}
                        name={a.customerId ? names[a.customerId] ?? null : null}
                        onOpen={() => onOpen(day, a.id)}
                    />
                ))}
                {followUps.map((f) => (
                    <button
                        key={f.taskId}
                        type="button"
                        onClick={() => onOpen(day, f.taskId)}
                        className="flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[11.5px] leading-tight text-left cursor-pointer min-w-0"
                        style={{ border: `1px solid color-mix(in srgb, ${KIND_HUE.followup} 45%, transparent)` }}
                    >
                        <span
                            aria-hidden="true"
                            className="shrink-0 w-[9px] h-[9px] rounded-[2px]"
                            style={{ border: `1.5px solid ${KIND_HUE.followup}` }}
                        />
                        <span className="truncate" style={{ color: "var(--fg)" }}>
                            {names[f.customerId] ?? f.title}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

function DraggableBar({ appt, name, onOpen }: { appt: Appointment; name: string | null; onOpen: () => void }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: appt.id });
    return (
        <button
            ref={setNodeRef}
            type="button"
            {...attributes}
            {...listeners}
            onClick={onOpen}
            className="block w-full text-left cursor-pointer touch-none rounded-md"
            style={{ opacity: isDragging ? 0.35 : 1 }}
        >
            <Bar appt={appt} name={name} />
        </button>
    );
}

/** One appointment as a thin bar: stripe in its kind's colour, time, who. */
export function Bar({ appt, name, lifted = false }: { appt: Appointment; name: string | null; lifted?: boolean }) {
    const hue = appt.status === "no-show" ? "var(--chart-neg)" : KIND_HUE[appt.kind];
    const faded = appt.status === "done" || appt.status === "cancelled";
    return (
        <span
            className="flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[11.5px] leading-tight min-w-0"
            style={{
                background: lifted ? "var(--elev-1)" : `color-mix(in srgb, ${hue} 8%, var(--elev-1))`,
                borderLeft: `3px solid ${hue}`,
                boxShadow: lifted ? "var(--shadow-2)" : undefined,
                opacity: faded ? 0.55 : 1,
            }}
        >
            <span className="shrink-0 font-semibold tabular-nums" style={{ color: "var(--fg-2)" }}>
                {isAllDay(appt) ? LENGTH_LABEL[ALL_DAY] : formatTime(appt.startMinutes)}
            </span>
            <span
                className="truncate"
                style={{ color: "var(--fg)", textDecoration: appt.status === "cancelled" ? "line-through" : undefined }}
            >
                {name ?? APPT_KIND_LABEL[appt.kind]}
            </span>
        </span>
    );
}
