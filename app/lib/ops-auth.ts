import "server-only";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

/**
 * Shared-secret gate for the `/api/ops/*` routes the ops console calls.
 *
 * The caller is a machine — the console, which has no auth of its own and runs on localhost —
 * so these routes are authenticated by a secret in the `x-ops-secret` header rather than by
 * Clerk. Same posture as the Stripe webhook.
 *
 * The env var is a parameter because the routes do not all carry the same risk. plan-sync and
 * sms-consent repair records against `OPS_SHARED_SECRET`; the operator-order routes open
 * Checkout Sessions and create accounts, so they take their own `OPS_ORDERS_SECRET` and a leak
 * of one secret does not hand over the other.
 *
 * Returns a response to send when the caller is not authorised, or null to continue.
 */
export function authorizeOps(
    request: Request,
    envVar: "OPS_SHARED_SECRET" | "OPS_ORDERS_SECRET",
    logTag: string,
): NextResponse | null {
    const expected = process.env[envVar];
    if (!expected) {
        // Fail closed. An unset secret must never mean "no check required".
        console.error(`[${logTag}] ${envVar} is not set — refusing`);
        return NextResponse.json({ error: "Not configured." }, { status: 503 });
    }
    if (!secretMatches(request.headers.get("x-ops-secret"), expected)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return null;
}

/** Constant-time compare so the secret can't be probed a byte at a time. */
function secretMatches(provided: string | null, expected: string): boolean {
    if (!provided) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
}
