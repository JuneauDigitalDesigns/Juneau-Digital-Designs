"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
    CalendarPlus,
    CaretRight,
    ChatCircle,
    Envelope,
    FileText,
    PhoneCall,
    Plus,
    Star,
} from "@phosphor-icons/react";
import { tabHref } from "@/app/portal/types";
import { duration } from "@/app/lib/duration";
import { buildTimeline, type TimelineEntry } from "@/app/lib/timeline";
import {
    STAGES,
    STAGE_COLOR,
    dayLabel,
    formatPhone,
    type CustomerRow,
    type TaskRow,
    type TimelineEvent,
} from "./stages";
import QuickReplies from "./QuickReplies";
import ReviewRequestDialog from "../ReviewRequestDialog";
import type { CustomerNote, Job } from "@/app/lib/crm-jobs";
import {
    APPT_KIND_LABEL,
    ALL_DAY,
    LENGTH_LABEL,
    formatSpan,
    formatTime,
    isAllDay,
    shortDayLabel,
    todayDay,
    upcoming,
    type Appointment,
} from "@/app/lib/crm-calendar";
import AppointmentForm, { type ApptFormValues } from "../calendar/AppointmentForm";
import { calendarHref, fetchCalendar, writeAppointment, type CalendarData } from "../calendar/api";
import { Label } from "./record/fields";
import RecordTabs, { panelId, tabId, type RecordTab } from "./record/RecordTabs";
import ComingUp from "./record/ComingUp";
import ContactTab from "./record/ContactTab";
import JobsTab from "./record/JobsTab";
import NotesTab from "./record/NotesTab";

/**
 * The customer record.
 *
 * Two shells, one body. On a desktop it fills the wide panel that slides over the board
 * (`variant="panel"`, inside `CustomerPanel`), and on a phone it stays the bottom sheet it has
 * always been (`variant="sheet"`, wrapped by `CustomerDrawer`). It used to be a 760px drawer on
 * both, which was never enough room for a details panel beside a full timeline — and the layout
 * did not actually fit in it: see the `minmax(0, …)` note on the grid below. Between the two it
 * replaced the board outright (`variant="page"`), which lost the board you came from.
 *
 * Nothing here is a floating card. The record sits straight on the surface, divided by hairlines,
 * because a stack of bordered boxes inside a bordered panel inside a page reads as debris. The
 * one exception is the message composer, which is a thing you act *into* rather than read, so it
 * keeps an edge.
 *
 * **Tabs** (Xander, 2026-11-12): Timeline, where it opens, then Contact info, Jobs and Notes,
 * under the header with the actions and the stage. The Timeline carries "Coming up" (the
 * follow-ups) and the text bar pinned to its foot; Contact info took the details column's fields
 * and the tags; Jobs replaced the single "Job value"; Notes replaced the single notes box. The
 * pieces live in `./record/`.
 *
 * The timeline is the part with a hard legibility requirement. It is read by someone who is not
 * technical, often on a phone, usually in a hurry — so: one plain-language line per event, day
 * grouping, consecutive same-kind runs collapsed, and detail only on request. The one exception
 * is the call they came from, which is pinned open above the timeline; see `OriginCall`.
 */

interface DetailResponse {
    customer: CustomerRow;
    timeline: TimelineEvent[];
    tasks: TaskRow[];
    jobs: Job[];
    notes: CustomerNote[];
    appointments: Appointment[];
    messagingState: "ready" | "not-on-plan" | "pending-build" | "connecting";
}

type TimelineFilter = "all" | "messages" | "calls" | "notes";

/** Words, not lowercase mono. The filters are read by someone who does not work here. */
const FILTER_LABEL: Record<TimelineFilter, string> = {
    all: "Everything",
    messages: "Texts",
    calls: "Calls",
    notes: "Your notes",
};

const KIND_ICON = {
    call: PhoneCall,
    "web-form": Envelope,
    "sms-in": ChatCircle,
    "sms-out": ChatCircle,
    "review-request": Star,
    "stage-change": CaretRight,
    note: FileText,
    task: FileText,
    file: FileText,
} as const;

/** Which filter chip an event belongs to. */
function bucketOf(kind: TimelineEvent["kind"]): TimelineFilter[] {
    if (kind === "sms-in" || kind === "sms-out") return ["all", "messages"];
    if (kind === "call") return ["all", "calls"];
    if (kind === "note" || kind === "task") return ["all", "notes"];
    return ["all"];
}

