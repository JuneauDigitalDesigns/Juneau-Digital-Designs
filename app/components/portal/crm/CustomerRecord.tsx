"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
    ArrowLeft,
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
    formatMoney,
    formatPhone,
    type CustomerRow,
    type TaskRow,
    type TimelineEvent,
} from "./stages";

/**
 * The customer record.
 *
 * Two shells, one body. On a desktop it **is** the content area beside the rail (`variant="page"`),
 * and on a phone it stays the bottom sheet it has always been (`variant="sheet"`, wrapped by
 * `CustomerDrawer`). It used to be a 760px drawer on both, which was never enough room for a
 * details panel beside a full timeline — and the layout did not actually fit in it: see the
 * `minmax(0, …)` note on the grid below.
 *
 * Nothing here is a floating card. The record sits straight on the surface, divided by hairlines,
 * because a stack of bordered boxes inside a bordered panel inside a page reads as debris. The
 * one exception is the message composer, which is a thing you act *into* rather than read, so it
 * keeps an edge.
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
    onRequestReview,
    onNotFound,
}: {
    customerId: string | null;
    siteSlug: string;
    /** `page` fills the content area; `sheet` is the body of the mobile drawer. */
    variant: "page" | "sheet";
    onChanged: () => void;
    onRequestReview: (c: CustomerRow) => void;
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

    const page = variant === "page";
    const pad = page ? "px-7" : "px-5";

    const details = (
        <Details
            customer={customer}
            tasks={data?.tasks ?? []}
            siteSlug={siteSlug}
            patch={patch}
            fieldError={fieldError}
            onTasksChanged={() => {
                onChanged();
                void reload();
            }}
            onRequestReview={onRequestReview}
            showReviewButton={!page}
            className={`${pad} py-1 ${page ? "lg:border-r" : ""}`}
        />
    );

    const activity = (
        <div className="flex flex-col min-w-0 min-h-0">
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

            {/* composer / the A2P wait */}
            <div className={`${pad} py-4 border-t min-w-0`} style={{ borderColor: "var(--rule)" }}>
                {data?.messagingState === "ready" ? (
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

    /**
     * `minmax(0, 1fr)`, never a bare `1fr`.
     *
     * A `1fr` track is `minmax(auto, 1fr)`, and its auto floor is the column's **min-content**
     * width. Nothing on the chain set `min-width: 0`, and the timeline's truncated preview line
     * is `white-space: nowrap`, so its min-content is the entire summary on one line. The track
     * could not shrink below it: measured at 1440px, this grid resolved to `320px 1206px` inside
     * a 744px panel — 782px of horizontal overflow, and the activity column pushed clean off the
     * side. On a phone the single `auto` column did the same thing: 1206px inside 390px.
     *
     * The two columns only exist at `lg`. Forcing them narrower does not help — tried at 390px,
     * it still left 241px over — because the fix is the floor, not the split.
     */
    const body = (
        <div
            className={`grid grid-cols-[minmax(0,1fr)] min-h-0 min-w-0 ${
                page ? "lg:grid-cols-[340px_minmax(0,1fr)]" : ""
            }`}
        >
            <div className="min-w-0" style={{ borderColor: "var(--rule)" }}>
                {details}
            </div>
            <div className="min-w-0">{activity}</div>
        </div>
    );

    if (!page) return body;

    /**
     * One surface, not a tray of cards.
     *
     * `.portal-stage` keeps its own 32px gutter and 1280px ceiling, so this is as edge-to-edge
     * as the content area gets; the border and radius are what every other portal surface has,
     * and are the reason this reads as the page rather than as something floating on it.
     */
    return (
        <div
            className="min-w-0 rounded-2xl border overflow-hidden"
            style={{ background: "var(--elev-1)", borderColor: "var(--rule)" }}
        >
            <RecordHeader
                customer={customer}
                siteSlug={siteSlug}
                patch={patch}
                onRequestReview={onRequestReview}
            />
            {body}
        </div>
    );
}

/* ── the page header ──────────────────────────────────────────────────────── */

/**
 * Who they are and what you can do about it, at the top of the content area.
 *
 * Only the page variant has this; the sheet gets the drawer's own title bar, where a phone has
 * no room for a second one. Call / Text / Request a review sit here rather than at the bottom of
 * a details column, because they are the reason the record was opened.
 */
function RecordHeader({
    customer,
    siteSlug,
    patch,
    onRequestReview,
}: {
    customer: CustomerRow;
    siteSlug: string;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
    onRequestReview: (c: CustomerRow) => void;
}) {
    const initials = (customer.name ?? "?")
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? "")
        .join("");

    return (
        <header className="px-7 pt-5 border-b" style={{ borderColor: "var(--rule)" }}>
            <Link
                href={tabHref("customers", siteSlug)}
                className="inline-flex items-center gap-1.5 text-[12.5px] mb-3.5"
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
                    <h1
                        className="text-[22px] font-bold leading-tight m-0 mb-1 truncate"
                        style={{ fontFamily: "var(--font-display)", color: "var(--fg)" }}
                    >
                        {customer.name ?? "Customer"}
                    </h1>
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

                <div className="shrink-0 flex flex-wrap gap-2">
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
                    <button
                        type="button"
                        onClick={() => onRequestReview(customer)}
                        disabled={!customer.phone}
                        data-tour="crm-drawer-review"
                        className="inline-flex items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        style={{
                            minHeight: 44,
                            background: "var(--accent)",
                            color: "var(--on-accent)",
                        }}
                    >
                        <Star size={14} weight="fill" />
                        {customer.reviewSent ? "Review requested" : "Request a review"}
                    </button>
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

/* ── everything about them ────────────────────────────────────────────────── */

function Details({
    customer,
    tasks,
    siteSlug,
    patch,
    fieldError,
    onTasksChanged,
    onRequestReview,
    showReviewButton,
    className,
}: {
    customer: CustomerRow;
    tasks: TaskRow[];
    siteSlug: string;
    patch: (body: Record<string, unknown>) => Promise<boolean>;
    fieldError: string | null;
    onTasksChanged: () => void;
    onRequestReview: (c: CustomerRow) => void;
    showReviewButton: boolean;
    className?: string;
}) {
    // Local to the only thing that debounces. It used to be threaded down from the record,
    // which meant a child writing through a prop every keystroke.
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    return (
        <div className={`min-w-0 ${className ?? ""}`} style={{ borderColor: "var(--rule)" }}>
            {showReviewButton && (
                <Block first>
                    <Label>Stage</Label>
                    <div className="mt-2.5">
                        <StagePicker customer={customer} patch={patch} />
                    </div>
                </Block>
            )}

            <Block first={!showReviewButton}>
                <Label>Contact</Label>
                {/* The receptionist takes these down by ear mid-call, so they are often close
                    rather than right. They were read-only until now, which left the client
                    looking at a number they knew was wrong with nothing to do about it. */}
                <p className="mt-1.5 mb-2 text-[12px] leading-snug" style={{ color: "var(--fg-2)" }}>
                    Click a field to correct it.
                </p>

                <div className="flex flex-col gap-2.5 min-w-0">
                    <EditableField
                        id="f-name"
                        label="Name"
                        value={customer.name ?? ""}
                        onSave={(v) => patch({ name: v || null })}
                    />
                    <EditableField
                        id="f-phone"
                        label="Phone"
                        type="tel"
                        value={customer.phone ? formatPhone(customer.phone) : ""}
                        onSave={(v) => patch({ phone: v || null })}
                    />
                    <EditableField
                        id="f-email"
                        label="Email"
                        type="email"
                        value={customer.email ?? ""}
                        onSave={(v) => patch({ email: v || null })}
                    />
                    <EditableField
                        id="f-address"
                        label="Address"
                        multiline
                        value={customer.address ?? ""}
                        onSave={(v) => patch({ address: v || null })}
                    />

                    {fieldError && (
                        <p
                            className="text-[12px] rounded-md px-2.5 py-2 m-0"
                            style={{
                                color: "var(--chart-neg)",
                                background: "color-mix(in srgb, var(--chart-neg) 10%, transparent)",
                            }}
                            role="alert"
                        >
                            {fieldError}
                        </p>
                    )}

                    {/* Not editable: where they came from is a fact about the record, not a
                        detail about the person. */}
                    <div className="flex justify-between gap-3 pt-0.5 text-[13px]">
                        <span style={{ color: "var(--fg-2)" }}>Came from</span>
                        <span className="text-right" style={{ color: "var(--fg)" }}>
                            {customer.source === "web-form"
                                ? "Website form"
                                : customer.source === "call"
                                  ? "Phone call"
                                  : "Added by you"}
                        </span>
                    </div>
                </div>
            </Block>

            <Block>
                <Label>Job value</Label>
                <EditableField
                    id="f-value"
                    label="Job value"
                    hideLabel
                    value={formatMoney(customer.value) ?? ""}
                    placeholder="$0"
                    big
                    onSave={(v) => {
                        const n = Number(v.replace(/[^0-9.]/g, ""));
                        return patch({ value: Number.isFinite(n) && n > 0 ? n : null });
                    }}
                />
            </Block>

            <Block>
                <Label>Tags</Label>
                <TagEditor tags={customer.tags} onChange={(tags) => void patch({ tags })} />
            </Block>

            <Block>
                <Label>Follow-ups</Label>
                <span data-tour="crm-drawer-tasks" />
                <TaskList
                    tasks={tasks}
                    siteSlug={siteSlug}
                    customerId={customer.customerId}
                    onChanged={onTasksChanged}
                />
            </Block>

            <Block last={!showReviewButton}>
                <Label>Your notes</Label>
                <textarea
                    defaultValue={customer.note ?? ""}
                    rows={3}
                    placeholder="e.g. works days, call after 5pm"
                    onChange={(e) => {
                        const v = e.target.value;
                        if (noteTimer.current) clearTimeout(noteTimer.current);
                        noteTimer.current = setTimeout(() => void patch({ note: v }), 700);
                    }}
                    className="w-full mt-2.5 rounded-lg border px-3 py-2 text-sm outline-none resize-y"
                    style={{
                        background: "var(--bg)",
                        borderColor: "var(--rule-strong)",
                        color: "var(--fg)",
                    }}
                />
            </Block>

            {showReviewButton && (
                <Block last dataTour="crm-drawer-review">
                    <button
                        type="button"
                        onClick={() => onRequestReview(customer)}
                        disabled={!customer.phone}
                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        <Star size={15} weight="fill" />
                        {customer.reviewSent ? "Review requested" : "Request a review"}
                    </button>
                </Block>
            )}
        </div>
    );
}

/**
 * One correctable detail.
 *
 * Drawn as an ordinary portal input rather than as text that turns into one on hover: the
 * global form reset in `globals.css` sets a border and a background on every input with
 * `!important`, so a borderless rest state is not available to us here, and a field that
 * half-wins that fight looks broken. It also matches Job value and Your notes directly below,
 * which have always been plain inputs.
 *
 * Saves on blur — no Save button to forget, and no PATCH per keystroke. A refused save (a
 * phone number another customer already holds) puts the stored value back, so the field never
 * shows something that was not written.
 */
function EditableField({
    id,
    label,
    value,
    onSave,
    type = "text",
    placeholder,
    multiline = false,
    hideLabel = false,
    big = false,
}: {
    id: string;
    label: string;
    value: string;
    onSave: (v: string) => Promise<boolean>;
    type?: string;
    placeholder?: string;
    multiline?: boolean;
    hideLabel?: boolean;
    big?: boolean;
}) {
    const [draft, setDraft] = useState(value);
    const [seen, setSeen] = useState(value);

    // The stored value wins whenever it changes under us — a reload, or a save that was
    // refused. Adjusted during render rather than in an effect: an effect would paint the
    // stale value first and then correct it, which is a visible flicker on a rejected edit.
    if (seen !== value) {
        setSeen(value);
        setDraft(value);
    }

    const shared = {
        id,
        value: draft,
        placeholder,
        onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setDraft(e.target.value),
        onBlur: async () => {
            if (draft === value) return;
            const ok = await onSave(draft.trim());
            if (!ok) setDraft(value);
        },
        className:
            "w-full rounded-lg border px-3 py-2 font-[inherit] outline-none " +
            (big ? "text-[17px] font-semibold" : "text-[13.5px]"),
        style: {
            background: "var(--bg)",
            borderColor: "var(--rule-strong)",
            color: "var(--fg)",
            minHeight: 38,
        },
    };

    return (
        <div className="min-w-0">
            <label
                htmlFor={id}
                className={hideLabel ? "sr-only" : "block text-[11.5px] mb-px"}
                style={hideLabel ? undefined : { color: "var(--fg-2)" }}
            >
                {label}
            </label>
            {multiline ? (
                <textarea {...shared} rows={2} className={`${shared.className} resize-y leading-snug`} />
            ) : (
                <input {...shared} type={type} />
            )}
        </div>
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

function Block({
    children,
    first,
    last,
    dataTour,
}: {
    children: React.ReactNode;
    first?: boolean;
    last?: boolean;
    /** Stable tour anchor. See `tour/steps.ts` — these are a contract, keep them through refactors. */
    dataTour?: string;
}) {
    return (
        <div
            data-tour={dataTour}
            className={`${first ? "pt-4" : "pt-5"} ${last ? "pb-5" : "pb-5"} min-w-0`}
            style={{ borderBottom: last ? undefined : "1px solid var(--rule-weak)" }}
        >
            {children}
        </div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <p
            className="text-[10px] uppercase tracking-wider m-0"
            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}
        >
            {children}
        </p>
    );
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

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
    const [adding, setAdding] = useState(false);
    const [val, setVal] = useState("");
    return (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
            {tags.map((t) => (
                <button
                    key={t}
                    type="button"
                    onClick={() => onChange(tags.filter((x) => x !== t))}
                    title="Remove"
                    className="text-[10.5px] px-2 py-0.5 rounded-full cursor-pointer"
                    style={{
                        fontFamily: "var(--font-mono)",
                        background: "var(--surface)",
                        color: "var(--fg-2)",
                    }}
                >
                    {t} ✕
                </button>
            ))}
            {adding ? (
                <input
                    autoFocus
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    onBlur={() => {
                        if (val.trim()) onChange([...tags, val.trim()]);
                        setVal("");
                        setAdding(false);
                    }}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                        if (e.key === "Escape") {
                            setVal("");
                            setAdding(false);
                        }
                    }}
                    className="text-[11px] px-2 py-0.5 rounded-full border outline-none w-24"
                    style={{
                        borderColor: "var(--rule-strong)",
                        background: "var(--bg)",
                        color: "var(--fg)",
                    }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="text-[10.5px] px-2 py-0.5 rounded-full border border-dashed cursor-pointer"
                    style={{ fontFamily: "var(--font-mono)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                >
                    + Add
                </button>
            )}
        </div>
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
