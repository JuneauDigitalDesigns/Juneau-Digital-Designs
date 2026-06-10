import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Client Portal | Juneau Digital Designs",
    description: "View your site analytics, call logs, and performance metrics.",
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    return <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider>;
}
