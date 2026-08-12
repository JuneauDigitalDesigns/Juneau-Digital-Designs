import type { InfraSnapshot } from "@/app/lib/portal-infra";
import type { PortalSiteProps } from "@/app/portal/types";
import { Card, CardLabel } from "./ui/Card";
import { StatusDot } from "./ui/StatusDot";
import { relativeTime } from "./ui/format";

type StepState = "done" | "active" | "waiting";

/**
 * What a client sees while their site is being built.
 *
 * This replaces a hatched `GhostPreview` that drew three empty stat tiles and a bar chart
 * labelled "Recent activity" — a chart the finished Overview never renders. The ghost
 * described a page that didn't exist, so the dashboard got *less* interesting once the
 * build completed. Real progress, drawn from real deployment state, is both honest and
 * more reassuring than a sketch of numbers.
 */
export function BuildProgress({
    site,
    infra,
}: {
    site: PortalSiteProps;
    infra: InfraSnapshot | null;
}) {
    const steps = deriveSteps(site, infra);

    return (
        <Card elevation={2} density="roomy" className="space-y-5">
            <div>
                <CardLabel>Build status</CardLabel>
                <p
                    className="mt-2 text-sm max-w-prose"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
                >
                    We&rsquo;re putting your site together. This page fills in with your call
                    numbers and site health as each step finishes — nothing here is a placeholder.
                </p>
            </div>

            <ol className="portal-steps">
                {steps.map((step) => (
                    <li key={step.label} className={`portal-step is-${step.state}`}>
                        <span className="portal-step-marker" aria-hidden="true">
                            {step.state === "done" ? (
                                <CheckMark />
                            ) : (
                                <StatusDot
                                    status={step.state === "active" ? "warn" : "pending"}
                                    size={8}
                                    pulse={step.state === "active"}
                                />
                            )}
                        </span>
                        <div className="min-w-0">
                            <span
                                className="block font-semibold"
                                style={{
                                    fontSize: "15px",
                                    color: step.state === "waiting" ? "var(--fg-3)" : "var(--fg)",
                                }}
                            >
                                {step.label}
                            </span>
                            <span className="block text-xs mt-0.5" style={{ color: "var(--fg-3)" }}>
                                {step.detail}
                            </span>
                        </div>
                        <span className="sr-only">
                            {step.state === "done"
                                ? "complete"
                                : step.state === "active"
                                  ? "in progress"
                                  : "not started"}
                        </span>
                    </li>
                ))}
            </ol>
        </Card>
    );
}

function deriveSteps(
    site: PortalSiteProps,
    infra: InfraSnapshot | null,
): Array<{ label: string; detail: string; state: StepState }> {
    const onboarded = site.status !== "pending-onboarding";
    const deployState = infra?.deploy.state ?? "unknown";
    const deployed = deployState === "ok";
    const domainOk = infra?.domain.state === "ok";
    const live = infra?.site.state === "ok";

    return [
        {
            label: "Onboarding complete",
            detail: onboarded
                ? "We have everything we need from you"
                : "Waiting on your onboarding form",
            state: onboarded ? "done" : "active",
        },
        {
            label: "Site building",
            detail: deployed
                ? infra?.deploy.readyAt
                    ? `Last build finished ${relativeTime(infra.deploy.readyAt)}`
                    : "Build finished"
                : deployState === "pending"
                  ? "Build running now"
                  : deployState === "down"
                    ? "Last build hit an error — we're on it"
                    : "Not started yet",
            state: deployed ? "done" : onboarded ? "active" : "waiting",
        },
        {
            label: "Domain connecting",
            detail: domainOk
                ? `${infra?.domain.name ?? "Your domain"} is verified`
                : infra?.domain.name
                  ? `${infra.domain.name} — verification pending`
                  : "Waiting on your domain",
            state: domainOk ? "done" : deployed ? "active" : "waiting",
        },
        {
            label: "Live",
            detail: live
                ? "Your site is answering visitors"
                : "Goes live once the steps above finish",
            state: live ? "done" : domainOk ? "active" : "waiting",
        },
    ];
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
