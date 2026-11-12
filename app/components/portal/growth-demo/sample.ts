import type { InboxItem } from "@/app/lib/crm-contacts";
import type { Job } from "@/app/lib/crm-jobs";
import type { Appointment } from "@/app/lib/crm-calendar";
import { DEMO_BOARD, DEMO_BUSINESS, DEMO_INBOX, DEMO_LEAD, type WorkingStage } from "@/app/data/portal-demo";
import type { CustomerRow, StageKey, TimelineEvent } from "../crm/stages";
import { COPY, DAVE_ID } from "./script";

/**
 * The demo's sample account, in the shapes the real portal components take, so the replica can
 * hand them the same props the live pages do (rebuilt 2026-11-12).
 *
 * The business, Dave and his 2:13 AM no-heat call, the rest of the Inbox and the rest of the
 * board are the homepage demo's own (`app/data/portal-demo.ts`), imported rather than copied.
 * Everything is fictional, and every number is in the 555-01XX range reserved for fiction.
 *
 * Times are built from the day the demo is watched, so "2:13 AM" is this morning wherever the
 * client is: the demo's clock reads 7:42 AM today.
 */

export const BUSINESS_NAME = DEMO_BUSINESS.name;

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

/* ── the Inbox ────────────────────────────────────────────────────────── */

export function inboxItems(now: Date, promoted: boolean, read: boolean): InboxItem[] {
    const dave: InboxItem = {
        id: DAVE_ID,
        source: "call",
        name: DEMO_LEAD.name,
        phone: e164(DEMO_LEAD.phone),
        phoneDisplay: DEMO_LEAD.phone,
        callbackPhone: null,
        callbackPhoneDisplay: null,
        email: null,
        preview: DEMO_LEAD.preview,
        at: today(2, 13, now),
        read,
        promoted,
        archived: false,
        durationSeconds: 118,
        recordingUrl: null,
        address: DEMO_LEAD.address,
        outcome: "Qualified",
        callback: null,
    } as InboxItem;
    const ago = [3, 26, 50];
    const rest = DEMO_INBOX.map((r, i) => {
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
export function dave(now: Date, stage: StageKey, opts: { job?: boolean; reviewSent?: boolean } = {}): CustomerRow {
    return row(
        DAVE_ID,
        DEMO_LEAD.name,
        DEMO_LEAD.phone,
        stage,
        {
            address: DEMO_LEAD.address,
            tags: ["Qualified"],
            createdAt: today(2, 13, now),
            firstContactAt: today(2, 13, now),
            lastContactAt: today(2, 13, now),
            value: opts.job ? JOB_AMOUNT : null,
            reviewSent: opts.reviewSent ? { sentAt: now.toISOString(), deliveryStatus: "sent", optedOut: false } : null,
        },
        now,
    );
}

/** The rest of the board, by working stage. */
export function boardRows(now: Date): CustomerRow[] {
    return STAGE_KEYS.flatMap((stage) =>
        DEMO_BOARD[stage].map((c) =>
            row(`demo-${c.id}`, c.name, c.phone, stage, { tags: c.tags, note: c.note ?? null, stale: Boolean(c.stale) }, now),
        ),
    );
}

/* ── Dave's file ──────────────────────────────────────────────────────── */

export const JOB_SERVICE = "Furnace repair";
export const JOB_AMOUNT = 450;
const JOB_ID = "demo-job-furnace";

export function daveJob(now: Date): Job {
    return {
        jobId: JOB_ID,
        customerId: DAVE_ID,
        service: JOB_SERVICE,
        status: "booked",
        amount: JOB_AMOUNT,
        address: DEMO_LEAD.address,
        notes: null,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
    };
}

/** The visit "Add to calendar" books: 8:00 AM today, an hour, at Dave's. */
export function daveVisit(now: Date): Appointment {
    return {
        id: "demo-visit",
        customerId: DAVE_ID,
        jobId: JOB_ID,
        day: dayKey(now),
        startMinutes: 8 * 60,
        durationMinutes: 60,
        kind: "visit",
        status: "scheduled",
        address: DEMO_LEAD.address,
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

export function names(): Record<string, string | null> {
    const out: Record<string, string | null> = { [DAVE_ID]: DEMO_LEAD.name };
    for (const stage of STAGE_KEYS) for (const c of DEMO_BOARD[stage]) out[`demo-${c.id}`] = c.name;
    return out;
}

/** Dave's history, as the record's timeline reads it. */
export function daveTimeline(now: Date, opts: { sent?: boolean; reply?: boolean; won?: boolean }): TimelineEvent[] {
    const ev: TimelineEvent[] = [
        {
            id: "demo-call",
            kind: "call",
            at: today(2, 13, now),
            summary: DEMO_LEAD.summary,
            actor: "customer",
            meta: { origin: true, detail: DEMO_LEAD.summary, durationSeconds: 118 },
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
    if (opts.sent) ev.push({ id: "demo-sms-out", kind: "sms-out", at: today(7, 40, now), summary: COPY.sms, actor: "client", meta: { body: COPY.sms } });
    if (opts.reply) ev.push({ id: "demo-sms-in", kind: "sms-in", at: today(7, 41, now), summary: COPY.reply, actor: "customer", meta: { body: COPY.reply } });
    if (opts.won)
        ev.push({ id: "demo-move-won", kind: "stage-change", at: today(7, 42, now), summary: "Moved to won", actor: "client", meta: { from: "scheduled", to: "won" } });
    return ev.sort((a, b) => b.at.localeCompare(a.at));
}
