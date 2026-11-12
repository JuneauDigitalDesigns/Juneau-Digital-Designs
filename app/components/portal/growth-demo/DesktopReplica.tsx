"use client";

import { useMemo, useRef } from "react";
import { CaretLeft, CaretRight, ChartPieSlice, Gear, Lifebuoy, Plus, Tray, TrendUp, Users, CalendarBlank, MagnifyingGlass, Question } from "@phosphor-icons/react";
import PortalBrand from "../PortalBrand";
import InboxToolbar from "../inbox/InboxToolbar";
import InboxList from "../inbox/InboxList";
import LeadDetail from "../inbox/LeadDetail";
import { inboxCounts, inboxRows, sectionRows } from "../inbox/model";
import { Chip, Column } from "../crm/CustomersSection";
import CustomerPanel from "../crm/CustomerPanel";
import CustomerRecord, { type DetailResponse } from "../crm/CustomerRecord";
import { COLLAPSED_BY_DEFAULT, STAGES, type CustomerRow, type StageKey } from "../crm/stages";
import { Card, SectionHeader } from "../ui/Card";
import MonthGrid, { KIND_HUE } from "../calendar/MonthGrid";
import DayList from "../calendar/DayList";
import type { CalendarJob } from "../calendar/api";
import { APPT_KIND_LABEL, monthLabel } from "@/app/lib/crm-calendar";
import { DEMO_BUSINESS } from "@/app/data/portal-demo";
import { DAVE_ID, captionFor, type SceneNo, type SceneView } from "./script";
import { BUSINESS_NAME, boardRows, dave, daveJob, daveTimeline, daveVisit, dayKey, inboxItems, names, otherAppointments } from "./sample";
import s from "./GrowthDemo.module.css";

/**
 * The desktop replica: the real portal, at a real 1160 × 700 desktop size, scaled down as a whole
 * when the window is smaller (`GrowthDemo` does the scaling), so it is never re-laid-out into
 * something the product does not look like.
 *
 * Rebuilt 2026-11-12 (Xander: "replicate it exactly"). The Inbox list, the open lead, the board's
 * columns and cards, the whole customer file (header, tabs, Coming up, the timeline, the text box,
 * Jobs, the review window) and the calendar's month and day are the portal's own components, fed
 * the sample account in `sample.ts`, so the demo cannot drift from the product. Only the frame
 * around them is copied, from `PortalChrome` (the rail), `InboxSection` (the split view),
 * `CustomersSection` (the board's header) and `CalendarSection` (its header): those components
 * fetch their own data and cannot be handed sample props.
 *
 * Decorative: `GrowthDemo` hides the frame from assistive tech and makes it inert, and the
 * narration a screen reader gets is the takeover's live region. Every handler is a no-op.
 */

const noop = () => {};
const RAIL_TABS = [
    { id: "overview", label: "Overview", Icon: ChartPieSlice },
    { id: "calls", label: "Inbox", Icon: Tray },
    { id: "customers", label: "Customers", Icon: Users },
    { id: "calendar", label: "Calendar", Icon: CalendarBlank },
    { id: "analytics", label: "Analytics", Icon: TrendUp },
    { id: "settings", label: "Settings", Icon: Gear },
    { id: "support", label: "Support", Icon: Lifebuoy },
] as const;

const REVIEW = { businessName: BUSINESS_NAME, reviewLinkConfigured: true };

export default function DesktopReplica({ scene, view, now }: { scene: SceneNo; view: SceneView; now: Date }) {
    const page = scene === 1 ? "calls" : view.view === "calendar" ? "calendar" : "customers";
    return (
        <div className={s.desk} data-composing={view.composing || undefined} data-editing={view.editing || undefined}>
            <Rail active={page} />
            <main className={s.deskStage}>
                {scene === 1 && <InboxPage view={view} now={now} />}
                {scene > 1 && page === "customers" && <BoardPage view={view} now={now} scene={scene} />}
                {page === "calendar" && <CalendarPage now={now} />}
                {view.caption && <Caption scene={scene} />}
            </main>
        </div>
    );
}

/* ── the rail, copied from PortalChrome ─────────────────────────────────── */