export default function CustomerRecord({
    customerId,
    siteSlug,
    variant,
    onChanged,
    review,
    onNotFound,
    backHref,
    onBack,
    initialTab = "timeline",
}: {
    customerId: string | null;
    siteSlug: string;
    /** `panel` fills the desktop slide-in panel; `sheet` is the body of the mobile drawer. */
    variant: "panel" | "sheet";
    /** The board this record was opened from. Defaults to the bare Customers tab. */
    backHref?: string;
    /** Closes the record. When given, "All customers" calls it instead of navigating. */
    onBack?: () => void;
    /** Which tab a record opens on. Timeline unless a caller (the tour, a demo) needs another. */
    initialTab?: RecordTab;
    onChanged: () => void;
    /** What the review popover needs from the board: the business name and whether a link is set. */
    review: ReviewContext;
    /**
     * The record could not be loaded — archived, deleted, or a deep link naming a customer
     * that is not this account's. The caller takes the view back to the board; see the note
     * where it is passed in.
     */
    onNotFound?: () => void;
}) {
    const [data, setData] = useState<DetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<TimelineFilter>("all");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [fieldError, setFieldError] = useState<string | null>(null);

    // The open tab belongs to the customer it was picked on: opening another one starts back on
    // `initialTab`. Derived during render rather than reset in an effect, so the new customer
    // never paints for a frame on the last one's tab.
    const [tabFor, setTabFor] = useState<{ id: string | null; tab: RecordTab }>({
        id: customerId,
        tab: initialTab,
    });
    const tab = tabFor.id === customerId ? tabFor.tab : initialTab;

    /**
     * "Add to calendar" on a job: the calendar's own form, over the record, with this customer
     * and that job already picked. The calendar is read as it opens, for the overlap check.
     */
    const [booking, setBooking] = useState<{ values: ApptFormValues; calendar: CalendarData } | null>(null);
    const [bookingBusy, setBookingBusy] = useState(false);
    const [today] = useState(() => todayDay());
    const setTab = useCallback((t: RecordTab) => setTabFor({ id: customerId, tab: t }), [customerId]);

    /**
     * "Text" in the header: to the Timeline, then into the text box.
     *
     * Scrolled and focused by hand rather than by following `#crm-sms`: the hash would push a
     * history entry, and "All customers" steps back over the entry opening the record pushed. A
     * click's state update is committed before the next frame, so the box exists by then.
     */
    const goText = useCallback(() => {
        setTab("timeline");
        requestAnimationFrame(() => {
            const target = document.getElementById("crm-sms") ?? document.getElementById("crm-composer");
            target?.scrollIntoView({ block: "nearest" });
            target?.focus({ preventScroll: true });
        });
    }, [setTab]);

    const reload = useCallback(async () => {
        if (!customerId) return;
        const fresh = await fetch(
            `/api/portal/customers/${customerId}?site=${encodeURIComponent(siteSlug)}`,
        )
            .then((r) => r.json())
            .catch(() => null);
        if (fresh?.customer) setData(fresh);
    }, [customerId, siteSlug]);

    useEffect(() => {
        if (!customerId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/portal/customers/${customerId}?site=${encodeURIComponent(siteSlug)}`)
            .then((r) => r.json())
            .then((json) => {
                if (cancelled) return;
                if (json?.customer) setData(json);
                else {
                    setData(null);
                    onNotFound?.();
                }
            })
            .catch(() => {})
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [customerId, siteSlug, onNotFound]);

    const customer = data?.customer ?? null;

    /**
     * Returns whether it landed, because a phone edit can now be refused.
     *
     * The index maps one number to one customer, so correcting a typo into a number another
     * customer already holds is rejected with a 409 rather than silently re-pointing it. The
     * field shows the message and puts the old value back.
     */
    async function patch(body: Record<string, unknown>): Promise<boolean> {
        if (!customerId) return false;
        setFieldError(null);
        try {
            const res = await fetch(`/api/portal/customers?site=${encodeURIComponent(siteSlug)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId, ...body }),
            });
            if (!res.ok) {
                const json = await res.json().catch(() => ({}));
                setFieldError(json?.error ?? "That change didn't save. Please try again.");
                return false;
            }
        } catch {
            setFieldError("That change didn't save. Please try again.");
            return false;
        }
        onChanged();
        return true;
    }

    async function sendMessage() {
        if (!customerId || !draft.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/portal/messages?site=${encodeURIComponent(siteSlug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ customerId, body: draft.trim() }),
            });
            if (res.ok) {
                setDraft("");
                // Re-read so the new message appears in the timeline in its real position.
                await reload();
                onChanged();
            }
        } finally {
            setSending(false);
        }
    }

    /**
     * The call this customer was promoted from, lifted out of the timeline.
     *
     * It is the only entry a client is guaranteed to want, and it used to sit in the list as an
     * ordinary row with its summary and recording behind a disclosure click — so the thing that
     * started the customer looked like it had not been kept at all.
     */
    const origin = useMemo(
        () => (data?.timeline ?? []).find((e) => e.meta?.origin === true) ?? null,
        [data],
    );

    /**
     * The whole reading of the history, decided in `app/lib/timeline.ts`.
     *
     * It used to be grouped and collapsed inline here, and the component then drew rows that
     * said what happened without saying who did it. Moving the shaping out is what made the
     * titles, the day headings and the conversation runs testable — and what let this file
     * go back to drawing what it is handed.
     */
    const days = useMemo(
        () =>
            buildTimeline(
                (data?.timeline ?? []).filter(
                    (e) => e.meta?.origin !== true && bucketOf(e.kind).includes(filter),
                ),
                customer?.name ?? null,
            ),
        [data, filter, customer],
    );

    if (loading && !customer) {
        return (
            <div className="p-6 text-sm" style={{ color: "var(--fg-3)" }}>
                Loading…
            </div>
        );
    }
    if (!customer) return null;

    const page = variant === "panel";
    const pad = page ? "px-7" : "px-5";

    /** After a change from inside the record: the board re-reads, and so does the record. */
    const refresh = () => {
        onChanged();
        void reload();
    };

    const reviewProps: ReviewAnchorProps = {
        ...review,
        customer,
        siteSlug,
        messagingState: data?.messagingState ?? "ready",
        // A sent request locks the button, so the record re-reads to show "Review requested".
        onSent: () => {
            onChanged();
            void reload();
        },
    };

    const activity = (
        <div data-record-activity="" className="flex flex-col flex-1 min-w-0 min-h-0">
            <ComingUp
                tasks={data?.tasks ?? []}
                siteSlug={siteSlug}
                customerId={customer.customerId}
                onChanged={refresh}
                appointments={data?.appointments ?? []}
                jobs={data?.jobs ?? []}
                calendarLink={calendarHref(siteSlug)}
                today={today}
                className={`${pad} pt-5 pb-4 border-b`}
            />
            {origin && <OriginCall event={origin} className={`${pad} py-6`} />}

            <div
                className={`flex items-center gap-1.5 ${pad} py-3.5 border-b flex-wrap`}
                style={{ borderColor: "var(--rule)" }}
            >
                {(["all", "messages", "calls", "notes"] as TimelineFilter[]).map((f) => (
                    <button
                        key={f}
                        type="button"
                        onClick={() => setFilter(f)}
                        aria-pressed={filter === f}
                        className="px-2.5 py-1 rounded-lg text-[12.5px] border cursor-pointer"
                        style={{
                            fontWeight: filter === f ? 600 : 400,
                            background: filter === f ? "var(--fg)" : "var(--elev-1)",
                            color: filter === f ? "var(--elev-1)" : "var(--fg-2)",
                            borderColor: filter === f ? "var(--fg)" : "var(--rule-strong)",
                        }}
                    >
                        {FILTER_LABEL[f]}
                    </button>
                ))}
                <span
                    className="ml-auto text-[10px]"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
                >
                    {data?.timeline.length ?? 0} events
                </span>
            </div>

            {/* min-w-0 is load-bearing — see the grid note below. */}
            <div
                data-tour="crm-drawer-timeline"
                className={`${pad} pb-5 overflow-y-auto flex-1 min-w-0`}
            >
                {days.length === 0 && (
                    <p className="py-8 text-sm text-center" style={{ color: "var(--fg-3)" }}>
                        Nothing here yet.
                    </p>
                )}

                {days.map((day) => (
                    <div key={day.key} className="pt-4 min-w-0">
                        <div className="flex items-baseline gap-2.5 mb-1">
                            <b className="text-[13px] font-bold" style={{ color: "var(--fg)" }}>
                                {day.label}
                            </b>
                            <span className="text-[12px]" style={{ color: "var(--fg-3)" }}>
                                {day.detail}
                            </span>
                        </div>

                        {day.entries.map((entry, i) => {
                            const { lead, run } = entry;
                            const isOpen = expanded.has(entry.id);
                            const detail = lead.meta?.detail as string | undefined;
                            const recording = lead.meta?.recordingUrl as string | undefined;
                            const long = (detail?.length ?? 0) > 260;
                            const first = i === 0;
                            const last = i === day.entries.length - 1;

                            return (
                                <div key={entry.id} className="relative flex gap-3 py-2.5 min-w-0">
                                    {/* The spine. Trimmed at the first and last marker so the
                                        line connects events rather than floating past them. */}
                                    <span
                                        aria-hidden="true"
                                        className="absolute w-px"
                                        style={{
                                            left: 13,
                                            top: first ? 20 : 0,
                                            bottom: last ? "calc(100% - 20px)" : 0,
                                            background: "var(--rule)",
                                        }}
                                    />
                                    <Marker entry={entry} />

                                    <div className="flex-1 min-w-0 pt-px">
                                        <div className="flex items-baseline gap-2.5 flex-wrap">
                                            <span
                                                className="text-[13.5px] font-semibold"
                                                style={{ color: "var(--fg)" }}
                                            >
                                                {entry.title}
                                            </span>
                                            <span
                                                className="text-[9.5px] uppercase px-1.5 py-0.5 rounded"
                                                style={{
                                                    fontFamily: "var(--font-mono)",
                                                    letterSpacing: "0.09em",
                                                    background: "var(--surface)",
                                                    color: "var(--fg-2)",
                                                }}
                                            >
                                                {entry.kindLabel}
                                            </span>
                                            <span
                                                className="ml-auto shrink-0 text-[10.5px] whitespace-nowrap"
                                                style={{
                                                    fontFamily: "var(--font-mono)",
                                                    color: "var(--fg-3)",
                                                }}
                                            >
                                                {entry.timeLabel}
                                            </span>
                                        </div>

                                        {/* A conversation reads as itself. It used to collapse
                                            to "2 messages", which hid the only part anyone
                                            wanted — a text is short enough to show in place. */}
                                        {run.length > 1 || isSms(lead.kind) ? (
                                            <div className="flex flex-col gap-1.5 mt-1.5 min-w-0">
                                                {run.map((m) => {
                                                    const mine = m.kind === "sms-out";
                                                    return (
                                                        <p
                                                            key={m.id}
                                                            className="m-0 text-[13px] leading-snug rounded-xl px-3 py-2"
                                                            style={{
                                                                maxWidth: "min(46ch, 100%)",
                                                                marginLeft: mine ? "auto" : undefined,
                                                                background: mine
                                                                    ? "rgba(37,99,235,0.08)"
                                                                    : "var(--surface)",
                                                                color: "var(--fg-2)",
                                                            }}
                                                        >
                                                            {String(m.meta?.body ?? m.summary)}
                                                        </p>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            detail && (
                                                <p
                                                    className="m-0 mt-1 text-[13px] leading-relaxed"
                                                    style={{
                                                        color: "var(--fg-2)",
                                                        maxWidth: "62ch",
                                                        display: long && !isOpen ? "-webkit-box" : undefined,
                                                        WebkitLineClamp: long && !isOpen ? 3 : undefined,
                                                        WebkitBoxOrient:
                                                            long && !isOpen ? "vertical" : undefined,
                                                        overflow: long && !isOpen ? "hidden" : undefined,
                                                    }}
                                                >
                                                    {detail}
                                                </p>
                                            )
                                        )}

                                        {/* Only a genuinely long summary gets a disclosure.
                                            Everything used to, including one-line notes. */}
                                        {long && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setExpanded((s) => {
                                                        const n = new Set(s);
                                                        if (n.has(entry.id)) n.delete(entry.id);
                                                        else n.add(entry.id);
                                                        return n;
                                                    })
                                                }
                                                className="mt-1.5 text-[12.5px] font-medium cursor-pointer"
                                                style={{ color: "var(--accent)" }}
                                            >
                                                {isOpen ? "Show less" : "Read the whole summary"}
                                            </button>
                                        )}

                                        {recording && (
                                            <audio
                                                controls
                                                preload="none"
                                                src={recording}
                                                className="mt-2.5 w-full"
                                                style={{ maxWidth: 360 }}
                                            />
                                        )}

                                        {lead.kind === "stage-change" &&
                                            typeof lead.meta?.from === "string" && (
                                                <p
                                                    className="m-0 mt-1 text-[10.5px]"
                                                    style={{
                                                        fontFamily: "var(--font-mono)",
                                                        color: "var(--fg-3)",
                                                    }}
                                                >
                                                    From {String(lead.meta.from)}
                                                </p>
                                            )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* The composer, or the A2P wait: a bar pinned to the bottom of the timeline.

                It used to sit after the last event, so replying to a long history meant
                scrolling to the end of it first. `sticky` holds it at the bottom of whatever
                scrolls the record (the desktop panel, the phone sheet) while any of the
                timeline is on screen; `mt-auto` puts it at the foot of the column when the
                history is shorter than the details beside it. Opaque, with a soft lift, so the
                timeline reads as passing underneath.

                Sticky fails silently if anything between here and the scroller clips, so the
                column and the body grid carry no `overflow`. `test/pinned-composer.test.mjs`
                holds both. */}
            <div
                id="crm-composer"
                className={`${pad} py-3.5 border-t min-w-0 sticky bottom-0 mt-auto z-[2]`}
                style={{
                    borderColor: "var(--rule)",
                    background: "var(--elev-1)",
                    boxShadow: "0 -10px 22px -16px rgba(13,17,23,0.28)",
                }}
            >
                {data?.messagingState === "ready" ? (
                    <>
                    {/* Inside this gate only: quick replies are a texting tool, and texting is
                        Growth/Enterprise with A2P verified. Draws nothing until the
                        reply-templates route exists. */}
                    {customer.phone && (
                        <QuickReplies siteSlug={siteSlug} name={customer.name} onPick={setDraft} />
                    )}
                    <div
                        className="flex gap-2 items-end p-3 rounded-xl border min-w-0"
                        style={{ background: "var(--bg)", borderColor: "var(--rule)" }}
                    >
                        <label htmlFor="crm-sms" className="sr-only">
                            Text {customer.name ?? "them"}
                        </label>
                        <textarea
                            id="crm-sms"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={2}
                            placeholder={`Text ${customer.name ?? "them"}…`}
                            disabled={!customer.phone}
                            className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-sm outline-none resize-none disabled:opacity-50"
                            style={{
                                background: "var(--elev-1)",
                                borderColor: "var(--rule-strong)",
                                color: "var(--fg)",
                            }}
                        />
                        <button
                            type="button"
                            onClick={sendMessage}
                            disabled={sending || !draft.trim() || !customer.phone}
                            className="shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                            style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                        >
                            {sending ? "Sending…" : "Send"}
                        </button>
                    </div>
                    </>
                ) : data?.messagingState === "not-on-plan" ? (
                    <Pending>Texting your customers comes with Growth.</Pending>
                ) : (
                    <Pending>
                        {/* No timeframe. Carrier approval is not ours to promise, and the
                            marketing side already holds that line — see the note in
                            `homepageclient.tsx` on a timeframe here being ours promising
                            theirs. */}
                        <b>Texting turns on soon.</b> Your business registration is with the
                        carriers. Calls and leads are unaffected.
                    </Pending>
                )}
            </div>
        </div>
    );

    const jobs = data?.jobs ?? [];
    const notes = data?.notes ?? [];
    const appointments = data?.appointments ?? [];

    async function addToCalendar(job: Job) {
        const calendar = await fetchCalendar(siteSlug);
        if (!calendar || !customer) return;
        setBooking({
            calendar,
            values: {
                customerId: customer.customerId,
                jobId: job.jobId,
                day: today,
                startMinutes: 9 * 60,
                durationMinutes: 60,
                kind: "visit",
                address: job.address ?? customer.address ?? "",
                notes: "",
            },
        });
    }

    async function book(v: ApptFormValues) {
        setBookingBusy(true);
        const ok = await writeAppointment(siteSlug, "POST", {
            customerId: v.customerId || null,
            jobId: v.jobId || null,
            day: v.day,
            startMinutes: v.durationMinutes >= ALL_DAY ? 0 : v.startMinutes,
            durationMinutes: v.durationMinutes,
            kind: v.kind,
            address: v.address,
            notes: v.notes,
        });
        setBookingBusy(false);
        if (ok) {
            setBooking(null);
            refresh();
        }
    }

    const visitsOf = (job: Job) => appointments.filter((a) => a.jobId === job.jobId);

    /**
     * The tabs and what they show.
     *
     * `min-w-0` all the way down is load-bearing. This used to be a two-column grid whose bare
     * `1fr` track took the timeline's one-line min-content (the whole summary) as its floor, and
     * pushed the activity 782px off the side of a 744px panel. One column now, but the floor is
     * the same trap, so every box on the chain keeps `min-w-0`.
     *
     * No `overflow` on this or the timeline column: the text bar is `sticky`, and any clipping
     * ancestor would silently pin it to a box that never scrolls (`test/pinned-composer.test.mjs`).
     */
    const body = (
        <div data-record-body="" className="flex flex-col flex-1 min-h-0 min-w-0">
            <RecordTabs
                tab={tab}
                onChange={setTab}
                counts={{ jobs: jobs.length, notes: notes.length }}
                className={page ? "px-4" : "px-2"}
            />
            <div
                role="tabpanel"
                id={panelId(tab)}
                aria-labelledby={tabId(tab)}
                className="flex flex-col flex-1 min-w-0"
            >
                {tab === "timeline" && activity}
                {tab === "contact" && (
                    <ContactTab customer={customer} patch={patch} fieldError={fieldError} className={`${pad} py-6`} />
                )}
                {tab === "jobs" && (
                    <JobsTab
                        customer={customer}
                        jobs={jobs}
                        siteSlug={siteSlug}
                        onChanged={refresh}
                        className={`${pad} py-5`}
                        renderMeta={(job) => {
                            const next = upcoming(visitsOf(job), today)[0];
                            if (!next) return "No visit booked";
                            const day = shortDayLabel(next.day, today);
                            return `Next visit ${day === "Today" ? "today" : day} · ${
                                isAllDay(next) ? LENGTH_LABEL[ALL_DAY] : formatTime(next.startMinutes)
                            }`;
                        }}
                        renderVisits={(job) => <Visits visits={visitsOf(job)} today={today} siteSlug={siteSlug} />}
                        renderActions={(job) => (
                            <button
                                type="button"
                                onClick={() => void addToCalendar(job)}
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 text-[12.5px] font-medium cursor-pointer whitespace-nowrap"
                                style={{ minHeight: 36, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}
                            >
                                <CalendarPlus size={14} /> Add to calendar
                            </button>
                        )}
                    />
                )}
                {tab === "notes" && (
                    <NotesTab
                        customer={customer}
                        notes={notes}
                        siteSlug={siteSlug}
                        onChanged={refresh}
                        className={`${pad} py-5`}
                    />
                )}
            </div>
        </div>
    );

    /**
     * One surface, not a tray of cards.
     *
     * The panel paints the surface and draws the edge, so the record runs to it: a bordered,
     * rounded card inside a bordered panel would be a box in a box. `min-h-full` and the flex
     * column let the Timeline's text bar sit at the foot of the panel when the history is short.
     */
    return (
        <div className="min-w-0 min-h-full flex flex-col">
            {page ? (
                <RecordHeader
                    customer={customer}
                    patch={patch}
                    review={reviewProps}
                    backHref={backHref ?? tabHref("customers", siteSlug)}
                    onBack={onBack}
                    onText={goText}
                />
            ) : (
                <SheetHeader customer={customer} patch={patch} review={reviewProps} onText={goText} />
            )}
            {body}
            {booking && (
                <AppointmentForm
                    initial={booking.values}
                    customers={[{ customerId: customer.customerId, name: customer.name, address: customer.address }]}
                    jobs={jobs}
                    appointments={booking.calendar.appointments}
                    names={booking.calendar.names}
                    busy={bookingBusy}
                    onSubmit={(v) => void book(v)}
                    onCancel={() => setBooking(null)}
                />
            )}
        </div>
    );
}

/** A job's booked visits, under its details, each with a way to its day on the calendar. */
function Visits({ visits, today, siteSlug }: { visits: Appointment[]; today: string; siteSlug: string }) {
    if (visits.length === 0) return null;
    const key = (a: Appointment) => `${a.day} ${String(a.startMinutes).padStart(4, "0")}`;
    const sorted = [...visits].sort((a, b) => key(a).localeCompare(key(b)));
    return (
        <div className="min-w-0">
            <Label>Visits</Label>
            <ul className="list-none m-0 mt-2 p-0 flex flex-col gap-1.5">
                {sorted.map((a) => (
                    <li
                        key={a.id}
                        className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border px-3 py-2 text-[13px]"
                        style={{ borderColor: "var(--rule)", background: "var(--elev-1)", opacity: a.status === "cancelled" ? 0.6 : 1 }}
                    >
                        <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                            {shortDayLabel(a.day, today)} · {formatSpan(a)}
                        </span>
                        <span className="font-semibold" style={{ color: "var(--fg)" }}>
                            {APPT_KIND_LABEL[a.kind]}
                        </span>
                        <Link href={calendarHref(siteSlug, a.day)} className="ml-auto text-[12.5px]" style={{ color: "var(--accent)" }}>
                            Open in calendar
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/* ── the panel header ─────────────────────────────────────────────────────── */

/**
 * Who they are and what you can do about it, at the top of the panel.
 *
 * Only the panel variant has this; the sheet gets the drawer's own title bar, where a phone has
 * no room for a second one. Call / Text / Request a review sit here rather than at the bottom of
 * a details column, because they are the reason the record was opened.
 */
function RecordHeader({
    customer,
    patch,
    review,
    backHref,
    onBack,
    onText,
}: {
    customer: CustomerRow;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
    review: ReviewAnchorProps;
    backHref: string;
    onBack?: () => void;
    /** Opens the Timeline tab and puts the cursor in the text box. */
    onText: () => void;
}) {
    const initials = (customer.name ?? "?")
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    /**
     * Focus lands on "All customers" once there is one.
     *
     * `CustomerPanel` focuses itself the moment it opens, because the record is still loading
     * and this link does not exist yet. When it arrives, focus moves here — but only if it is
     * still on the bare panel. Anyone who has already tabbed somewhere, and the tour, whose
     * popover holds focus, are left alone.
     */
    const backRef = useRef<HTMLAnchorElement>(null);
    useEffect(() => {
        if (document.activeElement?.hasAttribute("data-customer-panel")) {
            backRef.current?.focus({ preventScroll: true });
        }
    }, []);

    return (
        <header className="px-7 pt-5 border-b" style={{ borderColor: "var(--rule)" }}>
            {/* A real link, so it can be opened in a new tab; a plain click closes the record in
                place, which lets the board step back over the history entry opening it pushed. */}
            <Link
                ref={backRef}
                href={backHref}
                onClick={(e) => {
                    if (!onBack || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
                    e.preventDefault();
                    onBack();
                }}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold mb-3.5 -ml-1 px-1 py-1 rounded-md"
                style={{ color: "var(--accent)" }}
            >
                <ArrowLeft size={13} weight="bold" />
                All customers
            </Link>

            <div className="flex flex-wrap items-start gap-4">
                <span
                    aria-hidden="true"
                    className="shrink-0 w-[46px] h-[46px] rounded-xl flex items-center justify-center text-[15px] font-semibold"
                    style={{ background: "var(--surface)", color: "var(--fg-2)" }}
                >
                    {initials}
                </span>

                <div className="flex-1 min-w-0" style={{ flexBasis: "280px" }}>
                    {/* h2: the board behind keeps the page's h1, "Customers". */}
                    <h2
                        className="text-[22px] font-bold leading-tight m-0 mb-1 truncate"
                        style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
                    >
                        {customer.name ?? "Customer"}
                    </h2>
                    <p
                        className="m-0 text-[13px] flex flex-wrap gap-x-2.5 gap-y-1"
                        style={{ color: "var(--fg-2)" }}
                    >
                        {customer.phone && (
                            <a href={`tel:${customer.phone}`} style={{ color: "var(--accent)" }}>
                                {formatPhone(customer.phone)}
                            </a>
                        )}
                        {customer.email && (
                            <a
                                href={`mailto:${customer.email}`}
                                className="break-all"
                                style={{ color: "var(--accent)" }}
                            >
                                {customer.email}
                            </a>
                        )}
                        <span>Customer since {dayLabel(customer.firstContactAt ?? customer.createdAt)}</span>
                    </p>
                </div>

                <div className="shrink-0 flex flex-wrap gap-2 relative">
                    {customer.phone && (
                        <a
                            href={`tel:${customer.phone}`}
                            className="portal-hit inline-flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium"
                            style={{
                                minHeight: 44,
                                borderColor: "var(--rule-strong)",
                                color: "var(--fg)",
                            }}
                        >
                            <PhoneCall size={14} /> Call
                        </a>
                    )}
                    {customer.phone && (
                        <a
                            href="#crm-sms"
                            onClick={(e) => {
                                // Scrolled and focused by hand rather than by the hash. Following
                                // it would push a `#crm-sms` history entry, and "All customers"
                                // steps back over the entry opening the record pushed — it would
                                // land on that hash entry instead, with the record still open.
                                e.preventDefault();
                                onText();
                            }}
                            className="portal-hit inline-flex items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium"
                            style={{
                                minHeight: 44,
                                borderColor: "var(--rule-strong)",
                                color: "var(--fg)",
                            }}
                        >
                            <ChatCircle size={14} /> Text
                        </a>
                    )}
                    <ReviewAnchor {...review} align="end" />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 pb-3.5" data-tour="crm-drawer-stage">
                <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
                >
                    Stage
                </span>
                <StagePicker customer={customer} patch={patch} />
            </div>
        </header>
    );
}

function StagePicker({
    customer,
    patch,
}: {
    customer: CustomerRow;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
}) {
    return (
        <div
            role="group"
            aria-label="Pipeline stage"
            className="flex flex-wrap rounded-lg overflow-hidden border"
            style={{ borderColor: "var(--rule-strong)" }}
        >
            {STAGES.map((s) => {
                const on = s.key === customer.stage;
                return (
                    <button
                        key={s.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => void patch({ stage: s.key })}
                        className="px-3 inline-flex items-center gap-1.5 cursor-pointer border-r last:border-r-0"
                        style={{
                            minHeight: 34,
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: on ? 600 : 400,
                            borderColor: "var(--rule)",
                            background: on ? "var(--accent)" : "var(--elev-1)",
                            color: on ? "var(--on-accent)" : "var(--fg-2)",
                        }}
                    >
                        {!on && (
                            <span
                                className="portal-dot"
                                style={{ width: 6, height: 6, background: STAGE_COLOR[s.key] }}
                            />
                        )}
                        {s.label}
                    </button>
                );
            })}
        </div>
    );
}

/* ── the phone sheet's header ─────────────────────────────────────────────── */

/**
 * Who they are and what you can do about it, at the top of the phone sheet.
 *
 * The sheet has its own title bar ("All customers"), so this is the rest of the panel header,
 * stacked for 390px: the name, their number, Call / Text / Request a review in one row, then the
 * stage. Before the tabs these were scattered down a details column with the review button at
 * the very bottom, below the fold of a phone.
 */
function SheetHeader({
    customer,
    patch,
    review,
    onText,
}: {
    customer: CustomerRow;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
    review: ReviewAnchorProps;
    onText: () => void;
}) {
    const button =
        "portal-hit inline-flex items-center justify-center gap-1.5 rounded-lg border text-[13px] font-medium";
    return (
        <header className="px-5 pt-4">
            <h2
                className="m-0 text-[20px] font-bold leading-tight break-words"
                style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
            >
                {customer.name ?? "Customer"}
            </h2>
            <p className="m-0 mt-1 text-[13px]" style={{ color: "var(--fg-2)" }}>
                {customer.phone && (
                    <>
                        <a href={`tel:${customer.phone}`} style={{ color: "var(--accent)" }}>
                            {formatPhone(customer.phone)}
                        </a>
                        {" · "}
                    </>
                )}
                Customer since {dayLabel(customer.firstContactAt ?? customer.createdAt)}
            </p>

            <div className="relative grid grid-cols-[76px_76px_minmax(0,1fr)] gap-2 mt-3">
                {customer.phone ? (
                    <a href={`tel:${customer.phone}`} className={button} style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--fg)" }}>
                        <PhoneCall size={14} /> Call
                    </a>
                ) : (
                    <span />
                )}
                {customer.phone ? (
                    <a
                        href="#crm-sms"
                        onClick={(e) => {
                            e.preventDefault();
                            onText();
                        }}
                        className={button}
                        style={{ minHeight: 44, borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                    >
                        <ChatCircle size={14} /> Text
                    </a>
                ) : (
                    <span />
                )}
                <ReviewAnchor {...review} align="stretch" wide />
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-3.5 pb-3" data-tour="crm-drawer-stage">
                <span
                    className="text-[10px] uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
                >
                    Stage
                </span>
                <StagePicker customer={customer} patch={patch} />
            </div>
        </header>
    );
}

/* ── request a review ─────────────────────────────────────────────────────── */

/** What the board hands every record: the same for all of its customers. */
export interface ReviewContext {
    businessName: string;
    reviewLinkConfigured: boolean;
}

interface ReviewAnchorProps extends ReviewContext {
    customer: CustomerRow;
    siteSlug: string;
    messagingState: DetailResponse["messagingState"];
    onSent: () => void;
}

/**
 * The "Request a review" button and the window that opens right below it.
 *
 * It used to call up to the board, which slid a full-height drawer in from the right over the
 * record for a three-line message. Now the window hangs off the button (Xander, 2026-11-12).
 *
 * Placement is the caller's `relative` wrapper, which is all `ui/Popover` needs: the row of Call /
 * Text / Request a review in both headers. On the panel the window's right edge lines up under
 * the row's (`end`); on a phone it spans the row (`stretch`), the full width of the sheet.
 */
function ReviewAnchor({
    align,
    wide = false,
    customer,
    siteSlug,
    businessName,
    reviewLinkConfigured,
    messagingState,
    onSent,
}: ReviewAnchorProps & { align: "end" | "stretch"; wide?: boolean }) {
    const [open, setOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setOpen((o) => !o)}
                disabled={!customer.phone}
                aria-expanded={open}
                aria-haspopup="dialog"
                data-tour="crm-drawer-review"
                className={`${wide ? "w-full justify-center px-2" : "px-3.5"} rounded-lg inline-flex items-center gap-1.5 text-[13px] font-semibold whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer`}
                style={{ minHeight: 44, background: "var(--accent)", color: "var(--on-accent)" }}
            >
                <Star size={14} weight="fill" />
                {customer.reviewSent ? "Review requested" : "Request a review"}
            </button>
            <ReviewRequestDialog
                open={open}
                onClose={() => setOpen(false)}
                triggerRef={buttonRef}
                align={align}
                contact={{
                    contactId: customer.customerId,
                    displayName: customer.name,
                    phone: customer.phone,
                    phoneDisplay: formatPhone(customer.phone),
                    reviewSent: customer.reviewSent,
                }}
                businessName={businessName}
                reviewLinkConfigured={reviewLinkConfigured}
                messagingState={messagingState}
                siteSlug={siteSlug}
                onSent={onSent}
            />
        </>
    );
}

/* ── the call they came from ──────────────────────────────────────────────── */

/**
 * The originating call, pinned open above the timeline.
 *
 * The summary and the recording are not copied onto the customer at promotion — they are folded
 * in from the call log on every read, so a summary corrected upstream cannot drift from what the
 * record shows. What was missing was never the data, it was any way to see it: this entry sat in
 * the list as one more row, labelled "They called — 3m 42s", with the summary truncated to a line
 * and the player behind a click.
 */
function OriginCall({ event, className }: { event: TimelineEvent; className?: string }) {
    const detail = event.meta?.detail as string | undefined;
    const recording = event.meta?.recordingUrl as string | undefined;
    const seconds = event.meta?.durationSeconds as number | undefined;
    const unavailable = event.meta?.unavailable === true;

    return (
        <article className={`${className ?? ""} border-b min-w-0`} style={{ borderColor: "var(--rule)" }}>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
                <span
                    aria-hidden="true"
                    className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center"
                    style={{ background: tint("call"), color: tintFg("call") }}
                >
                    <PhoneCall size={13} />
                </span>
                <h2
                    className="m-0 text-[14px] font-semibold flex-1 min-w-0"
                    style={{ color: "var(--fg)" }}
                >
                    The call that started this customer
                </h2>
                <span
                    className="text-[10.5px] shrink-0"
                    style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
                >
                    {new Date(event.at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                    })}
                    {seconds ? ` · ${duration(seconds)}` : ""}
                </span>
            </div>

            {unavailable ? (
                /* Said plainly rather than left blank. The client knows there was a call; a
                   timeline that simply begins after it reads as lost data. */
                <p className="m-0 text-[13px] leading-relaxed" style={{ color: "var(--fg-2)" }}>
                    This call has aged out of your call log, so the summary and recording are no
                    longer available. Everything since is below.
                </p>
            ) : (
                <>
                    {detail && (
                        <p
                            className="m-0 mb-3.5 text-[13.5px] leading-relaxed"
                            style={{ color: "var(--fg-2)", maxWidth: "68ch" }}
                        >
                            {detail}
                        </p>
                    )}
                    {recording && (
                        <audio
                            controls
                            preload="none"
                            src={recording}
                            className="w-full"
                            style={{ maxWidth: 520 }}
                        />
                    )}
                </>
            )}
        </article>
    );
}



/* ── shared bits ──────────────────────────────────────────────────────────── */

/**
 * The dot on the spine: what kind of thing this was, and who did it.
 *
 * **Filled means the customer did it; outlined means the client did.** That is the one
 * distinction an owner reads a history for — whether they are chasing or being chased — and
 * it has to survive a glance, so it is carried by the shape of the marker rather than by the
 * wording alone. The type is still spelled out beside the title, because a shape and a colour
 * are a legend nobody was given.
 */
function Marker({ entry }: { entry: TimelineEntry }) {
    // `markerKind`, never `lead.kind`: a promotion is stored wearing the source's kind, and
    // reading it raw here drew a green phone beside "Added to your customers from your inbox".
    const Icon = entry.markerKind === "record" ? Plus : KIND_ICON[entry.markerKind];
    const hue = markerHue(entry.markerKind);
    const filled = entry.inbound;

    return (
        <span
            aria-hidden="true"
            className="relative z-[1] shrink-0 w-[27px] h-[27px] rounded-full flex items-center justify-center"
            style={{
                background: filled ? hue : "var(--elev-1)",
                borderWidth: 1.5,
                borderStyle: "solid",
                borderColor: filled ? hue : hue === "var(--fg-3)" ? "var(--rule-strong)" : hue,
                color: filled ? "#ffffff" : hue,
            }}
        >
            <Icon size={13} weight={filled ? "fill" : "regular"} />
        </span>
    );
}

/** One colour per kind, from the portal's chart tokens. The CRM gets no palette of its own. */
function markerHue(kind: TimelineEntry["markerKind"]): string {
    if (kind === "call") return "var(--chart-pos)";
    if (kind === "sms-in" || kind === "sms-out") return "var(--accent)";
    if (kind === "web-form") return "var(--chart-series-2)";
    if (kind === "review-request") return "var(--chart-warn)";
    // `record` lands here with every other bookkeeping entry: neutral, because nothing
    // happened between the client and the customer.
    return "var(--fg-3)";
}

function isSms(kind: TimelineEvent["kind"]): boolean {
    return kind === "sms-in" || kind === "sms-out";
}

function tint(kind: TimelineEvent["kind"]): string {
    if (isSms(kind)) return "rgba(37,99,235,0.1)";
    if (kind === "call") return "rgba(22,163,74,0.1)";
    return "var(--surface)";
}
function tintFg(kind: TimelineEvent["kind"]): string {
    if (isSms(kind)) return "var(--accent)";
    if (kind === "call") return "var(--chart-pos)";
    return "var(--fg-2)";
}



function Pending({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="rounded-lg border px-3.5 py-3 text-[12.5px] leading-relaxed"
            style={{
                background: "rgba(217,119,6,0.07)",
                borderColor: "rgba(217,119,6,0.28)",
                color: "var(--fg-2)",
            }}
        >
            {children}
        </div>
    );
}


