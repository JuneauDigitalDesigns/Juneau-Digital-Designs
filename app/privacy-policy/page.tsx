import Link from "next/link";

export const metadata = {
    title: "Privacy Policy | Juneau Digital Designs",
    description: "How Juneau Digital Designs collects and uses information submitted through contact and quote forms.",
};

export default function PrivacyPolicyPage() {
    return (
        <main
            style={{
                minHeight: "100vh",
                background: "var(--bg)",
                padding: "64px max(24px, 4vw)",
                position: "relative",
                overflow: "hidden",
            }}
        >
            {/* Subtle aurora backdrop */}
            <div
                style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    zIndex: 0,
                    background: "radial-gradient(ellipse at 60% 10%, rgba(182,168,255,0.12) 0%, transparent 60%)",
                }}
            />

            <article
                className="glass"
                style={{
                    position: "relative",
                    zIndex: 1,
                    maxWidth: 800,
                    margin: "0 auto",
                    padding: "clamp(28px, 5vw, 56px)",
                }}
            >
                <h1
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(28px, 4vw, 44px)",
                        fontWeight: 400,
                        letterSpacing: "-0.025em",
                        color: "var(--fg)",
                        marginBottom: 8,
                    }}
                >
                    Privacy Policy
                </h1>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", marginBottom: 40 }}>
                    Effective date: April 14, 2026
                </p>

                {[
                    {
                        heading: "Information we collect",
                        content: (
                            <p>
                                We collect information you voluntarily submit through our website forms, including your name, business name,
                                email address, phone number, service interest, project details, budget, and timeline.
                            </p>
                        ),
                    },
                    {
                        heading: "How we use your information",
                        content: (
                            <>
                                <p>Your information is used to:</p>
                                <ul style={{ paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                    <li>Respond to quote and contact requests.</li>
                                    <li>Communicate about your project and potential services.</li>
                                    <li>Maintain internal business records for active and prospective client communications.</li>
                                </ul>
                                <p style={{ marginTop: 10 }}>We do not sell your personal data to third parties.</p>
                            </>
                        ),
                    },
                    {
                        heading: "Third-party services",
                        content: (
                            <p>
                                We use Resend to securely transmit form submissions by email. Submitted form content may be processed by Resend
                                solely for message delivery and service reliability.
                            </p>
                        ),
                    },
                    {
                        heading: "Data retention",
                        content: (
                            <p>
                                We retain submitted information only as long as needed to respond to your inquiry, manage project communication,
                                and meet legal or operational obligations.
                            </p>
                        ),
                    },
                    {
                        heading: "Your choices",
                        content: (
                            <p>
                                You may request correction or deletion of your submitted personal information by contacting us directly. We will
                                honor valid requests where required by law.
                            </p>
                        ),
                    },
                    {
                        heading: "Contact",
                        content: (
                            <p>
                                For privacy-related questions, visit our{" "}
                                <Link href="/quote" style={{ color: "var(--accent)", textDecoration: "underline" }}>
                                    quote page
                                </Link>
                                .
                            </p>
                        ),
                    },
                ].map((section) => (
                    <section
                        key={section.heading}
                        style={{
                            marginTop: 36,
                            paddingTop: 28,
                            borderTop: "1px solid var(--rule)",
                        }}
                    >
                        <h2
                            style={{
                                fontFamily: "var(--font-display)",
                                fontSize: 18,
                                fontWeight: 500,
                                color: "var(--fg)",
                                marginBottom: 12,
                            }}
                        >
                            {section.heading}
                        </h2>
                        <div style={{ color: "var(--fg-2)", lineHeight: 1.7, fontSize: 15 }}>
                            {section.content}
                        </div>
                    </section>
                ))}
            </article>
        </main>
    );
}
