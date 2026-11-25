"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { CalendarBlank, CaretLeft, CaretRight, ChartPieSlice, Check, DotsThree, MagnifyingGlass, Plus, Tray, Users } from "@phosphor-icons/react";
import InboxToolbar from "../inbox/InboxToolbar";
import InboxList from "../inbox/InboxList";
import LeadDetail from "../inbox/LeadDetail";
import { inboxCounts, inboxRows, sectionRows } from "../inbox/model";
import { Chip, MobileCard } from "../crm/CustomersSection";
import CustomerRecord, { ReviewToast } from "../crm/CustomerRecord";
import TextThread from "../crm/TextThread";
import { STAGES, type StageKey } from "../crm/stages";
import { Card, SectionHeader } from "../ui/Card";
import MiniMonth from "../calendar/MiniMonth";
import DayList from "../calendar/DayList";
import type { CalendarJob } from "../calendar/api";
import { monthLabel } from "@/app/lib/crm-calendar";
import type { TradeSample } from "@/app/data/trade-samples";
import { COPY, DAVE_ID, captionFor, type CaptionAt, type SceneNo, type SceneView } from "./script";
import { BUSINESS_NUMBER, boardRows, dave, daveJob, daveVisit, dayKey, inboxItems, names, otherAppointments, recordData } from "./sample";
import s from "./GrowthDemo.module.css";

/**
 * The phone replica: the new phone app (the portal-mobile redesign, 2026-11-19), drawn from the
 * portal's own components on the trade's sample data, at the phone's own width, so they take their
 * phone layouts exactly as the live portal does.
 *
 * Real: the Inbox's toolbar, list and full-screen lead; the Customers list's rows; the whole
 * contact-card record (header, stage pill, round Call · Text · Review, tabs, Coming up, timeline,
 * the "Text Dave…" bar, Jobs); the texting screen; the calendar's mini month and day list; the
 * one-tap review's note.
 *
 * Copied, because the live versions fetch their own data, are fixed to the window or hold their
 * state inside: the top bar and tab bar (`PortalChrome`), the record's "All customers" bar
 * (`CustomerDrawer`), the Customers and Calendar page headers (`CustomersSection`,
 * `CalendarSection`), and the Stage sheet (`MobileCard`'s and the record pill's, which open only
 * from their own press; `inbox/Sheet` also moves focus, which would pull it out of the demo's
 * controls).
 *
 * Every layer the live app pins to the window (`fixed`) is held inside this shell instead
 * (`contain: paint` in the CSS), so the sheets and the texting screen cover the demo's phone,
 * not the page it sits on.
 */

const noop = () => {};
const STAGE_FOR: StageKey[] = ["lead", "contacted", "quoted", "scheduled"];
/** The sample owner's initial, for the account button in the top bar. */
const OWNER = "M";

