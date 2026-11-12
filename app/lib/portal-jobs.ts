import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { getCustomer, updateCustomer } from "./portal-crm";
import {
    jobsTotal,
    type CustomerNote,
    type Job,
    type JobFields,
} from "./crm-jobs";

/**
 * Jobs and notes on a customer: the I/O half. The shapes and the parsing are `crm-jobs.ts`.
 *
 * Same rules as the rest of CRM v2 in `portal-crm.ts`: **state, not cache**, written on mutation
 * and never served from a short TTL; every key carries `acctScope` (`accountScope(email)`), so a
 * record is only reachable from the account that wrote it. A job id from another account names a
 * key that does not exist in this one, and reads as "no such job".
 *
 * Keys, under the same `portal:crm:v2:` namespace:
 * - `job:{a}:{s}:{jobId}` one job; `jobs:{a}:{s}:{customerId}` that customer's job ids;
 *   `jobs-all:{a}:{s}` every job id on the site, for the calendar's job picker.
 * - `note:{a}:{s}:{noteId}` one note; `notes:{a}:{s}:{customerId}` that customer's note ids.
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

/** The same long backstop as `portal-crm.ts`, refreshed on every write. */
const STATE_TTL = 60 * 60 * 24 * 400;

const jobKey = (a: string, s: string, id: string) => `portal:crm:v2:job:${a}:${s}:${id}`;
const customerJobs = (a: string, s: string, c: string) => `portal:crm:v2:jobs:${a}:${s}:${c}`;
const siteJobs = (a: string, s: string) => `portal:crm:v2:jobs-all:${a}:${s}`;
const noteKey = (a: string, s: string, id: string) => `portal:crm:v2:note:${a}:${s}:${id}`;
const customerNotes = (a: string, s: string, c: string) => `portal:crm:v2:notes:${a}:${s}:${c}`;

