"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Archive,
    ArrowCounterClockwise,
    CaretDown,
    CaretUp,
    Envelope,
    MagnifyingGlass,
    PhoneCall,
    Plus,
    Trash,
} from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import { SectionHeader, Card, CardLabel } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import Drawer from "./ui/Drawer";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";
import { freshness } from "./ui/format";
import { duration } from "@/app/lib/duration";
import {
    filterInbox,
    groupForItem,
    groupInbox,
    groupItemIds,
    inboxItemForDeepLink,
    promotionInput,
    type InboxFilter,
    type InboxGroup,
    type InboxItem,
} from "@/app/lib/crm-contacts";

/**
 * The Inbox — every call and web enquiry, newest first.
 *
 * Follows mockup M1a/M1b: a flat single-line list that reads like an email inbox, and a side
 * drawer for detail. Nothing expands inline — an earlier revision did, and a two-column block
 * opening inside a list row read as a chat bubble rather than a record.
 */

interface InboxData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    items: InboxItem[];
    canPromote: boolean;
    truncated?: boolean;
    error?: string;
}

/**
 * `promoted` is a view of what has already left, not another slice of the worklist — see
 * `filterInbox`, which owns the rule that the other four hide promoted leads entirely.
 */
const FILTERS = ["all", "unread", "calls", "forms", "promoted", "archived"] as const;

