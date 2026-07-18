"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

/**
 * Terminal state for an authenticated user whose account isn't linked to a
 * client portal (no publicMetadata + no pending record — e.g. a signup that
 * never onboarded, an expired pending record, or a user deleted then recreated).
 *
 * This is a plain render, NOT a redirect. Redirecting an authenticated user to
 * /portal/sign-in loops forever, because Clerk bounces signed-in users off the
 * sign-in page straight back to /portal. Rendering here breaks that loop and
 * gives them a way to sign out and switch accounts.
 */
export default function PortalNoAccess() {
    return (
        <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
            {/* Header — matches DashboardShell / PortalPending */}
            <header
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: "var(--rule)", background: "rgba(255,255,255,0.03)" }}
            >
                <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                    Client Portal
                </span>
                <UserButton />
            </header>

            <main className="px-6 py-24 max-w-2xl mx-auto text-center">
                <span className="eyebrow">Account not linked</span>
                <h1 className="mt-6" style={{ fontSize: "var(--text-3xl)" }}>
                    No portal access yet
                </h1>
                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    This login isn&apos;t linked to a client site. If you recently completed
                    onboarding, make sure you signed in with the same email you used at
                    checkout. If you signed up with a different email, sign out and try again
                    with that address.
                </p>
                <p className="mt-4" style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}>
                    Still stuck? Email{" "}
                    <a
                        href="mailto:hello@juneaudigitaldesigns.com"
                        style={{ color: "var(--accent-2)", textDecoration: "underline" }}
                    >
                        hello@juneaudigitaldesigns.com
                    </a>{" "}
                    and we&apos;ll get you sorted.
                </p>

                <div className="mt-10 flex flex-wrap gap-3 justify-center">
                    <Link href="/" className="btn ghost" style={{ display: "inline-flex" }}>
                        Back to site
                    </Link>
                </div>
            </main>
        </div>
    );
}
