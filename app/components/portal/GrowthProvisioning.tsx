import type { FeatureAvailability } from "@jdd/schema";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, CardLabel } from "./ui/Card";
import { StatusDot } from "./ui/StatusDot";

/**
 * What a client sees between paying for Growth and their receptionist actually existing.
 *
 * The upgrade charges immediately; the number, the AI agent and the call log are created
 * out of band by `onboard.js`. That gap used to be invisible — a client paid $297 and the
 * portal looked identical, which is the complaint this answers. The `?upgraded=1` banner
 * covered the first pageview only and vanished on the next navigation; this persists until
 * the work is genuinely finished.
 *
 * **Only steps we can actually observe are drawn as steps.** The portal knows the plan
 * flipped and whether the call log is wired (`airtableBaseId` on the record). It has no
 * visibility into Twilio numbers or Retell agents, so those are described in prose rather
 * than rendered as progress we cannot measure — the same rule that removed the ghost chart
 * from Overview. A fake tracker is worse than no tracker: it invites "why has step 2 been
 * amber for a week?" and we would have no answer.
 */
export function GrowthProvisioning({
    site,
    calls,
    justUpgraded = false,
}: {
    site: PortalSiteProps;
    /** The calls feature's availability — `ready` means provisioning is done. */
    calls: FeatureAvailability;
    /**
     * True on the redirect straight back from a successful upgrade. Only changes the opening
     * sentence — there is no separate congratulations card, because it would sit directly
     * above this one saying the same thing.
     */
    justUpgraded?: boolean;
}) {
    const planLabel = site.plan.charAt(0).toUpperCase() + site.plan.slice(1);

    return (
        <Card elevation={2} density="roomy" className="space-y-5">
            <div>
                <CardLabel>Setting up {planLabel}</CardLabel>
                <p
                    className="mt-2 text-sm max-w-prose"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
                >
                    {justUpgraded
                        ? `Thanks — your agreement is signed and your billing is updated. `
                        : `You're on ${planLabel} and your billing is updated. `}
                    We&rsquo;re putting your AI receptionist together now — that&rsquo;s a
                    dedicated business number, an agent trained on your services, and the call log
                    below. It usually takes a day or two, and there&rsquo;s nothing you need to do.
                    We&rsquo;ll email you the number as soon as it&rsquo;s live.
                </p>
            </div>

            <ol className="portal-steps">
                <Step
                    label={`${planLabel} activated`}
                    detail="Your plan and billing are updated"
                    state="done"
                />
                <Step
                    label="Building your receptionist"
                    detail="Business number and AI agent — we'll email you the number"
                    state="active"
                />
                <Step
                    label="Call log"
                    detail={
                        calls.state === "pending-build"
                            ? "Opens once your site is live and the receptionist is ready"
                            : "Opens when your receptionist takes its first call"
                    }
                    state="waiting"
                />
            </ol>
        </Card>
    );
}

function Step({
    label,
    detail,
    state,
}: {
    label: string;
    detail: string;
    state: "done" | "active" | "waiting";
}) {
    return (
        <li className={`portal-step is-${state}`}>
            <span className="portal-step-marker" aria-hidden="true">
                {state === "done" ? (
                    <CheckMark />
                ) : (
                    <StatusDot
                        status={state === "active" ? "warn" : "pending"}
                        size={8}
                        pulse={state === "active"}
                    />
                )}
            </span>
            <div className="min-w-0">
                <span
                    className="block font-semibold"
                    style={{
                        fontSize: "15px",
                        color: state === "waiting" ? "var(--fg-3)" : "var(--fg)",
                    }}
                >
                    {label}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: "var(--fg-3)" }}>
                    {detail}
                </span>
            </div>
            <span className="sr-only">
                {state === "done" ? "complete" : state === "active" ? "in progress" : "not started"}
            </span>
        </li>
    );
}

function CheckMark() {
    return (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
                d="M2.5 6.2L4.8 8.5L9.5 3.5"
                stroke="var(--online)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * Is this site mid-Growth-provisioning?
 *
 * Derived, not stored: a paid tier whose call feature hasn't reached `ready` is by definition
 * still being set up. `siteFeature` resolves calls to `pending-build` while the site is
 * building or `connecting` once it's live without an `airtableBaseId` — either way the work
 * is outstanding.
 */
export function isProvisioningGrowth(
    site: PortalSiteProps,
    calls: FeatureAvailability,
): boolean {
    return (site.plan === "growth" || site.plan === "enterprise") && calls.state !== "ready";
}
