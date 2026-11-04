import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { normalizeE164 } from "./phone";

/**
 * CRM v2 — customers, their timeline, their tasks, and their SMS thread.
 *
 * **This is state, not cache.** A miss changes what renders; it is not a slow path. So unlike
 * everything in `portal-kv.ts` it is written on mutation and never served from a short TTL.
 *
 * The v1 model attached pipeline state to *every caller automatically*, which made it a call
 * tracker with stages rather than a CRM. v2 inverts that: the Inbox is raw inbound, and a
 * **customer only exists because the client deliberately promoted one** (or added them by hand).
 * The `v2` key namespace is a clean break — v1 keys are abandoned, not migrated.
 *
 * Every key carries `acctScope` (`accountScope(account.email)`), the invariant from
 * `portal-kv.ts`: these records are derived from caller PII and must never be reachable from
 * another account's scope. The one exception is `numberOwnerKey`, which is deliberately global —
 * see its note.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) {
        if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
            throw new Error("Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN");
        }
        _redis = Redis.fromEnv();
    }
    return _redis;
}

/* ── pipeline ─────────────────────────────────────────────────────────────── */

export const PIPELINE_STAGES = [
    "lead",
    "contacted",
    "quoted",
    "scheduled",
    "won",
    "lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export function isPipelineStage(v: unknown): v is PipelineStage {
    return typeof v === "string" && (PIPELINE_STAGES as readonly string[]).includes(v);
}

/**
 * How long a customer may sit in a stage before the board flags it as going cold.
 *
 * Terminal stages never go stale — a won job that closed in March is not a problem. The rest
 * are tuned to how a trade actually works: a brand-new lead left for three days is already a
 * lost job, while a booked job two weeks out is simply the schedule.
 */
const STALE_DAYS: Record<PipelineStage, number | null> = {
    lead: 3,
    contacted: 5,
    quoted: 7,
    scheduled: 14,
    won: null,
    lost: null,
};

export function isStale(stage: PipelineStage, stageChangedAt: string, now = Date.now()): boolean {
    const days = STALE_DAYS[stage];
    if (days === null) return false;
    const t = new Date(stageChangedAt).getTime();
    if (Number.isNaN(t)) return false;
    return now - t > days * 86_400_000;
}

/* ── records ──────────────────────────────────────────────────────────────── */

export interface Customer {
    customerId: string;
    name: string | null;
    /** E.164. Null for a manual record with no number — such a customer cannot be texted. */
    phone: string | null;
    email: string | null;
    address: string | null;
    stage: PipelineStage;
    /** Whole dollars. Chosen over minor units because a client types "1850", not "185000". */
    value: number | null;
    tags: string[];
    note: string | null;
    archived: boolean;
    source: "call" | "web-form" | "manual";
    /** Airtable record id or leadId this was promoted from. Null for manual adds. */
    sourceRef: string | null;
    /**
     * When they first got in touch, as opposed to when the client got round to promoting them.
     *
     * `createdAt` used to carry both jobs, so a customer promoted from a week-old call read as
     * having appeared today. Optional because records written before this did not have it —
     * read it as `firstContactAt ?? createdAt` and no migration is needed.
     */
    firstContactAt?: string | null;
    createdAt: string;
    updatedAt: string;
    updatedBy: string;
    /** Drives the stale indicator — reset whenever `stage` changes, not on every edit. */
    stageChangedAt: string;
    lastContactAt: string | null;
    reviewSent: ReviewSendRecord | null;
}

export type ActivityKind =
    | "call"
    | "web-form"
    | "sms-out"
    | "sms-in"
    | "review-request"
    | "stage-change"
    | "note"
    | "task"
    | "file";

export interface Activity {
    id: string;
    kind: ActivityKind;
    at: string;
    /** One plain-language line. The timeline renders this verbatim — never a raw field dump. */
    summary: string;
    meta?: Record<string, unknown>;
    actor: "customer" | "client" | "system";
}

export interface Task {
    taskId: string;
    customerId: string;
    title: string;
    dueAt: string | null;
    done: boolean;
    createdAt: string;
}

export interface Message {
    id: string;
    direction: "in" | "out";
    body: string;
    at: string;
    messageSid: string | null;
    status: "queued" | "sent" | "delivered" | "undelivered" | "failed" | "received";
    sentBy?: string;
}

