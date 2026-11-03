import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * `/api/onboarding/(.*)` sits in here with the portal routes rather than being left public.
 * It held the A2P identity submit, which carried a client's EIN; that route is gone (A2P
 * registration is operator-driven in the jdd-ops console now), and nothing lives under the
 * prefix today. Kept anyway: anything added there is onboarding data for a signed-in client,
 * and a matcher that already covers it is a lock nobody has to remember to fit.
 */
const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal/(.*)", "/api/onboarding/(.*)"]);
// The sign-in AND sign-up pages live under /portal, so they must be excluded from
// protection — otherwise auth.protect() redirects the unauthenticated visitor from
// the auth page back to sign-in, looping until the URL overflows (HTTP 431).
const isAuthRoute = createRouteMatcher(["/portal/sign-in(.*)", "/portal/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    if (isPortalRoute(req) && !isAuthRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