export default function PhoneReplica({
    scene,
    view,
    now,
    sample,
    framed = false,
}: {
    scene: SceneNo;
    view: SceneView;
    now: Date;
    sample: TradeSample;
    /** Drawn inside a phone frame on a page (the homepage), not filling a real phone's screen. */
    framed?: boolean;
}) {
    const reduce = !!useReducedMotion();
    const shellRef = useRef<HTMLDivElement>(null);

    // Which tab is underneath, and what is pushed over it, as the app's own navigation stacks them.
    const base: "inbox" | "customers" | "calendar" = scene === 1 ? "inbox" : view.view === "calendar" ? "calendar" : "customers";
    const pushed: "lead" | "record" | null = scene === 1 ? (view.leadOpen ? "lead" : null) : view.view === "record" ? "record" : null;
    const top = pushed ?? base;
    const daveStage: StageKey = view.won ? "won" : STAGE_FOR[view.daveStage];

    const inboxNow = useMemo(() => inboxItems(sample, now, view.promoted, view.leadOpen || scene > 1), [sample, now, view.promoted, view.leadOpen, scene]);
    const needs = inboxCounts(inboxNow, now.getTime()).needs;

    /* The two rows with no hook of their own get one, for the finger: Dave's Inbox row. Visible
       rows only: below 1024px the desktop row is in the DOM too, hidden. */
    useLayoutEffect(() => {
        const shell = shellRef.current;
        if (!shell || scene !== 1) return;
        for (const name of Array.from(shell.querySelectorAll("strong"))) {
            if (name.textContent !== sample.lead.name) continue;
            const row = name.closest("button");
            if (row && !row.closest("[data-inbox-pane]") && row.getClientRects().length > 0) row.setAttribute("data-demo-row", "dave");
        }
    });

    /* The scene's own scrolls, each run once, on whichever screen is on top. */
    const applied = useRef<string | null>(null);
    useLayoutEffect(() => {
        const cue = view.scroll;
        const shell = shellRef.current;
        if (!cue || !shell) return;
        const key = `${cue.key}|${top}`;
        if (applied.current === key) return;
        const box =
            shell.querySelector<HTMLElement>("[data-demo-top] [data-demo-scroll]") ??
            shell.querySelector<HTMLElement>("[data-demo-top] .overflow-y-auto");
        if (!box) return;
        let y = 0;
        if (cue.to === "end") y = box.scrollHeight;
        else if (cue.to !== "top") {
            const el = box.querySelector<HTMLElement>(cue.to);
            if (!el) return; // not drawn yet: tried again on the next tick
            y = el.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - (cue.offset ?? 0);
        }
        applied.current = key;
        box.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
    });

    /* The texting screen follows its newest text with `scrollIntoView`, which also scrolls every
       box around it, the page included: on the homepage that pulled a reader back up to the demo.
       Here it scrolls its own list and nothing else. Runs before the screen's own effect. */
    useLayoutEffect(() => {
        const list = shellRef.current?.querySelector<HTMLElement>('section[aria-label^="Texts with"] .overflow-y-auto');
        const end = list?.lastElementChild as HTMLElement | null | undefined;
        if (!list || !end) return;
        end.scrollIntoView = () => {
            list.scrollTop = list.scrollHeight;
        };
    }, [view.thread]);

    const record = view.view === "record" || view.view === "calendar" ? recordData(sample, view, now) : null;
    const showCaption = view.caption;

    return (
        <div
            ref={shellRef}
            className={s.phoneShell}
            data-framed={framed || undefined}
            data-bar-lit={view.barLit || undefined}
            data-review-lit={view.reviewLit || undefined}
        >
            {/* The tab underneath, with its top bar and the tab bar. */}
            <div className={s.phoneTab} data-demo-top={top === base ? "" : undefined}>
                <TopBar business={sample.business.name} calendar={base === "calendar"} />
                <div className={s.phoneBody} data-demo-scroll="">
                    <div className="px-4 pt-5 pb-6">
                        {base === "inbox" && <PhoneInbox items={inboxNow} now={now} />}
                        {base === "customers" && <PhoneCustomers sample={sample} now={now} daveStage={daveStage} quiet={view.quiet} />}
                        {base === "calendar" && <PhoneCalendar sample={sample} now={now} />}
                    </div>
                </div>
                <TabBar active={base === "inbox" ? "calls" : base} needs={needs} />
            </div>

            {/* Pushed over it, full screen, as the live app pushes them. */}
            {pushed === "lead" && <PhoneLead sample={sample} now={now} view={view} />}
            {pushed === "record" && record && (
                <div className={`${s.pushed} ${scene === 3 ? s.slideIn : ""}`} data-demo-top="">
                    <div className={s.pushedBar}>
                        <span data-demo="back" className="inline-flex items-center gap-1 h-11 px-2.5 text-[17px] font-semibold" style={{ color: "var(--accent)" }}>
                            <CaretLeft size={20} weight="bold" /> All customers
                        </span>
                    </div>
                    <div className={s.pushedBody} data-demo-scroll="">
                        <CustomerRecord
                            customerId={DAVE_ID}
                            siteSlug="demo"
                            variant="sheet"
                            onChanged={noop}
                            review={{ businessName: sample.business.name, reviewLinkConfigured: true }}
                            demo={{ data: record, tab: view.tab, draft: "" }}
                        />
                    </div>
                </div>
            )}

            {/* The texting screen, over the record. */}
            {view.thread && record && (
                <TextThread
                    customer={record.customer}
                    siteSlug="demo"
                    events={record.timeline}
                    businessNumber={BUSINESS_NUMBER}
                    draft={view.typed}
                    setDraft={noop}
                    sending={view.sending}
                    onSend={noop}
                    onClose={noop}
                />
            )}

            {/* The Stage sheet: from Dave's row on the list (scene 2), or his record's pill (scene 5). */}
            {view.stageSheet && <StageSheet name={sample.lead.name} current={daveStage} />}

            {/* The step box, and the review's note above it, never behind it. */}
            {showCaption && view.captionAt !== "bottom" && <PhoneCaption scene={scene} at={view.captionAt} phase={view.captionPhase} />}
            {(view.toast || (showCaption && view.captionAt === "bottom")) && (
                <div className={s.phoneFoot}>
                    {view.toast && <ReviewToast ok text={COPY.reviewSent} onDone={noop} inline />}
                    {showCaption && view.captionAt === "bottom" && <PhoneCaption scene={scene} at="bottom" phase={null} />}
                </div>
            )}
        </div>
    );
}

