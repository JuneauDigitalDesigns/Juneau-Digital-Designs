"use client";

import { monthMatrix, type Appointment } from "@/app/lib/crm-calendar";
import type { CalendarFollowUp } from "./api";
import { KIND_HUE } from "./MonthGrid";

/**
 * The month on a phone: day numbers with a dot per booking, tap a day to list it below.
 *
 * The console's grid needs 760px and drags with a pointer; neither survives 375px and a thumb.
 * Rescheduling on a phone is Edit, from the day's list.
 */
export default function MiniMonth({
    ym,
    today,
    selected,
    appointments,
    followUps,
    onSelect,
}: {
    ym: string;
    today: string;
    selected: string;
    appointments: Appointment[];
    followUps: CalendarFollowUp[];
    onSelect: (day: string) => void;
}) {
    const [y, m] = ym.split("-").map(Number);
    // Five rows are enough for most months; trim a sixth that is all next month.
    const weeks = monthMatrix(y, m - 1).filter((w) => w.some((c) => c.inMonth));

    return (
        <div className="rounded-2xl border p-2" style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}>
            <div className="grid grid-cols-7 text-center text-[10px] pb-1" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }} aria-hidden="true">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <span key={i}>{d}</span>
                ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
                {weeks.flat().map(({ day, inMonth }) => {
                    const isToday = day === today;
                    const isSel = day === selected;
                    const dots = [
                        ...appointments.filter((a) => a.day === day && a.status !== "cancelled").map((a) => KIND_HUE[a.kind]),
                        ...followUps.filter((f) => f.dueAt === day).map(() => KIND_HUE.followup),
                    ].slice(0, 3);
                    return (
                        <button
                            key={day}
                            type="button"
                            onClick={() => onSelect(day)}
                            aria-pressed={isSel}
                            aria-label={new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
                                weekday: "long",
                                month: "long",
                                day: "numeric",
                            })}
                            className="h-11 rounded-[10px] flex flex-col items-center justify-center gap-[3px] cursor-pointer text-[14px]"
                            style={{
                                background: isSel ? "var(--accent)" : "transparent",
                                boxShadow: isToday && !isSel ? "inset 0 0 0 1.5px var(--accent)" : undefined,
                                color: isSel ? "var(--on-accent)" : inMonth ? "var(--fg)" : "var(--fg-3)",
                                fontWeight: isToday || isSel ? 700 : 500,
                            }}
                        >
                            {Number(day.slice(8))}
                            <span className="flex gap-[2px] h-[5px]" aria-hidden="true">
                                {dots.map((c, i) => (
                                    <span
                                        key={i}
                                        className="w-[5px] h-[5px] rounded-full"
                                        style={{ background: isSel ? "var(--on-accent)" : c }}
                                    />
                                ))}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
