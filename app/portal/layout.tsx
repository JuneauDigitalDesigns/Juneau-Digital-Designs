import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import { clerkAppearance, clerkLocalization } from "./clerkAppearance";

export const metadata: Metadata = {
    title: "Client Portal | Juneau Digital Designs",
    description: "View your site analytics, call logs, and performance metrics.",
    // Installable as an app (2026-11-19, Xander Q18): "JDD Portal" (approved string 13) on the
    // home screen, full screen, no browser bars. Portal routes only, so the agency site is not
    // installable. No service worker and no push: Xander chose no push alerts.
    manifest: "/portal.webmanifest",
    appleWebApp: { capable: true, title: "JDD Portal", statusBarStyle: "default" },
    icons: { apple: "/portal-icons/apple-touch-icon.png" },
};

/** The browser and status-bar colour, matching the portal's page colour in each theme. */
export const viewport: Viewport = {
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
        { media: "(prefers-color-scheme: dark)", color: "#0b0d11" },
    ],
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider
            // Applied at the provider, not per-page: <UserButton/> lives in the portal rail
            // and was rendering in stock Clerk chrome — a white card in Clerk purple and
            // Inter — because the appearance was only passed on sign-in and sign-up. It is
            // the agency palette for every Clerk surface (see clerkAppearance.ts), so it also
            // suits /portal/onboarding if Clerk UI ever lands there. The sign-in and sign-up
            // cards add their own layer on top (`clerkAuthAppearance`, on the component).
            appearance={clerkAppearance}
            // Clerk's built-in wording, overridden with approved strings.
            localization={clerkLocalization}
            afterSignOutUrl="/"
            signInUrl="/portal/sign-in"
            signUpUrl="/portal/sign-up"
            signUpFallbackRedirectUrl="/portal"
            signInFallbackRedirectUrl="/portal"
        >
            {children}
        </ClerkProvider>
    );
}
