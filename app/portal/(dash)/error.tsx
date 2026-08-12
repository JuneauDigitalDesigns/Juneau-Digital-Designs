"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for a dashboard route.
 *
 * Individual panels handle their own upstream failures with a retry, so reaching this
 * means the page itself threw. Say so plainly rather than showing a blank screen.
 */
export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("[portal] route error", error);
    }, [error]);

    return (
        <div className="portal-elev px-6 py-12 flex flex-col items-center text-center gap-3">
            <h2
                className="font-bold"
                style={{ fontFamily: "var(--font-display)", fontSize: "20px", lineHeight: 1.15 }}
            >
                Something went wrong
            </h2>
            <p className="text-sm max-w-md" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)" }}>
                We couldn&apos;t load this page. Your data is safe — this is only a problem
                displaying it.
            </p>
            <button
                type="button"
                onClick={reset}
                className="portal-elev portal-interactive text-sm px-3.5 py-2 cursor-pointer"
                style={{ color: "var(--fg)" }}
            >
                Try again
            </button>
        </div>
    );
}
