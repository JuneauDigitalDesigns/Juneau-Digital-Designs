import type { InboxItem } from "@/app/lib/crm-contacts";
import type { Job } from "@/app/lib/crm-jobs";
import type { Appointment } from "@/app/lib/crm-calendar";
import type { TradeSample } from "@/app/data/trade-samples";
import type { WorkingStage } from "@/app/data/portal-demo";
import type { CustomerRow, StageKey, TimelineEvent } from "../crm/stages";
import type { DetailResponse } from "../crm/CustomerRecord";
import { DAVE_ID, type SceneView } from "./script";

/**
 * The demo's sample account, in the shapes the real portal components take, so the replica can
 * hand them the same props the live pages do (rebuilt 2026-11-12).
 *
 * Everything comes from the client's own trade (`app/data/trade-samples.ts`, 2026-11-19: "if it
 * is a HVAC client, then the dummy data … is HVAC customers"): the business, Dave and his 2:13 AM
 * call, the rest of the Inbox, the board, the job Dave books and the texts either side of it. The
 * HVAC set is the homepage demo's own. Everything is fictional, and every number is in the
 * 555-01XX range reserved for fiction.
 *
 * Times are built from the day the demo is watched, so "2:13 AM" is this morning wherever the
 * client is: the demo's clock reads 7:42 AM today.
 */

/** Today at this local time, as an ISO string. */
function today(h: number, m: number, base: Date): string {
    const d = new Date(base);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
}
function daysAgo(n: number, h: number, base: Date): string {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    d.setHours(h, 0, 0, 0);
    return d.toISOString();
}
/** `(512) 555-0129` → `+15125550129`. */
function e164(display: string): string {
    return `+1${display.replace(/\D/g, "")}`;
}
/** The local calendar day, `YYYY-MM-DD`, as the calendar stores it. */
export function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The demo's "now": 7:42 AM on the day it is watched. */
export function demoNow(real = new Date()): Date {
    const d = new Date(real);
    d.setHours(7, 42, 0, 0);
    return d;
}

/** The business's texting number, for the texting screen's note. Fictional, like the rest. */
export const BUSINESS_NUMBER = "+15125550100";

/* ── the Inbox ────────────────────────────────────────────────────────── */

export function inboxItems(ts: TradeSample, now: Date, promoted: boolean, read: boolean): InboxItem[] {
    const dave: InboxItem = {
        id: DAVE_ID,
        source: "call",
        name: ts.lead.name,
        phone: e164(ts.lead.phone),
        phoneDisplay: ts.lead.phone,
        callbackPhone: null,
        callbackPhoneDisplay: null,
        email: null,
        preview: ts.lead.preview,
        at: today(2, 13, now),
        read,
        promoted,
        archived: false,
        durationSeconds: 118,
        recordingUrl: null,
        address: ts.lead.address,
        outcome: "Qualified",
        callback: null,
    } as InboxItem;
    const ago = [3, 26, 50];
    const rest = ts.inbox.map((r, i) => {
        const at = new Date(now.getTime() - ago[i] * 3600_000).toISOString();
        return {
            ...dave,
            id: `demo-${r.id}`,
            source: r.web ? "web-form" : "call",
            name: r.name,
            phone: `+1512555014${i}`,
            phoneDisplay: `(512) 555-014${i}`,
            preview: r.preview,
            at,
            read: !r.unread,
            promoted: false,
            durationSeconds: r.web ? null : 48,
            address: null,
            outcome: null,
        } as InboxItem;
    });
    return [dave, ...rest];
}

/* ── the customers ────────────────────────────────────────────────────── */

const STAGE_KEYS: WorkingStage[] = ["lead", "contacted", "quoted", "scheduled"];

function row(id: string, name: string, phone: string, stage: StageKey, extra: Partial<CustomerRow>, now: Date): CustomerRow {
    return {
        customerId: id,
        name,
        phone: e164(phone),
        email: null,
        address: null,
        stage,
        value: null,
        tags: [],
        note: null,
        archived: false,
        source: "call",
        createdAt: daysAgo(4, 10, now),
        firstContactAt: daysAgo(4, 10, now),
        lastContactAt: daysAgo(1, 10, now),
        reviewSent: null,
        stale: false,
        unread: false,
        openTasks: 0,
        overdueTasks: 0,
        ...extra,
    };
}

/** Dave as a customer, at the stage the scene has him. */
export function dave(ts: TradeSample, now: Date, stage: StageKey, opts: { job?: boolean; reviewSent?: boolean } = {}): CustomerRow {
    return row(
        DAVE_ID,
        ts.lead.name,
        ts.lead.phone,
        stage,
        {
            address: ts.lead.address,
            tags: ["Qualified"],
            createdAt: today(2, 13, now),
            firstContactAt: today(2, 13, now),
            lastContactAt: today(2, 13, now),
            value: opts.job ? ts.job.amount : null,
            reviewSent: opts.reviewSent ? { sentAt: now.toISOString(), deliveryStatus: "sent", optedOut: false } : null,
        },
        now,
    );
}

/**
 * The rest of the board, by working stage. The one going stale last heard from them six days
 * ago, so the phone list's "Going quiet · 6 days" reads as it would live.
 */
