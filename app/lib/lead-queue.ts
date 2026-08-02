import "server-only";
import { Redis } from "@upstash/redis";

/**
 * Lead queue (producer side).
 *
 * Two entry points on this site create leads, and neither of them is a purchase:
 *   1. the hero interest form  → `POST /api/lead`      → source: "form"
 *   2. the demo agent call     → `POST /api/lead/call` → source: "call"
 *
 * The jdd-ops console (local-only) pulls these over HTTPS REST and renders them as a
 * Kanban at /leads. Namespaced under `jdd:lead:*` and `jdd:democall:*` so they never
 * collide with `jdd:intake:*` (won customers, mid-onboarding) or `agreement:*` in the
 * same Upstash instance.
 *
 * This is deliberately a near-copy of intake-queue.ts rather than a shared abstraction:
 * the two queues answer different questions and are free to drift. The ONE difference
 * that matters is spelled out at NO_TTL below.
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

export type LeadStage = "new" | "qualified" | "quoted" | "won" | "lost";
export type LeadSource = "form" | "call";
export type PlanInterest = "starter" | "growth" | "enterprise";

/** One entry in a lead's history. Written by both this site and the console. */
export interface LeadActivity {
  at: number;
  kind: string;
  text: string;
}

export interface QueuedLead {
  id: string;
  /** Epoch ms — doubles as the sorted-set score. */
  receivedAt: number;
  source: LeadSource;
  stage: LeadStage;
  /** Fractional sort position within its column; absent = never dragged. */
  order?: number;
  name: string;
  businessName: string;
  phone: string;
  email?: string;
  planInterest: PlanInterest | null;
  /** Free-text from the form, or the trade the agent extracted on a call. */
  note?: string;
  trade?: string;
  /** → jdd:democall:item:{callId}, for source: "call". */
  callId?: string;
  notes?: string;
  activity: LeadActivity[];
  lostReason?: string;
  updatedAt?: number;
  /** Set by the console once this lead shows up as a real client. */
  convertedSlug?: string;
}

/**
 * One call to the demo number. EVERY call gets one of these, including the anonymous
 * ones that never become leads — that's the point of keeping it separate from the
 * funnel. The console's Calls tab reads this; the board does not.
 */
export interface DemoCall {
  callId: string;
  at: number;
  fromNumber: string | null;
  durationMs: number | null;
  outcome: string | null;
  disconnectionReason: string | null;
  summary: string | null;
  recordingUrl: string | null;
  /** Set when this call also produced a card, so the tab can mark it. */
  leadId?: string;
}

const leadKey = (id: string) => `jdd:lead:item:${id}`;
const LEAD_INDEX = "jdd:lead:index";
/** Reverse index so the webhook can answer "did this call already make a lead?" exactly. */
const leadByCallKey = (callId: string) => `jdd:lead:by-call:${callId}`;

const callKey = (callId: string) => `jdd:democall:item:${callId}`;
const CALL_INDEX = "jdd:democall:index";

/**
 * NO_TTL — intentional divergence from intake-queue.ts.
 *
 * That file expires items after 30 days, which is right for a claim queue: an intake is
 * transient, it gets imported and it's gone. A LEAD is not transient. A funnel that
 * silently deletes cards a month after they arrive isn't a feature, it's a bug that
 * looks like forgetfulness. So leads and demo calls are written without expiry and are
 * removed only when something deliberately removes them.
 */

/** Store a lead and add it to the index (scored by arrival). */
export async function enqueueLead(rec: QueuedLead): Promise<void> {
  const r = getRedis();
  await r.set(leadKey(rec.id), rec);
  await r.zadd(LEAD_INDEX, { score: rec.receivedAt, member: rec.id });
  if (rec.callId) await r.set(leadByCallKey(rec.callId), rec.id);
}

/** The lead a given demo call already produced, if any. Used for webhook idempotency. */
export async function leadIdForCall(callId: string): Promise<string | null> {
  return getRedis().get<string>(leadByCallKey(callId));
}

/** Upsert a demo-call record. Idempotent — a redelivered webhook overwrites in place. */
export async function upsertDemoCall(rec: DemoCall): Promise<void> {
  const r = getRedis();
  await r.set(callKey(rec.callId), rec);
  await r.zadd(CALL_INDEX, { score: rec.at, member: rec.callId });
}

/** Slugify a business name the same way intake does, so conversion matching lines up. */
export function slugifyBusiness(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
}
