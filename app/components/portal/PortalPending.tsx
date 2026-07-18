"use client";

import { UserButton } from "@clerk/nextjs";

const planLabel: Record<"starter" | "growth" | "enterprise", string> = {
    starter: "Starter",
    growth: "Growth",
    enterprise: "Enterprise",
};

/**
 * Holding page shown after a client signs up but before jdd-ops has provisioned
 * their live site (publicMetadata.status === "building"). Gives them something
 * to access immediately: their business name + a "we're building your site"
 * message. Mirrors DashboardShell's header so the transition to the real
 * dashboard is seamless once status flips to "live".
 */
export default function PortalPending({
    name,
    plan,
}: {
    name: string;
    plan: "starter" | "growth" | "enterprise";
}) {
    return (
        <div className="min-h-screen" style={{ background: "var(--bg)", color: "var(--fg)" }}>
            {/* Header — matches DashboardShell */}
            <header
                className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: "var(--rule)", background: "rgba(255,255,255,0.03)" }}
            >
                <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold" style={{ fontFamily: "var(--font-display)" }}>
                        {name}
                    </span>
                    <span
                        className="text-xs px-2 py-0.5 rounded-full border"
                        style={{
                            borderColor: "var(--rule-strong)",
                            color: "var(--fg-2)",
                            fontFamily: "var(--font-mono)",
                        }}
                    >
                        {planLabel[plan]}
                    </span>
                </div>
                <UserButton />
            </header>

            {/* Building message */}
            <main className="px-6 py-24 max-w-2xl mx-auto text-center">
                <span className="eyebrow">Setup in progress</span>
                <h1 className="mt-6" style={{ fontSize: "var(--text-3xl)" }}>
                    We&apos;re building your site
                </h1>
                <p
                    className="mt-4"
                    style={{ color: "var(--fg-2)", lineHeight: "var(--leading-relaxed)", fontSize: 16 }}
                >
                    Thanks for completing onboarding, {name}. Our team is putting your website
                    together now. Once it&apos;s live, this portal will fill in with your
                    performance metrics
                    {plan === "starter" ? "" : ", call logs,"} and traffic — no need to sign up
                    again, just log back in here.
                </p>
                <p className="mt-8" style={{ color: "var(--fg-3)", fontSize: 14 }}>
                    We&apos;ll email you the moment it&apos;s ready.
                </p>
            </main>
        </div>
    );
}
