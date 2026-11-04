/**
 * Where Clerk sends a visitor the moment sign-up or sign-in completes.
 *
 * Destinations inside `/portal` are handed to Clerk as they are. Anything outside it, which today
 * means the purchase funnel (`/start?plan=…`), goes through `/portal/continue` first, and that page
 * loads the destination as a full page.
 *
 * Why the hop: Clerk finishes a sign-up by pushing the destination through the Next router, a
 * client-side transition. From `/portal/sign-up` to `/start`, that transition leaves the portal
 * layout, which is the only place Clerk is mounted, while `/start` redirects on to `/agreement`.
 * On the 2026-11-04 Stripe test run that transition never finished: the server answered with
 * `/agreement` and the browser kept showing the sign-up page until a reload. Both fresh sign-ups
 * hit it. A reload fixed it because a reload is a full page load, so the hop does that
 * reload for the buyer: Clerk's push stays inside the portal layout, and the funnel starts with
 * a full page load carrying the session cookie that was just set.
 *
 * Takes a value that has already been through `safeRedirectPath`, and keeps the hop out of its
 * own `to`, so the hop can never point back at itself.
 */
export const POST_AUTH_HOP = "/portal/continue";

export function isPortalPath(path: string): boolean {
    return path === "/portal" || path.startsWith("/portal/") || path.startsWith("/portal?");
}

export function postAuthRedirect(target: string): string {
    if (isPortalPath(target)) return target;
    return `${POST_AUTH_HOP}?to=${encodeURIComponent(target)}`;
}
