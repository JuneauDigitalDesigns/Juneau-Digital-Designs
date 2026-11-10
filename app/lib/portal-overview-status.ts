import type { FeatureAvailability } from "@jdd/schema";
import type { InfraSnapshot } from "./portal-infra";

/**
 * The Overview's one-line health verdict, replacing the five-segment HealthStrip there.
 *
 * Reads the same two inputs the strip did — the infra snapshot and the receptionist's feature
 * state — plus the cached PageSpeed score, and says one thing. The detail moved to Analytics,
 * and the line links there.
 *
 * It says "working normally" only on evidence: the site answered the probe and the
 * receptionist is live. Anything we did not measure (no canonical URL yet, the probe unknown,
 * a web-only site with no receptionist to vouch for) renders no line at all, because a green
 * dot over something nobody checked is the strip crying "fine" — the mirror image of the
 * amber-dot-to-sell-something trap `HealthStrip.receptionistState` documents.
 *
 * Not a problem here, on purpose: a failed *deploy* (the previous build keeps serving, so the
 * client's site is unaffected) and a receptionist mid-setup (the GrowthProvisioning card
 * above already says so, at length). There is no live receptionist health signal to read —
 * the feature state says it is wired, not that it answered its last call — so the only
 * receptionist states this can report are the ones the strip reported.
 */

export type OverviewStatus = { tone: "ok" | "warn"; text: string } | null;

/** Google's "Poor" band, the same cut-off the strip and the Performance tab use. */
const SLOW_BELOW = 50;

export function overviewStatus(
    infra: InfraSnapshot | null,
    score: number | null,
    calls: FeatureAvailability,
): OverviewStatus {
    if (!infra) return null;

    if (infra.site.state === "down") {
        // TODO(wording): not in the approved copy. Drafted to match the approved "slow" line;
        // listed under "Wording needing approval" in the PR.
        return { tone: "warn", text: "Your website isn't loading right now · see Analytics" };
    }
    if (score !== null && score < SLOW_BELOW) {
        // Approved (copy draft, batch 2, "Status line").
        return { tone: "warn", text: "Your website is slow to load today · see Analytics" };
    }
    if (infra.site.state === "ok" && calls.state === "ready") {
        return { tone: "ok", text: "Website and receptionist working normally" };
    }
    return null;
}
