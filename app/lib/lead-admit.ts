import "server-only";
import { randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { claimCallback } from "./lead-gate";
import { sendOpsNotice } from "./ops-notice";

/**
 * The human check for every client site's lead form, and the single-use admission it issues.
 *
 * A client site's `/api/contact` calls `/api/ingest/admit` first, with the Cloudflare Turnstile
 * token its form produced. Here the token is verified with Cloudflare, the per-visitor limits are
 * applied, and the AI callback is claimed. The answer is an `admissionId`, good for ten minutes,
 * for this site and this contact only. `/api/ingest/call-consent` and `/api/ingest/lead` then
 * require one, once each.
 *
 * **Why the agency verifies, not the client site.** The Turnstile secret never sits in a client
 * repo, and a leaked `LEAD_INGEST_TOKEN` alone can no longer write anything: every write needs a
 * fresh Turnstile solve, in a real browser, on one of that client's own hostnames.
 *
 * **Never throttle a genuine lead (operator decision, 2026-11-09).** The only refusals are a
 * failed human check and one visitor sending again and again; both are shown to the visitor in
 * approved words. Every other limit holds back a call or a text and lets the lead through.
 *
 * **Fail safe.** Cloudflare unreachable, or the secret missing: no call, and the lead is admitted
 * marked `verification: "unavailable"`, under a tighter per-visitor limit. A lead nobody can
 * call beats a lead nobody receives.
 */

let _redis: Redis | null = null;
function getRedis(): Redis {
    if (!_redis) _redis = Redis.fromEnv();
    return _redis;
}

const int = (name: string, fallback: number): number => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;
export const ADMISSION_TTL_SECONDS = 10 * MINUTE;

export function admitLimits() {
    return {
        /** One visitor (IP) on one site. Refused past these: message B. */
        ipSiteShort: int("GATE_IP_SITE_10MIN", 3),
        ipSiteDaily: int("GATE_IP_SITE_DAILY", 10),
        /** One visitor across every client site. */
        ipAllDaily: int("GATE_IP_ALL_DAILY", 20),
        /** When Cloudflare can't be asked: one per visitor per site per 10 minutes. */
        ipSiteShortUnverified: int("GATE_IP_SITE_10MIN_UNVERIFIED", 1),
        /** A site this busy is worth a look. JDD is told; nothing is held back. */
        siteHourlyNotice: int("GATE_SITE_HOURLY_NOTICE", 20),
        siteDailyNotice: int("GATE_SITE_DAILY_NOTICE", 100),
    };
}

/* ── the site's own record ──────────────────────────────────────────────── */

/**
 * Written by jdd-ops `onboard.js` next to the ingest token: the hostnames this site's form is
 * served from (a Turnstile token from anywhere else is refused), and whether this site's route
 * calls `/admit` yet. `enforce` is set once the new route is deployed, so a site still on the old
 * route keeps working (with the call and text limits) until it is re-run.
 */
export interface SiteGate {
    hostnames: string[];
    enforce: boolean;
}

export const siteGateKey = (acctScope: string, slug: string) => `portal:gate:site:v1:${acctScope}:${slug}`;

export async function getSiteGate(acctScope: string, slug: string): Promise<SiteGate | null> {
    const raw = await getRedis().get<Partial<SiteGate>>(siteGateKey(acctScope, slug));
    if (!raw || typeof raw !== "object") return null;
    return {
        hostnames: Array.isArray(raw.hostnames) ? raw.hostnames.filter((h) => typeof h === "string").map((h) => h.toLowerCase()) : [],
        enforce: raw.enforce === true,
    };
}

/** Whether this site's ingest writes must carry an admission. */
export async function admissionRequired(acctScope: string, slug: string): Promise<boolean> {
    if (process.env.INGEST_REQUIRE_ADMISSION === "on") return true;
    return (await getSiteGate(acctScope, slug))?.enforce === true;
}

/* ── Turnstile ──────────────────────────────────────────────────────────── */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/** Cloudflare's published dummy secrets (always pass / always fail / token already spent). */
const TEST_SECRET = /^[123]x0{33}AA$/;

export type Verification =
    | { kind: "passed"; hostname: string }
    | { kind: "failed"; codes: string[] }
    | { kind: "unavailable" };

export async function verifyTurnstile(token: string, ip: string | null, hostnames: string[]): Promise<Verification> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
        console.error("[lead-admit] TURNSTILE_SECRET_KEY not set: no human check, so no AI calls");
        return { kind: "unavailable" };
    }
    if (!token) return { kind: "failed", codes: ["missing-input-response"] };

    let out: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
    try {
        const body = new URLSearchParams({ secret, response: token.slice(0, 2048) });
        if (ip) body.set("remoteip", ip);
        const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(4000) });
        if (!res.ok) {
            console.error("[lead-admit] siteverify answered", res.status);
            return { kind: "unavailable" };
        }
        out = await res.json();
    } catch (e) {
        console.error("[lead-admit] siteverify unreachable", e);
        return { kind: "unavailable" };
    }
    const codes = out["error-codes"] ?? [];
    if (codes.includes("internal-error")) return { kind: "unavailable" };
    if (out.success !== true) return { kind: "failed", codes };

    // A dummy secret answers for any page (its hostname is a placeholder), so the hostname rule
    // can't apply. It only ever runs in tests and on the `_e2e_test_*` fixtures.
    if (TEST_SECRET.test(secret)) return { kind: "passed", hostname: out.hostname ?? "" };

    if (out.action !== "lead") return { kind: "failed", codes: ["wrong-action"] };
    const hostname = (out.hostname ?? "").toLowerCase();
    if (hostnames.length > 0 && !hostnames.includes(hostname)) {
        // Solved on another of our client sites (they can share a widget), then brought here.
        return { kind: "failed", codes: ["wrong-hostname"] };
    }
    return { kind: "passed", hostname };
}