/* ── the chrome, copied from PortalChrome ─────────────────────────────── */

function Avatar() {
    return (
        <span
            className="shrink-0 w-8 h-8 rounded-full grid place-items-center text-[13px] font-semibold"
            style={{ background: "var(--surface)", color: "var(--fg-2)", border: "1px solid var(--rule)" }}
        >
            {OWNER}
        </span>
    );
}

/* At rest: the business top left, the account top right; on Calendar the account moves left and
   New appointment's "+" sits on its own on the right. */
function TopBar({ business, calendar }: { business: string; calendar: boolean }) {
    return (
        <header className={`portal-topbar ${s.topBar}`}>
            {calendar && <Avatar />}
            <div className="portal-topbar-site">
                <span className="portal-topbar-name">{business}</span>
            </div>
            {calendar ? (
                <span className="portal-topbar-plus">
                    <Plus size={20} weight="bold" />
                </span>
            ) : (
                <Avatar />
            )}
        </header>
    );
}

const TABS = [
    { id: "overview", label: "Home", Icon: ChartPieSlice },
    { id: "calls", label: "Inbox", Icon: Tray },
    { id: "customers", label: "Customers", Icon: Users },
    { id: "calendar", label: "Calendar", Icon: CalendarBlank },
] as const;

/* The live bar is `position: fixed` to the window; here it sits at the foot of the screen. */
function TabBar({ active, needs }: { active: string; needs: number }) {
    return (
        <nav className={`portal-tabbar ${s.tabBar}`}>
            {TABS.map(({ id, label, Icon }) => (
                <span key={id} data-demo-tab={id} className={`portal-tab${id === active ? " is-active" : ""}`}>
                    <Icon size={25} weight={id === active ? "fill" : "regular"} />
                    <span>{label}</span>
                    {id === "calls" && needs > 0 && <span className="portal-tab-badge">{needs}</span>}
                </span>
            ))}
            <span data-demo-tab="more" className="portal-tab">
                <DotsThree size={25} weight="bold" />
                <span>More</span>
            </span>
        </nav>
    );
}

/* ── 1: the Inbox, and Dave's lead full screen ──────────────────────────── */

function PhoneInbox({ items, now }: { items: ReturnType<typeof inboxItems>; now: Date }) {
    const rows = inboxRows(items, "all", "", now.getTime());
    const searchRef = useRef<HTMLInputElement>(null);
    return (
        <div className="space-y-4">
            <InboxToolbar
                filter="all"
                counts={inboxCounts(items, now.getTime())}
                remindSupported
                search=""
                onSearch={noop}
                onFilter={noop}
                selected={0}
                onBulkDone={noop}
                onBulkRemind={noop}
                onBulkClear={noop}
                searchRef={searchRef}
                isDesktop={false}
            />
            <div className="portal-elev overflow-hidden">
                <InboxList
                    sections={sectionRows(rows, now)}
                    selectedRowId={null}
                    cursorRowId={null}
                    wide
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
        </div>
    );
}

