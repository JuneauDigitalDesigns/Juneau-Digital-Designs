import type { InboxItem } from "@/app/lib/crm-contacts";
import type { Appointment } from "@/app/lib/crm-calendar";
import type { CustomerNote, Job } from "@/app/lib/crm-jobs";
import type { Message } from "@/app/lib/portal-crm";
import type { TranscriptTurn } from "@/app/lib/call-recording";
import type { PipelineCustomer, PipelineTask } from "@/app/lib/portal-overview-pipeline";
import type { CustomerRow, StageKey, TaskRow, TimelineEvent } from "../crm/stages";
import type { DetailResponse } from "../crm/CustomerRecord";
import { tradeSample, type SampleTrade, type TradeSample } from "@/app/data/trade-samples";

/**
 * The portal's contents while the tour runs (Xander, 19 Nov 2026): "Let's make sure that the tour
 * that they get is filled with dummy data. That way there's actually something for them to look
 * at", from the client's own trade (`app/data/trade-samples.ts`).
 *
 * Built in the exact shapes the portal's own routes answer with, so the live screens draw it
 * unchanged: `sample-mode.ts` hands these to the Inbox, Customers, the customer record and the
 * Calendar in place of their fetches, and the Home page builds its cards from them on the server.
 * Pure and isomorphic: no I/O, and the same input always gives the same output.
 *
 * Every id starts `tour-`, so nothing here can be mistaken for, or written over, a real record.
 */

export const TOUR_ID_PREFIX = "tour-";
/** Dave, the newest lead: the one the tour opens in the Inbox. */
export const TOUR_LEAD_ID = "tour-dave";
/** The customer the tour opens: Brenda, quoted, with a reply, a job, a visit and a reminder. */
export const TOUR_RECORD_ID = "tour-brenda";

const H = 3600_000;
const D = 24 * H;

