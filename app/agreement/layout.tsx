import { ClerkProvider } from "@clerk/nextjs";

/**
 * Clerk runs on the agreement page, because this page makes the signed-in API calls that
 * matter most: `/api/agreement`, then `/api/checkout` (or the plan-change routes).
 *
 * Without it, nothing in the browser renews the Clerk session token. That token lasts 60
 * seconds, and on every other signed-in page clerk-js refreshes it in the background. Reading
 * the terms and filling the form takes longer than a minute, so the cookie had expired by the
 * time the buyer pressed the button. Clerk's middleware can refresh an expired token only on a
 * page load, never on a POST, so it treated the call as signed out and the route answered 401
 * "Sign in to continue". The 2026-11-04 Stripe test run hit this on `/api/checkout` four seconds
 * after the agreement saved. With #55, `/api/agreement` would have refused first.
 *
 * Mounted here rather than in the root layout, so marketing pages still load no Clerk script.
 * The URLs match the portal's provider; this page renders no Clerk UI of its own.
 */
export default function AgreementLayout({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider signInUrl="/portal/sign-in" signUpUrl="/portal/sign-up" afterSignOutUrl="/">
            {children}
        </ClerkProvider>
    );
}
