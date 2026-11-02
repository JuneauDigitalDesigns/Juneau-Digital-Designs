"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    CaretRight,
    ChatCircle,
    Envelope,
    FileText,
    PhoneCall,
    Plus,
    Star,
} from "@phosphor-icons/react";
import Drawer from "../ui/Drawer";
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
 * The customer record — mockup M3.
 *
 * 760px, two columns: everything *about* them on the left, everything that *happened* on the
 * right. A drawer rather than a modal so the board stays visible behind it; that is the
 * documented pattern for record detail in a dense workspace, and it is why the width went up
 * instead of the surface changing.
 *
 * The timeline is the part with a hard legibility requirement. It is read by someone who is not
 * technical, often on a phone, usually in a hurry — so: one plain-language line per event, day
 * grouping, consecutive same-kind runs collapsed, and detail only on request.
 */

interface DetailResponse {
    customer: CustomerRow;
    timeline: TimelineEvent[];
    tasks: TaskRow[];
    messagingState: "ready" | "not-on-plan" | "pending-build" | "connecting";
}

type TimelineFilter = "all" | "messages" | "calls" | "notes";

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

export default function CustomerDrawer({
    open,
    onClose,
    customerId,
    siteSlug,
    onChanged,
    onRequestReview,
}: {
    open: boolean;
    onClose: () => void;
    customerId: string | null;
    siteSlug: string;
    onChanged: () => void;
    onRequestReview: (c: CustomerRow) => void;
}) {
    const [data, setData] = useState<DetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<TimelineFilter>("all");
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!open || !customerId) return;
        let cancelled = false;
        setLoading(true);
        fetch(`/api/portal/customers/${customerId}?site=${encodeURIComponent(siteSlug)}`)
            .then((r) => r.json())
            .then((json) => {
                if (!cancelled) setData(json?.customer ? json : null);
            })
            .catch(() => {})
            .finally(() => !cancelled && setLoading(false));
        return () => {
            cancelled = true;
        };
    }, [open, customerId, siteSlug]);

    const customer = data?.customer ?? null;

    async function patch(body: Record<string, unknown>) {
        if (!customerId) return;
        await fetch(`/api/portal/customers?site=${encodeURIComponent(siteSlug)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, ...body }),
        }).catch(() => {});
        onChanged();
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
                const fresh = await fetch(
                    `/api/portal/customers/${customerId}?site=${encodeURIComponent(siteSlug)}`,
                ).then((r) => r.json());
                setData(fresh?.customer ? fresh : data);
                onChanged();
            }
        } finally {
            setSending(false);
        }
    }

    /** Collapse consecutive same-kind events into one row ("3 messages"). */
    const grouped = useMemo(() => {
        const events = (data?.timeline ?? []).filter((e) => bucketOf(e.kind).includes(filter));
        const out: { day: string; rows: { lead: TimelineEvent; run: TimelineEvent[] }[] }[] = [];

        for (const ev of events) {
            const day = dayLabel(ev.at);
            let bucket = out.find((b) => b.day === day);
            if (!bucket) {
                bucket = { day, rows: [] };
                out.push(bucket);
            }
            const last = bucket.rows[bucket.rows.length - 1];
            const sameRun =
                last &&
                (last.lead.kind === ev.kind ||
                    (isSms(last.lead.kind) && isSms(ev.kind)));
            if (sameRun && isSms(ev.kind)) last.run.push(ev);
            else bucket.rows.push({ lead: ev, run: [ev] });
        }
        return out;
    }, [data, filter]);

    return (
        <Drawer
            open={open}
            onClose={onClose}
            title={customer?.name ?? "Customer"}
            width="xl"
            padded={false}
            surface="raised"
        >
            {loading && !customer && (
                <div className="p-6 text-sm" style={{ color: "var(--fg-3)" }}>
                    Loading…
                </div>
            )}

            {customer && (
                <div className="grid lg:grid-cols-[320px_1fr] min-h-0">
                    {/* ── left: the record ── */}
                    <div
                        className="p-6 space-y-0 lg:border-r"
                        style={{ borderColor: "var(--rule)" }}
                    >
                        <Block first dataTour="crm-drawer-stage">
                            <Label>Stage</Label>
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {STAGES.map((s) => {
                                    const on = s.key === customer.stage;
                                    return (
                                        <button
                                            key={s.key}
                                            type="button"
                                            onClick={() => patch({ stage: s.key })}
                                            className="px-2.5 py-1 rounded-full text-[10.5px] border inline-flex items-center gap-1.5 cursor-pointer"
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                background: on ? "var(--accent)" : "var(--elev-1)",
                                                color: on ? "var(--on-accent)" : "var(--fg-2)",
                                                borderColor: on ? "transparent" : "var(--rule-strong)",
                                            }}
                                        >
                                            {!on && (
                                                <span
                                                    className="rounded-full"
                                                    style={{ width: 6, height: 6, background: STAGE_COLOR[s.key] }}
                                                />
                                            )}
                                            {s.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </Block>

                        <Block>
                            <Label>Contact</Label>
                            <dl className="mt-1.5">
                                <Row k="Phone">
                                    {customer.phone ? (
                                        <a href={`tel:${customer.phone}`} style={{ color: "var(--accent)" }}>
                                            {formatPhone(customer.phone)}
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </Row>
                                <Row k="Email">
                                    {customer.email ? (
                                        <a href={`mailto:${customer.email}`} style={{ color: "var(--accent)" }}>
                                            {customer.email}
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </Row>
                                <Row k="Address">{customer.address ?? "—"}</Row>
                                <Row k="Came from">
                                    {customer.source === "web-form"
                                        ? "Website form"
                                        : customer.source === "call"
                                          ? "Phone call"
                                          : "Added by you"}
                                </Row>
                            </dl>
                        </Block>

                        <Block>
                            <Label>Job value</Label>
                            <input
                                type="text"
                                defaultValue={formatMoney(customer.value) ?? ""}
                                placeholder="$0"
                                onBlur={(e) => {
                                    const n = Number(e.target.value.replace(/[^0-9.]/g, ""));
                                    patch({ value: Number.isFinite(n) && n > 0 ? n : null });
                                }}
                                className="w-full mt-2.5 rounded-lg border px-3 py-2 text-sm outline-none"
                                style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            />
                        </Block>

                        <Block>
                            <Label>Tags</Label>
                            <TagEditor
                                tags={customer.tags}
                                onChange={(tags) => patch({ tags })}
                            />
                        </Block>

                        <Block>
                            <Label>Follow-ups</Label>
                            <span data-tour="crm-drawer-tasks" />
                            <TaskList
                                tasks={data?.tasks ?? []}
                                siteSlug={siteSlug}
                                customerId={customer.customerId}
                                onChanged={() => {
                                    onChanged();
                                    if (customerId) {
                                        fetch(`/api/portal/customers/${customerId}?site=${encodeURIComponent(siteSlug)}`)
                                            .then((r) => r.json())
                                            .then((j) => j?.customer && setData(j))
                                            .catch(() => {});
                                    }
                                }}
                            />
                        </Block>

                        <Block>
                            <Label>Notes</Label>
                            <textarea
                                defaultValue={customer.note ?? ""}
                                rows={3}
                                placeholder="e.g. works days, call after 5pm"
                                onChange={(e) => {
                                    const v = e.target.value;
                                    if (noteTimer.current) clearTimeout(noteTimer.current);
                                    noteTimer.current = setTimeout(() => patch({ note: v }), 700);
                                }}
                                className="w-full mt-2.5 rounded-lg border px-3 py-2 text-sm outline-none resize-y"
                                style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            />
                        </Block>

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
                    </div>

                    {/* ── right: what happened ── */}
                    <div className="flex flex-col min-h-0">
                        <div
                            className="flex items-center gap-1.5 px-6 py-3.5 border-b"
                            style={{ borderColor: "var(--rule)" }}
                        >
                            {(["all", "messages", "calls", "notes"] as TimelineFilter[]).map((f) => (
                                <button
                                    key={f}
                                    type="button"
                                    onClick={() => setFilter(f)}
                                    className="px-2.5 py-1 rounded-full text-[11px] border cursor-pointer capitalize"
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        background: filter === f ? "var(--fg)" : "var(--elev-1)",
                                        color: filter === f ? "var(--elev-1)" : "var(--fg-2)",
                                        borderColor: filter === f ? "var(--fg)" : "var(--rule-strong)",
                                    }}
                                >
                                    {f}
                                </button>
                            ))}
                            <span
                                className="ml-auto text-[10px]"
                                style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                            >
                                {data?.timeline.length ?? 0} events
                            </span>
                        </div>

                        <div data-tour="crm-drawer-timeline" className="px-6 pb-5 overflow-auto flex-1">
                            {grouped.length === 0 && (
                                <p className="py-8 text-sm text-center" style={{ color: "var(--fg-3)" }}>
                                    Nothing here yet.
                                </p>
                            )}

                            {grouped.map((bucket) => (
                                <div key={bucket.day}>
                                    <div
                                        className="flex items-center gap-2.5 mt-5 mb-2.5 text-[10px] uppercase tracking-wider"
                                        style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                                    >
                                        {bucket.day}
                                        <span className="flex-1 h-px" style={{ background: "var(--rule)" }} />
                                    </div>

                                    {bucket.rows.map(({ lead, run }) => {
                                        const Icon = KIND_ICON[lead.kind];
                                        const many = run.length > 1;
                                        const isOpen = expanded.has(lead.id);
                                        const detail =
                                            (lead.meta?.detail as string | undefined) ??
                                            (lead.meta?.body as string | undefined);
                                        const recording = lead.meta?.recordingUrl as string | undefined;

                                        return (
                                            <div key={lead.id}>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setExpanded((s) => {
                                                            const n = new Set(s);
                                                            if (n.has(lead.id)) n.delete(lead.id);
                                                            else n.add(lead.id);
                                                            return n;
                                                        })
                                                    }
                                                    className="w-full flex gap-3 items-start py-2.5 text-left cursor-pointer"
                                                >
                                                    <span
                                                        className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center"
                                                        style={{
                                                            background: tint(lead.kind),
                                                            color: tintFg(lead.kind),
                                                        }}
                                                    >
                                                        <Icon size={13} />
                                                    </span>
                                                    <span className="flex-1 min-w-0 pt-0.5">
                                                        <span className="block text-[13.5px]" style={{ color: "var(--fg)" }}>
                                                            {many ? `${run.length} messages` : lead.summary}
                                                        </span>
                                                        {!many && detail && !isOpen && (
                                                            <span
                                                                className="block text-[12.5px] mt-1 truncate"
                                                                style={{ color: "var(--fg-3)" }}
                                                            >
                                                                {detail}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span
                                                        className="shrink-0 text-[10.5px] pt-1"
                                                        style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                                                    >
                                                        {new Date(lead.at).toLocaleTimeString(undefined, {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </button>

                                                {isOpen && (detail || recording || many) && (
                                                    <div
                                                        className="ml-[38px] mb-2 rounded-xl border p-4"
                                                        style={{ background: "var(--bg)", borderColor: "var(--rule)" }}
                                                    >
                                                        {many ? (
                                                            <div className="space-y-2.5">
                                                                {run.map((m) => (
                                                                    <p key={m.id} className="text-[13px] leading-relaxed" style={{ color: "var(--fg-2)" }}>
                                                                        <span style={{ color: "var(--fg-3)" }}>{m.summary}: </span>
                                                                        {String(m.meta?.body ?? "")}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-[13.5px] leading-relaxed m-0" style={{ color: "var(--fg-2)" }}>
                                                                {detail}
                                                            </p>
                                                        )}
                                                        {recording && (
                                                            <audio controls preload="none" src={recording} className="mt-3 w-full" />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>

                        {/* composer / the A2P wait */}
                        <div className="px-6 py-4 border-t" style={{ borderColor: "var(--rule)" }}>
                            {data?.messagingState === "ready" ? (
                                <div className="flex gap-2 items-end">
                                    <textarea
                                        value={draft}
                                        onChange={(e) => setDraft(e.target.value)}
                                        rows={2}
                                        placeholder={`Text ${customer.name ?? "them"}…`}
                                        disabled={!customer.phone}
                                        className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none resize-none disabled:opacity-50"
                                        style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                                    />
                                    <button
                                        type="button"
                                        onClick={sendMessage}
                                        disabled={sending || !draft.trim() || !customer.phone}
                                        className="rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                                    >
                                        {sending ? "Sending…" : "Send"}
                                    </button>
                                </div>
                            ) : data?.messagingState === "not-on-plan" ? (
                                <Pending>Texting your customers comes with Growth.</Pending>
                            ) : (
                                <Pending>
                                    <b>Texting turns on soon.</b> Your business registration is with the
                                    carriers — usually about two more weeks. Calls and leads are unaffected.
                                </Pending>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Drawer>
    );
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
    return "var(--fg-3)";
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
            className={`${first ? "pt-0" : "pt-5"} ${last ? "pb-0" : "pb-5"}`}
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
            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
        >
            {children}
        </p>
    );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
    return (
        <div className="flex justify-between gap-3 py-1.5 text-[13.5px]">
            <dt className="text-[12.5px]" style={{ color: "var(--fg-3)" }}>
                {k}
            </dt>
            <dd className="m-0 text-right" style={{ color: "var(--fg)" }}>
                {children}
            </dd>
        </div>
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
                    style={{ fontFamily: "var(--font-mono)", background: "var(--surface)", color: "var(--fg-2)" }}
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
                    style={{ borderColor: "var(--rule-strong)", background: "var(--bg)", color: "var(--fg)" }}
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="text-[10.5px] px-2 py-0.5 rounded-full border border-dashed cursor-pointer"
                    style={{ fontFamily: "var(--font-mono)", borderColor: "var(--rule-strong)", color: "var(--fg-3)" }}
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
                        style={{
                            color: t.done ? "var(--fg-3)" : "var(--fg)",
                            textDecoration: t.done ? "line-through" : undefined,
                        }}
                    >
                        {t.title}
                    </span>
                    {t.dueAt && (
                        <span
                            className="ml-auto text-[10.5px]"
                            style={{
                                fontFamily: "var(--font-mono)",
                                color: overdue(t) ? "var(--chart-warn)" : "var(--fg-3)",
                            }}
                        >
                            {overdue(t) ? "Overdue" : `Due ${new Date(t.dueAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
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
                            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
                            style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                        />
                        <button
                            type="button"
                            onClick={create}
                            className="rounded-lg px-3 py-2 text-sm font-semibold"
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