function Rail({ active }: { active: string }) {
    return (
        <aside className={s.rail}>
            <PortalBrand />
            <div className="portal-brand-label">Client Portal</div>
            <div className="portal-rail-head">
                <span
                    className="block truncate font-bold"
                    style={{ fontFamily: "var(--font-display)", fontSize: "20px", lineHeight: 1.15, letterSpacing: "var(--tracking-tight)" }}
                >
                    {DEMO_BUSINESS.name}
                </span>
                <span className="mt-0.5 block text-xs" style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
                    {DEMO_BUSINESS.host}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                    <span
                        className="text-xs px-2 py-0.5 rounded-full border shrink-0"
                        style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}
                    >
                        Growth
                    </span>
                </div>
            </div>
            <nav className="portal-rail-nav">
                {RAIL_TABS.map(({ id, label, Icon }) => (
                    <span key={id} className={`portal-rail-link${id === active ? " is-active" : ""}`}>
                        <Icon size={17} weight={id === active ? "fill" : "regular"} className="shrink-0" />
                        <span className="truncate">{label}</span>
                    </span>
                ))}
            </nav>
            <div className="portal-rail-foot" style={{ marginTop: "auto" }}>
                <span className="portal-rail-link" style={{ width: "100%" }}>
                    <Question size={17} className="shrink-0" />
                    <span className="truncate">Help &amp; tour</span>
                </span>
            </div>
        </aside>
    );
}

/* ── 1: the Inbox, the lead opened, Promote ────────────────────────────── */