/** Compact relative time — the list has one column of room for it. */
function shortAgo(iso: string | null): string {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return "";
    const mins = Math.floor((Date.now() - t) / 60_000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"}`;
    const days = Math.floor(hrs / 24);
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days`;
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fullWhen(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function InboxSection({ site }: { site: PortalSiteProps }) {
    const router = useRouter();
    const params = useSearchParams();
    /**
     * Seeded from the URL so a deep link survives a cold load and a refresh.
     *
     * The owner's text links to one enquiry (`/portal/l/<id>` redirects here with `?open=`),
     * and this used to start at null and read no parameter at all — so the link opened the
     * inbox and nothing else, which is the one thing it was for. Read as the initial value,
     * not synced from the param on every render: once the drawer is open the client owns it,
     * and a `router.replace` must not fight them.
     */
    const [openId, setOpenId] = useState<string | null>(params.get("open"));
    const [promoting, setPromoting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Which grouped rows are showing their individual calls. Keyed by group id. */
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    /**
     * Archive state applied before the server has caught up.
     *
     * The row has to leave the instant it is archived — waiting on a round trip to put
     * something away feels like the click missed. Reverted if the write fails.
     */
    const [pending, setPending] = useState<Record<string, boolean>>({});
    const [undo, setUndo] = useState<{ ids: string[]; label: string } | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<InboxItem | null>(null);
    const [deleting, setDeleting] = useState(false);

    const { data, isLoading, fetchedAt, refresh } = useCachedFetch<InboxData>(
        `inbox:${site.slug}`,
        `/api/portal/inbox?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
    );

    const filter = (params.get("f") ?? "all") as InboxFilter;
    const search = (params.get("q") ?? "").trim().toLowerCase();

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set(key, value);
        else next.delete(key);
        router.replace(`?${next.toString()}`, { scroll: false });
    };

    /** Open an item and say so in the URL, so a reload lands back on it. */
    const openItem = (id: string | null) => {
        setOpenId(id);
        setParam("open", id ?? "");
    };

    const all = useMemo(() => {
        const base = data?.items ?? [];
        const keys = Object.keys(pending);
        if (keys.length === 0) return base;
        return base.map((i) => (i.id in pending ? { ...i, archived: pending[i.id] } : i));
    }, [data, pending]);

    /**
     * Filter, then group — never the other way round.
     *
     * Grouping what the current view holds is what lets the archived view accumulate: archive
     * three calls today and a fourth next week and it reads as one row of four, because the
     * archived view groups the archived items. Grouping first would split that number across
     * two rows the moment one of its calls was put away.
     */
    const items = useMemo(() => filterInbox(all, filter, search), [all, filter, search]);
    const groups = useMemo(() => groupInbox(items), [items]);

    /**
     * The row a deep link landed in, when the link named something other than its newest call.
     *
     * An owner's text points at one particular call. If that call is the third in a run, the
     * row above the drawer shows the *newest* one, and closing the drawer would leave them
     * looking at a summary they never asked about. Expanding that row shows where the call
     * they tapped actually sits. Derived rather than stored, so it collapses again on close.
     */
    const linked = openId ? groupForItem(groups, openId) : null;
    const linkedRun = linked && linked.count > 1 && linked.lead.id !== openId ? linked.id : null;

    /**
     * Resolves a nested callback to the enquiry it was folded into, so a link to the call the
     * receptionist made opens the enquiry that caused it rather than nothing.
     *
     * Searches every item, including ones promoted away. The *list* hides those — it is a
     * worklist — but a link naming one by id is not the list, and the drawer already says
     * "Already in your customers" rather than offering to promote it twice. The redirect
     * sends promoted ids to the customer record anyway; this is the direct-link case.
     */
    const open = inboxItemForDeepLink(all, openId);
    // Every count is of the worklist, so none includes what has left it.
    const working = useMemo(() => all.filter((i) => !i.promoted && !i.archived), [all]);
    const unreadCount = working.filter((i) => !i.read).length;
    const promotedCount = all.filter((i) => i.promoted).length;
    const archivedCount = all.filter((i) => i.archived && !i.promoted).length;
    const viewingArchive = filter === "archived";

    /**
     * Put a row away, or bring it back.
     *
     * Takes every id the row stands for, because a grouped row is one person's whole run of
     * calls and archiving it has to be one action and one undo. Archiving records the ids that
     * exist now rather than the number: the next call from someone who rang three times last
     * week is new work, not something already dealt with.
     */
    async function archiveIds(ids: string[], archived: boolean, label: string) {
        if (ids.length === 0) return;
        setError(null);
        setPending((p) => ({ ...p, ...Object.fromEntries(ids.map((id) => [id, archived])) }));
        setUndo(archived ? { ids, label } : null);

        const res = await fetch(
            `/api/portal/inbox/archive?site=${encodeURIComponent(site.slug)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, archived }),
            },
        ).catch(() => null);

        if (!res?.ok) {
            setPending((p) => {
                const next = { ...p };
                for (const id of ids) delete next[id];
                return next;
            });
            setUndo(null);
            setError(
                archived
                    ? "We couldn't put that away. Please try again."
                    : "We couldn't bring that back. Please try again.",
            );
            return;
        }
        refresh();
    }

    async function deleteLead(item: InboxItem) {
        setDeleting(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/portal/inbox/delete?site=${encodeURIComponent(site.slug)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: item.id }),
                },
            );
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json?.error ?? "We couldn't delete that. Please try again.");
                return;
            }
            setConfirmDelete(null);
            refresh();
        } catch {
            setError("We couldn't delete that. Please try again.");
        } finally {
            setDeleting(false);
        }
    }

    function toggleGroup(id: string) {
        setExpanded((s) => {
            const n = new Set(s);
            if (n.has(id)) n.delete(id);
            else n.add(id);
            return n;
        });
    }

    /** "3 calls from Dale Whitcombe", or just the name — what the undo toast says. */
    function groupLabel(g: InboxGroup): string {
        const who = g.lead.name ?? g.lead.phoneDisplay;
        return g.count > 1 ? `${g.count} calls from ${who}` : who;
    }

    async function promote() {
        if (!open) return;
        setPromoting(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/customers?site=${encodeURIComponent(site.slug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // What travels is decided in one testable place, not inlined here — four of
                // these fields used to be missing and nothing could see that they were.
                body: JSON.stringify(promotionInput(open)),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(json?.error ?? "We couldn't add that customer. Please try again.");
                return;
            }
            setOpenId(null);
            refresh();
            router.push(
                `/portal/customers?site=${encodeURIComponent(site.slug)}&open=${json.customer.customerId}`,
            );
        } catch {
            setError("We couldn't add that customer. Please try again.");
        } finally {
            setPromoting(false);
        }
    }

    const header = (
        <SectionHeader
            title="Inbox"
            meta={freshness(
                `${unreadCount} new · ${working.length} to work`,
                fetchedAt,
            )}
        />
    );

    if (isLoading && !data) {
        return (
            <div className="space-y-6">
                {header}
                <Card density="none" className="divide-y" style={{ borderColor: "var(--rule)" }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 animate-pulse" style={{ background: "var(--surface)" }} />
                    ))}
                </Card>
            </div>
        );
    }

    if (!data || data.state === "error") {
        return (
            <div className="space-y-6">
                {header}
                <FeatureError message={data?.error} onRetry={refresh} />
            </div>
        );
    }

    if (data.state !== "ready") {
        return (
            <div className="space-y-6">
                <SectionHeader title="Inbox" />
                <FeatureState feature="leads" availability={{ state: data.state }} />
            </div>
        );
    }

    if (all.length === 0) {
        return (
            <div className="space-y-6">
                {header}
                <FeatureState feature="leads" availability={{ state: "ready" }} />
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                {header}
                <div
                    className="inline-flex rounded-lg overflow-hidden border"
                    style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}
                    role="tablist"
                    aria-label="Filter inbox"
                >
                    {FILTERS.map((f) => {
                        // Nothing has been promoted yet: the tab would only ever open an empty
                        // list, and on a new account it is a word the client has no use for.
                        if (f === "promoted" && promotedCount === 0) return null;
                        if (f === "archived" && archivedCount === 0) return null;
                        return (
                            <button
                                key={f}
                                type="button"
                                role="tab"
                                aria-selected={filter === f}
                                onClick={() => setParam("f", f === "all" ? "" : f)}
                                className="px-3.5 py-1.5 text-xs uppercase tracking-wide cursor-pointer"
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    background: filter === f ? "var(--accent)" : "transparent",
                                    color: filter === f ? "var(--on-accent)" : "var(--fg-3)",
                                }}
                            >
                                {f === "promoted"
                                    ? `promoted · ${promotedCount}`
                                    : f === "archived"
                                      ? `archived · ${archivedCount}`
                                      : f}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div data-tour="inbox-filters"
                className="flex items-center gap-2 rounded-lg border px-3 py-2 max-w-md"
                style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}>
                <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                <input
                    type="search"
                    value={params.get("q") ?? ""}
                    onChange={(e) => setParam("q", e.target.value)}
                    placeholder="Search name, number, or message…"
                    className="bg-transparent outline-none text-sm w-full"
                    style={{ color: "var(--fg)" }}
                />
            </div>

            {error && (
                <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                    {error}
                </p>
            )}

            {undo && (
                <div
                    role="status"
                    className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm max-w-md"
                    style={{ background: "var(--fg)", color: "var(--elev-1)" }}
                >
                    <span className="min-w-0 truncate">Archived {undo.label}.</span>
                    <button
                        type="button"
                        onClick={() => archiveIds(undo.ids, false, undo.label)}
                        className="ml-auto shrink-0 font-semibold underline underline-offset-2 cursor-pointer"
                        style={{ color: "#9dc0ff" }}
                    >
                        Undo
                    </button>
                </div>
            )}

            <Card density="none" className="overflow-hidden" data-tour="inbox-list">
                {groups.map((g, i) => {
                    const item = g.lead;
                    const isOpen = expanded.has(g.id) || g.id === linkedRun;
                    const ids = groupItemIds(g);
                    return (
                        <div
                            key={g.id}
                            style={{ borderTop: i === 0 ? undefined : "1px solid var(--rule)" }}
                        >
                            <div
                                className="flex items-center"
                                style={{ background: g.unread ? "rgba(37,99,235,0.025)" : undefined }}
                            >
                                <button
                                    type="button"
                                    onClick={() => openItem(item.id)}
                                    className="flex-1 min-w-0 flex flex-wrap md:flex-nowrap items-center gap-x-3 gap-y-1 px-4 py-3.5 text-left cursor-pointer transition-colors"
                                >
                                    <span
                                        className="shrink-0 rounded-full"
                                        style={{
                                            width: 7,
                                            height: 7,
                                            background: g.unread ? "var(--accent)" : "transparent",
                                        }}
                                        aria-hidden="true"
                                    />
                                    <span
                                        className="shrink-0 w-[30px] h-[30px] rounded-lg flex items-center justify-center"
                                        style={{
                                            background:
                                                item.source === "web-form"
                                                    ? "rgba(37,99,235,0.1)"
                                                    : "var(--surface)",
                                            color:
                                                item.source === "web-form"
                                                    ? "var(--accent)"
                                                    : "var(--fg-3)",
                                        }}
                                    >
                                        {item.source === "web-form" ? (
                                            <Envelope size={15} />
                                        ) : (
                                            <PhoneCall size={15} />
                                        )}
                                    </span>
                                    <span
                                        className="shrink-0 max-w-[132px] truncate text-sm"
                                        style={{
                                            color: item.name ? "var(--fg)" : "var(--fg-3)",
                                            fontWeight: g.unread ? 700 : 600,
                                        }}
                                    >
                                        {item.name ?? "Unknown caller"}
                                    </span>
                                    {/* The count is what makes a row a group. Only shown when
                                        there is more than one, so a single call reads exactly
                                        as it did before. */}
                                    {g.count > 1 && (
                                        <span
                                            className="shrink-0 text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
                                            style={{
                                                fontFamily: "var(--font-mono)",
                                                background: "rgba(22,163,74,0.12)",
                                                color: "var(--chart-pos)",
                                            }}
                                        >
                                            {g.count} calls
                                        </span>
                                    )}
                                    {/* On a phone the name, the count and the time already fill
                                        the line, and a message squeezed into what is left reads
                                        as one or two characters. It wraps to its own line below
                                        them instead, and sits inline again from `md` up. */}
                                    <span
                                        className="basis-full order-last pl-10 truncate text-[13px] md:basis-0 md:flex-1 md:order-none md:pl-0 min-w-0"
                                        style={{ color: g.unread ? "var(--fg-2)" : "var(--fg-3)" }}
                                    >
                                        {item.preview ?? "No message"}
                                    </span>
                                    <span className="shrink-0 hidden md:flex gap-1.5">
                                        {g.count === 1 && (
                                            <Tag>
                                                {item.source === "web-form"
                                                    ? "Web form"
                                                    : `Call · ${duration(item.durationSeconds) ?? "—"}`}
                                            </Tag>
                                        )}
                                        {item.callback && (
                                            <Tag tone="pos">
                                                ☎ {duration(item.callback.durationSeconds) ?? "—"}
                                            </Tag>
                                        )}
                                        {item.promoted && <Tag tone="pos">✓ Promoted</Tag>}
                                    </span>
                                    <span
                                        className="shrink-0 w-[72px] text-right text-xs"
                                        style={{
                                            fontFamily: "var(--font-mono)",
                                            color: "var(--fg-3)",
                                        }}
                                    >
                                        {shortAgo(g.at)}
                                    </span>
                                </button>

                                <span className="shrink-0 flex items-center gap-1 pr-3 pl-1">
                                    {viewingArchive ? (
                                        <>
                                            <RowButton
                                                label="Restore"
                                                onClick={() =>
                                                    archiveIds(ids, false, groupLabel(g))
                                                }
                                            >
                                                <ArrowCounterClockwise size={14} />
                                            </RowButton>
                                            {/* Only a web enquiry is ours to destroy. A call is
                                                a row in the client's own Airtable log with a
                                                recording on it. */}
                                            {item.source === "web-form" ? (
                                                <RowButton
                                                    label="Delete"
                                                    danger
                                                    onClick={() => setConfirmDelete(item)}
                                                >
                                                    <Trash size={14} />
                                                </RowButton>
                                            ) : (
                                                <span
                                                    className="hidden lg:inline text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
                                                    style={{
                                                        fontFamily: "var(--font-mono)",
                                                        background: "var(--surface)",
                                                        color: "var(--fg-3)",
                                                    }}
                                                >
                                                    stays in your call log
                                                </span>
                                            )}
                                        </>
                                    ) : (
                                        <RowButton
                                            label={g.count > 1 ? `Archive all ${g.count}` : "Archive"}
                                            onClick={() => archiveIds(ids, true, groupLabel(g))}
                                        >
                                            <Archive size={14} />
                                        </RowButton>
                                    )}
                                    {g.count > 1 && (
                                        <RowButton
                                            label={isOpen ? "Hide calls" : `Show all ${g.count} calls`}
                                            onClick={() => toggleGroup(g.id)}
                                        >
                                            {isOpen ? <CaretUp size={14} /> : <CaretDown size={14} />}
                                        </RowButton>
                                    )}
                                </span>
                            </div>

                            {/* Each call keeps its own time, length and summary. Nothing is
                                merged away; the row is a way of reading the list. */}
                            {isOpen &&
                                g.items.map((sub) => (
                                    <div
                                        key={sub.id}
                                        className="flex items-center gap-3 py-2.5 pr-3 pl-6 md:pl-14"
                                        style={{
                                            background: "var(--bg)",
                                            borderTop: "1px solid var(--rule-weak)",
                                        }}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => openItem(sub.id)}
                                            className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer"
                                        >
                                            <span
                                                className="shrink-0 text-[10.5px] w-[108px]"
                                                style={{
                                                    fontFamily: "var(--font-mono)",
                                                    color: "var(--fg-3)",
                                                }}
                                            >
                                                {shortAgo(sub.at)}
                                            </span>
                                            <span
                                                className="shrink-0 text-[10.5px] w-[52px]"
                                                style={{
                                                    fontFamily: "var(--font-mono)",
                                                    color: "var(--fg-3)",
                                                }}
                                            >
                                                {duration(sub.durationSeconds) ?? "—"}
                                            </span>
                                            <span
                                                className="flex-1 min-w-0 truncate text-[12.5px]"
                                                style={{ color: "var(--fg-2)" }}
                                            >
                                                {sub.preview ?? "No message"}
                                            </span>
                                        </button>
                                        <RowButton
                                            label={viewingArchive ? "Restore this call" : "Archive this call"}
                                            onClick={() =>
                                                archiveIds(
                                                    [sub.id],
                                                    !viewingArchive,
                                                    sub.name ?? sub.phoneDisplay,
                                                )
                                            }
                                        >
                                            {viewingArchive ? (
                                                <ArrowCounterClockwise size={13} />
                                            ) : (
                                                <Archive size={13} />
                                            )}
                                        </RowButton>
                                    </div>
                                ))}
                        </div>
                    );
                })}
                {groups.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--fg-3)" }}>
                        {viewingArchive
                            ? "Nothing archived yet. Anything you put away waits here."
                            : "Nothing matches that."}
                    </div>
                )}
            </Card>

            <Drawer
                open={open !== null}
                onClose={() => openItem(null)}
                title={open?.name ?? "Enquiry"}
                width="lg"
                surface="raised"
            >
                {open && (
                    <div className="space-y-6">
                        <p className="text-sm" style={{ color: "var(--fg-3)" }}>
                            {fullWhen(open.at)} · {open.source === "web-form" ? "web form" : "phone call"}
                        </p>

                        {open.preview && (
                            <section className="space-y-2.5">
                                <CardLabel>
                                    {open.source === "web-form" ? "What they asked for" : "What was said"}
                                </CardLabel>
                                <div
                                    className="rounded-xl border p-4 text-sm leading-relaxed"
                                    style={{ background: "var(--bg)", borderColor: "var(--rule)" }}
                                >
                                    {open.preview}
                                </div>
                            </section>
                        )}

                        {open.callback && (
                            <section className="space-y-2.5">
                                <CardLabel>What happened next</CardLabel>
                                <div className="flex gap-3">
                                    <span
                                        className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center"
                                        style={{ background: "rgba(22,163,74,0.1)", color: "var(--chart-pos)" }}
                                    >
                                        <PhoneCall size={13} />
                                    </span>
                                    <div className="flex-1 text-sm">
                                        <div style={{ color: "var(--fg)" }}>
                                            Your receptionist called them back
                                        </div>
                                        {open.callback.summary && (
                                            <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--fg-3)" }}>
                                                {open.callback.summary}
                                            </p>
                                        )}
                                        {open.callback.recordingUrl && (
                                            <audio controls preload="none" src={open.callback.recordingUrl} className="mt-2 w-full" />
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}

                        {open.recordingUrl && !open.callback && (
                            <section className="space-y-2.5">
                                <CardLabel>Recording</CardLabel>
                                <audio controls preload="none" src={open.recordingUrl} className="w-full" />
                            </section>
                        )}

                        <section className="space-y-2.5">
                            <CardLabel>Contact details</CardLabel>
                            <div className="grid grid-cols-2 gap-4">
                                <Fact label="Phone">
                                    {open.phone ? (
                                        <a href={`tel:${open.phone}`} style={{ color: "var(--accent)" }}>
                                            {open.phoneDisplay}
                                        </a>
                                    ) : (
                                        "No number"
                                    )}
                                </Fact>
                                <Fact label="Email">
                                    {open.email ? (
                                        <a href={`mailto:${open.email}`} style={{ color: "var(--accent)" }}>
                                            {open.email}
                                        </a>
                                    ) : (
                                        "—"
                                    )}
                                </Fact>
                                {open.callbackPhone && (
                                    <Fact label="Callback number">
                                        <a href={`tel:${open.callbackPhone}`} style={{ color: "var(--accent)" }}>
                                            {open.callbackPhoneDisplay}
                                        </a>
                                    </Fact>
                                )}
                                <Fact label="Source">
                                    {open.source === "web-form" ? "Website form" : "Phone call"}
                                </Fact>
                                <Fact label="Received">{fullWhen(open.at)}</Fact>
                            </div>
                        </section>

                        <div className="pt-1">
                            {data.canPromote ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={promote}
                                        data-tour="inbox-promote"
                                        disabled={promoting || open.promoted}
                                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                                    >
                                        <Plus size={15} weight="bold" />
                                        {open.promoted
                                            ? "Already in your customers"
                                            : promoting
                                              ? "Adding…"
                                              : "Promote to customer"}
                                    </button>
                                    <p className="mt-2 text-xs text-center leading-relaxed" style={{ color: "var(--fg-3)" }}>
                                        Creates a customer record with this enquiry already attached.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <a
                                        href={
                                            (open.callbackPhone ?? open.phone)
                                                ? `tel:${open.callbackPhone ?? open.phone}`
                                                : undefined
                                        }
                                        className="w-full rounded-lg px-4 py-3 text-sm font-semibold inline-flex items-center justify-center gap-2"
                                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                                    >
                                        <PhoneCall size={15} weight="bold" />
                                        Call them back
                                    </a>
                                    <p className="mt-2 text-xs text-center leading-relaxed" style={{ color: "var(--fg-3)" }}>
                                        Customer records and follow-up texting come with Growth.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    const label = open.name ?? open.phoneDisplay;
                                    archiveIds([open.id], !open.archived, label);
                                    openItem(null);
                                }}
                                className="w-full rounded-lg border px-4 py-2.5 text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer"
                                style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                            >
                                {open.archived ? (
                                    <>
                                        <ArrowCounterClockwise size={15} /> Restore to inbox
                                    </>
                                ) : (
                                    <>
                                        <Archive size={15} /> Archive
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </Drawer>

            {/* The one destructive path in the inbox, and the only one with a confirmation:
                archive is reversible and a dialog on a reversible action teaches people to
                dismiss dialogs. This says what survives, because a client deleting an enquiry
                is entitled to know the call log and the consent record are not going with it. */}
            <Drawer
                open={confirmDelete !== null}
                onClose={() => setConfirmDelete(null)}
                title="Delete this enquiry?"
                width="md"
                surface="raised"
            >
                {confirmDelete && (
                    <div className="space-y-5">
                        <p className="text-sm leading-relaxed" style={{ color: "var(--fg-2)" }}>
                            This removes {confirmDelete.name ?? "this"}&rsquo;s enquiry for good,
                            including their message and contact details. You cannot undo it. Your
                            call log and recordings are not affected.
                        </p>
                        <div className="flex flex-wrap gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmDelete(null)}
                                className="rounded-lg border px-4 py-2.5 text-sm font-medium cursor-pointer"
                                style={{ borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            >
                                Keep it
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteLead(confirmDelete)}
                                disabled={deleting}
                                className="rounded-lg px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-60"
                                style={{ background: "var(--chart-neg)", color: "#ffffff" }}
                            >
                                {deleting ? "Deleting…" : "Delete permanently"}
                            </button>
                        </div>
                    </div>
                )}
            </Drawer>
        </div>
    );
}

/**
 * A small, square-ish action on a row.
 *
 * Icon-only so a row of three does not crowd out the message, with the words on the tooltip
 * and on the accessible name — the two places that still have room for them.
 */
function RowButton({
    label,
    onClick,
    danger,
    children,
}: {
    label: string;
    onClick: () => void;
    danger?: boolean;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={label}
            aria-label={label}
            className="portal-hit shrink-0 w-8 h-8 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors"
            style={{ color: danger ? "var(--chart-neg)" : "var(--fg-3)" }}
        >
            {children}
        </button>
    );
}

function Tag({ children, tone }: { children: React.ReactNode; tone?: "pos" }) {
    return (
        <span
            className="text-[10.5px] px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
                fontFamily: "var(--font-mono)",
                background: tone === "pos" ? "rgba(22,163,74,0.1)" : "var(--surface)",
                color: tone === "pos" ? "var(--chart-pos)" : "var(--fg-2)",
            }}
        >
            {children}
        </span>
    );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div
                className="text-[10px] uppercase tracking-wider mb-1"
                style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
            >
                {label}
            </div>
            <div className="text-sm" style={{ color: "var(--fg)" }}>
                {children}
            </div>
        </div>
    );
}