function PhoneLead({ sample, now, view }: { sample: TradeSample; now: Date; view: SceneView }) {
    const items = useMemo(() => inboxItems(sample, now, view.promoted, true), [sample, now, view.promoted]);
    // Promoted, Dave leaves the list (as he does live) but his lead stays open, now marked Promoted.
    const row =
        inboxRows(items, "all", "", now.getTime()).find((r) => r.lead.id === DAVE_ID) ??
        inboxRows(items, "promoted", "", now.getTime()).find((r) => r.lead.id === DAVE_ID) ??
        null;
    if (!row) return null;
    return (
        <div className={`${s.pushed} ${s.slideIn}`} data-inbox-pane="" data-demo-top="">
            <LeadDetail
                item={row.lead}
                row={row}
                now={now}
                isDesktop={false}
                canPromote
                remindSupported
                promoting={view.promoting}
                remindOpen={false}
                setRemindOpen={noop}
                error={null}
                actions={{ onDone: noop, onRestore: noop, onRemind: noop, onPromote: noop, onDelete: noop, onOpenItem: noop, onBack: noop, onMarkUnread: noop }}
            />
        </div>
    );
}

/* ── 2: Customers, stage pills over one list ────────────────────────────── */

function PhoneCustomers({ sample, now, daveStage, quiet }: { sample: TradeSample; now: Date; daveStage: StageKey; quiet: boolean }) {
    const rows = [dave(sample, now, daveStage), ...boardRows(sample, now)];
    const stale = rows.filter((r) => r.stale).length;
    return (
        <div className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <SectionHeader title="Customers" meta={`${rows.length} active · 0 need a reply · ${stale} going stale`} />
                <span
                    className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium"
                    style={{ background: "var(--elev-1)", borderColor: "var(--rule-strong)", color: "var(--fg-2)" }}
                >
                    <Plus size={13} weight="bold" /> Add customer
                </span>
            </div>
            <Card className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 min-w-[240px]" style={{ background: "var(--bg)", borderColor: "var(--rule-strong)" }}>
                    <MagnifyingGlass size={14} style={{ color: "var(--fg-3)" }} />
                    <span className="text-sm" style={{ color: "var(--fg-3)" }}>
                        Search customers…
                    </span>
                </div>
            </Card>
            <div className="flex gap-2 overflow-x-hidden -mx-4 px-4 pb-1">
                {[{ key: "", label: "All", n: rows.length }, ...STAGES.map((st) => ({ key: st.key, label: st.label, n: rows.filter((r) => r.stage === st.key).length }))].map((p) => (
                    <span
                        key={p.key || "all"}
                        className="shrink-0 h-9 px-3.5 rounded-full border text-[14.5px] font-semibold inline-flex items-center"
                        style={
                            p.key === ""
                                ? { background: "var(--fg)", color: "var(--bg)", borderColor: "var(--fg)" }
                                : { background: "var(--elev-1)", color: "var(--fg-2)", borderColor: "var(--rule-strong)" }
                        }
                    >
                        {p.label}
                        {p.n > 0 && <span className="ml-1.5 tabular-nums">{p.n}</span>}
                    </span>
                ))}
            </div>
            <div className="flex items-center gap-2 overflow-x-hidden -mx-4 px-4 pb-1 -mt-2">
                <Chip on={false} onClick={noop} count={0}>
                    Needs reply
                </Chip>
                <Chip on={false} onClick={noop} count={stale}>
                    Going stale
                </Chip>
                <Chip on={false} onClick={noop} count={0}>
                    ★ Review-ready
                </Chip>
                <Chip on={false} onClick={noop}>
                    Show archived
                </Chip>
            </div>
            <div className="portal-group">
                {rows.map((c) => (
                    <div key={c.customerId} data-customer-id={c.customerId} className={s.custRow} data-lit={(quiet && c.stale) || undefined}>
                        <MobileCard row={c} onOpen={noop} onMove={noop} />
                    </div>
                ))}
            </div>
        </div>
    );
}

