import type { ReactNode } from "react";
import type { FeatureAvailability } from "@jdd/schema";
import type { InfraSnapshot, SegmentState } from "@/app/lib/portal-infra";
import { addReceptionistHref } from "@/app/portal/types";
import { Card } from "../ui/Card";
import { StatusDot, type Status } from "../ui/StatusDot";
import { relativeTime, shortDate } from "../ui/format";

/**
 * Analytics › Site health: is the site answering, is the domain attached, when did it last
 * change, is the receptionist picking up.
 *
 * The same infra snapshot the Overview's health strip reads (`getInfraSnapshot`, cached), shown
 * in the approved Analytics wording. The strip's state-to-word mappings are restated here
 * rather than imported: the strip is leaving the Overview in the same rework, and this section
 * must not break when it goes.
 *
 * Each cell reports independently, and "Not checked" is a statement about our measurement in
 * muted grey, never a warning about the client's site. A server component for the same reason
 * the strip is one: relative times rendered once on the server cannot mismatch on hydration.
 */
export function SiteHealth({
    infra,
    calls,
    lastCallAt,
    slug,
}: {
    infra: InfraSnapshot;
    /** The receptionist's availability on this site. */
    calls: FeatureAvailability;
    /** Most recent answered call, or null when there is none or calls could not be read. */
    lastCallAt: string | null;
    slug: string;
}) {
    const probed = infra.site.status !== null || infra.site.ms !== null;

    return (
        <Card density="none" className="overflow-hidden">
            <div className="grid grid-cols-1 lg:grid-cols-4">
                <Cell
                    label="Website"
                    state={infra.site.state}
                    value={websiteValue(infra.site.state)}
                    detail={probed ? `Checked ${relativeTime(infra.fetchedAt)}` : "Not checked"}
                    first
                />
                <Cell
                    label="Domain"
                    state={infra.domain.state}
                    value={infra.domain.name ?? domainWord(infra.domain.state)}
                    detail={
                        // TODO(wording): the approved line continues "· renews Mar 2027". The
                        // portal has no renewal date for a client's domain, so only the part we
                        // can stand behind is shown.
                        infra.domain.verified === true
                            ? "Secure (https)"
                            : infra.domain.verified === false
                              ? "Not verified yet"
                              : "Not checked"
                    }
                />
                <Cell
                    label="Last update"
                    state={infra.deploy.state}
                    value={infra.deploy.readyAt ? shortDate(infra.deploy.readyAt) : deployWord(infra.deploy.state)}
                    detail={infra.deploy.commitMessage?.split("\n")[0] ?? deployDetail(infra.deploy.state)}
                />
                <Cell
                    label="Receptionist"
                    state={receptionistState(calls)}
                    value={calls.state === "ready" ? "Answering" : receptionistValue(calls)}
                    detail={
                        calls.state === "ready" ? (
                            lastCallAt ? `Last call ${relativeTime(lastCallAt)}` : "Answering your calls"
                        ) : calls.state === "not-on-plan" ? (
                            // Web-only: the receptionist is in their plan and switching it on is
                            // accepting the standard Starter terms, not an upgrade.
                            <a
                                href={addReceptionistHref(slug)}
                                className="underline underline-offset-2"
                                style={{ color: "var(--accent)" }}
                            >
                                Add your receptionist
                            </a>
                        ) : (
                            receptionistDetail(calls)
                        )
                    }
                />
            </div>
        </Card>
    );
}

function Cell({
    label,
    state,
    value,
    detail,
    first = false,
}: {
    label: string;
    state: SegmentState;
    value: string;
    detail: ReactNode;
    first?: boolean;
}) {
    const dot: Status = state === "unknown" ? "pending" : state;
    return (
        // Stacked rows on a phone, four columns from 1024px: the divider turns from a top rule
        // into a left one at the same breakpoint.
        <div
            className={`flex flex-col gap-1.5 px-4 py-3.5 min-w-0${first ? "" : " border-t lg:border-t-0 lg:border-l"}`}
            style={{ borderColor: "var(--rule-weak)" }}
        >
            <span
                className="text-xs uppercase tracking-widest"
                style={{ color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}
            >
                {label}
            </span>
            <span className="flex items-center gap-2 min-w-0">
                <StatusDot status={dot} size={8} />
                <span
                    className="truncate font-semibold text-sm"
                    style={{ color: state === "unknown" ? "var(--fg-3)" : "var(--fg)" }}
                    title={value}
                >
                    {value}
                </span>
            </span>
            <span
                className="text-xs truncate"
                style={{ color: "var(--fg-3)" }}
                title={typeof detail === "string" ? detail : undefined}
            >
                {detail}
            </span>
        </div>
    );
}

function websiteValue(state: SegmentState): string {
    switch (state) {
        case "ok":
            return "Online";
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
 * "Not on plan" is `unknown`, not `warn`: nothing is wrong with a web-only site that has no
 * receptionist. An amber dot there would be the page crying wolf to sell something.
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
        case "connecting":
            return "Your number and agent are being set up";
        default:
            return "Starts when your site goes live";
    }
}
