import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";
import { scoreOf, type Appointment, type ApptFields } from "./crm-calendar";

/**
 * The portal calendar's appointments: the I/O half. Shapes, parsing and time maths are
 * `crm-calendar.ts`.
 *
 * A line-for-line cousin of the console's `meetingQueue.ts`: one record per appointment and one
 * sorted set scored chronologically (`scoreOf`), so an ascending range reads in time order, and
 * a read prunes index entries whose record is gone rather than returning holes.
 *
 * Unlike the console's, every key is account- and site-scoped under `portal:crm:v2:`, the CRM
 * rule from `portal-crm.ts`: an id from another account names a key that does not exist here.
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

const STATE_TTL = 60 * 60 * 24 * 400;
const apptKey = (a: string, s: string, id: string) => `portal:crm:v2:appt:${a}:${s}:${id}`;
const apptIndex = (a: string, s: string) => `portal:crm:v2:appts:${a}:${s}`;

function newId(): string {
    return `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
}

/** Every appointment on the site, earliest first. */
export async function listAppointments(acct: string, slug: string): Promise<Appointment[]> {
    const redis = getRedis();
    const ids = ((await redis.zrange(apptIndex(acct, slug), 0, -1)) ?? []) as string[];
    if (ids.length === 0) return [];
    const rows = (await redis.mget(...ids.map((id) => apptKey(acct, slug, id)))) as (Appointment | null)[];
    const gone = ids.filter((_, i) => rows[i] === null);
    if (gone.length) await redis.zrem(apptIndex(acct, slug), ...gone);
    return rows.filter((r): r is Appointment => r !== null);
}

export async function getAppointment(acct: string, slug: string, id: string): Promise<Appointment | null> {
    return getRedis().get<Appointment>(apptKey(acct, slug, id));
}

async function write(acct: string, slug: string, a: Appointment): Promise<void> {
    const redis = getRedis();
    await redis.set(apptKey(acct, slug, a.id), a, { ex: STATE_TTL });
    await redis.zadd(apptIndex(acct, slug), { score: scoreOf(a.day, a.startMinutes), member: a.id });
    await redis.expire(apptIndex(acct, slug), STATE_TTL);
}

export async function createAppointment(acct: string, slug: string, fields: ApptFields): Promise<Appointment> {
    const now = new Date().toISOString();
    const a: Appointment = { id: newId(), ...fields, createdAt: now, updatedAt: now };
    await write(acct, slug, a);
    return a;
}

export async function updateAppointment(
    acct: string,
    slug: string,
    id: string,
    patch: Partial<ApptFields>,
): Promise<Appointment | null> {
    const existing = await getAppointment(acct, slug, id);
    if (!existing) return null;
    const next: Appointment = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    if (!next.customerId) next.jobId = null;
    await write(acct, slug, next); // re-scores when the day or the time moved
    return next;
}

export async function deleteAppointment(acct: string, slug: string, id: string): Promise<Appointment | null> {
    const existing = await getAppointment(acct, slug, id);
    if (!existing) return null;
    const redis = getRedis();
    await redis.del(apptKey(acct, slug, id));
    await redis.zrem(apptIndex(acct, slug), id);
    return existing;
}

/** A job's visits go with it ("Delete this job and its visits?"). Returns how many. */
export async function deleteAppointmentsForJob(acct: string, slug: string, jobId: string): Promise<number> {
    const mine = (await listAppointments(acct, slug)).filter((a) => a.jobId === jobId);
    for (const a of mine) await deleteAppointment(acct, slug, a.id);
    return mine.length;
}