/* The Stage sheet, as `MobileCard` and the record's stage pill draw it. */
function StageSheet({ name, current }: { name: string; current: StageKey }) {
    return (
        <>
            <span className={s.sheetScrim} aria-hidden="true" />
            <div className={s.sheet}>
                <span aria-hidden="true" className="block w-10 h-1 rounded-full mx-auto mb-2" style={{ background: "var(--rule-strong)" }} />
                <h2 className="m-0 px-1 text-[19px] font-bold text-left" style={{ fontFamily: "var(--font-display)" }}>
                    Stage
                </h2>
                <p className="m-0 px-1 mb-1 text-[14.5px] text-left" style={{ color: "var(--fg-2)" }}>
                    {name}
                </p>
                {STAGES.map((st) => (
                    <span
                        key={st.key}
                        data-demo-stage={st.key}
                        className="flex items-center justify-between min-h-[52px] px-1 border-t text-[16.5px]"
                        style={{ borderColor: "var(--rule)", color: "var(--fg)" }}
                    >
                        <span className="inline-flex items-center gap-2">
                            <span className="rounded-full" style={{ width: 10, height: 10, background: st.color }} />
                            {st.label}
                        </span>
                        {st.key === current && <Check size={20} weight="bold" style={{ color: "var(--accent)" }} />}
                    </span>
                ))}
            </div>
        </>
    );
}

/* ── 3: the Calendar tab, Dave's visit today ─────────────────────────────── */

function PhoneCalendar({ sample, now }: { sample: TradeSample; now: Date }) {
    const today = dayKey(now);
    const ym = today.slice(0, 7);
    const appointments = [daveVisit(sample, now), ...otherAppointments(now)];
    const job = daveJob(sample, now);
    const jobs: CalendarJob[] = [{ jobId: job.jobId, customerId: job.customerId, service: job.service, address: job.address, status: job.status }];
    const square = { borderColor: "var(--rule-strong)", color: "var(--fg-2)", background: "var(--elev-1)" };
    return (
        <div className={`space-y-5 min-w-0 ${s.fadeIn}`}>
            <div>
                <SectionHeader title="Calendar" />
                <p className="m-0 mt-1 text-[13.5px]" style={{ color: "var(--fg-2)" }}>
                    Jobs, estimates and follow-ups, all in one place.
                </p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
                <span className="w-11 h-11 rounded-lg border flex items-center justify-center" style={square}>
                    <CaretLeft size={14} />
                </span>
                <h2 className="m-0 text-[18px] font-bold min-w-[150px] text-center" style={{ color: "var(--fg)" }}>
                    {monthLabel(ym)}
                </h2>
                <span className="w-11 h-11 rounded-lg border flex items-center justify-center" style={square}>
                    <CaretRight size={14} />
                </span>
                <span className="rounded-lg border px-3 text-[13px] font-medium inline-flex items-center" style={{ minHeight: 36, borderColor: "var(--rule-strong)", color: "var(--fg)", background: "var(--elev-1)" }}>
                    Today
                </span>
            </div>
            <div className="flex flex-col gap-4 min-w-0">
                <MiniMonth ym={ym} today={today} selected={today} appointments={appointments} followUps={[]} onSelect={noop} />
                <DayList
                    day={today}
                    today={today}
                    siteSlug="demo"
                    appointments={appointments}
                    followUps={[]}
                    names={names(sample)}
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

/* ── the step box ───────────────────────────────────────────────────────── */

/** The approved mockup's dark step box: at the top, just below the middle (texting), or the bottom. */
function PhoneCaption({ scene, at, phase }: { scene: SceneNo; at: CaptionAt; phase: "4b" | null }) {
    const cap = captionFor(scene, { phone: true, phase });
    return (
        <div key={`${at}-${phase ?? ""}`} className={s.pcap} data-at={at}>
            <span className={s.pcapStep}>{cap.step}</span>
            <strong className={s.pcapTitle}>{cap.title}</strong>
            <p className={s.pcapText}>{cap.text}</p>
            {cap.gate && <p className={s.pcapGate}>{cap.gate}</p>}
        </div>
    );
}
