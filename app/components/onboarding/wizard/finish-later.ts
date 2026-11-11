/**
 * Where "Finish later" takes a client (finding F-B1b, end-to-end test 2026-11-10).
 *
 * It used to save and go to /portal, but /portal sends a site that is still being set up straight
 * back to this wizard, so a client whose only site was pending could never leave. Approved by
 * Xander word for word, 2026-11-11 ("Approve as drafted", mockup
 * https://claude.ai/artifact/BaoLxNU2Gd9JPLhh4yW3CA, items F1 to F3):
 * - a client with another site that is already set up goes to that site's dashboard, with the
 *   existing toast;
 * - otherwise the wizard shows a "Saved" screen with Keep going and Sign out (to the homepage).
 * Answers are saved on our side as well as in the browser, so they come back on any device.
 */

export const FINISH_LATER = {
    toast: "Saved. Next time you'll pick up right here.", // unchanged
    savedHeading: "Your answers are saved", // F1
    savedBody: "Come back any time, on any device. Sign in at juneaudigitaldesigns.com/portal and you'll pick up right where you left off.", // F2
    keepGoing: "Keep going", // F3
    signOut: "Sign out", // F3
} as const;

/** Where "Sign out" lands. */
export const SIGNED_OUT_URL = "/";

type SiteLike = { slug: string; status: string };

/**
 * The slug of another site on the account that already has a dashboard (anything not still being
 * set up), or null when the wizard's site is the only one, or every other site is pending too.
 */
export function finishLaterTarget(sites: readonly SiteLike[], currentSlug: string): string | null {
    const other = sites.find((x) => x.slug !== currentSlug && x.status !== "pending-onboarding");
    return other ? other.slug : null;
}
