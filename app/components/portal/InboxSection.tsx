"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Envelope, MagnifyingGlass, PhoneCall, Plus } from "@phosphor-icons/react";
import type { PortalSiteProps } from "@/app/portal/types";
import { SectionHeader, Card, CardLabel } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import Drawer from "./ui/Drawer";
import { useCachedFetch, CLIENT_TTL } from "./PortalDataProvider";
import { freshness } from "./ui/format";
import { duration } from "@/app/lib/duration";

/**
 * The Inbox — every call and web enquiry, newest first.
 *
 * Follows mockup M1a/M1b: a flat single-line list that reads like an email inbox, and a side
 * drawer for detail. Nothing expands inline — an earlier revision did, and a two-column block
 * opening inside a list row read as a chat bubble rather than a record.
 */

interface InboxItem {
    id: string;
    source: "call" | "web-form";
    name: string | null;
    phone: string | null;
    phoneDisplay: string;
    email: string | null;
    preview: string | null;
    at: string | null;
    read: boolean;
    promoted: boolean;
    durationSeconds: number | null;
    recordingUrl: string | null;
    callback: {
        at: string | null;
        durationSeconds: number | null;
        summary: string | null;
        recordingUrl: string | null;
    } | null;
}

interface InboxData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    items: InboxItem[];
    canPromote: boolean;
    truncated?: boolean;
    error?: string;
}

type Filter = "all" | "unread" | "calls" | "forms";

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
    const [openId, setOpenId] = useState<string | null>(null);
    const [promoting, setPromoting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { data, isLoading, fetchedAt, refresh } = useCachedFetch<InboxData>(
        `inbox:${site.slug}`,
        `/api/portal/inbox?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
    );

    const filter = (params.get("f") ?? "all") as Filter;
    const search = (params.get("q") ?? "").trim().toLowerCase();

    const setParam = (key: string, value: string) => {
        const next = new URLSearchParams(params.toString());
        if (value) next.set(key, value);
        else next.delete(key);
        router.replace(`?${next.toString()}`, { scroll: false });
    };

    const all = useMemo(() => data?.items ?? [], [data]);
    const items = useMemo(() => {
        return all.filter((i) => {
            if (filter === "unread" && i.read) return false;
            if (filter === "calls" && i.source !== "call") return false;
            if (filter === "forms" && i.source !== "web-form") return false;
            if (search) {
                const hay = `${i.name ?? ""} ${i.phoneDisplay} ${i.preview ?? ""}`.toLowerCase();
                if (!hay.includes(search)) return false;
            }
            return true;
        });
    }, [all, filter, search]);

    const open = all.find((i) => i.id === openId) ?? null;
    const unreadCount = all.filter((i) => !i.read).length;

    async function promote() {
        if (!open) return;
        setPromoting(true);
        setError(null);
        try {
            const res = await fetch(`/api/portal/customers?site=${encodeURIComponent(site.slug)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: open.name,
                    phone: open.phone,
                    email: open.email,
                    note: open.preview,
                    source: open.source,
                    sourceRef: open.id,
                }),
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
                `${unreadCount} new · ${all.length} this period`,
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
                    {(["all", "unread", "calls", "forms"] as Filter[]).map((f) => (
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
                            {f}
                        </button>
                    ))}
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

            <Card density="none" className="overflow-hidden" data-tour="inbox-list">
                {items.map((item, i) => (
                    <button
                        key={item.id}
                        type="button"
                        onClick={() => setOpenId(item.id)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer transition-colors"
                        style={{
                            borderTop: i === 0 ? undefined : "1px solid var(--rule)",
                            background: item.read ? undefined : "rgba(37,99,235,0.025)",
                        }}
                    >
                        <span
                            className="shrink-0 rounded-full"
                            style={{
                                width: 7,
                                height: 7,
                                background: item.read ? "transparent" : "var(--accent)",
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
                                color: item.source === "web-form" ? "var(--accent)" : "var(--fg-3)",
                            }}
                        >
                            {item.source === "web-form" ? <Envelope size={15} /> : <PhoneCall size={15} />}
                        </span>
                        <span
                            className="shrink-0 w-[132px] truncate text-sm"
                            style={{
                                color: item.name ? "var(--fg)" : "var(--fg-3)",
                                fontWeight: item.read ? 600 : 700,
                            }}
                        >
                            {item.name ?? "Unknown caller"}
                        </span>
                        <span
                            className="flex-1 min-w-0 truncate text-[13px]"
                            style={{ color: item.read ? "var(--fg-3)" : "var(--fg-2)" }}
                        >
                            {item.preview ?? "No message"}
                        </span>
                        <span className="shrink-0 flex gap-1.5">
                            <Tag>{item.source === "web-form" ? "Web form" : `Call · ${duration(item.durationSeconds) ?? "—"}`}</Tag>
                            {item.callback && <Tag tone="pos">☎ {duration(item.callback.durationSeconds) ?? "—"}</Tag>}
                            {item.promoted && <Tag tone="pos">✓ Promoted</Tag>}
                        </span>
                        <span
                            className="shrink-0 w-[72px] text-right text-xs"
                            style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}
                        >
                            {shortAgo(item.at)}
                        </span>
                    </button>
                ))}
                {items.length === 0 && (
                    <div className="px-4 py-10 text-center text-sm" style={{ color: "var(--fg-3)" }}>
                        Nothing matches that.
                    </div>
                )}
            </Card>

            <Drawer
                open={open !== null}
                onClose={() => setOpenId(null)}
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
                                        href={open.phone ? `tel:${open.phone}` : undefined}
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
                    </div>
                )}
            </Drawer>
        </div>
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
