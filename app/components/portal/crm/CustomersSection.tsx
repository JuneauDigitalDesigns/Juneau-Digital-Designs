"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretLeft, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, SectionHeader } from "../ui/Card";
import { FeatureState, FeatureError } from "../ui/FeatureState";
import { useCachedFetch, CLIENT_TTL } from "../PortalDataProvider";
import CustomerDrawer from "./CustomerDrawer";
import ReviewRequestDialog from "../ReviewRequestDialog";
import StarterShowcase from "./StarterShowcase";
import {
    COLLAPSED_BY_DEFAULT,
    STAGES,
    STAGE_COLOR,
    formatMoney,
    formatPhone,
    shortAgo,
    type CustomerRow,
    type StageKey,
} from "./stages";

/**
 * The customer board — mockup M2.
 *
 * Six stages, with Won and Lost collapsed to narrow summary columns by default so the four
 * working stages get the width. Cards carry only the two signals that drive action: a stale dot
 * and an unread badge. Value, tasks and notes live on the record, not the card face.
 */

interface CustomersData {
    state: "ready";
    customers: CustomerRow[];
    messagingReady: boolean;
    messagingState: "ready" | "not-on-plan" | "pending-build" | "connecting";
    reviewLinkConfigured: boolean;
}

export default function CustomersSection({ site }: { site: PortalSiteProps }) {
    const router = useRouter();
    const params = useSearchParams();
    const gate = site.features.crm;

    const { data, isLoading, refresh } = useCachedFetch<CustomersData>(
        `customers:${site.slug}`,
        `/api/portal/customers?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
        gate.state === "ready",
    );

    const [openId, setOpenId] = useState<string | null>(params.get("open"));
    const [reviewFor, setReviewFor] = useState<CustomerRow | null>(null);
    const [collapsed, setCollapsed] = useState<Set<StageKey>>(new Set(COLLAPSED_BY_DEFAULT));
    const [adding, setAdding] = useState(false);
    const [overrides, setOverrides] = useState<Record<string, Partial<CustomerRow>>>({});

    const view = params.get("view") === "table" ? "table" : "board";
    const search = (params.get("q") ?? "").trim().toLowerCase();
    const needsReply = params.get("unread") === "1";
    const staleOnly = params.get("stale") === "1";
    const reviewReady = params.get("rr") === "1";
    const showArchived = params.get("archived") === "1";
    const filtersOn = Boolean(search || needsReply || staleOnly || reviewReady || showArchived);

    const setParam = useCallback(
        (k: string, v: string) => {
            const next = new URLSearchParams(params.toString());
            if (v) next.set(k, v);
            else next.delete(k);
            router.replace(`?${next.toString()}`, { scroll: false });
        },
        [params, router],
    );

    const all = useMemo(
        () =>
            (data?.customers ?? []).map((c) =>
                overrides[c.customerId] ? { ...c, ...overrides[c.customerId] } : c,
            ),
        [data, overrides],
    );

    const rows = useMemo(
        () =>
            all.filter((c) => {
                if (!showArchived && c.archived) return false;
                if (needsReply && !c.unread) return false;
                if (staleOnly && !c.stale) return false;
                if (reviewReady && !(c.stage === "won" && c.phone && !c.reviewSent)) return false;
                if (search) {
                    const hay = `${c.name ?? ""} ${c.phone ?? ""} ${c.note ?? ""} ${c.tags.join(" ")}`.toLowerCase();
                    if (!hay.includes(search)) return false;
                }
                return true;
            }),
        [all, showArchived, needsReply, staleOnly, reviewReady, search],
    );

    const byStage = useMemo(() => {
        const m: Record<StageKey, CustomerRow[]> = {
            lead: [], contacted: [], quoted: [], scheduled: [], won: [], lost: [],
        };
        for (const c of rows) m[c.stage].push(c);
        return m;
    }, [rows]);

    async function move(customerId: string, stage: StageKey) {
        setOverrides((o) => ({ ...o, [customerId]: { ...o[customerId], stage } }));
        const res = await fetch(`/api/portal/customers?site=${encodeURIComponent(site.slug)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ customerId, stage }),
        }).catch(() => null);
        if (!res?.ok) {
            setOverrides((o) => {
                const n = { ...o };
                delete n[customerId];
                return n;
            });
        }
        refresh();
    }

    // ── gating ────────────────────────────────────────────────────────────
    if (gate.state === "not-on-plan") {
        return <StarterShowcase site={site} />;
    }
    if (gate.state !== "ready") {
        return (
            <div className="space-y-6">
                <SectionHeader title="Customers" />
                <FeatureState feature="crm" availability={gate} />
            </div>
        );
    }

    if (isLoading && !data) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Customers" />
                <div className="hidden lg:flex gap-3">
                    {STAGES.map((s) => (
                        <div key={s.key} className="flex-1 h-56 rounded-xl animate-pulse" style={{ background: "var(--surface)" }} />
                    ))}
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Customers" />
                <FeatureError onRetry={refresh} />
            </div>
        );
    }

    const unreadCount = all.filter((c) => c.unread).length;
    const staleCount = all.filter((c) => c.stale).length;
    const reviewCount = all.filter((c) => c.stage === "won" && c.phone && !c.reviewSent).length;

    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <SectionHeader
                    title="Customers"
                    meta={`${all.filter((c) => !c.archived).length} active · ${unreadCount} need a reply · ${staleCount} going stale`}
                />
                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => setAdding(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium cursor-pointer"
                        style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        <Plus size={13} weight="bold" /> Add customer
                    </button>
                    <div
                        className="inline-flex rounded-lg overflow-hidden border"
                        style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}
                    >
                        {(["board", "table"] as const).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setParam("view", v === "board" ? "" : v)}
                                className="px-3.5 py-1.5 text-xs uppercase tracking-wide cursor-pointer"
                                style={{
                                    fontFamily: "var(--font-mono)",
                                    background: view === v ? "var(--accent)" : "transparent",
                                    color: view === v ? "var(--on-accent)" : "var(--fg-3)",
                                }}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <Card className="flex flex-wrap items-center gap-2">
                <div
                    className="flex items-center gap-2 rounded-lg border px-3 py-1.5 min-w-[240px]"
                    style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}
                >
                    <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                    <input
                        type="search"
                        value={params.get("q") ?? ""}
                        onChange={(e) => setParam("q", e.target.value)}
                        placeholder="Search customers…"
                        className="bg-transparent outline-none text-sm w-full"
                        style={{ color: "var(--fg)" }}
                    />
                </div>
                <Chip on={needsReply} onClick={() => setParam("unread", needsReply ? "" : "1")} count={unreadCount}>
                    Needs reply
                </Chip>
                <Chip on={staleOnly} onClick={() => setParam("stale", staleOnly ? "" : "1")} count={staleCount}>
                    Going stale
                </Chip>
                <Chip on={reviewReady} onClick={() => setParam("rr", reviewReady ? "" : "1")} count={reviewCount}>
                    ★ Review-ready
                </Chip>
                <Chip on={showArchived} onClick={() => setParam("archived", showArchived ? "" : "1")}>
                    Show archived
                </Chip>
                {filtersOn && (
                    <button
                        type="button"
                        onClick={() => router.replace(`?site=${encodeURIComponent(site.slug)}`, { scroll: false })}
                        className="text-sm underline underline-offset-4 cursor-pointer"
                        style={{ color: "var(--accent)" }}
                    >
                        Clear
                    </button>
                )}
            </Card>

            {all.length === 0 ? (
                <FeatureState feature="crm" availability={{ state: "ready" }} />
            ) : view === "table" ? (
                <TableView rows={rows} onOpen={setOpenId} />
            ) : (
                <>
                    {/* Desktop board */}
                    <div data-tour="crm-board" className="hidden lg:flex gap-3 items-start overflow-x-auto pb-2">
                        {STAGES.map((s) =>
                            collapsed.has(s.key) ? (
                                <button
                                    key={s.key}
                                    type="button"
                                    onClick={() =>
                                        setCollapsed((c) => {
                                            const n = new Set(c);
                                            n.delete(s.key);
                                            return n;
                                        })
                                    }
                                    className="shrink-0 w-[58px] rounded-xl border flex flex-col items-center gap-2 py-2.5 cursor-pointer"
                                    style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
                                    title={`${s.label} — ${byStage[s.key].length}`}
                                >
                                    <span className="rounded-full" style={{ width: 8, height: 8, background: s.color }} />
                                    <span
                                        className="font-bold text-[13px]"
                                        style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "var(--font-display)", color: "var(--fg-2)" }}
                                    >
                                        {s.label}
                                    </span>
                                    <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                        {byStage[s.key].length}
                                    </span>
                                </button>
                            ) : (
                                <Column
                                    key={s.key}
                                    stage={s.key}
                                    label={s.label}
                                    color={s.color}
                                    rows={byStage[s.key]}
                                    collapsible={COLLAPSED_BY_DEFAULT.includes(s.key)}
                                    onCollapse={() =>
                                        setCollapsed((c) => new Set(c).add(s.key))
                                    }
                                    onDrop={(id) => move(id, s.key)}
                                    onOpen={setOpenId}
                                />
                            ),
                        )}
                    </div>

                    {/* Mobile: stage-filtered list */}
                    <div data-tour="crm-list" className="lg:hidden space-y-3">
                        {rows.map((c) => (
                            <MobileCard key={c.customerId} row={c} onOpen={() => setOpenId(c.customerId)} onMove={move} />
                        ))}
                        {rows.length === 0 && (
                            <p className="py-8 text-center text-sm" style={{ color: "var(--fg-3)" }}>
                                No customers match these filters.
                            </p>
                        )}
                    </div>
                </>
            )}

            <CustomerDrawer
                open={openId !== null}
                onClose={() => {
                    setOpenId(null);
                    setParam("open", "");
                }}
                customerId={openId}
                siteSlug={site.slug}
                onChanged={refresh}
                onRequestReview={(c) => setReviewFor(c)}
            />

            <ReviewRequestDialog
                open={reviewFor !== null}
                onClose={() => setReviewFor(null)}
                contact={
                    reviewFor
                        ? {
                              contactId: reviewFor.customerId,
                              displayName: reviewFor.name,
                              phone: reviewFor.phone,
                              phoneDisplay: formatPhone(reviewFor.phone),
                              reviewSent: reviewFor.reviewSent,
                          }
                        : null
                }
                businessName={site.name}
                reviewLinkConfigured={data.reviewLinkConfigured}
                messagingState={data.messagingState}
                siteSlug={site.slug}
                onSent={() => refresh()}
            />

            {adding && (
                <AddCustomer
                    siteSlug={site.slug}
                    onClose={() => setAdding(false)}
                    onCreated={(id) => {
                        setAdding(false);
                        refresh();
                        setOpenId(id);
                    }}
                />
            )}
        </div>
    );
}

