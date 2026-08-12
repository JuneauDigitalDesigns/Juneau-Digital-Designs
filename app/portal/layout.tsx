import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { portalClerkAppearance } from "./clerkAppearance";

export const metadata: Metadata = {
    title: "Client Portal | Juneau Digital Designs",
    description: "View your site analytics, call logs, and performance metrics.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider
            // Applied at the provider, not per-page: <UserButton/> lives in the portal rail
            // and was rendering in stock Clerk chrome — a white card in Clerk purple and
            // Inter — because the appearance was only passed on sign-in and sign-up.
            appearance={portalClerkAppearance}
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
