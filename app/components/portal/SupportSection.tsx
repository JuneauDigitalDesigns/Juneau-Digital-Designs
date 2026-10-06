"use client";

import { useState, type CSSProperties } from "react";
import { TICKET_CATEGORIES, type Ticket, type TicketCategory, type TicketStatus } from "@jdd/schema";
import type { PortalSiteProps } from "@/app/portal/types";
import { useCachedFetch, useInvalidate, CLIENT_TTL } from "./PortalDataProvider";
import { SectionCard, FieldRow, inputStyle } from "./ui/FormPrimitives";
import { DataTable, type Column } from "./ui/DataTable";
import Drawer from "./ui/Drawer";
import { StatusDot, type Status } from "./ui/StatusDot";

/**
 * Support: the client's ticket thread with the agency.
 *
 * A client opens a ticket (subject, category, what's wrong), and it lands on the console's
 * /tickets board for the operator to triage and reply. Replies come back here, and the client
 * is emailed a link to the thread each time. The client may add messages and reopen or close a
 * ticket, but never edit history — the audit trail is append-only on both sides.
 *
 * No em-dashes in any client-facing copy.
 */

const STATUS_LABEL: Record<TicketStatus, string> = {
    open: "Open",
    in_progress: "In progress",
    waiting_on_client: "Needs your reply",
    resolved: "Resolved",
    closed: "Closed",
};

/** Ticket status mapped onto the portal's four-value status colour. */
const STATUS_DOT: Record<TicketStatus, Status> = {
    open: "pending",
    in_progress: "pending",
    waiting_on_client: "warn",
    resolved: "ok",
    closed: "ok",
};

const CATEGORY_LABEL: Record<TicketCategory, string> = {
    billing: "Billing",
    technical: "Technical",
    content: "Content and copy",
    voice_agent: "Voice agent",
    other: "Something else",
};

const primaryButton: CSSProperties = {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "9px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
};

const secondaryButton: CSSProperties = {
    background: "transparent",
    color: "var(--fg-2)",
    border: "1px solid var(--rule-strong)",
    borderRadius: 6,
    padding: "7px 14px",
    fontSize: 13,
    cursor: "pointer",
};

function StatusBadge({ status }: { status: TicketStatus }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: "var(--fg-2)" }}>
            <StatusDot status={STATUS_DOT[status]} size={7} />
            {STATUS_LABEL[status]}
        </span>
    );
}