/* ── pieces ───────────────────────────────────────────────────────────────── */

function Column({
    label,
    color,
    rows,
    collapsible,
    onCollapse,
    onDrop,
    onOpen,
}: {
    stage: StageKey;
    label: string;
    color: string;
    rows: CustomerRow[];
    collapsible: boolean;
    onCollapse: () => void;
    onDrop: (customerId: string) => void;
    onOpen: (id: string) => void;
}) {
    const [over, setOver] = useState(false);
    return (
        <section
            className="flex-1 min-w-[168px] rounded-xl p-1.5 transition-colors"
            style={{ background: over ? "var(--surface)" : "transparent" }}
            onDragOver={(e) => {
                e.preventDefault();
                if (!over) setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const id = e.dataTransfer.getData("text/plain");
                if (id) onDrop(id);
            }}
            aria-label={`${label} column`}
        >
            <div className="flex items-center gap-2 px-1.5 pb-2.5">
                <span className="rounded-full" style={{ width: 8, height: 8, background: color }} />
                <span className="font-bold text-[14px]" style={{ fontFamily: "var(--font-display)" }}>
                    {label}
                </span>
                <span className="ml-auto text-[10.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                    {rows.length}
                </span>
                {collapsible && (
                    <button
                        type="button"
                        onClick={onCollapse}
                        aria-label={`Collapse ${label}`}
                        className="cursor-pointer"
                        style={{ color: "var(--fg-3)" }}
                    >
                        <CaretLeft size={11} weight="bold" />
                    </button>
                )}
            </div>
            <div className="flex flex-col gap-2 min-h-[40px]">
                {rows.map((c) => (
                    <BoardCard key={c.customerId} row={c} onOpen={() => onOpen(c.customerId)} />
                ))}
                {rows.length === 0 && (
                    <div
                        className="rounded-xl border border-dashed px-2 py-4 text-center text-[12px]"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-3)" }}
                    >
                        Drop a customer here
                    </div>
                )}
            </div>
        </section>
    );
}