/* ── admission ──────────────────────────────────────────────────────────── */

export interface Admission {
    acctScope: string;
    slug: string;
    phone: string | null;
    email: string | null;
    /** The callback was claimed for this phone: `/call-consent` may save consent, and the site dial. */
    callback: boolean;
    verification: "passed" | "unavailable";
}

const K = {
    admission: (id: string) => `portal:gate:v1:adm:${id}`,
    used: (id: string, use: string) => `portal:gate:v1:adm-used:${id}:${use}`,
    ipSite: (acct: string, slug: string, ip: string, w: string) => `portal:gate:v1:ip:${w}:${acct}:${slug}:${ip}`,
    ipAll: (ip: string, day: string) => `portal:gate:v1:ip:all:${day}:${ip}`,
    siteCount: (acct: string, slug: string, w: string) => `portal:gate:v1:site:${w}:${acct}:${slug}`,
    noticeOnce: (what: string, scope: string, w: string) => `portal:gate:v1:notice:${what}:${scope}:${w}`,
};

/** Count one; true while at or under the cap. Over-cap counts are not taken back: a flood
 * should keep hitting the wall, not find room each time one falls off. */
async function within(key: string, cap: number, ttl: number): Promise<boolean> {
    const n = await getRedis().incr(key);
    if (n === 1) await getRedis().expire(key, ttl);
    return n <= cap;
}

export type AdmitResult =
    | { ok: true; admissionId: string; callback: "allowed" | "held"; verification: Admission["verification"] }
    | { ok: false; error: "not-verified" | "too-many" };

export interface AdmitInput {
    acctScope: string;
    slug: string;
    turnstileToken: string | null;
    ip: string | null;
    phone: string | null;
    email: string | null;
    wantsCallback: boolean;
}

