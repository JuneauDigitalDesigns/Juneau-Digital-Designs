import Link from "next/link";
import type { FeatureAvailability } from "@jdd/schema";
import type { InfraSnapshot, SegmentState } from "@/app/lib/portal-infra";
import { tabHref, upgradeHref } from "@/app/portal/types";
import { Card } from "./ui/Card";
import { StatusDot, type Status } from "./ui/StatusDot";
import { relativeTime } from "./ui/format";

/**
 * The client's whole web presence in one bar: is the site answering, did the last deploy
 * land, is the domain attached, how fast is it.
 *
 * Each segment reports independently. A missing Vercel project id blanks the deploy and
 * domain segments and nothing else — one unwired credential must never make a client's
 * working site look broken. "Not checked" is a statement about our measurement, and reads
 * in muted grey rather than a warning colour.
 *
 * A server component on purpose: it holds no state, and rendering the relative deploy time
 * once on the server avoids an SSR/hydration mismatch when a minute ticks over mid-load.
 */
export function HealthStrip({
    infra,
    score,
    slug,
    calls,
    billingLinked,
}: {
    infra: InfraSnapshot;
    /** Cached PageSpeed score, or null when today's run hasn't happened yet. */
    score: number | null;
    slug: string;
    /** Drives the Receptionist segment — the client's view of their plan tier. */
    calls: FeatureAvailability;
    /** False means no subscription on file, so the upgrade link would dead-end. */
    billingLinked: boolean;
}) {
    return (
        <Card elevation={2} density="none" className="overflow-hidden">
            <div className="portal-health-grid">
                <Segment
                    label="Site"
                    state={infra.site.state}
                    value={siteValue(infra)}
                    detail={
                        infra.site.ms !== null
                            ? `${infra.site.ms} ms response`
                            : infra.site.status !== null
                              ? `HTTP ${infra.site.status}`
                              : "Not checked"
                    }
                    live={infra.site.state === "ok"}
                />

                <Segment
                    label="Last deploy"
                    state={infra.deploy.state}
                    value={
                        infra.deploy.readyAt ? relativeTime(infra.deploy.readyAt) : deployWord(infra.deploy.state)
                    }
                    detail={infra.deploy.commitMessage?.split("\n")[0] ?? deployDetail(infra.deploy.state)}
                />

                <Segment
                    label="Domain"
                    state={infra.domain.state}
                    value={infra.domain.name ?? domainWord(infra.domain.state)}
                    detail={
                        infra.domain.verified === true
                            ? "Verified · HTTPS active"
                            : infra.domain.verified === false
                              ? "Not verified yet"
                              : "Not checked"
                    }
                />

                {/* The receptionist's own line in the health bar.
                    It doubles as the upgrade tracker, which is why it lives here rather than
                    in a banner: an upgrade has no completion "moment" worth a toast, it has a
                    state. Starter reads "Not on plan", a paid-but-unprovisioned site reads
                    "Setting up", and once call tracking is wired it reads "Live" and stays
                    there. No timestamp and nothing to dismiss. */}
                <Segment
                    label="Receptionist"
                    state={receptionistState(calls)}
                    value={receptionistValue(calls)}
                    detail={
                        calls.state === "not-on-plan" ? (
                            billingLinked ? (
                                <Link
                                    href={upgradeHref(slug)}
                                    className="underline underline-offset-2"
                                    style={{ color: "var(--accent)" }}
                                >
                                    Add it with Growth
                                </Link>
                            ) : (
                                // No subscription on file — the upgrade would dead-end after
                                // the client signed. Say nothing actionable here; the Call Log
                                // panel carries the contact-us message in full.
                                <span>Not on your plan</span>
                            )
                        ) : (
                            receptionistDetail(calls)
                        )
                    }
                    live={calls.state === "ready"}
                />

                <Segment
                    label="Speed"
                    state={scoreState(score)}
                    value={score === null ? "—" : String(score)}
                    detail={
                        score === null ? (
                            <Link
                                href={tabHref("performance", slug)}
                                className="underline underline-offset-2"
                                style={{ color: "var(--accent)" }}
                            >
                                Run today&rsquo;s check
                            </Link>
                        ) : (
                            `PageSpeed · ${scoreWord(score)}`
                        )
                    }
                />
            </div>
        </Card>
    );
}

function Segment({
    label,
    state,
    value,
    detail,
    live = false,
}: {
    label: string;
    state: SegmentState;
    value: string;
    detail: React.ReactNode;
    live?: boolean;
}) {
    const dot: Status = state === "unknown" ? "pending" : state;

    return (
        <div className="flex flex-col gap-1 px-4 py-3.5 min-w-0">
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            <span className="flex items-center gap-2 min-w-0">
                <StatusDot status={dot} size={8} pulse={live} />
                <span
                    className="truncate font-semibold"
                    style={{
                        fontSize: "15px",
                        color: state === "unknown" ? "var(--fg-3)" : "var(--fg)",
                    }}
                    title={value}
                >
                    {value}
                </span>
            </span>
            <span className="text-xs truncate" style={{ color: "var(--fg-3)" }} title={typeof detail === "string" ? detail : undefined}>
                {detail}
            </span>
        </div>
    );
}

function siteValue(infra: InfraSnapshot): string {
    switch (infra.site.state) {
        case "ok":
            return "Live";
        case "down":
            return "Not responding";
        case "pending":
            return "Not live yet";
        default:
            return "Unknown";
    }
}

function deployWord(state: SegmentState): string {
    if (state === "pending") return "In progress";
    if (state === "down") return "Failed";
    return "Unknown";
}

function deployDetail(state: SegmentState): string {
    if (state === "pending") return "Building now";
    if (state === "down") return "Last build errored";
    return "Not checked";
}

function domainWord(state: SegmentState): string {
    if (state === "pending") return "Connecting";
    if (state === "warn") return "Not attached";
    return "Unknown";
}

/**
 * "Not on plan" is deliberately `unknown`, not `warn`.
 *
 * Nothing is wrong with a Starter site that has no receptionist — it is the product they
 * bought. An amber dot on a healthy site would be the strip crying wolf to sell something,
 * which is the fastest way to teach a client to ignore the colours that do matter.
 */
function receptionistState(calls: FeatureAvailability): SegmentState {
    switch (calls.state) {
        case "ready":
            return "ok";
        case "connecting":
        case "pending-build":
            return "pending";
        default:
            return "unknown";
    }
}

function receptionistValue(calls: FeatureAvailability): string {
    switch (calls.state) {
        case "ready":
            return "Live";
        case "connecting":
            return "Setting up";
        case "pending-build":
            return "Not live yet";
        default:
            return "Not on plan";
    }
}

function receptionistDetail(calls: FeatureAvailability): string {
    switch (calls.state) {
        case "ready":
            return "Answering your calls";
        case "connecting":
            return "Your number and agent are being set up";
        default:
            return "Starts when your site goes live";
    }
}

/** Google's own PageSpeed bands, so the colour matches what the Performance tab says. */
function scoreState(score: number | null): SegmentState {
    if (score === null) return "unknown";
    if (score >= 90) return "ok";
    if (score >= 50) return "warn";
    return "down";
}

function scoreWord(score: number): string {
    if (score >= 90) return "Good";
    if (score >= 50) return "Needs work";
    return "Poor";
}