function BoardCard({ row, onOpen }: { row: CustomerRow; onOpen: () => void }) {
    return (
        <article
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", row.customerId)}
            onClick={onOpen}
            data-tour="crm-card"
            className="rounded-xl border p-3 cursor-grab"
            style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
        >
            <div className="flex items-center gap-1.5 font-semibold text-[13.5px]" style={{ color: "var(--fg)" }}>
                {row.stale && (
                    <span
                        title="Going stale"
                        className="rounded-full shrink-0"
                        style={{ width: 7, height: 7, background: "var(--chart-warn)" }}
                    />
                )}
                <span className="truncate">{row.name ?? "Unknown"}</span>
                {row.unread && (
                    <span
                        className="ml-auto rounded-full px-1.5 text-[9.5px]"
                        style={{ background: "var(--accent)", color: "var(--on-accent)", fontFamily: "var(--font-mono)" }}
                    >
                        •
                    </span>
                )}
            </div>
            <div className="text-[11.5px] mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                {formatPhone(row.phone)}
            </div>
            {row.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                    {row.tags.slice(0, 2).map((t) => (
                        <span
                            key={t}
                            className="text-[10px] px-2 py-0.5 rounded-full"
                            style={{ fontFamily: "var(--font-mono)", background: "var(--surface)", color: "var(--fg-2)" }}
                        >
                            {t}
                        </span>
                    ))}
                    {row.tags.length > 2 && (
                        <span className="text-[10px]" style={{ color: "var(--fg-3)" }}>
                            +{row.tags.length - 2}
                        </span>
                    )}
                </div>
            )}
            {row.note && (
                <p
                    className="mt-2 text-[12px] pl-2 border-l line-clamp-2"
                    style={{ color: "var(--fg-3)", borderColor: "var(--rule)" }}
                >
                    {row.note}
                </p>
            )}
        </article>
    );
}