export type ReviewDeliveryStatus =
    | "queued"
    | "sent"
    | "delivered"
    | "undelivered"
    | "failed"
    | "unknown";

/**
 * The record that enforces one-review-per-number, and tracks delivery and opt-out.
 *
 * Keyed by E.164 under the account scope — a number is a person, so the block holds across all
 * of a client's sites. Written with **no TTL**: this is the evidence the button is permanently
 * locked for that caller, and there is deliberately no delete path.
 */
export interface ReviewSendRecord {
    e164: string;
    sentAt: string;
    sentBy: string;
    siteSlug: string;
    messageSid: string | null;
    deliveryStatus: ReviewDeliveryStatus;
    optedOut: boolean;
}

/* ── keys ─────────────────────────────────────────────────────────────────── */

/**
 * Long backstop expiry rather than none, mirroring `lastVisitKey` in `portal-kv.ts`: a dormant
 * account eventually stops occupying keys, but within any realistic active window this is
 * permanent. Refreshed on every write.
 */
const STATE_TTL = 60 * 60 * 24 * 400;

const customerKey = (a: string, s: string, id: string) => `portal:crm:v2:customer:${a}:${s}:${id}`;
const customerIndex = (a: string, s: string) => `portal:crm:v2:index:${a}:${s}`;
const phoneIndex = (a: string, s: string, e164: string) => `portal:crm:v2:phone:${a}:${s}:${e164}`;
const activityKey = (a: string, s: string, id: string) => `portal:crm:v2:activity:${a}:${s}:${id}`;
const threadKey = (a: string, s: string, id: string) => `portal:crm:v2:thread:${a}:${s}:${id}`;
const unreadIndex = (a: string, s: string) => `portal:crm:v2:unread:${a}:${s}`;
const taskKey = (a: string, s: string, id: string) => `portal:crm:v2:task:${a}:${s}:${id}`;
const taskIndex = (a: string, s: string) => `portal:crm:v2:tasks:${a}:${s}`;
/** Source ids (Airtable record / leadId) already promoted, so the Inbox can mark them. */
const promotedIndex = (a: string, s: string) => `portal:crm:v2:promoted:${a}:${s}`;
/** Source ids the client has put away. Same id space as `promotedIndex` and the deep links. */
const archivedIndex = (a: string, s: string) => `portal:crm:v2:archived:${a}:${s}`;
/** When and by whom, one small record per archived id. `reason` is room for a later "spam". */
const archivedAtKey = (a: string, s: string, id: string) =>
    `portal:crm:v2:archived-at:${a}:${s}:${id}`;
const reviewSentKey = (a: string, e164: string) => `portal:review:sent:v1:${a}:${e164}`;

/**
 * Number → owning site. **Global by design**, not account-scoped.
 *
 * Inbound SMS arrives at one shared webhook carrying only the `To` number, so this is the only
 * way to resolve which client it belongs to. It holds no PII — a business's own published
 * number and the slug it maps to.
 *
 * MUST be deleted at teardown: a recycled Twilio number would otherwise route a stranger's
 * inbound SMS into the previous client's thread.
 */
const numberOwnerKey = (e164: string) => `portal:number-owner:v1:${e164}`;

/* ── customers ────────────────────────────────────────────────────────────── */

