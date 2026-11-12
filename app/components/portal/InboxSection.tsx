"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import type { PortalSiteProps } from "@/app/portal/types";
import { SectionHeader, Card } from "./ui/Card";
import { FeatureState, FeatureError } from "./ui/FeatureState";
import Drawer from "./ui/Drawer";
import { useCachedFetch, useInvalidate, CLIENT_TTL } from "./PortalDataProvider";
import {
    filterInbox,
    groupItemIds,
    inboxItemForDeepLink,
    parseInboxFilter,
    type InboxFilter,
    type InboxItem,
} from "@/app/lib/crm-contacts";
import {
    handledThisWeek,
    inboxCounts,
    inboxRows,
    moveKey,
    neighbourRow,
    paneOnArrival,
    remindToast,
    rowClick,
    sectionRows,
    stepRow,
    tomorrowMorning,
    unreadIds,
    type InboxRow,
} from "./inbox/model";
import * as api from "./inbox/api";
import InboxToolbar from "./inbox/InboxToolbar";
import InboxList, { CaughtUp, NothingMatches, dialNumber } from "./inbox/InboxList";
import LeadDetail from "./inbox/LeadDetail";
import UndoToast, { type UndoState } from "./inbox/UndoToast";
import { ShortcutHelp } from "./inbox/ShortcutHelp";

/**
 * The Inbox — every call and web enquiry, sorted into what still needs the owner and what
 * does not.
 *
 * Follows the approved Inbox mockups (desktop split view, phone list with a lead screen that
 * slides in). This file holds the state and the actions; the pieces it draws live in
 * `./inbox/`, and every rule worth testing — status, sections, counts, reminder times — is in
 * `./inbox/model.ts` and `app/lib/crm-contacts.ts`, away from React.
 *
 * **The URL is the state** for anything a link or a reload should land back on: `?f=` (the
 * view), `?q=` (search) and `?open=` (the lead). The owner's text links to one enquiry —
 * `/portal/l/<id>` redirects here with `?open=` — so that one has to work from a cold load.
 * On a phone, opening a lead *pushes* a history entry, so the phone's back gesture closes it
 * instead of leaving the Inbox (as #82 did for customers); on desktop, moving between leads
 * replaces, so j/k does not fill the history.
 *
 * **Closer to email** (Xander, 2026-11-12). A computer arrives on the full-width list with
 * nothing open, as Gmail does; clicking a row opens its record on the right and narrows the
 * list, and clicking the same row again, Esc or the record's ✕ closes it. ↑ ↓ (or j k) move a
 * marker while nothing is open and Enter opens it; with a record open they move the record.
 * Opening marks the row read, saved per account (`/api/portal/inbox/read`), and Mark unread
 * (u) puts it back.
 */

interface InboxData {
    state: "ready" | "not-on-plan" | "pending-build" | "connecting" | "error";
    items: InboxItem[];
    canPromote: boolean;
    truncated?: boolean;
    error?: string;
}

type Override = Partial<Pick<InboxItem, "archived" | "remindAt" | "read">>;

/** The split view starts where the rail does; below it the layout is the phone one. */
const DESKTOP = "(min-width: 1024px)";

/**
 * Which layout, or null before the browser has said.
 *
 * Not `useMediaQuery`, which answers `false` until an effect runs: arriving on the Inbox from
 * another tab renders the cached list synchronously, so a desktop with `?open=` would flash
 * the phone's full-screen lead for a frame first. This reads the real value on a client
 * render and holds both layouts back only for the hydration pass, where the server cannot know.
 */
function useIsDesktop(): boolean | null {
    return useSyncExternalStore(
        (onChange) => {
            const mql = window.matchMedia(DESKTOP);
            mql.addEventListener("change", onChange);
            return () => mql.removeEventListener("change", onChange);
        },
        () => window.matchMedia(DESKTOP).matches,
        () => null,
    );
}

