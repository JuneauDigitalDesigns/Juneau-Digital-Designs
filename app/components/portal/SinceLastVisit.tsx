import type { LastVisitSummary } from "@/app/lib/portal-last-visit";
import { tabHref } from "@/app/portal/types";
import Link from "next/link";

/**
 * The Overview's opening line: what happened while the client was away.
 *
 * Renders **nothing** when nothing arrived, which is most visits. That is the whole design.
 * A panel that is always present saying "0 new calls" is furniture, and furniture is what
 * this page had too much of; a line that only appears when it has something to say is worth
 * reading every time it does.
 *
 * The copy states counts and nothing else. "Qualified" is only ever the word the client
 * typed in their own Airtable Outcome column, never a status we inferred from a call
 * happening — a call is a call until the owner rings back.
 */
export function SinceLastVisit({
    summary,
    slug,
}: {
    summary: LastVisitSummary;
    slug: string;
}) {
    if (summary.since === null || summary.newCalls === 0) return null;

    const { newCalls, newQualified } = summary;
    const callWord = newCalls === 1 ? "call" : "calls";

    return (
        <Link
            href={tabHref("calls", slug)}
            className="portal-since portal-row"
            aria-label={`${newCalls} new ${callWord} since your last visit. Open the call log.`}
        >
            <span className="portal-since-dot" aria-hidden="true" />
            <span className="portal-since-lead">
                <b>
                    {newCalls} new {callWord}
                </b>
                {newQualified > 0 && <>, {newQualified} marked qualified</>}
            </span>
            <span className="portal-since-meta">since {relativeDay(summary.since)}</span>
        </Link>
    );
}

/**
 * "yesterday", "Tuesday", or a date once the weekday stops being unambiguous.
 *
 * Rendered on the server, so this is the server's clock and timezone. That is a known
 * imprecision worth accepting here: the alternative is a client component that renders empty
 * and fills in after hydration, on the one line of this page meant to be read first.
 */
function relativeDay(ts: number): string {
    const days = Math.floor((Date.now() - ts) / 86_400_000);
    if (days < 1) return "earlier today";
    if (days < 2) return "yesterday";
    if (days < 7) {
        return new Date(ts).toLocaleDateString(undefined, { weekday: "long" });
    }
    return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