function InboxPage({ view, now }: { view: SceneView; now: Date }) {
    const items = useMemo(() => inboxItems(now, view.promoted, view.leadOpen), [now, view.promoted, view.leadOpen]);
    const rows = inboxRows(items, "all", "", now.getTime());
    const sections = sectionRows(rows, now);
    const counts = inboxCounts(items, now.getTime());
    // Promoted, Dave leaves the list (as he does live) but his record stays open, now marked Promoted.
    const row = rows.find((r) => r.lead.id === DAVE_ID) ?? inboxRows(items, "promoted", "", now.getTime()).find((r) => r.lead.id === DAVE_ID) ?? null;
    const searchRef = useRef<HTMLInputElement>(null);
    const open = view.leadOpen && row;

    return (
        <div className="space-y-4">
            <InboxToolbar
                filter="all"
                counts={counts}
                remindSupported
                search=""
                onSearch={noop}
                onFilter={noop}
                selected={0}
                onBulkDone={noop}
                onBulkRemind={noop}
                onBulkClear={noop}
                searchRef={searchRef}
                isDesktop
            />
            {/* InboxSection's split view, at a fixed height: the live one is sized to the window. */}
            <div className="portal-elev overflow-hidden flex" style={{ height: 520 }}>
                <div className={`min-w-0 ${open ? "w-[420px] flex-none border-r" : "flex-1"}`} style={{ borderColor: "var(--rule)" }}>
                    <InboxList
                        sections={sections}
                        selectedRowId={open ? row.id : null}
                        cursorRowId={null}
                        wide={!open}
                        checked={new Set()}
                        onToggleCheck={noop}
                        onOpen={noop}
                        onDone={noop}
                        onRemind={noop}
                        remindSupported
                        now={now}
                        empty={null}
                    />
                </div>
                {open && (
                    <div className={`flex-1 min-w-0 min-h-0 relative ${s.slideIn}`}>
                        <LeadDetail
                            item={row.lead}
                            row={row}
                            now={now}
                            isDesktop
                            canPromote
                            remindSupported
                            promoting={view.promoting}
                            remindOpen={false}
                            setRemindOpen={noop}
                            error={null}
                            actions={{
                                onDone: noop,
                                onRestore: noop,
                                onRemind: noop,
                                onPromote: noop,
                                onDelete: noop,
                                onOpenItem: noop,
                                onBack: noop,
                                onMarkUnread: noop,
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── 2 to 5: the board, with Dave's file over it ───────────────────────── */

/** The detail the record would have fetched, for the moment the scene is at. */
export function recordData(scene: SceneNo, view: SceneView, now: Date): DetailResponse {
    const stage: StageKey = view.won ? "won" : "scheduled";
    const booked = scene >= 4 || view.view === "calendar";
    return {
        customer: dave(now, stage, { job: view.job, reviewSent: view.reviewSent }),
        timeline: daveTimeline(now, { sent: view.sent, reply: view.reply, won: view.won }),
        tasks: [],
        jobs: view.job ? [daveJob(now)] : [],
        notes: [],
        appointments: booked ? [daveVisit(now)] : [],
        messagingState: "ready",
    };
}

const STAGE_FOR: StageKey[] = ["lead", "contacted", "quoted", "scheduled"];

function BoardPage({ view, now, scene }: { view: SceneView; now: Date; scene: SceneNo }) {
    const rows: CustomerRow[] = useMemo(() => {
        const me = dave(now, STAGE_FOR[view.daveStage]);
        return [me, ...boardRows(now)];
    }, [now, view.daveStage]);
    const byStage = (k: StageKey) => rows.filter((r) => r.stage === k);
    // While Dave is in hand, the column he is about to land in is lit, as a real drag lights it.
    const target = view.lifted ? STAGE_FOR[Math.min(view.daveStage + 1, 3)] : null;
    const recordOpen = view.view === "record";

    return (
        <div>
            <div className="space-y-5">
                <div className="flex items-end justify-between gap-4 flex-wrap">
                    <SectionHeader title="Customers" meta={`${rows.length} active · 0 need a reply · 1 going stale`} />
                    <div className="flex items-center gap-2.5">
                        <span
                            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium"
                            style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                        >
                            <Plus size={13} weight="bold" /> Add customer
                        </span>
                        <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: "var(--rule-strong)", background: "var(--elev-1)" }}>
                            {(["board", "table"] as const).map((v) => (
                                <span
                                    key={v}
                                    className="px-3.5 py-1.5 text-xs uppercase tracking-wide"
                                    style={{
                                        fontFamily: "var(--font-mono)",
                                        background: v === "board" ? "var(--accent)" : "transparent",
                                        color: v === "board" ? "var(--on-accent)" : "var(--fg-3)",
                                    }}
                                >
                                    {v}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <Card className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 min-w-[240px]" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}>
                        <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                        <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                            Search customers…
                        </span>
                    </div>
                    <Chip on={false} onClick={noop} count={0}>
                        Needs reply
                    </Chip>
                    <Chip on={false} onClick={noop} count={1}>
                        Going stale
                    </Chip>
                    <Chip on={false} onClick={noop} count={0}>
                        ★ Review-ready
                    </Chip>
                    <Chip on={false} onClick={noop}>
                        Show archived
                    </Chip>
                </Card>
                <div className="flex gap-3 items-start pb-2">
                    {STAGES.map((st) =>
                        COLLAPSED_BY_DEFAULT.includes(st.key) ? (
                            <div
                                key={st.key}
                                className="shrink-0 w-[58px] rounded-xl border flex flex-col items-center gap-2 py-2.5"
                                style={{ background: "var(--elev-1)", borderColor: "var(--elev-border)" }}
                            >
                                <span className="rounded-full" style={{ width: 8, height: 8, background: st.color }} />
                                <span
                                    className="font-bold text-[13px]"
                                    style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "var(--font-display)", color: "var(--fg-2)" }}
                                >
                                    {st.label}
                                </span>
                                <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--fg-3)" }}>
                                    {st.key === "won" ? 6 : 1}
                                </span>
                            </div>
                        ) : (
                            <Column
                                key={st.key}
                                stage={st.key}
                                label={st.label}
                                color={st.color}
                                rows={byStage(st.key)}
                                collapsible={false}
                                onCollapse={noop}
                                onDrop={noop}
                                onOpen={noop}
                                highlight={target === st.key}
                            />
                        ),
                    )}
                </div>
            </div>
            {scene >= 3 && (
                <CustomerPanel open={recordOpen} onClose={noop} customerId={DAVE_ID}>
                    <CustomerRecord
                        customerId={DAVE_ID}
                        siteSlug="demo"
                        variant="panel"
                        onChanged={noop}
                        review={REVIEW}
                        onBack={noop}
                        demo={{ data: recordData(scene, view, now), tab: view.tab, draft: view.typed, reviewOpen: view.reviewOpen }}
                    />
                </CustomerPanel>
            )}
        </div>
    );
}

/* ── 3: the visit on the calendar, copied header around the real month and day ── */

function CalendarPage({ now }: { now: Date }) {
    const today = dayKey(now);
    const ym = today.slice(0, 7);
    const appointments = [daveVisit(now), ...otherAppointments(now)];
    const job = daveJob(now);
    const jobs: CalendarJob[] = [{ jobId: job.jobId, customerId: job.customerId, service: job.service, address: job.address, status: job.status }];
    return (
        <div className={`space-y-5 min-w-0 ${s.slideIn}`}>
            <div>
                <SectionHeader title="Calendar" />
                <p className="m-0 mt-1 text-[13.5px]" style={{ color: "var(--fg-2)" }}>
                    Jobs, estimates and follow-ups, all in one place.
                </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", background: "var(--elev-1)" }}>
                    <CaretLeft size={14} />
                </span>
                <h2 className="m-0 text-[18px] font-bold min-w-[150px] text-center" style={{ color: "var(--fg)" }}>
                    {monthLabel(ym)}
                </h2>
                <span className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ borderColor: "var(--rule-strong)", color: "var(--fg-2)", background: "var(--elev-1)" }}>
                    <CaretRight size={14} />
                </span>
                <span className="rounded-lg border px-3 text-[13px] font-medium inline-flex items-center" style={{ minHeight: 36, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}>
                    Today
                </span>
                <ul className="flex list-none m-0 p-0 ml-3 gap-3.5 text-[12px]" style={{ color: "var(--fg-2)" }}>
                    {(["visit", "estimate", "callback"] as const).map((k) => (
                        <li key={k} className="inline-flex items-center gap-1.5">
                            <span className="w-[9px] h-[9px] rounded-[3px]" style={{ background: KIND_HUE[k] }} />
                            {APPT_KIND_LABEL[k]}
                        </li>
                    ))}
                    <li className="inline-flex items-center gap-1.5">
                        <span className="w-[9px] h-[9px] rounded-[2px]" style={{ border: `1.5px solid ${KIND_HUE.followup}` }} />
                        Follow-up
                    </li>
                </ul>
                <span
                    className="ml-auto rounded-lg px-4 text-[13.5px] font-semibold inline-flex items-center gap-1.5"
                    style={{ minHeight: 40, background: "var(--accent)", color: "var(--on-accent)" }}
                >
                    <Plus size={13} weight="bold" /> New appointment
                </span>
            </div>
            <div className="flex flex-row gap-4 min-w-0">
                <div className="flex-1 min-w-0">
                    <MonthGrid
                        ym={ym}
                        today={today}
                        selected={today}
                        appointments={appointments}
                        followUps={[]}
                        names={names()}
                        onSelect={noop}
                        onOpen={noop}
                        onMove={noop}
                    />
                </div>
                <DayList
                    className="w-[300px] shrink-0 self-start"
                    day={today}
                    today={today}
                    siteSlug="demo"
                    appointments={appointments}
                    followUps={[]}
                    names={names()}
                    jobs={jobs}
                    highlight="demo-visit"
                    onStatus={noop}
                    onEdit={noop}
                    onDelete={noop}
                    onDone={noop}
                    onBook={noop}
                />
            </div>
        </div>
    );
}

/* ── the caption ─────────────────────────────────────────────────────────── */

export function Caption({ scene, side = "left" }: { scene: SceneNo; side?: "left" | "top" }) {
    const cap = captionFor(scene);
    const mono = { fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-3)" } as const;
    return (
        /* Bottom left, over the rail: on the right it sat on the text box and the review window. */
        <div className={s.caption} data-side={side}>
            <span style={mono}>{cap.step}</span>
            <strong className="text-[15px]" style={{ color: "var(--fg)" }}>
                {cap.title}
            </strong>
            <p className="m-0 text-[13.5px] leading-snug" style={{ color: "var(--fg-2)" }}>
                {cap.text}
            </p>
            {cap.gate && (
                <p className="m-0 text-xs leading-snug" style={{ color: "var(--fg-3)" }}>
                    {cap.gate}
                </p>
            )}
        </div>
    );
}