export default function InboxSection({ site }: { site: PortalSiteProps }) {
    const router = useRouter();
    const params = useSearchParams();
    const layout = useIsDesktop();
    const isDesktop = layout === true;
    const reduceMotion = useReducedMotion();
    const invalidate = useInvalidate();

    const { data, isLoading, refresh } = useCachedFetch<InboxData>(
        `inbox:${site.slug}`,
        `/api/portal/inbox?site=${encodeURIComponent(site.slug)}`,
        CLIENT_TTL.calls,
    );

    const filter = parseInboxFilter(params.get("f"));
    const rawSearch = params.get("q") ?? "";
    const search = rawSearch.trim().toLowerCase();
    const urlOpen = params.get("open") || null;
    /** The tour points into the open record, so while it runs a computer opens the newest lead. */
    const touring = params.get("tour") === "1";

    /**
     * The clock the list is read against, ticking once a minute: a reminder that comes due
     * while the page is open moves back into Needs you, and "Today" rolls over at midnight,
     * without a refetch.
     */
    const [nowMs, setNowMs] = useState(() => Date.now());
    useEffect(() => {
        const t = window.setInterval(() => setNowMs(Date.now()), 60_000);
        return () => window.clearInterval(t);
    }, []);
    const now = useMemo(() => new Date(nowMs), [nowMs]);

    /**
     * Done / Remind me state applied before the server has caught up.
     *
     * The row has to leave the instant it is handled — waiting on a round trip to put
     * something away feels like the click missed. Reverted if the write fails.
     */
    const [overrides, setOverrides] = useState<Record<string, Override>>({});
    const [error, setError] = useState<string | null>(null);
    const [toast, setToast] = useState<UndoState | null>(null);
    const toastSeq = useRef(0);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [remindOpen, setRemindOpen] = useState(false);
    const [help, setHelp] = useState(false);
    const [promoting, setPromoting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState<InboxItem | null>(null);
    const [deleting, setDeleting] = useState(false);
    /** Set once a remind call 404s, so the controls go away instead of failing again. */
    const [remindGone, setRemindGone] = useState(false);
    /** The keyboard marker while no record is open: where ↑ ↓ are, and what Enter opens. */
    const [cursorRowId, setCursorRowId] = useState<string | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const all = useMemo(() => {
        const base = data?.items ?? [];
        if (Object.keys(overrides).length === 0) return base;
        return base.map((i) => (i.id in overrides ? { ...i, ...overrides[i.id] } : i));
    }, [data, overrides]);

    /**
     * Reminders are live only when the inbox payload carries `remindAt` (null or a time). Until
     * the backend change lands the key is absent on every item, and Remind me, the Reminders
     * view and the bulk "Remind me tomorrow" are simply not drawn.
     */
    const remindSupported = !remindGone && all.some((i) => i.remindAt !== undefined);
    const canPromote = Boolean(data?.canPromote);

    const rows = useMemo(() => inboxRows(all, filter, search, nowMs), [all, filter, search, nowMs]);
    const sections = useMemo(() => sectionRows(rows, now), [rows, now]);
    const counts = useMemo(() => inboxCounts(all, nowMs), [all, nowMs]);

    /**
     * Which lead is on screen. A deep link names one (any status — an archived or promoted lead
     * still opens, it is just not in the worklist); otherwise nothing, and the list has the full
     * width (`paneOnArrival` says why the tour is the exception).
     */
    const linked = inboxItemForDeepLink(all, urlOpen);
    const selected: InboxItem | null = linked ?? paneOnArrival(rows, { isDesktop, touring });
    const selectedRow: InboxRow | null = selected
        ? (rows.find((r) => r.items.some((i) => i.id === selected.id)) ?? null)
        : null;
    /** The desktop record is showing, so the list is narrow. */
    const paneOpen = isDesktop && selected !== null;
    const cursorRow = rows.find((r) => r.id === cursorRowId) ?? null;

    /* ── the URL ──────────────────────────────────────────────────────────── */

    const href = useCallback(
        (mutate: (p: URLSearchParams) => void) => {
            const next = new URLSearchParams(params.toString());
            mutate(next);
            return `?${next.toString()}`;
        },
        [params],
    );

    const setParam = (key: string, value: string) => {
        router.replace(href((p) => (value ? p.set(key, value) : p.delete(key))), { scroll: false });
    };

    const setFilter = (f: InboxFilter) => setParam("f", f === "needs" ? "" : f);

    /** True while the lead on a phone screen was opened from this list, so Back returns to it. */
    const openedHere = useRef(false);
    useEffect(() => {
        if (!urlOpen) openedHere.current = false;
    }, [urlOpen]);

    const openLead = (id: string) => {
        setRemindOpen(false);
        const to = href((p) => p.set("open", id));
        if (window.matchMedia(DESKTOP).matches) {
            router.replace(to, { scroll: false });
        } else {
            openedHere.current = true;
            router.push(to, { scroll: false });
        }
    };

    /** Open a row from the list, marking it read on the way: the click is the opening. */
    const openRow = (row: InboxRow) => {
        setCursorRowId(row.id);
        markRead(unreadIds(row), true);
        openLead(row.lead.id);
    };

    // Closing a lead we opened steps back over the entry `openLead` pushed. One that arrived by
    // deep link (an owner's text) has no list entry behind it to step back to, so it replaces.
    const closeLead = () => {
        setRemindOpen(false);
        if (openedHere.current) {
            openedHere.current = false;
            router.back();
            return;
        }
        router.replace(href((p) => p.delete("open")), { scroll: false });
    };

    /** Close the record and leave the keyboard marker on the row it came from. */
    const closePane = () => {
        if (selectedRow) setCursorRowId(selectedRow.id);
        closeLead();
    };

    /** A list click: the open row closes, any other row opens (`rowClick`). */
    const clickRow = (row: InboxRow) => {
        if (paneOpen && rowClick(selectedRow?.id ?? null, row.id) === "close") closePane();
        else openRow(row);
    };

    /**
     * After a row leaves the view, where the screen goes: on desktop the pane moves to the
     * row below (or above), the way an email client does; on a phone the lead screen closes.
     */
    const moveOff = (leavingRowIds: string[], ids: string[], patch: Override) => {
        if (!selected || !ids.includes(selected.id)) return;
        const after = all.map((i) => (ids.includes(i.id) ? { ...i, ...patch } : i));
        const stays = filterInbox(after, filter, search, nowMs).some((i) => i.id === selected.id);
        if (stays) return;
        if (!window.matchMedia(DESKTOP).matches) {
            if (urlOpen) closeLead();
            return;
        }
        const next = neighbourRow(rows, leavingRowIds);
        router.replace(
            href((p) => (next ? p.set("open", next.lead.id) : p.delete("open"))),
            { scroll: false },
        );
    };

    /* ── actions ──────────────────────────────────────────────────────────── */

    const apply = (ids: string[], patch: Override) =>
        setOverrides((o) => ({
            ...o,
            ...Object.fromEntries(ids.map((id) => [id, { ...o[id], ...patch }])),
        }));

    /** Put the overrides for these ids back to what they were before an action. */
    const revert = (ids: string[], before: Record<string, Override>) =>
        setOverrides((o) => {
            const next = { ...o };
            for (const id of ids) {
                if (before[id]) next[id] = before[id];
                else delete next[id];
            }
            return next;
        });

    /**
     * Read or unread, shown at once and saved behind it. A failed "read" just turns the row
     * bold again; a failed Mark unread says so, since the owner asked for it.
     */
    function markRead(ids: string[], read: boolean) {
        if (ids.length === 0) return;
        const before = { ...overrides };
        apply(ids, { read });
        void api.setRead(site.slug, ids, read).then((ok) => {
            if (ok) return;
            revert(ids, before);
            if (!read) setError("That change didn't save. Please try again.");
        });
    }

    /** Mark unread closes the record too: left open, it would read as opened again. */
    const markUnread = (row: InboxRow | null) => {
        if (!row || row.status === "done" || row.status === "promoted") return;
        setError(null);
        markRead(groupItemIds(row), false);
        setCursorRowId(row.id);
        if (selectedRow?.id === row.id) closeLead();
    };

    /**
     * A lead that opened without a click — a deep link from the owner's text, or the pane moving
     * on after Done — is read too. In-app opens have already marked it (`openRow`), so this finds
     * nothing left to do for them. Applied once the write lands, not before: an effect is not the
     * place to set state synchronously. The tour's sample lead is not written down.
     */
    const markArrivalRead = useRef<() => void>(() => {});
    useEffect(() => {
        markArrivalRead.current = () => {
            if (!selected || touring) return;
            const ids = selectedRow ? unreadIds(selectedRow) : selected.read ? [] : [selected.id];
            if (ids.length === 0) return;
            void api.setRead(site.slug, ids, true).then((ok) => {
                if (ok) apply(ids, { read: true });
            });
        };
    });
    const selectedId = selected?.id ?? null;
    useEffect(() => {
        markArrivalRead.current();
    }, [selectedId]);

    const say = (label: string, undo: () => void) =>
        setToast({ key: ++toastSeq.current, label, undo });

    async function markDone(ids: string[], label: string, rowIds: string[]) {
        if (ids.length === 0) return;
        setError(null);
        const before = { ...overrides };
        moveOff(rowIds, ids, { archived: true });
        apply(ids, { archived: true });
        say(label, () => void restore(ids, ids[0]));
        if (!(await api.setDone(site.slug, ids, true))) {
            revert(ids, before);
            setToast(null);
            setError("We couldn't put that away. Please try again.");
            return;
        }
        refresh();
    }

    /** Undo for Done, and the Done view's Restore to inbox. */
    async function restore(ids: string[], reselect?: string) {
        setError(null);
        setToast(null);
        const before = { ...overrides };
        apply(ids, { archived: false });
        if (reselect && window.matchMedia(DESKTOP).matches) {
            router.replace(href((p) => p.set("open", reselect)), { scroll: false });
        }
        if (!(await api.setDone(site.slug, ids, false))) {
            revert(ids, before);
            setError("We couldn't bring that back. Please try again.");
            return;
        }
        refresh();
    }

    async function remindIds(ids: string[], at: Date, label: string, rowIds: string[]) {
        if (ids.length === 0 || !remindSupported) return;
        setError(null);
        const before = { ...overrides };
        const patch = { remindAt: at.toISOString() };
        moveOff(rowIds, ids, patch);
        apply(ids, patch);
        say(label, () => void unremind(ids, ids[0]));
        const r = await api.remind(site.slug, ids, at);
        if (!r.ok) {
            revert(ids, before);
            setToast(null);
            if (r.unsupported) setRemindGone(true);
            else setError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        refresh();
    }

    async function unremind(ids: string[], reselect?: string) {
        setError(null);
        setToast(null);
        const before = { ...overrides };
        apply(ids, { remindAt: null });
        if (reselect && window.matchMedia(DESKTOP).matches) {
            router.replace(href((p) => p.set("open", reselect)), { scroll: false });
        }
        const r = await api.cancelRemind(site.slug, ids);
        if (!r.ok) {
            revert(ids, before);
            if (r.unsupported) setRemindGone(true);
            else setError(r.error ?? "That change didn't save. Please try again.");
            return;
        }
        refresh();
    }

    /** What a lead's own buttons act on: its whole row when it is one, else just itself. */
    const selectedIds = (): string[] => {
        if (!selected) return [];
        return selectedRow ? groupItemIds(selectedRow) : [selected.id];
    };

    const rowDone = (row: InboxRow) => void markDone(groupItemIds(row), "Marked done", [row.id]);

    const checkedRows = rows.filter((r) => checked.has(r.id));
    const bulkDone = () => {
        const n = checkedRows.length;
        void markDone(checkedRows.flatMap(groupItemIds), `${n} marked done`, checkedRows.map((r) => r.id));
        setChecked(new Set());
    };
    const bulkRemind = () => {
        const n = checkedRows.length;
        void remindIds(
            checkedRows.flatMap(groupItemIds),
            tomorrowMorning(now),
            `${n} will come back tomorrow at 7 AM`,
            checkedRows.map((r) => r.id),
        );
        setChecked(new Set());
    };

    async function promote() {
        if (!selected) return;
        setPromoting(true);
        setError(null);
        const r = await api.promote(site.slug, selected);
        setPromoting(false);
        if (!r.ok) {
            setError(r.error ?? "We couldn't add that customer. Please try again.");
            return;
        }
        refresh();
        invalidate("customers:");
        router.push(`/portal/customers?site=${encodeURIComponent(site.slug)}&open=${r.value}`);
    }

    async function deleteLead(item: InboxItem) {
        setDeleting(true);
        setError(null);
        const r = await api.deleteLead(site.slug, item.id);
        setDeleting(false);
        if (!r.ok) {
            setError(r.error ?? "We couldn't delete that. Please try again.");
            return;
        }
        setConfirmDelete(null);
        if (urlOpen === item.id) closeLead();
        refresh();
    }

    /* ── keyboard (desktop) ───────────────────────────────────────────────── */

    /**
     * ↑/↓/j/k/Enter/Esc/c/e/h/u,/,? — attached to `window` only while this component is mounted
     * on a desktop, and removed on unmount, so none of it reaches another portal page. Ignored
     * while typing anywhere and whenever a modifier is held (Cmd-K, Ctrl-F and the browser's
     * own shortcuts are not ours).
     *
     * With a record open the keys act on it. With none open they act on the keyboard marker,
     * so the full-width list is as workable from the keyboard as the split view.
     *
     * The handler reads the latest render through a ref, so the listener is attached once
     * rather than on every keystroke-driven render.
     */
    const keys = useRef<(e: KeyboardEvent) => void>(() => {});
    useEffect(() => {
        keys.current = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target as HTMLElement | null;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            // The player's own arrow keys seek; a menu or dialog owns its keys.
            if (t?.closest?.("audio, video, [role=menu], [role=dialog]")) return;
            if (help || confirmDelete || remindOpen) return;

            const click = (action: string) =>
                document.querySelector<HTMLElement>(`[data-inbox-action="${action}"]`)?.click();
            /** What the keys act on: the open record's row, else the marker's. */
            const target = paneOpen ? selectedRow : cursorRow;

            const delta = moveKey(e.key);
            if (delta !== 0) {
                const next = stepRow(rows, (paneOpen ? selectedRow?.id : cursorRowId) ?? null, delta);
                if (!next) return;
                e.preventDefault();
                if (paneOpen) openRow(next);
                else setCursorRowId(next.id);
                document
                    .querySelector(`[data-row-id="${CSS.escape(next.id)}"]`)
                    ?.scrollIntoView({ block: "nearest" });
                return;
            }

            switch (e.key) {
                case "Enter":
                    // A focused button or link answers Enter itself.
                    if (t?.closest?.("button, a")) return;
                    if (!paneOpen) {
                        if (!cursorRow) return;
                        e.preventDefault();
                        openRow(cursorRow);
                        return;
                    }
                    e.preventDefault();
                    document.querySelector<HTMLElement>("[data-inbox-pane] a, [data-inbox-pane] button")?.focus();
                    return;
                case "Escape":
                    // The tour's own Esc closes the tour; the record it points into stays.
                    if (!paneOpen || touring) return;
                    e.preventDefault();
                    closePane();
                    return;
                case "c": {
                    const dial = target ? dialNumber(target.lead) : null;
                    if (dial) window.location.href = `tel:${dial}`;
                    return;
                }
                case "e":
                    e.preventDefault();
                    if (paneOpen) click("done");
                    else if (target && target.status !== "done" && target.status !== "promoted") {
                        // The marker moves on with the row, as the open record does.
                        setCursorRowId(neighbourRow(rows, [target.id])?.id ?? null);
                        rowDone(target);
                    }
                    return;
                case "h":
                    e.preventDefault();
                    if (paneOpen) click("remind");
                    else if (target && remindSupported && target.status !== "done" && target.status !== "promoted") {
                        openRow(target);
                        setRemindOpen(true);
                    }
                    return;
                case "u":
                    e.preventDefault();
                    markUnread(target);
                    return;
                case "/":
                    e.preventDefault();
                    searchRef.current?.focus();
                    return;
                case "?":
                    e.preventDefault();
                    setHelp(true);
                    return;
            }
        };
    });
    useEffect(() => {
        if (!isDesktop) return;
        const onKey = (e: KeyboardEvent) => keys.current(e);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [isDesktop]);

    /* ── states before there is a list ────────────────────────────────────── */

    if (isLoading && !data) {
        return (
            <div className="space-y-6">
                <SectionHeader title="Inbox" />
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
                <SectionHeader title="Inbox" />
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
                <SectionHeader title="Inbox" />
                <FeatureState feature="leads" availability={{ state: "ready" }} />
            </div>
        );
    }

    const empty =
        rows.length > 0 ? null : filter === "needs" && !search ? (
            <CaughtUp handled={handledThisWeek(all, nowMs)} onShowAll={() => setFilter("all")} />
        ) : (
            <NothingMatches />
        );

    const detail = selected && (
        <LeadDetail
            key={selected.id}
            item={selected}
            row={selectedRow}
            now={now}
            isDesktop={isDesktop}
            canPromote={canPromote}
            remindSupported={remindSupported}
            promoting={promoting}
            remindOpen={remindOpen}
            setRemindOpen={setRemindOpen}
            error={error}
            actions={{
                onDone: () => void markDone(selectedIds(), "Marked done", selectedRow ? [selectedRow.id] : []),
                onRestore: () => void restore(selectedIds()),
                onRemind: (at) =>
                    void remindIds(selectedIds(), at, remindToast(at, now), selectedRow ? [selectedRow.id] : []),
                onPromote: () => void promote(),
                onDelete: () => setConfirmDelete(selected),
                onOpenItem: openLead,
                onBack: closePane,
                onMarkUnread: () => markUnread(selectedRow),
            }}
        />
    );

    return (
        <div className="space-y-4">
            <InboxToolbar
                filter={filter}
                counts={counts}
                remindSupported={remindSupported}
                search={rawSearch}
                onSearch={(q) => setParam("q", q)}
                onFilter={setFilter}
                selected={checkedRows.length}
                onBulkDone={bulkDone}
                onBulkRemind={bulkRemind}
                onBulkClear={() => setChecked(new Set())}
                searchRef={searchRef}
                isDesktop={isDesktop}
            />

            {error && !paneOpen && (
                <p className="text-sm" style={{ color: "var(--chart-neg)" }}>
                    {error}
                </p>
            )}

            <div className="portal-elev overflow-hidden lg:flex lg:h-[calc(100dvh-196px)] lg:min-h-[520px]">
                {/* The list takes the full width until a record opens beside it. */}
                <div
                    data-tour="inbox-list"
                    className={`min-w-0 ${paneOpen ? "lg:w-[420px] lg:flex-none lg:border-r" : "lg:flex-1"}`}
                    style={{ borderColor: "var(--rule)" }}
                >
                    <InboxList
                        sections={sections}
                        selectedRowId={isDesktop ? (selectedRow?.id ?? null) : null}
                        cursorRowId={isDesktop ? cursorRowId : null}
                        wide={!paneOpen}
                        checked={checked}
                        onToggleCheck={(id) =>
                            setChecked((s) => {
                                const n = new Set(s);
                                if (n.has(id)) n.delete(id);
                                else n.add(id);
                                return n;
                            })
                        }
                        onOpen={clickRow}
                        onDone={rowDone}
                        onRemind={(row) => {
                            openRow(row);
                            setRemindOpen(true);
                        }}
                        remindSupported={remindSupported}
                        now={now}
                        empty={empty}
                    />
                </div>
                {paneOpen && (
                    <div data-inbox-pane className="flex-1 min-w-0 min-h-0 relative">
                        {detail}
                    </div>
                )}
            </div>

            {/* Phone: the lead fills the screen, over the tab bar, and slides in from the right.
                Fixed inside `.portal-scope`, so it reads the tokens like everything else. */}
            {layout === false && detail && (
                <motion.section
                    aria-label={selected?.name ?? selected?.phoneDisplay ?? "Lead"}
                    data-inbox-pane
                    initial={reduceMotion ? false : { x: "100%" }}
                    animate={{ x: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 0.8, 0.24, 1] }}
                    className="fixed inset-0 z-50 flex flex-col overscroll-contain"
                    style={{ background: "var(--bg)" }}
                >
                    {detail}
                </motion.section>
            )}

            <UndoToast toast={toast} onDismiss={() => setToast(null)} />
            {help && <ShortcutHelp onClose={() => setHelp(false)} />}

            {/* The one destructive path in the inbox, and the only one with a confirmation:
                Done is reversible and a dialog on a reversible action teaches people to
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
                                className="rounded-lg border px-4 py-2.5 min-h-11 text-sm font-medium cursor-pointer"
                                style={{ borderColor: "var(--rule-strong)", color: "var(--fg)" }}
                            >
                                Keep it
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteLead(confirmDelete)}
                                disabled={deleting}
                                className="rounded-lg px-4 py-2.5 min-h-11 text-sm font-semibold cursor-pointer disabled:opacity-60"
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