function MobileCard({
    row,
    onOpen,
    onMove,
}: {
    row: CustomerRow;
    onOpen: () => void;
    onMove: (id: string, s: StageKey) => void;
}) {
    return (
        <div
            className="rounded-xl border p-3"
            style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-1)" }}
        >
            <div className="flex items-start justify-between gap-3">
                <button type="button" onClick={onOpen} className="text-left min-w-0 cursor-pointer">
                    <div className="flex items-center gap-1.5 font-semibold text-sm">
                        {row.stale && (
                            <span className="rounded-full shrink-0" style={{ width: 7, height: 7, background: "var(--chart-warn)" }} />
                        )}
                        {row.name ?? "Unknown"}
                    </div>
                    <div className="text-[11.5px] mt-0.5" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-2)" }}>
                        {formatPhone(row.phone)}
                    </div>
                </button>
                <select
                    value={row.stage}
                    onChange={(e) => onMove(row.customerId, e.target.value as StageKey)}
                    className="text-[11px] px-2 py-1 rounded-lg border"
                    style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                >
                    {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                            {s.label}
                        </option>
                    ))}
                </select>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
                {row.unread && (
                    <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(37,99,235,0.09)", color: "var(--accent)", fontFamily: "var(--font-mono)" }}
                    >
                        New reply
                    </span>
                )}
                <span className="ml-auto text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                    {shortAgo(row.lastContactAt ?? row.createdAt)}
                </span>
            </div>
        </div>
    );
}