export function boardRows(ts: TradeSample, now: Date): CustomerRow[] {
    return STAGE_KEYS.flatMap((stage) =>
        ts.board[stage].map((c) =>
            row(
                `demo-${c.id}`,
                c.name,
                c.phone,
                stage,
                {
                    tags: c.tags,
                    note: c.note ?? null,
                    stale: Boolean(c.stale),
                    ...(c.stale ? { lastContactAt: daysAgo(6, 0, now) } : {}),
                },
                now,
            ),
        ),
    );
}

/* ── Dave's file ──────────────────────────────────────────────────────── */

const JOB_ID = "demo-job";

export function daveJob(ts: TradeSample, now: Date): Job {
    return {
        jobId: JOB_ID,
        customerId: DAVE_ID,
        service: ts.job.service,
        status: "booked",
        amount: ts.job.amount,
        address: ts.lead.address,
        notes: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
}

/** The visit "Add to calendar" books: 8:00 AM today, an hour, at Dave's. */
export function daveVisit(ts: TradeSample, now: Date): Appointment {
    return {
        id: "demo-visit",
        customerId: DAVE_ID,
        jobId: JOB_ID,
        day: dayKey(now),
        startMinutes: 8 * 60,
        durationMinutes: 60,
        kind: "visit",
        status: "scheduled",
        address: ts.lead.address,
        notes: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    } as Appointment;
}

/** The other appointments on the month, so it reads as a working calendar. */
export function otherAppointments(now: Date): Appointment[] {
    const at = (days: number, start: number, kind: Appointment["kind"], who: string, id: string): Appointment =>
        ({
            id,
            customerId: who,
            jobId: null,
            day: dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days)),
            startMinutes: start,
            durationMinutes: 60,
            kind,
            status: "scheduled",
            address: null,
            notes: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        }) as Appointment;
    return [
        at(1, 9 * 60, "visit", "demo-gary", "demo-a1"),
        at(2, 13 * 60, "estimate", "demo-brenda", "demo-a2"),
        at(-2, 10 * 60, "callback", "demo-kyle", "demo-a3"),
    ];
}

export function names(ts: TradeSample): Record<string, string | null> {
    const out: Record<string, string | null> = { [DAVE_ID]: ts.lead.name };
    for (const stage of STAGE_KEYS) for (const c of ts.board[stage]) out[`demo-${c.id}`] = c.name;
    return out;
}

/**
 * Dave's history, as the record's timeline reads it: the call he came from (pinned open above
 * the timeline), his promotion from the Inbox, the three stage moves, then the texts and Won as
 * the scenes get to them. Only kinds the portal really writes, worded as it words them, so the
 * history is the one a client would see (the job and its visit show where the record shows them:
 * the Jobs tab and Coming up).
 */
export function daveTimeline(
    ts: TradeSample,
    now: Date,
    opts: { sent?: boolean; delivered?: boolean; reply?: boolean; won?: boolean },
): TimelineEvent[] {
    const ev: TimelineEvent[] = [
        {
            id: "demo-call",
            kind: "call",
            at: today(2, 13, now),
            summary: ts.lead.summary,
            actor: "customer",
            meta: { origin: true, detail: ts.lead.summary, durationSeconds: 118 },
        },
        {
            // How promotion records itself: the source's kind, against the client.
            id: "demo-added",
            kind: "call",
            at: today(6, 2, now),
            summary: "Added to your customers from your inbox",
            actor: "client",
        },
    ];
    const moves: [StageKey, StageKey, number][] = [
        ["lead", "contacted", 6],
        ["contacted", "quoted", 6],
        ["quoted", "scheduled", 7],
    ];
    moves.forEach(([from, to, h], i) =>
        ev.push({
            id: `demo-move-${i}`,
            kind: "stage-change",
            at: today(h, 10 + i * 12, now),
            summary: `Moved to ${to}`,
            actor: "client",
            meta: { from, to },
        }),
    );
    if (opts.sent)
        ev.push({
            id: "demo-sms-out",
            kind: "sms-out",
            at: today(7, 40, now),
            summary: ts.sms,
            actor: "client",
            meta: { body: ts.sms, status: opts.delivered ? "delivered" : null },
        });
    if (opts.reply) ev.push({ id: "demo-sms-in", kind: "sms-in", at: today(7, 41, now), summary: ts.reply, actor: "customer", meta: { body: ts.reply } });
    if (opts.won)
        ev.push({ id: "demo-move-won", kind: "stage-change", at: today(7, 42, now), summary: "Moved to won", actor: "client", meta: { from: "scheduled", to: "won" } });
    return ev.sort((a, b) => b.at.localeCompare(a.at));
}

/** The detail the record would have fetched, for the moment the scene is at. */
export function recordData(ts: TradeSample, view: SceneView, now: Date): DetailResponse {
    const stage: StageKey = view.won ? "won" : "scheduled";
    return {
        customer: dave(ts, now, stage, { job: view.job, reviewSent: view.reviewSent }),
        timeline: daveTimeline(ts, now, { sent: view.sent, delivered: view.delivered, reply: view.reply, won: view.won }),
        tasks: [],
        jobs: view.job ? [daveJob(ts, now)] : [],
        notes: [],
        appointments: view.visit ? [daveVisit(ts, now)] : [],
        messagingState: "ready",
        businessNumber: BUSINESS_NUMBER,
    };
}