export async function admit(input: AdmitInput): Promise<AdmitResult> {
    const L = admitLimits();
    const { acctScope, slug } = input;
    const gate = await getSiteGate(acctScope, slug);
    const v = await verifyTurnstile(input.turnstileToken ?? "", input.ip, gate?.hostnames ?? []);
    if (v.kind === "failed") {
        console.warn(`[lead-admit] ${slug}: human check failed (${v.codes.join(",") || "no code"})`);
        return { ok: false, error: "not-verified" };
    }

    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const tenMin = String(Math.floor(now.getTime() / (10 * MINUTE * 1000)));
    const ip = (input.ip || "unknown").slice(0, 64);

    // Per visitor, counted only once a submission has passed (or couldn't be checked): a failed
    // challenge costs a genuine visitor nothing.
    const short = v.kind === "passed" ? L.ipSiteShort : L.ipSiteShortUnverified;
    const fits =
        (await within(K.ipSite(acctScope, slug, ip, `10m:${tenMin}`), short, 10 * MINUTE)) &&
        (await within(K.ipSite(acctScope, slug, ip, `d:${day}`), L.ipSiteDaily, DAY)) &&
        (await within(K.ipAll(ip, day), L.ipAllDaily, DAY));
    if (!fits) {
        console.warn(`[lead-admit] ${slug}: too many from one visitor`);
        return { ok: false, error: "too-many" };
    }

    await noticeIfBusy(acctScope, slug, now, L).catch(() => {});

    let callback = false;
    if (input.wantsCallback && input.phone && v.kind === "passed") {
        callback = (await claimCallback(acctScope, slug, input.phone)).ok;
    }

    const admissionId = randomBytes(16).toString("hex");
    const admission: Admission = {
        acctScope,
        slug,
        phone: input.phone,
        email: input.email?.trim().toLowerCase() || null,
        callback,
        verification: v.kind,
    };
    await getRedis().set(K.admission(admissionId), admission, { ex: ADMISSION_TTL_SECONDS });
    return { ok: true, admissionId, callback: callback ? "allowed" : "held", verification: v.kind };
}

async function noticeIfBusy(acctScope: string, slug: string, now: Date, L: ReturnType<typeof admitLimits>) {
    const hour = now.toISOString().slice(0, 13);
    const day = now.toISOString().slice(0, 10);
    const h = await getRedis().incr(K.siteCount(acctScope, slug, `h:${hour}`));
    if (h === 1) await getRedis().expire(K.siteCount(acctScope, slug, `h:${hour}`), 2 * 60 * MINUTE);
    const d = await getRedis().incr(K.siteCount(acctScope, slug, `d:${day}`));
    if (d === 1) await getRedis().expire(K.siteCount(acctScope, slug, `d:${day}`), 2 * DAY);
    if (h === L.siteHourlyNotice + 1 || d === L.siteDailyNotice + 1) {
        const first = await getRedis().set(K.noticeOnce("busy", `${acctScope}:${slug}`, day), 1, { nx: true, ex: 2 * DAY });
        if (first === "OK") {
            await sendOpsNotice(`[JDD] ${slug} is getting a lot of form submissions`, [
                `${slug} has had ${h} form submissions this hour and ${d} today. They are all being recorded; this is only a heads-up in case it is abuse rather than a busy day.`,
                `AI calls are still limited to one per number and ${Number(process.env.GATE_CALLBACK_SITE_DAILY) || 100} a day for this site, and owner texts to 6 an hour.`,
            ]);
        }
    }
}

/**
 * Spend an admission on one use (`consent` or `lead`), once. Null when it doesn't exist, has
 * expired, belongs to another site, names a different contact, or that use is already spent.
 */
export async function spendAdmission(
    id: unknown,
    use: "consent" | "lead",
    owner: { acctScope: string; slug: string },
    contact: { phone?: string | null; email?: string | null },
): Promise<Admission | null> {
    if (typeof id !== "string" || !/^[0-9a-f]{32}$/.test(id)) return null;
    const a = await getRedis().get<Admission>(K.admission(id));
    if (!a || a.acctScope !== owner.acctScope || a.slug !== owner.slug) return null;
    if (contact.phone !== undefined && (contact.phone ?? null) !== a.phone) return null;
    if (contact.email !== undefined && (contact.email?.trim().toLowerCase() || null) !== a.email) return null;
    const first = await getRedis().set(K.used(id, use), 1, { nx: true, ex: ADMISSION_TTL_SECONDS });
    return first === "OK" ? a : null;
}