function TableView({ rows, onOpen }: { rows: CustomerRow[]; onOpen: (id: string) => void }) {
    return (
        <Card density="none" className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr style={{ borderBottom: "1px solid var(--rule)" }}>
                        {["Name", "Stage", "Value", "Tags", "Last contact"].map((h) => (
                            <th
                                key={h}
                                className="text-left px-4 py-3 text-xs uppercase tracking-widest font-medium whitespace-nowrap"
                                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
                            >
                                {h}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((c) => (
                        <tr
                            key={c.customerId}
                            onClick={() => onOpen(c.customerId)}
                            className="cursor-pointer"
                            style={{ borderBottom: "1px solid var(--rule)" }}
                        >
                            <td className="px-4 py-3">
                                <div className="flex items-center gap-1.5">
                                    {c.stale && (
                                        <span className="rounded-full" style={{ width: 7, height: 7, background: "var(--chart-warn)" }} />
                                    )}
                                    <span style={{ color: "var(--fg)" }}>{c.name ?? "Unknown"}</span>
                                    {c.unread && (
                                        <span
                                            className="text-[9.5px] px-1.5 rounded-full"
                                            style={{ background: "var(--accent)", color: "var(--on-accent)", fontFamily: "var(--font-mono)" }}
                                        >
                                            new
                                        </span>
                                    )}
                                </div>
                                <div className="text-[11.5px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                    {formatPhone(c.phone)}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1.5 text-[12px]">
                                    <span className="rounded-full" style={{ width: 7, height: 7, background: STAGE_COLOR[c.stage] }} />
                                    {STAGES.find((s) => s.key === c.stage)?.label}
                                </span>
                            </td>
                            <td className="px-4 py-3" style={{ color: "var(--fg-2)" }}>
                                {formatMoney(c.value) ?? "—"}
                            </td>
                            <td className="px-4 py-3" style={{ color: "var(--fg-3)" }}>
                                {c.tags.join(", ") || "—"}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                {shortAgo(c.lastContactAt ?? c.createdAt)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {rows.length === 0 && (
                <p className="px-4 py-10 text-center text-sm" style={{ color: "var(--fg-3)" }}>
                    No customers match these filters.
                </p>
            )}
        </Card>
    );
}

function Chip({
    on,
    onClick,
    count,
    children,
}: {
    on: boolean;
    onClick: () => void;
    count?: number;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] cursor-pointer"
            style={{
                background: on ? "var(--accent)" : "var(--elev-1)",
                color: on ? "var(--on-accent)" : "var(--fg-2)",
                borderColor: on ? "var(--accent)" : "var(--rule-strong)",
            }}
        >
            {children}
            {count !== undefined && count > 0 && (
                <span className="text-[10.5px] opacity-75" style={{ fontFamily: "var(--font-mono)" }}>
                    {count}
                </span>
            )}
        </button>
    );
}

function AddCustomer({
    siteSlug,
    onClose,
    onCreated,
}: {
    siteSlug: string;
    onClose: () => void;
    onCreated: (id: string) => void;
}) {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    async function submit() {
        setBusy(true);
        setErr(null);
        try {
            const res = await fetch(`/api/portal/customers?site=${encodeURIComponent(siteSlug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, phone, source: "manual" }),
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) {
                setErr(json?.error ?? "We couldn't add that customer.");
                return;
            }
            onCreated(json.customer.customerId);
        } finally {
            setBusy(false);
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(13,17,23,0.4)" }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-sm rounded-2xl border p-6 space-y-4"
                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)", boxShadow: "var(--shadow-2)" }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Add a customer
                </h3>
                <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Name"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                />
                <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone number"
                    className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--bg)", borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                />
                {err && (
                    <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                        {err}
                    </p>
                )}
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold cursor-pointer"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy || (!name.trim() && !phone.trim())}
                        className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50 cursor-pointer"
                        style={{ background: "var(--accent)", color: "var(--on-accent)" }}
                    >
                        {busy ? "Adding…" : "Add"}
                    </button>
                </div>
            </div>
        </div>
    );
}
