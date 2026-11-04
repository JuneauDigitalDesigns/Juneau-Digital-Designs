"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

/**
 * Waits for Clerk to report the new session as active, then loads `to` as a full page.
 *
 * `location.replace` rather than the Next router, deliberately. A full page load lets the
 * middleware read the session cookie that sign-up just set, and lets `/start` answer with an
 * ordinary 307 to `/agreement`, which the browser follows and paints. No client-side transition
 * is involved, so none can stall. `replace` also keeps this page out of the back button: going back
 * from the agreement returns to the pricing page, not to a page that sends them forward again.
 *
 * If Clerk loads and finds no session, the visitor was not really signed in. They go to sign-in
 * with the same destination rather than into a funnel that would bounce them anyway.
 */
export default function ContinueAfterAuth({ to }: { to: string }) {
    const { isLoaded, isSignedIn } = useAuth();
    // Shown only if the hand-off is taking unusually long, so a stuck tab still has a way out.
    const [slow, setSlow] = useState(false);

    useEffect(() => {
        if (!isLoaded) return;
        if (isSignedIn) {
            window.location.replace(to);
        } else {
            window.location.replace(`/portal/sign-in?redirect_url=${encodeURIComponent(to)}`);
        }
    }, [isLoaded, isSignedIn, to]);

    useEffect(() => {
        const t = window.setTimeout(() => setSlow(true), 8000);
        return () => window.clearTimeout(t);
    }, []);

    return (
        <div role="status" aria-live="polite" className="max-w-sm text-center">
            <p style={{ color: "var(--fg)", fontSize: "var(--text-lg)" }}>Signing you in…</p>
            {slow && (
                <p className="mt-3" style={{ color: "var(--fg-2)" }}>
                    Taking longer than usual.{" "}
                    <a href={to} style={{ color: "var(--accent-2)", textDecoration: "underline" }}>
                        Continue
                    </a>
                </p>
            )}
        </div>
    );
}
