import type { PortalSiteStatus } from "@jdd/schema";

/**
 * When the first-run tour may start by itself.
 *
 * Starting the tour is a navigation (`router.push("/portal/calls?tour=1")`), fired from an
 * effect as the dashboard shell mounts. That is only safe when the page under the shell is
 * staying put. On 2026-11-11 it was not: a client whose only site was still
 * `pending-onboarding` opened `/portal`, the Overview called `redirect()` to the wizard, and the
 * tour's push raced that redirect. Next's root router then threw "Rendered more hooks than
 * during the previous render", which no error boundary can catch, so the client saw the black
 * "This page couldn't load" screen until Next's refresh tag reloaded them into the wizard.
 *
 * Two rules, each enough for that case on its own:
 *
 * 1. **Not for a site that is still being described.** The Overview of a `pending-onboarding`
 *    site *is* the wizard, so the dashboard the tour teaches does not exist for it yet. The tour
 *    starts on the client's next visit after onboarding.
 *
 * 2. **Not while the page is redirecting.** A page that calls `redirect()` after the layout has
 *    streamed answers 200 and carries a `<meta id="__next-page-redirect" http-equiv="refresh">`.
 *    While that tag is in the document, Next turns every client navigation into a hard one, and
 *    a hard navigation issued alongside the redirect is what crashes the router. This covers any
 *    other page that redirects, such as the old Traffic, Performance and Billing paths.
 *    `test/portal-tour-auto-launch.test.mjs` checks that the installed Next still uses that id.
 */
export const NEXT_STREAMED_REDIRECT_META_ID = "__next-page-redirect";

export function shouldAutoLaunchTour({
    tourCompleted,
    siteStatus,
    redirectPending,
}: {
    tourCompleted: boolean;
    /** The status of the site the shell is showing. */
    siteStatus: PortalSiteStatus;
    /** Whether the page has already been told to redirect. See `streamedRedirectPending`. */
    redirectPending: boolean;
}): boolean {
    if (tourCompleted) return false;
    if (siteStatus === "pending-onboarding") return false;
    if (redirectPending) return false;
    return true;
}

/** True when Next has streamed a redirect for this page and is about to leave it. */
export function streamedRedirectPending(doc: Pick<Document, "getElementById">): boolean {
    return doc.getElementById(NEXT_STREAMED_REDIRECT_META_ID) !== null;
}
