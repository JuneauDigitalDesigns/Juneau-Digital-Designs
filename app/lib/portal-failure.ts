/**
 * Why a portal panel has no data.
 *
 * Every Vercel-backed panel used to collapse three unrelated conditions into one sentence —
 * "We couldn't load this". A missing `VERCEL_TOKEN`, a project with Web Analytics switched
 * off, and a genuine upstream 500 rendered identically, so the only way to tell them apart
 * was to read the source and then the server log. That is exactly how the Traffic tab sat
 * broken on a correctly-configured client.
 *
 * `FailureReason` is **operator-facing**. It is logged, returned in the payload for the ops
 * tooling to read, and never rendered to a client — portal copy does not name our plumbing
 * (see the header comment in components/portal/ui/FeatureState.tsx). What the client sees is
 * derived from it by `clientStateFor`.
 */

export type FailureReason =
    /** We never configured the credential. Ours to fix; the client cannot act on it. */
    | "not-configured"
    /** The Vercel project exists but Web Analytics was never switched on. Also ours. */
    | "analytics-off"
    /** Vercel answered with an error, timed out, or the network failed. Usually transient. */
    | "upstream-error";

/**
 * The client-visible state for a reason.
 *
 * The first two map to `connecting`, whose existing copy — "Your site is live, and we're
 * still connecting… nothing is needed from you" — is precisely true for both. Only a genuine
 * upstream failure becomes `error`, which is also the only one that offers a retry: retrying
 * an unset environment variable is theatre.
 */
export function clientStateFor(reason: FailureReason): "connecting" | "error" {
    return reason === "upstream-error" ? "error" : "connecting";
}

/**
 * Classify an upstream HTTP status from the Vercel Web Analytics API.
 *
 * A 4xx from that endpoint means the project isn't serving analytics — the feature was never
 * switched on. 5xx, timeouts and network faults are Vercel having a bad day.
 *
 * Two statuses are deliberately *not* treated as "analytics off", because neither says
 * anything about the project's configuration:
 *   401 — our token was rejected. That's our credential, not their project.
 *   429 — we're rate limited. Retrying is exactly the right response.
 *
 * Note the obvious-looking alternative is a trap: `analytics` on `GET /v9/projects/{id}`
 * reports the legacy Audiences product and is absent even on projects actively collecting
 * Web Analytics (verified against a project simultaneously returning real device and browser
 * rows). Reading it marks healthy clients as broken. Classify from the query you actually
 * depend on.
 */
export function reasonForStatus(status: number | null): FailureReason {
    if (status !== null && status >= 400 && status < 500 && status !== 401 && status !== 429) {
        return "analytics-off";
    }
    return "upstream-error";
}

/** One-line operator explanation, for logs and the ops audit. */
export function describeReason(reason: FailureReason, detail?: string): string {
    const base = {
        "not-configured": "VERCEL_TOKEN is not set — the portal cannot query Vercel at all",
        "analytics-off": "Web Analytics is not enabled on this Vercel project",
        "upstream-error": "Vercel returned an error",
    }[reason];
    return detail ? `${base}: ${detail}` : base;
}
