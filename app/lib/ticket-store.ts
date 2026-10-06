import "server-only";
import { Redis } from "@upstash/redis";
import {
  TICKET_INDEX,
  ticketKey,
  normalizeEmail,
  zTicket,
  type Ticket,
} from "@jdd/schema";

/**
 * Support ticket store (portal / client side).
 *
 * The client-facing half of the ticket bridge: the portal writes tickets here and the console
 * reads them. Same `jdd:ticket:item:{id}` + `jdd:ticket:index` keys the console uses, in the
 * same Upstash instance the lead funnel already shares — so this mirrors `lead-queue.ts`'s exact
 * Redis construction (not account-store's bare `Redis.fromEnv()`) to guarantee it lands on the
 * same DB the leads do.
 *
 * The canonical shape and the pure read-modify-write ops live in `@jdd/schema`; this module only
 * does I/O. There is deliberately NO TTL — support history is durable state, like the leads and
 * the account record.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
      throw new Error(
        "Vercel KV not configured — set KV_REST_API_URL and KV_REST_API_TOKEN " +
          "(provision Upstash Redis via Vercel Dashboard → Storage)",
      );
    }
    _redis = Redis.fromEnv();
  }
  return _redis;
}

/** True when KV creds are present; lets the route degrade cleanly instead of 500-ing. */
export function ticketStoreConfigured(): boolean {
  return Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
}

/** Read one ticket. Returns null when absent or when the stored shape no longer parses. */
export async function getTicket(id: string): Promise<Ticket | null> {
  const raw = await getRedis().get<unknown>(ticketKey(id));
  if (!raw) return null;
  const parsed = zTicket.safeParse(raw);
  if (!parsed.success) {
    console.error("[ticket-store] invalid ticket record", id, parsed.error.issues);
    return null;
  }
  return parsed.data;
}

/**
 * Every ticket belonging to one account + site, newest first.
 *
 * This is the security boundary: a client may only ever see tickets stamped with their own
 * account email AND the site they are scoped to. The filter is applied here, server-side, over
 * the shared global index — the client never names which tickets to read.
 */
export async function listTicketsForScope(accountEmail: string, siteSlug: string): Promise<Ticket[]> {
  const redis = getRedis();
  const email = normalizeEmail(accountEmail);
  const ids = await redis.zrange<string[]>(TICKET_INDEX, 0, -1, { rev: true });
  if (!ids.length) return [];
  const items = await Promise.all(ids.map((id) => redis.get<unknown>(ticketKey(id))));

  const out: Ticket[] = [];
  for (const raw of items) {
    if (!raw) continue;
    const parsed = zTicket.safeParse(raw);
    if (!parsed.success) continue;
    const t = parsed.data;
    if (normalizeEmail(t.accountEmail) !== email || t.siteSlug !== siteSlug) continue;
    out.push({
      ...t,
      activity: Array.isArray(t.activity) ? t.activity : [],
      messages: Array.isArray(t.messages) ? t.messages : [],
    });
  }
  return out;
}

/** Write a ticket and index it at its createdAt score. Idempotent re-index on update. */
export async function saveTicket(ticket: Ticket): Promise<void> {
  const redis = getRedis();
  await redis.set(ticketKey(ticket.id), ticket);
  await redis.zadd(TICKET_INDEX, { score: ticket.createdAt, member: ticket.id });
}
