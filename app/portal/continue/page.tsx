import type { Metadata } from "next";
import PortalScope from "@/app/components/portal/PortalScope";
import ContinueAfterAuth from "@/app/components/portal/ContinueAfterAuth";
import { safeRedirectPath } from "@/app/lib/safe-redirect";
import { POST_AUTH_HOP } from "@/app/lib/post-auth-redirect";

export const metadata: Metadata = {
    title: "Signing you in | Juneau Digital Designs",
    robots: { index: false },
};

/**
 * The stop between Clerk and the purchase funnel. See `postAuthRedirect` for why it exists.
 *
 * Left out of the middleware's protection, like the sign-in and sign-up pages, on purpose. Clerk
 * routes here in the same instant it activates the new session. A protected route would add a
 * server-side auth check to that client transition, the step that just failed, and a visitor
 * who really is signed out is sent to sign-in by the client component anyway. The page shows
 * nothing but a status line.
 */
export default async function ContinuePage({
    searchParams,
}: {
    searchParams: Promise<{ to?: string | string[] }>;
}) {
    let to = safeRedirectPath((await searchParams).to);
    // Never back to the hop itself: a loop of full page loads is worse than landing on the portal.
    if (to === POST_AUTH_HOP || to.startsWith(`${POST_AUTH_HOP}?`) || to.startsWith(`${POST_AUTH_HOP}/`)) {
        to = "/portal";
    }

    return (
        <PortalScope>
            <div
                className="min-h-screen flex items-center justify-center p-6"
                style={{ background: "var(--bg)" }}
            >
                <ContinueAfterAuth to={to} />
            </div>
        </PortalScope>
    );
}
