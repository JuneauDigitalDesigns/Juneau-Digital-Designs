import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPortalRoute = createRouteMatcher(["/portal(.*)", "/api/portal/(.*)"]);
// The sign-in page lives under /portal, so it must be excluded from protection —
// otherwise auth.protect() redirects the unauthenticated visitor from the sign-in
// page back to the sign-in page, looping until the URL overflows (HTTP 431).
const isSignInRoute = createRouteMatcher(["/portal/sign-in(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    if (isPortalRoute(req) && !isSignInRoute(req)) {
        await auth.protect();
    }
});

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
