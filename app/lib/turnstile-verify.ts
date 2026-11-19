import "server-only";

/**
 * One Cloudflare Turnstile token, checked with Cloudflare's siteverify. The one copy of this check:
 * the client sites' lead forms use it through `lead-admit.ts` (each widget's own secret), and the
 * agency's own "Get started" form through `agency-lead-gate.ts` (`TURNSTILE_SECRET_KEY`).
 *
 * The answer is three-way on purpose. "failed" is the visitor's: refuse. "unavailable" is ours or
 * Cloudflare's (down, or our secret wrong): never the visitor's fault, so the caller keeps the lead,
 * marked unverified (operator decision, 2026-11-09: "never lose a lead").
 */

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
/**
 * Cloudflare's published dummy secrets (always pass / always fail / token already spent), e.g.
 * `1x0000000000000000000000000000000AA`: 31 zeros. Until 2026-11-19 this said 33, so a dummy secret
 * fell through to the action and hostname rules and every test token was refused.
 */
const TEST_SECRET = /^[123]x0{31}AA$/;

export type Verification =
    | { kind: "passed"; hostname: string }
    | { kind: "failed"; codes: string[] }
    | { kind: "unavailable" };

export interface SiteverifyInput {
    secret: string;
    token: string;
    ip: string | null;
    /**
     * The host the form was posted to. Each form posts to its own origin, so a token solved
     * anywhere else is refused. This needs no stored list of hostnames, which would go stale the
     * day a domain is attached.
     */
    host: string | null;
    /** The `action` the widget was rendered with. */
    action: string;
    /** For the logs: which caller. */
    tag: string;
}

export async function siteverify({ secret, token, ip, host, action, tag }: SiteverifyInput): Promise<Verification> {
    if (!token) return { kind: "failed", codes: ["missing-input-response"] };

    let out: { success?: boolean; hostname?: string; action?: string; "error-codes"?: string[] };
    try {
        const body = new URLSearchParams({ secret, response: token.slice(0, 2048) });
        if (ip) body.set("remoteip", ip);
        const res = await fetch(SITEVERIFY, { method: "POST", body, signal: AbortSignal.timeout(4000) });
        if (!res.ok) {
            console.error(`[${tag}] siteverify answered`, res.status);
            return { kind: "unavailable" };
        }
        out = await res.json();
    } catch (e) {
        console.error(`[${tag}] siteverify unreachable`, e);
        return { kind: "unavailable" };
    }
    const codes = out["error-codes"] ?? [];
    if (codes.includes("internal-error")) return { kind: "unavailable" };
    // Our secret is wrong or missing for this widget: our mistake, never the visitor's. Refusing
    // would turn away every lead the form gets; the caller keeps them, unverified.
    if (codes.includes("invalid-input-secret") || codes.includes("missing-input-secret")) {
        console.error(`[${tag}] Cloudflare doesn't accept our secret for this widget: no human check`);
        return { kind: "unavailable" };
    }
    if (out.success !== true) return { kind: "failed", codes };

    // A dummy secret answers for any page (its hostname is a placeholder), so the hostname rule
    // can't apply. It only ever runs in tests, local development and the `_e2e_test_*` fixtures.
    if (TEST_SECRET.test(secret)) return { kind: "passed", hostname: out.hostname ?? "" };

    if (out.action !== action) return { kind: "failed", codes: ["wrong-action"] };
    const hostname = (out.hostname ?? "").toLowerCase();
    if (host && hostname !== host) return { kind: "failed", codes: ["wrong-hostname"] };
    return { kind: "passed", hostname };
}

/** The host a request was made on, lower case, without a port: what the widget's token names. */
export function requestHost(req: Request): string | null {
    const raw = req.headers.get("x-forwarded-host") || req.headers.get("host") || safeUrlHost(req.url);
    return raw ? raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "") : null;
}

function safeUrlHost(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}