function newId(): string {
    // Time-prefixed so ids sort by creation, as in `portal-crm.ts`.
    return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

async function readMany<T>(keys: string[]): Promise<T[]> {
    if (keys.length === 0) return [];
    const rows = (await getRedis().mget(...keys)) as (T | null)[];
    return rows.filter((r): r is T => r !== null);
}

/* ── jobs ─────────────────────────────────────────────────────────────────── */

/** One customer's jobs, newest first. */
export async function listJobs(acct: string, slug: string, customerId: string): Promise<Job[]> {
    const ids = (await getRedis().smembers(customerJobs(acct, slug, customerId))) ?? [];
    const jobs = await readMany<Job>(ids.map((id) => jobKey(acct, slug, id)));
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Every job on the site. For the calendar, which offers a customer's jobs to book a visit for. */
export async function listSiteJobs(acct: string, slug: string): Promise<Job[]> {
    const ids = (await getRedis().smembers(siteJobs(acct, slug))) ?? [];
    return readMany<Job>(ids.map((id) => jobKey(acct, slug, id)));
}

export async function getJob(acct: string, slug: string, jobId: string): Promise<Job | null> {
    return getRedis().get<Job>(jobKey(acct, slug, jobId));
}

/** Null when the customer is not this account's. */
export async function createJob(
    acct: string,
    slug: string,
    customerId: string,
    fields: JobFields,
): Promise<Job | null> {
    const customer = await getCustomer(acct, slug, customerId);
    if (!customer) return null;
    const now = new Date().toISOString();
    const job: Job = {
        jobId: newId(),
        customerId,
        ...fields,
        // A new job is usually at the customer's own address; the client can change it.
        address: fields.address ?? customer.address ?? null,
        createdAt: now,
        updatedAt: now,
    };
    const redis = getRedis();
    await redis.set(jobKey(acct, slug, job.jobId), job, { ex: STATE_TTL });
    await redis.sadd(customerJobs(acct, slug, customerId), job.jobId);
    await redis.expire(customerJobs(acct, slug, customerId), STATE_TTL);
    await redis.sadd(siteJobs(acct, slug), job.jobId);
    await redis.expire(siteJobs(acct, slug), STATE_TTL);
    return job;
}

export async function updateJob(
    acct: string,
    slug: string,
    jobId: string,
    patch: Partial<JobFields>,
): Promise<Job | null> {
    const existing = await getJob(acct, slug, jobId);
    if (!existing) return null;
    const next: Job = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    await getRedis().set(jobKey(acct, slug, jobId), next, { ex: STATE_TTL });
    return next;
}

/** The deleted job, or null when there was none. */
export async function deleteJob(acct: string, slug: string, jobId: string): Promise<Job | null> {
    const existing = await getJob(acct, slug, jobId);
    if (!existing) return null;
    const redis = getRedis();
    await redis.del(jobKey(acct, slug, jobId));
    await redis.srem(customerJobs(acct, slug, existing.customerId), jobId);
    await redis.srem(siteJobs(acct, slug), jobId);
    return existing;
}

/**
 * Point the customer's value at their jobs.
 *
 * The board, the table and the Overview all read `Customer.value`, so writing the total there
 * is what makes "the board shows the jobs total" true everywhere without touching any of them.
 * Run after every job change. A customer with no jobs left goes back to no value: the jobs were
 * what it was counting. One who never had a job is never touched, so a value typed in by hand
 * before jobs existed stays until their first job.
 */
export async function syncCustomerValue(
    acct: string,
    slug: string,
    customerId: string,
    byUser: string,
): Promise<void> {
    const jobs = await listJobs(acct, slug, customerId);
    const total = jobsTotal(jobs);
    const customer = await getCustomer(acct, slug, customerId);
    if (!customer || customer.value === total) return;
    await updateCustomer(acct, slug, customerId, { value: total }, byUser);
}

/* ── notes ────────────────────────────────────────────────────────────────── */

/** One customer's notes, newest first. The old single note is added by `withLegacyNote`. */
export async function listNotes(acct: string, slug: string, customerId: string): Promise<CustomerNote[]> {
    const ids = (await getRedis().smembers(customerNotes(acct, slug, customerId))) ?? [];
    const notes = await readMany<CustomerNote>(ids.map((id) => noteKey(acct, slug, id)));
    return notes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getNote(acct: string, slug: string, noteId: string): Promise<CustomerNote | null> {
    return getRedis().get<CustomerNote>(noteKey(acct, slug, noteId));
}

/** `createdAt` may be given, for the old single note turning into a real one with its own date. */
export async function createNote(
    acct: string,
    slug: string,
    customerId: string,
    body: string,
    createdAt?: string,
): Promise<CustomerNote | null> {
    if (!(await getCustomer(acct, slug, customerId))) return null;
    const note: CustomerNote = {
        noteId: newId(),
        customerId,
        body,
        createdAt: createdAt ?? new Date().toISOString(),
        updatedAt: createdAt ? new Date().toISOString() : null,
    };
    const redis = getRedis();
    await redis.set(noteKey(acct, slug, note.noteId), note, { ex: STATE_TTL });
    await redis.sadd(customerNotes(acct, slug, customerId), note.noteId);
    await redis.expire(customerNotes(acct, slug, customerId), STATE_TTL);
    return note;
}

export async function updateNote(
    acct: string,
    slug: string,
    noteId: string,
    body: string,
): Promise<CustomerNote | null> {
    const existing = await getNote(acct, slug, noteId);
    if (!existing) return null;
    const next = { ...existing, body, updatedAt: new Date().toISOString() };
    await getRedis().set(noteKey(acct, slug, noteId), next, { ex: STATE_TTL });
    return next;
}

export async function deleteNote(acct: string, slug: string, noteId: string): Promise<CustomerNote | null> {
    const existing = await getNote(acct, slug, noteId);
    if (!existing) return null;
    const redis = getRedis();
    await redis.del(noteKey(acct, slug, noteId));
    await redis.srem(customerNotes(acct, slug, existing.customerId), noteId);
    return existing;
}
