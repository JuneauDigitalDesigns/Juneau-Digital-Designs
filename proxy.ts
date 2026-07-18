import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal/(.*)"]);
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
