import "server-only";
import { siteverify, type Verification } from "./turnstile-verify";
import { within } from "./lead-admit";

/**
 * The human check for the agency's own "Get started" form (`LeadPanel` → `/api/lead`), Xander,
 * 2026-11-19: "I want to be sure that it's checking to see that the people submitting those are
 * actually people and not bots".
 *
 * The same rules as the client sites' lead forms (`lead-admit.ts`), and the same Cloudflare check
 * (`turnstile-verify.ts`), with the agency's own widget: public key `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
 * secret `TURNSTILE_SECRET_KEY`. The client sites' pool widgets are separate.
 *
 * - **Refused:** a token Cloudflare rejects, none at all, a reused one, one solved on another host.
 * - **Kept, unverified:** Cloudflare unreachable, our secret missing or wrong, or the widget unable
 *   to run on the page (`turnstileStatus: "error"`: a blocked script, or a host not on the widget).
 *   A lead nobody can verify beats a lead nobody receives; the console card says it is unverified.
 *   What that gives up: a script can claim the widget failed. It gets one lead per IP per ten
 *   minutes onto the board, each marked unverified.
 * - **Refused, too many:** one visitor (IP) sending again and again. Counted only once a submission
 *   has passed or couldn't be checked, so a failed check costs a genuine visitor nothing.
 */

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

const int = (name: string, fallback: number): number => {
    const n = Number(process.env[name]);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export function agencyLeadLimits() {
    return {
        ipShort: int("AGENCY_LEAD_IP_10MIN", 3),
        ipDaily: int("AGENCY_LEAD_IP_DAILY", 10),
        ipShortUnverified: int("AGENCY_LEAD_IP_10MIN_UNVERIFIED", 1),
    };
}

const ipKey = (ip: string, window: string) => `jdd:lead:gate:v1:ip:${window}:${ip}`;

export type AgencyLeadCheck =
    | { ok: true; verification: "passed" | "unverified" }
    | { ok: false; error: "not-verified" | "too-many" };

export interface AgencyLeadCheckInput {
    token: string | null;
    /** "error": the widget couldn't produce a token on the page. */
    status: string | null;
    ip: string | null;
    host: string | null;
}

export async function checkAgencyLead(input: AgencyLeadCheckInput): Promise<AgencyLeadCheck> {
    const secret = process.env.TURNSTILE_SECRET_KEY?.trim() || null;
    let v: Verification;
    if (!input.token && input.status === "error") {
        v = { kind: "unavailable" };
    } else if (!secret) {
        console.error("[agency-lead] TURNSTILE_SECRET_KEY not set: the Get started form has no human check");
        v = { kind: "unavailable" };
    } else {
        v = await siteverify({
            secret,
            token: input.token ?? "",
            ip: input.ip,
            host: input.host,
            action: "lead",
            tag: "agency-lead",
        });
    }
    if (v.kind === "failed") {
        console.warn(`[agency-lead] human check failed (${v.codes.join(",") || "no code"})`);
        return { ok: false, error: "not-verified" };
    }

    const L = agencyLeadLimits();
    const now = Date.now();
    const day = new Date(now).toISOString().slice(0, 10);
    const tenMin = String(Math.floor(now / (10 * MINUTE * 1000)));
    const ip = (input.ip || "unknown").slice(0, 64);
    const short = v.kind === "passed" ? L.ipShort : L.ipShortUnverified;
    const fits =
        (await within(ipKey(ip, `10m:${tenMin}`), short, 10 * MINUTE)) &&
        (await within(ipKey(ip, `d:${day}`), L.ipDaily, DAY));
    if (!fits) {
        console.warn("[agency-lead] too many from one visitor");
        return { ok: false, error: "too-many" };
    }
    return { ok: true, verification: v.kind === "passed" ? "passed" : "unverified" };
}
