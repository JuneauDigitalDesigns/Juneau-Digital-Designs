export const metadata = {
    title: "Privacy Policy | Juneau Digital Designs",
    description: "How Juneau Digital Designs collects, uses, and protects information submitted through contact forms, agreement signing, and onboarding.",
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
                    background: "radial-gradient(ellipse at 60% 10%, rgba(245,237,214,0.07) 0%, transparent 60%)",
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
                        letterSpacing: "0.03em",
                        color: "var(--fg)",
                        marginBottom: 8,
                    }}
                >
                    Privacy Policy
                </h1>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-3)", marginBottom: 40 }}>
                    Effective date: May 20, 2026
                </p>

                {[
                    {
                        heading: "Information we collect",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>
                                    We collect information you voluntarily provide through the following areas of our website:
                                </p>

                                <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>Contact &amp; quote forms</p>
                                <p style={{ marginBottom: 14 }}>
                                    Your name, business name, email address, phone number, service interest, project details, budget, and
                                    timeline.
                                </p>

                                <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>Agreement signing</p>
                                <p style={{ marginBottom: 10 }}>
                                    When you sign a Master Service Agreement, we collect your legal business name, entity type, business
                                    address, signer name, signer title, and email address. We also capture your hand-drawn digital signature
                                    (stored as an image).
                                </p>
                                <p style={{ marginBottom: 14 }}>
                                    For fraud prevention and ESIGN Act compliance, we automatically record your IP address, browser user
                                    agent string, the date and time of signing (UTC), and a SHA-256 hash of the submitted agreement data.
                                    This information is embedded in a tamper-evident audit trail appended to your signed contract PDF.
                                </p>

                                <p style={{ fontWeight: 600, color: "var(--fg)", marginBottom: 6 }}>Onboarding form</p>
                                <p>
                                    After payment, we collect detailed information needed to build your website, including brand names,
                                    business description, address, phone, colors, logo and image files, SEO metadata, Google Analytics ID,
                                    Facebook Pixel ID, social media profile URLs, services, testimonials, FAQs, and other site content you
                                    provide.
                                </p>
                            </>
                        ),
                    },
                    {
                        heading: "How we use your information",
                        content: (
                            <>
                                <p>Your information is used to:</p>
                                <ul style={{ paddingLeft: 20, marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                                    <li>Respond to quote and contact requests.</li>
                                    <li>Generate, deliver, and archive your signed Master Service Agreement.</li>
                                    <li>Verify your identity and intent for electronic signature purposes under the ESIGN Act (15 U.S.C. § 7001 et seq.).</li>
                                    <li>Process your subscription payment through Stripe.</li>
                                    <li>Build and configure your website using the content you provide.</li>
                                    <li>Communicate about your project and active services.</li>
                                    <li>Maintain internal business records for active and prospective client communications.</li>
                                </ul>
                                <p style={{ marginTop: 10 }}>We do not sell your personal data to third parties.</p>
                            </>
                        ),
                    },
                    {
                        heading: "Electronic signatures & audit trail",
                        content: (
                            <p>
                                Our agreement signing flow complies with the Electronic Signatures in Global and National Commerce Act (ESIGN
                                Act, 15 U.S.C. § 7001 et seq.). To create a legally valid audit record, we capture your IP address, browser
                                user agent, signing timestamp, and a SHA-256 integrity hash of your submitted agreement data at the moment of
                                signing. This information is stored in the signed PDF and retained for the duration of the service
                                relationship and as required by applicable law. Your drawn signature is embedded directly into the contract
                                PDF and is not stored separately after the document is generated.
                            </p>
                        ),
                    },
                    {
                        heading: "Third-party services",
                        content: (
                            <>
                                <p style={{ marginBottom: 14 }}>
                                    We share data with the following third-party processors only to the extent necessary to provide our
                                    services:
                                </p>
                                <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Resend</span> — Email delivery. Used to
                                        transmit quote inquiries and to send signed contract PDFs to you and to our team.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Stripe</span> — Payment processing. Your
                                        email address and plan information are passed to Stripe to create a checkout session and manage your
                                        subscription. Stripe&apos;s privacy policy governs their handling of your payment information.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Vercel Blob</span> — File storage. Signed
                                        contract PDFs and onboarding image uploads are stored in Vercel Blob and accessible via a secure
                                        URL.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Upstash Redis</span> — Temporary data
                                        store. Agreement records are held for up to 30 days to link your signed contract to your checkout
                                        session, then automatically deleted.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Make.com</span> — Workflow automation. Your
                                        onboarding submission and payment confirmation are forwarded to our internal workflow for site
                                        build processing.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Cloudflare Turnstile</span> — Bot
                                        protection. The onboarding form uses Cloudflare Turnstile to verify you are human. Cloudflare may
                                        process your IP address and browser signals to complete this verification.
                                    </li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        heading: "Data retention",
                        content: (
                            <>
                                <p style={{ marginBottom: 10 }}>We retain your data according to the following schedule:</p>
                                <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Contact &amp; quote inquiry data</span> —
                                        retained only as long as needed to respond to your inquiry and manage initial communications.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Agreement KV records</span> — automatically
                                        deleted after 30 days; used solely to link your signed agreement to your checkout session.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Signed contract PDFs &amp; audit trail</span> —
                                        retained for the duration of the service relationship and as required by applicable law.
                                    </li>
                                    <li>
                                        <span style={{ fontWeight: 600, color: "var(--fg)" }}>Onboarding files &amp; images</span> —
                                        retained for the duration of the active service engagement.
                                    </li>
                                </ul>
                            </>
                        ),
                    },
                    {
                        heading: "Your choices",
                        content: (
                            <p>
                                You may request correction or deletion of your submitted personal information by contacting us directly. We
                                will honor valid requests where required by law. Note that signed agreement records and associated audit
                                trails may need to be retained to satisfy legal obligations even after a deletion request.
                            </p>
                        ),
                    },
                    {
                        heading: "Contact",
                        content: (
                            <p>
                                For privacy-related questions or data requests, email us at{" "}
                                <a
                                    href="mailto:privacy@juneaudigitaldesigns.com"
                                    style={{ color: "var(--accent)", textDecoration: "underline" }}
                                >
                                    privacy@juneaudigitaldesigns.com
                                </a>
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