function at(now: Date, offsetMs: number): string {
    return new Date(now.getTime() + offsetMs).toISOString();
}
/** Today at this local time. */
function todayAt(now: Date, h: number, m = 0): string {
    const d = new Date(now);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
}
function dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDays(now: Date, n: number): Date {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + n);
}
function e164(display: string): string {
    return `+1${display.replace(/\D/g, "")}`;
}
/** The first dollar figure in a line ("$6,400 quote sent Monday" → 6400), for Brenda's value. */
function dollars(line: string | undefined, fallback: number): number {
    const m = line?.match(/\$([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, "")) : fallback;
}

/* ── the Inbox ───────────────────────────────────────────────────────────── */

export function sampleInbox(trade: SampleTrade, now: Date, opts: { webOnly?: boolean } = {}): InboxItem[] {
    const all = sampleInboxAll(trade, now);
    if (!opts.webOnly) return all;
    // A website-plan client has no calls, so the tour shows only form inquiries. The tour's own
    // lead (the one the Handle step opens) stays, as a form inquiry, so that step still has one.
    return all
        .filter((i) => i.source !== "call" || i.id === TOUR_LEAD_ID)
        .map((i) =>
            i.id === TOUR_LEAD_ID
                ? { ...i, source: "web-form" as const, durationSeconds: null, email: "dave@example.com", outcome: null }
                : i,
        );
}

function sampleInboxAll(trade: SampleTrade, now: Date): InboxItem[] {
    const s = tradeSample(trade);
    const base = {
        callbackPhone: null,
        callbackPhoneDisplay: null,
        email: null,
        promoted: false,
        archived: false,
        recordingUrl: null,
        address: null,
        outcome: null,
        callback: null,
    };
    const dave: InboxItem = {
        ...base,
        id: TOUR_LEAD_ID,
        source: "call",
        name: s.lead.name,
        phone: e164(s.lead.phone),
        phoneDisplay: s.lead.phone,
        preview: s.lead.preview,
        // 2:13 AM, before opening: an after-hours call, as the walk-through describes.
        at: todayAt(now, 2, 13) < now.toISOString() ? todayAt(now, 2, 13) : at(now, -5 * H),
        read: false,
        durationSeconds: 118,
        address: s.lead.address,
        outcome: s.lead.tag,
    } as InboxItem;
    const ago = [3 * H, 26 * H, 50 * H];
    const rest = s.inbox.map(
        (r, i) =>
            ({
                ...base,
                id: `${TOUR_ID_PREFIX}${r.id}`,
                source: r.web ? "web-form" : "call",
                name: r.name,
                phone: `+1512555016${i}`,
                phoneDisplay: `(512) 555-016${i}`,
                email: r.web ? `${r.name.split(" ")[0].toLowerCase()}@example.com` : null,
                preview: r.preview,
                at: at(now, -ago[i]),
                read: !r.unread,
                durationSeconds: r.web ? null : 48,
            }) as InboxItem,
    );
    return [dave, ...rest];
}

export function sampleTranscript(trade: SampleTrade): TranscriptTurn[] {
    return tradeSample(trade).transcript;
}

/* ── customers ───────────────────────────────────────────────────────────── */

interface Person {
    id: string;
    name: string;
    phone: string;
    stage: StageKey;
    tag: string;
    note?: string;
    stale?: boolean;
    value: number | null;
    unread?: boolean;
    daysAgo: number;
}

function people(s: TradeSample): Person[] {
    const b = s.board;
    const quoted = b.quoted[0];
    return [
        { id: TOUR_RECORD_ID, name: quoted.name, phone: quoted.phone, stage: "quoted", tag: quoted.tags[0], note: quoted.note, value: dollars(quoted.note, 1850), unread: true, daysAgo: 3 },
        { id: `${TOUR_ID_PREFIX}${b.contacted[0].id}`, name: b.contacted[0].name, phone: b.contacted[0].phone, stage: "contacted", tag: b.contacted[0].tags[0], stale: true, value: null, daysAgo: 9 },
        { id: `${TOUR_ID_PREFIX}${b.scheduled[0].id}`, name: b.scheduled[0].name, phone: b.scheduled[0].phone, stage: "scheduled", tag: b.scheduled[0].tags[0], note: b.scheduled[0].note, value: 420, daysAgo: 5 },
        { id: `${TOUR_ID_PREFIX}${b.lead[0].id}`, name: b.lead[0].name, phone: b.lead[0].phone, stage: "lead", tag: b.lead[0].tags[0], note: b.lead[0].note, value: null, daysAgo: 1 },
        { id: `${TOUR_ID_PREFIX}greg`, name: "Greg Tran", phone: "(512) 555-0171", stage: "won", tag: s.job.service, value: 3100, daysAgo: 12 },
    ];
}

function rowOf(p: Person, now: Date): CustomerRow {
    const created = at(now, -p.daysAgo * D);
    return {
        customerId: p.id,
        name: p.name,
        phone: e164(p.phone),
        email: null,
        address: null,
        stage: p.stage,
        value: p.value,
        tags: [p.tag],
        note: p.note ?? null,
        archived: false,
        source: "call",
        createdAt: created,
        firstContactAt: created,
        lastContactAt: p.unread ? at(now, -2 * H) : at(now, -(p.stale ? 8 : 1) * D),
        reviewSent: null,
        stale: Boolean(p.stale),
        unread: Boolean(p.unread),
        openTasks: p.id === TOUR_RECORD_ID ? 1 : 0,
        overdueTasks: 0,
    };
}

export function sampleCustomers(trade: SampleTrade, now: Date): CustomerRow[] {
    return people(tradeSample(trade)).map((p) => rowOf(p, now));
}

/** The calendar, a working month around today. */
export function sampleAppointments(trade: SampleTrade, now: Date): Appointment[] {
    const ps = people(tradeSample(trade));
    const appt = (id: string, who: string, days: number, startMinutes: number, kind: Appointment["kind"]): Appointment =>
        ({
            id: `${TOUR_ID_PREFIX}${id}`,
            customerId: who,
            jobId: who === TOUR_RECORD_ID && kind === "visit" ? `${TOUR_ID_PREFIX}job-brenda` : null,
            day: dayKey(plusDays(now, days)),
            startMinutes,
            durationMinutes: 60,
            kind,
            status: "scheduled",
            address: null,
            notes: null,
            createdAt: now.toISOString(),
            updatedAt: now.toISOString(),
        }) as Appointment;
    return [
        appt("a1", ps[2].id, 0, 9 * 60, "visit"),
        appt("a2", TOUR_RECORD_ID, 1, 13 * 60 + 30, "estimate"),
        appt("a3", ps[3].id, 1, 8 * 60, "callback"),
        appt("a4", TOUR_RECORD_ID, 6, 9 * 60 + 30, "visit"),
        appt("a5", ps[4].id, -2, 10 * 60, "visit"),
    ];
}

function tasksFor(now: Date): TaskRow[] {
    return [{ taskId: `${TOUR_ID_PREFIX}task-quote`, customerId: TOUR_RECORD_ID, title: "Send the quote Friday", dueAt: todayAt(now, 17), done: false }];
}

function jobsFor(s: TradeSample, p: Person, now: Date): Job[] {
    if (p.id !== TOUR_RECORD_ID && p.stage !== "scheduled" && p.stage !== "won") return [];
    return [
        {
            jobId: `${TOUR_ID_PREFIX}job-${p.id.slice(TOUR_ID_PREFIX.length)}`,
            customerId: p.id,
            service: p.tag,
            status: p.stage === "won" ? "done" : p.stage === "scheduled" ? "booked" : "quoted",
            amount: p.value,
            address: null,
            notes: null,
            createdAt: at(now, -2 * D),
            updatedAt: at(now, -2 * D),
        } as Job,
    ];
}

function messagesFor(s: TradeSample, p: Person, now: Date): Message[] {
    if (p.id !== TOUR_RECORD_ID) return [];
    const first = p.name.split(" ")[0];
    return [
        { id: `${TOUR_ID_PREFIX}m1`, direction: "out", body: `Hi ${first}, it's Mike from ${s.business.name}. Here's the quote for the ${p.tag.toLowerCase()}: $${(p.value ?? 0).toLocaleString("en-US")}. Happy to answer any questions.`, at: at(now, -26 * H), messageSid: null, status: "delivered" },
        { id: `${TOUR_ID_PREFIX}m2`, direction: "in", body: "Sounds good. Does Thursday morning work?", at: at(now, -2 * H), messageSid: null, status: "received" },
    ];
}

/** One customer's file, as `GET /api/portal/customers/{id}` answers it. */
export function sampleRecord(trade: SampleTrade, customerId: string, now: Date): (DetailResponse & { state: "ready"; messages: Message[] }) | null {
    const s = tradeSample(trade);
    const p = people(s).find((x) => x.id === customerId);
    if (!p) return null;
    const customer = rowOf(p, now);
    const first = p.name.split(" ")[0];
    const messages = messagesFor(s, p, now);
    const notes: CustomerNote[] = p.id === TOUR_RECORD_ID ? [{ noteId: `${TOUR_ID_PREFIX}n1`, customerId: p.id, body: s.note, createdAt: at(now, -2 * D), updatedAt: null }] : [];
    const timeline: TimelineEvent[] = [
        { id: `${TOUR_ID_PREFIX}call`, kind: "call", at: customer.createdAt, summary: `${first} called`, actor: "customer", meta: { origin: true, detail: `${first} asked about a ${p.tag.toLowerCase()} and wants a quote.`, durationSeconds: 96 } },
        ...(p.stage !== "lead"
            ? [{ id: `${TOUR_ID_PREFIX}move`, kind: "stage-change" as const, at: at(now, -27 * H), summary: `Moved to ${p.stage}`, actor: "client" as const, meta: { from: "lead", to: p.stage } }]
            : []),
        ...messages.map((m) => ({
            id: `msg:${m.id}`,
            kind: (m.direction === "in" ? "sms-in" : "sms-out") as TimelineEvent["kind"],
            at: m.at,
            summary: m.direction === "in" ? `${p.name} texted you` : "You texted them",
            actor: (m.direction === "in" ? "customer" : "client") as TimelineEvent["actor"],
            meta: { body: m.body, status: m.status },
        })),
        ...notes.map((n) => ({ id: `note:${n.noteId}`, kind: "note" as const, at: n.createdAt, summary: "You added a note", actor: "client" as const, meta: { body: n.body } })),
    ].sort((a, b) => b.at.localeCompare(a.at)) as TimelineEvent[];
    return {
        state: "ready",
        customer,
        timeline,
        messages,
        tasks: p.id === TOUR_RECORD_ID ? tasksFor(now) : [],
        jobs: jobsFor(s, p, now),
        notes,
        appointments: sampleAppointments(trade, now).filter((a) => a.customerId === p.id),
        messagingState: "ready",
        businessNumber: "+15125550100",
    };
}

/** The calendar route's answer. */
export function sampleCalendar(trade: SampleTrade, now: Date) {
    const ps = people(tradeSample(trade));
    const tasks = tasksFor(now);
    return {
        state: "ready" as const,
        appointments: sampleAppointments(trade, now),
        followUps: tasks.map((t) => ({ taskId: t.taskId, customerId: t.customerId, title: t.title, dueAt: t.dueAt!.slice(0, 10) })),
        customers: ps.map((p) => ({ customerId: p.id, name: p.name, address: null })).sort((a, b) => a.name.localeCompare(b.name)),
        names: Object.fromEntries(ps.map((p) => [p.id, p.name])),
        jobs: ps.flatMap((p) => jobsFor(tradeSample(trade), p, now)).map((j) => ({ jobId: j.jobId, customerId: j.customerId, service: j.service, address: j.address, status: j.status })),
    };
}

/* ── the Home page (server side) ─────────────────────────────────────────── */

export function samplePipeline(trade: SampleTrade, now: Date): { customers: PipelineCustomer[]; tasks: PipelineTask[] } {
    return {
        customers: sampleCustomers(trade, now).map((c) => ({
            customerId: c.customerId,
            name: c.name,
            phone: c.phone,
            stage: c.stage,
            value: c.value,
            archived: false,
            stageChangedAt: c.lastContactAt ?? c.createdAt,
            reviewSent: null,
            stale: c.stale,
        })),
        tasks: tasksFor(now).map((t) => ({ ...t })),
    };
}

/** Is this one of the tour's own records? Writes to these never leave the browser. */
export function isTourId(id: string | null | undefined): boolean {
    return Boolean(id && id.startsWith(TOUR_ID_PREFIX));
}
