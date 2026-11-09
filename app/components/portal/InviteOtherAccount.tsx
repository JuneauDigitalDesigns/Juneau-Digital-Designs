"use client";

import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

/** An invitation opened while signed in to a different account. Neutral labels only. */
export default function InviteOtherAccount({ email, returnPath }: { email: string | null; returnPath: string }) {
    return (
        <div style={{ maxWidth: 460, textAlign: "center", display: "flex", flexDirection: "column", gap: 14, alignItems: "center" }}>
            <h1 style={{ fontSize: "var(--text-2xl)", color: "var(--fg)", margin: 0 }}>Signed in to another account</h1>
            <p style={{ color: "var(--fg-2)", margin: 0, lineHeight: "var(--leading-relaxed)" }}>
                This invitation creates a new login{email ? `. Current account: ${email}` : ""}.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                <SignOutButton redirectUrl={returnPath}>
                    <button type="button" className="btn primary">Sign out and continue</button>
                </SignOutButton>
                <Link href="/portal" className="btn">Go to portal</Link>
            </div>
        </div>
    );
}
