"use client";

import { useMemo, useRef } from "react";
import { ChartPieSlice, DotsThree, Tray, TrendUp, Users } from "@phosphor-icons/react";
import InboxToolbar from "../inbox/InboxToolbar";
import InboxList from "../inbox/InboxList";
import LeadDetail from "../inbox/LeadDetail";
import { inboxCounts, inboxRows, sectionRows } from "../inbox/model";
import { MobileCard } from "../crm/CustomersSection";
import CustomerRecord from "../crm/CustomerRecord";
import { SectionHeader } from "../ui/Card";
import MiniMonth from "../calendar/MiniMonth";
import DayList from "../calendar/DayList";
import type { CalendarJob } from "../calendar/api";
import { DAVE_ID, type SceneNo, type SceneView } from "./script";
import { BUSINESS_NAME, boardRows, dave, daveJob, daveVisit, dayKey, inboxItems, names, otherAppointments } from "./sample";
import { Caption, recordData } from "./DesktopReplica";
import type { StageKey } from "../crm/stages";
import s from "./GrowthDemo.module.css";

/**
 * The phone replica: the same real components as the desktop one, drawn at the phone's own width,
 * so they take their phone layouts exactly as the live portal does (rebuilt 2026-11-12). The
 * Inbox's stacked rows and full-screen lead, the board's stage list, the customer file's sheet
 * header, and the calendar's mini month are all the components' own.
 *
 * Copied, because the live versions are fixed to the window: the bottom tab bar (`PortalChrome`)
 * and the phone list wrapper (`CustomersSection`). Everything else is the component.
 */

const noop = () => {};
const REVIEW = { businessName: BUSINESS_NAME, reviewLinkConfigured: true };
const STAGE_FOR: StageKey[] = ["lead", "contacted", "quoted", "scheduled"];

export default function PhoneReplica({ scene, view, now }: { scene: SceneNo; view: SceneView; now: Date }) {
    const tab = scene === 1 ? "calls" : view.view === "calendar" ? "more" : "customers";
    return (
        <div className={s.phoneShell} data-composing={view.composing || undefined} data-editing={view.editing || undefined}>
            <div className={s.phoneBody} data-demo-scroll="">
                {scene === 1 && <PhoneInbox view={view} now={now} />}
                {scene > 1 && view.view === "none" && <PhoneBoard view={view} now={now} />}
                {view.view === "record" && (
                    <CustomerRecord
                        customerId={DAVE_ID}
                        siteSlug="demo"
                        variant="sheet"
                        onChanged={noop}
                        review={REVIEW}
                        demo={{ data: recordData(scene, view, now), tab: view.tab, draft: view.typed, reviewOpen: view.reviewOpen }}
                    />
                )}
                {view.view === "calendar" && <PhoneCalendar now={now} />}
            </div>
            <TabBar active={tab} />
            {/* Up top while Dave is texted, so the text box being typed in stays in view. */}
            {view.caption && <Caption scene={scene} side={scene === 4 ? "top" : "left"} />}
        </div>
    );
}

/* The live bar is `position: fixed` to the window; here it sits at the foot of the screen. */
function TabBar({ active }: { active: string }) {
    const tabs = [
        { id: "overview", label: "Overview", Icon: ChartPieSlice },
        { id: "calls", label: "Inbox", Icon: Tray },
        { id: "customers", label: "Customers", Icon: Users },
        { id: "analytics", label: "Analytics", Icon: TrendUp },
    ];
    return (
        <nav className="portal-tabbar" style={{ position: "relative", display: "flex", inset: "auto" }}>
            {tabs.map(({ id, label, Icon }) => (
                <span key={id} className={`portal-tab${id === active ? " is-active" : ""}`}>
                    <Icon size={21} weight={id === active ? "fill" : "regular"} />
                    <span>{label}</span>
                </span>
            ))}
            <span className={`portal-tab${active === "more" ? " is-active" : ""}`}>
                <DotsThree size={21} weight="bold" />
                <span>More</span>
            </span>
        </nav>
    );
}

function PhoneInbox({ view, now }: { view: SceneView; now: Date }) {
    const items = useMemo(() => inboxItems(now, view.promoted, view.leadOpen), [now, view.promoted, view.leadOpen]);
    const rows = inboxRows(items, "all", "", now.getTime());
    // Promoted, Dave leaves the list (as he does live) but his record stays open, now marked Promoted.
    const row = rows.find((r) => r.lead.id === DAVE_ID) ?? inboxRows(items, "promoted", "", now.getTime()).find((r) => r.lead.id === DAVE_ID) ?? null;
    const searchRef = useRef<HTMLInputElement>(null);
    // On a phone the lead takes the whole screen, as the live pane does.
    if (view.leadOpen && row) {
        return (
            <div className={s.slideIn}>
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
    return (
        <div className="space-y-4 p-4">
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

/* The live phone list, from `CustomersSection`. The stage menu on Dave's card is how a phone moves him. */
function PhoneBoard({ view, now }: { view: SceneView; now: Date }) {
    const rows = [dave(now, STAGE_FOR[view.daveStage]), ...boardRows(now)];
    return (
        <div className="space-y-4 p-4">
            <SectionHeader title="Customers" meta={`${rows.length} active · 0 need a reply · 1 going stale`} />
            <div className="space-y-3">
                {rows.map((c) => (
                    <div key={c.customerId} data-customer-id={c.customerId}>
                        <MobileCard row={c} onOpen={noop} onMove={noop} />
                    </div>
                ))}
            </div>
        </div>
    );
}

function PhoneCalendar({ now }: { now: Date }) {
    const today = dayKey(now);
    const appointments = [daveVisit(now), ...otherAppointments(now)];
    const job = daveJob(now);
    const jobs: CalendarJob[] = [{ jobId: job.jobId, customerId: job.customerId, service: job.service, address: job.address, status: job.status }];
    return (
        <div className={`space-y-4 p-4 ${s.slideIn}`}>
            <SectionHeader title="Calendar" />
            <MiniMonth ym={today.slice(0, 7)} today={today} selected={today} appointments={appointments} followUps={[]} onSelect={noop} />
            <DayList
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
    );
}
