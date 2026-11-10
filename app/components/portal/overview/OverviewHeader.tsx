import Link from "next/link";
import type { ReactNode } from "react";
import type { OverviewStatus } from "@/app/lib/portal-overview-status";

/**
 * "Good morning, Mike" / "This week, Mon Nov 3 – today", with the status line on the right.
 *
 * The greeting uses the first word of the account profile's contact name — the one field a
 * client sets for themselves in Settings — and falls back to the plain "Overview" title when
 * there is none, as the approved copy says. The status line is a slot because it streams in
 * its own Suspense boundary: it waits on a live HTTP probe, and the greeting must not.
 */
export function OverviewHeader({
    greeting,
    sub,
    status,
}: {
    greeting: string;
    sub: string;
    status: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4 lg:flex-wrap">
            <div className="min-w-0">
                <h1
                    style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 800,
                        fontSize: "var(--text-4xl)",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.15,
                        margin: 0,
                    }}
                >
                    {greeting}
                </h1>
                <div className="mt-0.5" style={{ color: "var(--fg-3)", fontSize: "var(--text-sm)" }}>
                    {sub}
                </div>
            </div>
            {status}
        </div>
    );
}

/** The greeting, or "Overview" with no contact name on file. */
export function greetingLine(contactName: string | undefined, part: "morning" | "afternoon" | "evening"): string {
    const first = contactName?.trim().split(/\s+/)[0];
    return first ? `Good ${part}, ${first}` : "Overview";
}

/**
 * One pill: a green or amber dot and a sentence, linking to Analytics' Site health section.
 *
 * Text is `--fg-2` on a white pill (8.14:1). The dot is `--online` / `--chart-warn` and is
 * not text, so it needs only to be visible beside the words, which carry the meaning.
 */
export function StatusLine({ status, href }: { status: OverviewStatus; href: string }) {
    if (!status) return null;
    return (
        <Link
            href={href}
            className="portal-elev inline-flex items-center gap-2 self-start lg:self-auto px-3 py-2 lg:py-1.5 hover:underline"
            style={{
                borderRadius: "999px",
                fontSize: "var(--text-sm)",
                color: "var(--fg-2)",
            }}
        >
            <span
                aria-hidden="true"
                className="inline-block shrink-0"
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: status.tone === "ok" ? "var(--online)" : "var(--chart-warn)",
                }}
            />
            {status.text}
        </Link>
    );
}