function newId(): string {
    // Time-prefixed so ids sort by creation without a ULID dependency.
    return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

export async function listCustomers(acct: string, slug: string): Promise<Customer[]> {
    const redis = getRedis();
    const ids = await redis.smembers(customerIndex(acct, slug));
    if (!ids || ids.length === 0) return [];

    const rows = (await redis.mget(
        ...ids.map((id) => customerKey(acct, slug, id)),
    )) as (Customer | null)[];

    const customers = rows.filter((c): c is Customer => c !== null);
    // Newest activity first — the board's and table's default reading order.
    customers.sort((a, b) => timeOf(b.lastContactAt ?? b.createdAt) - timeOf(a.lastContactAt ?? a.createdAt));
    return customers;
}

export async function getCustomer(
    acct: string,
    slug: string,
    customerId: string,
): Promise<Customer | null> {
    return getRedis().get<Customer>(customerKey(acct, slug, customerId));
}

/** The customer already holding this number on this site, if any. The promotion dedupe. */
export async function findCustomerByPhone(
    acct: string,
    slug: string,
    phone: string | null,
): Promise<Customer | null> {
    const e164 = normalizeE164(phone ?? "");
    if (!e164) return null;
    const id = await getRedis().get<string>(phoneIndex(acct, slug, e164));
    return id ? getCustomer(acct, slug, id) : null;
}

export interface CreateCustomerInput {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    stage?: PipelineStage;
    value?: number | null;
    note?: string | null;
    tags?: string[];
    source: Customer["source"];
    sourceRef?: string | null;
    firstContactAt?: string | null;
}

/**
 * Create a customer, or return the existing one when this number is already on the board.
 *
 * Returning the existing record rather than erroring is deliberate: from the client's side
 * "promote" on someone they already track is not a mistake, it is a navigation. The caller
 * tells them it was already there.
 */
export async function createCustomer(
    acct: string,
    slug: string,
    input: CreateCustomerInput,
    byUser: string,
): Promise<{ customer: Customer; existed: boolean }> {
    const e164 = normalizeE164(input.phone ?? "");

    const existing = await findCustomerByPhone(acct, slug, e164);
    if (existing) {
        if (input.sourceRef) await markPromoted(acct, slug, input.sourceRef);
        return { customer: existing, existed: true };
    }

    const now = new Date().toISOString();
    const customer: Customer = {
        customerId: newId(),
        name: input.name?.trim() || null,
        phone: e164,
        email: input.email?.trim() || null,
        address: input.address?.trim() || null,
        stage: input.stage ?? "lead",
        value: input.value ?? null,
        tags: input.tags ?? [],
        note: input.note?.trim() || null,
        archived: false,
        source: input.source,
        sourceRef: input.sourceRef ?? null,
        firstContactAt: input.firstContactAt ?? null,
        createdAt: now,
        updatedAt: now,
        updatedBy: byUser,
        stageChangedAt: now,
        lastContactAt: null,
        reviewSent: null,
    };

    const redis = getRedis();
    await redis.set(customerKey(acct, slug, customer.customerId), customer, { ex: STATE_TTL });
    await redis.sadd(customerIndex(acct, slug), customer.customerId);
    await redis.expire(customerIndex(acct, slug), STATE_TTL);
    if (e164) {
        await redis.set(phoneIndex(acct, slug, e164), customer.customerId, { ex: STATE_TTL });
    }
    if (input.sourceRef) await markPromoted(acct, slug, input.sourceRef);

    return { customer, existed: false };
}

export interface CustomerPatch {
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    stage?: PipelineStage;
    value?: number | null;
    note?: string | null;
    tags?: string[];
    archived?: boolean;
    lastContactAt?: string | null;
}

/**
 * A patch either lands or it does not, and the caller has to tell the client which.
 *
 * It used to return `Customer | null`, where null meant only "no such customer". Now that a
 * phone edit can be refused on its own merits, the two outcomes need telling apart — a
 * collision reported as a 404 would read to the client as "your customer disappeared".
 */
export type UpdateResult =
    | { ok: true; customer: Customer }
    | { ok: false; reason: "not-found" | "phone-taken" };

export async function updateCustomer(
    acct: string,
    slug: string,
    customerId: string,
    patch: CustomerPatch,
    byUser: string,
): Promise<UpdateResult> {
    const redis = getRedis();
    const existing = await getCustomer(acct, slug, customerId);
    if (!existing) return { ok: false, reason: "not-found" };

    const now = new Date().toISOString();
    const stageChanged = patch.stage !== undefined && patch.stage !== existing.stage;

    const next: Customer = {
        ...existing,
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.email !== undefined ? { email: patch.email } : {}),
        ...(patch.address !== undefined ? { address: patch.address } : {}),
        ...(patch.stage !== undefined ? { stage: patch.stage } : {}),
        ...(patch.value !== undefined ? { value: patch.value } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
        ...(patch.archived !== undefined ? { archived: patch.archived } : {}),
        ...(patch.lastContactAt !== undefined ? { lastContactAt: patch.lastContactAt } : {}),
        updatedAt: now,
        updatedBy: byUser,
        // Only a real stage move resets the staleness clock. Editing a note must not make an
        // eight-day-old quote look freshly worked.
        stageChangedAt: stageChanged ? now : existing.stageChangedAt,
    };

    // A phone change has to move the dedupe index with it, or the old number keeps resolving.
    if (patch.phone !== undefined) {
        const e164 = normalizeE164(patch.phone ?? "");

        /**
         * Refuse a number another customer already holds.
         *
         * The index maps one number to one customer, and this used to overwrite it — so
         * correcting a typo into a number already on the board silently re-pointed it, and the
         * customer who really owned it stopped being found by phone: their inbound SMS and
         * every promotion dedupe would land on the wrong record. Failing the edit is the only
         * safe answer; merging two customers is a decision we do not get to make here.
         */
        if (e164 && e164 !== existing.phone) {
            const holder = await redis.get<string>(phoneIndex(acct, slug, e164));
            if (holder && holder !== customerId) return { ok: false, reason: "phone-taken" };
        }

        if (existing.phone && existing.phone !== e164) {
            await redis.del(phoneIndex(acct, slug, existing.phone));
        }
        next.phone = e164;
        if (e164) await redis.set(phoneIndex(acct, slug, e164), customerId, { ex: STATE_TTL });
    }

    await redis.set(customerKey(acct, slug, customerId), next, { ex: STATE_TTL });

    if (stageChanged) {
        await appendActivity(acct, slug, customerId, {
            kind: "stage-change",
            summary: `Moved to ${STAGE_LABEL[next.stage]}`,
            actor: "client",
            meta: { from: existing.stage, to: next.stage },
        });
    }
    return { ok: true, customer: next };
}

export const STAGE_LABEL: Record<PipelineStage, string> = {
    lead: "Lead",
    contacted: "Contacted",
    quoted: "Quoted",
    scheduled: "Scheduled",
    won: "Won",
    lost: "Lost",
};

/* ── promotion bookkeeping ────────────────────────────────────────────────── */

export async function markPromoted(acct: string, slug: string, sourceRef: string): Promise<void> {
    const redis = getRedis();
    await redis.sadd(promotedIndex(acct, slug), sourceRef);
    await redis.expire(promotedIndex(acct, slug), STATE_TTL);
}

/** Which inbox source ids have already been promoted, so the list can mark them. */
export async function promotedRefs(acct: string, slug: string): Promise<Set<string>> {
    const refs = (await getRedis().smembers<string[]>(promotedIndex(acct, slug))) ?? [];
    return new Set(refs);
}

/* ── archiving ────────────────────────────────────────────────────────────── */

export interface ArchiveRecord {
    at: string;
    by: string;
    /** Unused today. Here so "not a lead" can be recorded later without a migration. */
    reason?: string;
}

/**
 * Put inbox items away, or bring them back.
 *
 * Takes a list because the Inbox archives a whole row at once, and a row is usually every call
 * one person made. Archiving records **the ids that exist now**, never the phone number: a
 * number would be a mute, and the next call from a customer who rang three times last week is
 * new work, not something already dealt with.
 *
 * Portal-side for calls as well as leads. A call's row belongs to the client's own Airtable log,
 * which this portal reads and does not write, so putting one away is our state about their
 * record rather than a change to it.
 */
export async function setArchived(
    acct: string,
    slug: string,
    ids: string[],
    archived: boolean,
    byUser: string,
): Promise<void> {
    if (ids.length === 0) return;
    const redis = getRedis();

    if (archived) {
        await redis.sadd(archivedIndex(acct, slug), ids[0], ...ids.slice(1));
        await redis.expire(archivedIndex(acct, slug), STATE_TTL);
        const record: ArchiveRecord = { at: new Date().toISOString(), by: byUser };
        await Promise.all(
            ids.map((id) =>
                redis.set(archivedAtKey(acct, slug, id), record, { ex: STATE_TTL }),
            ),
        );
        return;
    }

    await redis.srem(archivedIndex(acct, slug), ids[0], ...ids.slice(1));
    await Promise.all(ids.map((id) => redis.del(archivedAtKey(acct, slug, id))));
}

/** Which inbox ids are put away, so the list can hide them from the worklist. */
export async function archivedRefs(acct: string, slug: string): Promise<Set<string>> {
    const refs = (await getRedis().smembers<string[]>(archivedIndex(acct, slug))) ?? [];
    return new Set(refs);
}

/**
 * Delete every archive key for one site. **For teardown.**
 *
 * `purgeLeads` in `portal-leads.ts` is the other half and has no caller in this repository —
 * teardown runs from the ops console. This has to be called beside it, or a torn-down account
 * leaves a set of its callers' Airtable record ids behind for the full 400-day backstop.
 */
export async function purgeArchive(acct: string, slug: string): Promise<number> {
    const redis = getRedis();
    const ids = (await redis.smembers<string[]>(archivedIndex(acct, slug))) ?? [];
    if (ids.length > 0) {
        await redis.del(...ids.map((id) => archivedAtKey(acct, slug, id)));
    }
    await redis.del(archivedIndex(acct, slug));
    return ids.length;
}

/* ── activity timeline ────────────────────────────────────────────────────── */

export async function appendActivity(
    acct: string,
    slug: string,
    customerId: string,
    input: Omit<Activity, "id" | "at"> & { at?: string },
): Promise<Activity> {
    const activity: Activity = {
        id: newId(),
        at: input.at ?? new Date().toISOString(),
        kind: input.kind,
        summary: input.summary,
        actor: input.actor,
        ...(input.meta ? { meta: input.meta } : {}),
    };
    const redis = getRedis();
    await redis.rpush(activityKey(acct, slug, customerId), activity);
    await redis.expire(activityKey(acct, slug, customerId), STATE_TTL);
    return activity;
}

/** Stored activity for one customer, newest first. */
export async function listActivity(
    acct: string,
    slug: string,
    customerId: string,
): Promise<Activity[]> {
    const rows = (await getRedis().lrange<Activity>(activityKey(acct, slug, customerId), 0, -1)) ?? [];
    return rows.sort((a, b) => timeOf(b.at) - timeOf(a.at));
}

/* ── tasks ────────────────────────────────────────────────────────────────── */

export async function listTasks(acct: string, slug: string): Promise<Task[]> {
    const redis = getRedis();
    const ids = await redis.smembers(taskIndex(acct, slug));
    if (!ids || ids.length === 0) return [];
    const rows = (await redis.mget(...ids.map((id) => taskKey(acct, slug, id)))) as (Task | null)[];
    return rows.filter((t): t is Task => t !== null);
}

export async function createTask(
    acct: string,
    slug: string,
    customerId: string,
    title: string,
    dueAt: string | null,
): Promise<Task> {
    const task: Task = {
        taskId: newId(),
        customerId,
        title: title.trim().slice(0, 200),
        dueAt,
        done: false,
        createdAt: new Date().toISOString(),
    };
    const redis = getRedis();
    await redis.set(taskKey(acct, slug, task.taskId), task, { ex: STATE_TTL });
    await redis.sadd(taskIndex(acct, slug), task.taskId);
    await redis.expire(taskIndex(acct, slug), STATE_TTL);
    return task;
}

export async function setTaskDone(
    acct: string,
    slug: string,
    taskId: string,
    done: boolean,
): Promise<Task | null> {
    const redis = getRedis();
    const task = await redis.get<Task>(taskKey(acct, slug, taskId));
    if (!task) return null;
    const next = { ...task, done };
    await redis.set(taskKey(acct, slug, taskId), next, { ex: STATE_TTL });
    return next;
}

/* ── messages ─────────────────────────────────────────────────────────────── */

export async function listMessages(
    acct: string,
    slug: string,
    customerId: string,
): Promise<Message[]> {
    return (await getRedis().lrange<Message>(threadKey(acct, slug, customerId), 0, -1)) ?? [];
}

export async function appendMessage(
    acct: string,
    slug: string,
    customerId: string,
    message: Omit<Message, "id">,
): Promise<Message> {
    const full: Message = { id: newId(), ...message };
    const redis = getRedis();
    await redis.rpush(threadKey(acct, slug, customerId), full);
    await redis.expire(threadKey(acct, slug, customerId), STATE_TTL);
    if (message.direction === "in") {
        await redis.sadd(unreadIndex(acct, slug), customerId);
        await redis.expire(unreadIndex(acct, slug), STATE_TTL);
    }
    return full;
}

export async function unreadCustomerIds(acct: string, slug: string): Promise<Set<string>> {
    const ids = (await getRedis().smembers<string[]>(unreadIndex(acct, slug))) ?? [];
    return new Set(ids);
}

export async function markThreadRead(acct: string, slug: string, customerId: string): Promise<void> {
    await getRedis().srem(unreadIndex(acct, slug), customerId);
}

/* ── number → site routing ────────────────────────────────────────────────── */

export interface NumberOwner {
    acctScope: string;
    slug: string;
}

export async function setNumberOwner(e164: string, owner: NumberOwner): Promise<void> {
    const n = normalizeE164(e164);
    if (!n) return;
    await getRedis().set(numberOwnerKey(n), owner);
}

/**
 * The owner's email, stored under their own account scope.
 *
 * `accountScope` is a one-way hash, so a webhook holding only the scope cannot recover the
 * address — but it needs one to check SMS consent before notifying. Kept **account-scoped**
 * rather than on the global `numberOwnerKey`, which deliberately holds no personal data.
 */
const ownerEmailKey = (acct: string) => `portal:crm:v2:owner-email:${acct}`;

export async function setOwnerEmail(acct: string, email: string): Promise<void> {
    await getRedis().set(ownerEmailKey(acct), email, { ex: STATE_TTL });
}

export async function getOwnerEmail(acct: string): Promise<string | null> {
    return getRedis().get<string>(ownerEmailKey(acct));
}

export async function getNumberOwner(e164: string): Promise<NumberOwner | null> {
    const n = normalizeE164(e164);
    if (!n) return null;
    const raw = await getRedis().get<NumberOwner | string>(numberOwnerKey(n));
    if (!raw) return null;
    // Tolerates the v1 review-only index, which stored a bare acctScope string.
    return typeof raw === "string" ? null : raw;
}

/* ── review requests (carried over from v1, unchanged semantics) ──────────── */

export async function getReviewSend(acct: string, e164: string): Promise<ReviewSendRecord | null> {
    const n = normalizeE164(e164);
    if (!n) return null;
    return getRedis().get<ReviewSendRecord>(reviewSentKey(acct, n));
}

export async function getReviewSends(
    acct: string,
    e164s: string[],
): Promise<Map<string, ReviewSendRecord>> {
    const map = new Map<string, ReviewSendRecord>();
    const valid = Array.from(
        new Set(e164s.map((e) => normalizeE164(e)).filter((e): e is string => Boolean(e))),
    );
    if (valid.length === 0) return map;
    const rows = (await getRedis().mget(
        ...valid.map((e) => reviewSentKey(acct, e)),
    )) as (ReviewSendRecord | null)[];
    valid.forEach((e, i) => {
        const r = rows[i];
        if (r) map.set(e, r);
    });
    return map;
}

export async function recordReviewSend(input: {
    acctScope: string;
    e164: string;
    sentBy: string;
    siteSlug: string;
    messageSid: string | null;
    deliveryStatus?: ReviewDeliveryStatus;
}): Promise<ReviewSendRecord> {
    const n = normalizeE164(input.e164);
    if (!n) throw new Error(`recordReviewSend: not an E.164 number: ${input.e164}`);

    const rec: ReviewSendRecord = {
        e164: n,
        sentAt: new Date().toISOString(),
        sentBy: input.sentBy,
        siteSlug: input.siteSlug,
        messageSid: input.messageSid,
        deliveryStatus: input.deliveryStatus ?? "queued",
        optedOut: false,
    };
    await getRedis().set(reviewSentKey(input.acctScope, n), rec);
    return rec;
}

export async function markReviewDelivery(
    acct: string,
    e164: string,
    status: ReviewDeliveryStatus,
    messageSid?: string | null,
): Promise<void> {
    const n = normalizeE164(e164);
    if (!n) return;
    const key = reviewSentKey(acct, n);
    const rec = await getRedis().get<ReviewSendRecord>(key);
    if (!rec) return;
    await getRedis().set(key, {
        ...rec,
        deliveryStatus: status,
        ...(messageSid ? { messageSid } : {}),
    });
}

/**
 * Honour an inbound STOP in our own records.
 *
 * Twilio's Advanced Opt-Out blocks the number at the Messaging Service either way; this keeps
 * `review:sent:*` truthful so the UI never offers to text someone who opted out.
 */
export async function markReviewOptOut(acct: string, e164: string): Promise<void> {
    const n = normalizeE164(e164);
    if (!n) return;
    const key = reviewSentKey(acct, n);
    const rec = await getRedis().get<ReviewSendRecord>(key);
    if (!rec) return;
    await getRedis().set(key, { ...rec, optedOut: true });
}

function timeOf(iso: string | null): number {
    if (!iso) return 0;
    const t = new Date(iso).getTime();
    return Number.isNaN(t) ? 0 : t;
}