function fmtDate(ms: number): string {
    return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtTime(ms: number): string {
    return new Date(ms).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function SupportSection({ site }: { site: PortalSiteProps }) {
    const slug = site.slug;
    const q = useCachedFetch<{ tickets?: Ticket[]; error?: string }>(
        `tickets:${slug}`,
        `/api/portal/tickets?site=${encodeURIComponent(slug)}`,
        CLIENT_TTL.tickets,
    );
    const invalidate = useInvalidate();

    const tickets = q.data?.tickets ?? [];
    const loadError = q.data?.error ?? null;

    // New-ticket form
    const [subject, setSubject] = useState("");
    const [category, setCategory] = useState<TicketCategory>("technical");
    const [bodyText, setBodyText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Open ticket drawer
    const [openId, setOpenId] = useState<string | null>(null);
    const openTicket = tickets.find((t) => t.id === openId) ?? null;
    const [reply, setReply] = useState("");
    const [actionBusy, setActionBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    function refresh() {
        invalidate(`tickets:${slug}`);
        q.refresh();
    }

    async function submitTicket() {
        if (!subject.trim()) {
            setFormError("Please add a subject.");
            return;
        }
        if (!bodyText.trim()) {
            setFormError("Please describe the issue.");
            return;
        }
        setSubmitting(true);
        setFormError(null);
        try {
            const res = await fetch(`/api/portal/tickets?site=${encodeURIComponent(slug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject: subject.trim(), category, body: bodyText.trim() }),
            });
            const data = (await res.json().catch(() => ({}))) as { ticket?: Ticket; error?: string };
            if (!res.ok || !data.ticket) {
                setFormError(data.error ?? "We couldn't open that ticket. Please try again.");
                return;
            }
            setSubject("");
            setBodyText("");
            setCategory("technical");
            refresh();
            setOpenId(data.ticket.id);
        } catch {
            setFormError("We couldn't open that ticket. Please try again.");
        } finally {
            setSubmitting(false);
        }
    }

    async function patchTicket(patch: { message?: string; status?: "open" | "closed" }) {
        if (!openTicket) return;
        setActionBusy(true);
        setActionError(null);
        try {
            const res = await fetch(`/api/portal/tickets?site=${encodeURIComponent(slug)}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: openTicket.id, ...patch }),
            });
            const data = (await res.json().catch(() => ({}))) as { ticket?: Ticket; error?: string };
            if (!res.ok || !data.ticket) {
                setActionError(data.error ?? "That didn't save. Please try again.");
                return;
            }
            setReply("");
            refresh();
        } catch {
            setActionError("That didn't save. Please try again.");
        } finally {
            setActionBusy(false);
        }
    }

    const columns: Column<Ticket>[] = [
        {
            key: "subject",
            header: "Subject",
            primary: true,
            cell: (t) => <span style={{ color: "var(--fg)" }}>{t.subject}</span>,
        },
        {
            key: "status",
            header: "Status",
            badge: true,
            cell: (t) => <StatusBadge status={t.status} />,
        },
        {
            key: "category",
            header: "Category",
            meta: true,
            cell: (t) => CATEGORY_LABEL[t.category] ?? t.category,
        },
        {
            key: "updated",
            header: "Updated",
            meta: true,
            cellClassName: "whitespace-nowrap",
            cell: (t) => fmtDate(t.updatedAt ?? t.createdAt),
        },
    ];

    return (
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
            <header className="mb-6">
                <h1 className="text-2xl font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Support
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--fg-3)" }}>
                    Open a ticket and we will get back to you. You will get an email whenever we reply.
                </p>
            </header>

            {/* ── New ticket ─────────────────────────────────────────────────────── */}
            <SectionCard title="Open a ticket">
                <FieldRow label="Subject">
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="A short summary"
                        maxLength={200}
                        style={inputStyle}
                    />
                </FieldRow>
                <FieldRow label="Category">
                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as TicketCategory)}
                        style={inputStyle}
                    >
                        {TICKET_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {CATEGORY_LABEL[c]}
                            </option>
                        ))}
                    </select>
                </FieldRow>
                <FieldRow label="What's going on?">
                    <textarea
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        placeholder="Tell us what you need, with as much detail as helps."
                        rows={5}
                        maxLength={5000}
                        style={{ ...inputStyle, resize: "vertical", minHeight: 110 }}
                    />
                </FieldRow>
                {formError && (
                    <p className="mb-3 text-sm" style={{ color: "var(--chart-neg)" }}>
                        {formError}
                    </p>
                )}
                <button type="button" style={primaryButton} disabled={submitting} onClick={submitTicket}>
                    {submitting ? "Sending…" : "Open ticket"}
                </button>
            </SectionCard>

            {/* ── Existing tickets ───────────────────────────────────────────────── */}
            <h2
                className="mb-3 px-1 text-xs uppercase"
                style={{
                    fontFamily: "var(--font-mono)",
                    letterSpacing: "var(--tracking-widest)",
                    color: "var(--fg-3)",
                }}
            >
                Your tickets
            </h2>

            {q.isLoading ? (
                <p className="px-1 text-sm" style={{ color: "var(--fg-3)" }}>
                    Loading your tickets…
                </p>
            ) : loadError ? (
                <p className="px-1 text-sm" style={{ color: "var(--chart-neg)" }}>
                    {loadError}
                </p>
            ) : (
                <DataTable
                    columns={columns}
                    rows={tickets}
                    rowKey={(t) => t.id}
                    onRowClick={(t) => {
                        setActionError(null);
                        setReply("");
                        setOpenId(t.id);
                    }}
                    caption="Your support tickets"
                    empty={
                        <p className="px-1 text-sm" style={{ color: "var(--fg-3)" }}>
                            No tickets yet. Open one above and it will show up here.
                        </p>
                    }
                />
            )}

            {/* ── Ticket thread ──────────────────────────────────────────────────── */}
            <Drawer
                open={Boolean(openTicket)}
                onClose={() => setOpenId(null)}
                title={openTicket?.subject ?? "Ticket"}
            >
                {openTicket && (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: "var(--fg-3)" }}>
                            <StatusBadge status={openTicket.status} />
                            <span>·</span>
                            <span>{CATEGORY_LABEL[openTicket.category] ?? openTicket.category}</span>
                            <span>·</span>
                            <span>Opened {fmtDate(openTicket.createdAt)}</span>
                        </div>

                        {/* Thread */}
                        <div className="flex flex-col gap-3">
                            {openTicket.messages.map((m, i) => (
                                <div
                                    key={`${m.at}-${i}`}
                                    className="rounded-lg border p-3"
                                    style={{
                                        borderColor: "var(--rule)",
                                        background: m.author === "operator" ? "var(--surface)" : "var(--bg)",
                                    }}
                                >
                                    <div className="mb-1 flex items-center gap-2 text-xs" style={{ color: "var(--fg-3)" }}>
                                        <span style={{ color: m.author === "operator" ? "var(--accent)" : "var(--fg-2)" }}>
                                            {m.author === "operator" ? "Juneau Digital Designs" : "You"}
                                        </span>
                                        <span>{fmtTime(m.at)}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap text-sm" style={{ color: "var(--fg)" }}>
                                        {m.text}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Reply (hidden once closed; reopen first) */}
                        {openTicket.status !== "closed" && (
                            <div className="flex flex-col gap-2">
                                <label className="text-sm" style={{ color: "var(--fg-3)" }}>
                                    Add a reply
                                </label>
                                <textarea
                                    value={reply}
                                    onChange={(e) => setReply(e.target.value)}
                                    rows={4}
                                    maxLength={5000}
                                    placeholder="Write a reply…"
                                    style={{ ...inputStyle, resize: "vertical", minHeight: 90 }}
                                />
                                <div>
                                    <button
                                        type="button"
                                        style={primaryButton}
                                        disabled={actionBusy || !reply.trim()}
                                        onClick={() => patchTicket({ message: reply.trim() })}
                                    >
                                        {actionBusy ? "Sending…" : "Send reply"}
                                    </button>
                                </div>
                            </div>
                        )}

                        {actionError && (
                            <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                                {actionError}
                            </p>
                        )}

                        {/* Reopen / close */}
                        <div className="flex flex-wrap gap-2 border-t pt-4" style={{ borderColor: "var(--rule)" }}>
                            {openTicket.status === "closed" ? (
                                <button
                                    type="button"
                                    style={secondaryButton}
                                    disabled={actionBusy}
                                    onClick={() => patchTicket({ status: "open" })}
                                >
                                    Reopen ticket
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    style={secondaryButton}
                                    disabled={actionBusy}
                                    onClick={() => patchTicket({ status: "closed" })}
                                >
                                    Close ticket
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
}
