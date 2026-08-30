import Link from "next/link";
import type { PortalSite } from "@jdd/schema";
import { Card, CardLabel } from "./ui/Card";

/**
 * The way back to a site that was paid for but never described.
 *
 * `selectSite` ranks `pending-onboarding` last on purpose — a client who came to check on a
 * build should not be ambushed by a form for a different site they bought later. The
 * consequence is that an unfinished purchase is reachable only from the site selector, which
 * is easy to miss and looks like nothing happened.
 *
 * So the redirect straight after payment handles the moment it matters, and this handles
 * every visit after it. Together they mean a client is never blocked from a working site and
 * never loses track of one they have already been charged for.
 *
 * Renders nothing when there is nothing outstanding, so the caller can drop it in
 * unconditionally.
 */
export function PendingSiteBanner({
    sites,
    currentSlug,
}: {
    /** Every site on the account, not just the selected one. */
    sites: PortalSite[];
    /** Excluded from the list — that site's own view is already the wizard. */
    currentSlug: string;
}) {
    const pending = sites.filter(
        (s) => s.status === "pending-onboarding" && s.slug !== currentSlug,
    );
    if (pending.length === 0) return null;

    return (
        <Card elevation={2} density="roomy" className="space-y-4">
            <div>
                <CardLabel>
                    {pending.length === 1 ? "Finish setting up your new site" : "Finish setting up your new sites"}
                </CardLabel>
                <p
                    className="mt-2 text-sm max-w-prose"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}
                >
                    {pending.length === 1 ? (
                        <>
                            Your payment went through and the site is reserved. We need a few details
                            about the business before we can start building it — it takes about five
                            minutes, and you can leave and come back.
                        </>
                    ) : (
                        <>
                            {pending.length} sites are paid for and waiting on their details. Each one
                            takes about five minutes, and you can leave and come back.
                        </>
                    )}
                </p>
            </div>

            <div className="flex flex-wrap gap-3">
                {pending.map((site) => (
                    <Link
                        key={site.slug}
                        href={`/portal/onboarding?site=${encodeURIComponent(site.slug)}`}
                        className="btn primary btn-wrap"
                        style={{ display: "inline-flex" }}
                    >
                        {/*
                          * The name comes from the agreement's legal name; the slug at this stage
                          * is still the `pending-…` placeholder and would mean nothing to a client.
                          */}
                        {pending.length === 1
                            ? "Continue setup"
                            : `Set up ${site.name ?? "your new site"}`}
                    </Link>
                ))}
            </div>
        </Card>
    );
}
