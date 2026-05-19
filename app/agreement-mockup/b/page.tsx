"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import MockupBanner from "../_components/MockupBanner";
import PlanChip from "../_components/PlanChip";
import SignatureCanvas from "../_components/SignatureCanvas";

export default function AgreementMockupBPage() {
    return (
        <Suspense fallback={null}>
            <AgreementMockupB />
        </Suspense>
    );
}

function AgreementMockupB() {
    const searchParams = useSearchParams();
    const plan = searchParams.get("plan") ?? "growth";
    const isEnterprise = plan === "enterprise";
    const [agreed, setAgreed] = useState(false);

    return (
        <main style={{ minHeight: "100vh", padding: "60px 0" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 max(20px, 4vw)" }}>
                <MockupBanner />

                <div style={{ marginBottom: 24 }}>
                    <PlanChip plan={plan} />
                </div>

                <h1
                    style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "clamp(28px, 4vw, 44px)",
                        fontWeight: 400,
                        letterSpacing: "-0.025em",
                        color: "var(--fg)",
                        lineHeight: 1.1,
                        marginBottom: 10,
                    }}
                >
                    Master Services Agreement.
                </h1>
                <p
                    style={{
                        color: "var(--fg-2)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        marginBottom: 28,
                    }}
                >
                    Review the agreement, fill in your details, then sign below to continue
                    to payment.
                </p>

                {/* MSA preview */}
                <Section title="Agreement">
                    <div
                        style={{
                            maxHeight: 360,
                            overflowY: "auto",
                            padding: "22px 24px",
                            background: "var(--surface)",
                            border: "1px solid var(--rule)",
                            borderRadius: 12,
                            fontSize: 13.5,
                            lineHeight: 1.7,
                            color: "var(--fg-2)",
                        }}
                    >
                        <H2>Master Services Agreement</H2>
                        <p>
                            <strong style={{ color: "var(--fg)" }}>
                                Juneau Digital Designs LLC Services Agreement
                            </strong>
                        </p>
                        <p>This Master Services Agreement is entered into between:</p>
                        <p>
                            <strong style={{ color: "var(--fg)" }}>Provider:</strong> Juneau
                            Digital Designs LLC, a Florida limited liability company
                            (&quot;we,&quot; &quot;us,&quot; or &quot;JDD&quot;)
                        </p>
                        <p>
                            <strong style={{ color: "var(--fg)" }}>Client:</strong> [your
                            legal name &amp; address — filled from the form below]
                        </p>

                        <H3>1. Services</H3>
                        <p>
                            Provider will deliver the services described in the plan tier
                            selected by Client (the &quot;Plan&quot;) as set forth in
                            Schedule A attached to this Agreement.
                        </p>

                        <H3>3. Fees and Billing</H3>
                        <p>
                            Client agrees to pay the monthly fee for the selected Plan, billed
                            in advance on the first calendar day of each service month. Client
                            authorizes recurring automatic billing via the payment method on
                            file. Failed payments will be retried within 72 hours.
                        </p>

                        <Truncated>
                            …sections 2 (Timeline), 4 (Inclusions), 5 (Call Volume),
                            6 (AI Acknowledgments), 7 (Recording &amp; Consent),
                            8 (Client Responsibilities), 9 (Phone Number Ownership),
                            10 (IP) shown in full on the live page…
                        </Truncated>

                        <H3>12. Limitation of Liability</H3>
                        <p>
                            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, PROVIDER&apos;S
                            TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE GREATER OF: (A) THE
                            TOTAL FEES PAID BY CLIENT IN THE TWELVE (12) MONTHS PRECEDING THE
                            CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).
                        </p>

                        <H3>14. Term and Termination</H3>
                        <p>
                            Either party may terminate at the end of any monthly billing cycle
                            with written notice. Required notice periods: Starter and Growth —
                            30 days; Enterprise — 60 days.
                        </p>

                        <H3>15.1 Governing Law</H3>
                        <p>
                            This Agreement is governed by the laws of the State of Florida,
                            without regard to conflict of law principles.
                        </p>

                        <Truncated>
                            …Schedule A (full feature matrix by plan) shown in full on the
                            live page…
                        </Truncated>
                    </div>
                </Section>

                {/* Form */}
                <Section title="Your details">
                    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                        <Field label="Legal entity name" placeholder="Acme Corp" />
                        <FieldRow>
                            <Field
                                label="Entity type"
                                type="select"
                                options={[
                                    "LLC",
                                    "Corporation",
                                    "Sole Proprietor",
                                    "Partnership",
                                    "Other",
                                ]}
                            />
                            <Field label="Target launch date" type="date" />
                        </FieldRow>
                        <Field
                            label="Business address"
                            placeholder="123 Main St, Orlando, FL 32801"
                        />
                        <FieldRow>
                            <Field label="Signer name" placeholder="Jane Smith" />
                            <Field label="Signer title" placeholder="Owner" />
                        </FieldRow>

                        {isEnterprise && (
                            <div
                                style={{
                                    marginTop: 8,
                                    paddingTop: 16,
                                    borderTop: "1px solid var(--rule)",
                                }}
                            >
                                <div className="kicker" style={{ marginBottom: 12 }}>
                                    ━ ENTERPRISE — SITE NAMES
                                </div>
                                <div
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 14,
                                    }}
                                >
                                    <Field label="Site 1" placeholder="Acme Plumbing" />
                                    <Field label="Site 2" placeholder="Acme HVAC" />
                                    <Field label="Site 3 (optional)" placeholder="" />
                                </div>
                            </div>
                        )}
                    </div>
                </Section>

                {/* Signature */}
                <Section title="Signature">
                    <SignatureCanvas />
                </Section>

                {/* Acceptance */}
                <label
                    style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "16px 18px",
                        background: "var(--surface)",
                        border: "1px solid var(--rule)",
                        borderRadius: 10,
                        cursor: "pointer",
                        marginTop: 24,
                    }}
                >
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={(e) => setAgreed(e.target.checked)}
                        style={{
                            marginTop: 2,
                            width: 18,
                            height: 18,
                            accentColor: "var(--accent)",
                            cursor: "pointer",
                        }}
                    />
                    <span style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.55 }}>
                        I have read and agree to be legally bound by the{" "}
                        <strong style={{ color: "var(--fg)" }}>
                            Master Services Agreement
                        </strong>
                        . I understand my electronic signature has the same legal effect as a
                        handwritten one.
                    </span>
                </label>

                {/* CTA */}
                <button
                    type="button"
                    onClick={() =>
                        alert(
                            "Mockup preview — in the real flow this would stamp your signature onto the PDF, store it in Vercel Blob, email both parties, and forward you to Stripe Checkout.",
                        )
                    }
                    className="btn primary"
                    style={{
                        width: "100%",
                        marginTop: 18,
                        justifyContent: "center",
                        opacity: agreed ? 1 : 0.5,
                        pointerEvents: agreed ? "auto" : "none",
                    }}
                >
                    Sign &amp; continue to payment →
                </button>

                <p
                    style={{
                        marginTop: 18,
                        textAlign: "center",
                        fontSize: 11,
                        color: "var(--fg-3)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.05em",
                    }}
                >
                    Signed PDF emailed to you · ESIGN Act & UETA compliant
                </p>
            </div>
        </main>
    );
}

/* ── Small layout helpers ──────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section style={{ marginTop: 32 }}>
            <div className="kicker" style={{ marginBottom: 14 }}>
                ━ {title.toUpperCase()}
            </div>
            {children}
        </section>
    );
}

function H2({ children }: { children: React.ReactNode }) {
    return (
        <h2
            style={{
                fontFamily: "var(--font-display)",
                fontSize: 20,
                color: "var(--fg)",
                fontWeight: 600,
                marginBottom: 12,
                marginTop: 0,
            }}
        >
            {children}
        </h2>
    );
}

function H3({ children }: { children: React.ReactNode }) {
    return (
        <h3
            style={{
                fontFamily: "var(--font-display)",
                fontSize: 14,
                color: "var(--fg)",
                fontWeight: 600,
                marginTop: 20,
                marginBottom: 6,
            }}
        >
            {children}
        </h3>
    );
}

function Truncated({ children }: { children: React.ReactNode }) {
    return (
        <p
            style={{
                margin: "18px 0",
                padding: "10px 14px",
                background: "rgba(182, 168, 255, 0.05)",
                border: "1px dashed rgba(182, 168, 255, 0.25)",
                borderRadius: 8,
                color: "var(--fg-3)",
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                letterSpacing: "0.02em",
            }}
        >
            {children}
        </p>
    );
}

function Field({
    label,
    placeholder = "",
    type = "text",
    options,
}: {
    label: string;
    placeholder?: string;
    type?: string;
    options?: string[];
}) {
    const id = label.toLowerCase().replace(/\W+/g, "-");
    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor={id} className="kicker">
                ━ {label}
            </label>
            {type === "select" ? (
                <select id={id} style={fieldStyle}>
                    {options?.map((o) => (
                        <option key={o}>{o}</option>
                    ))}
                </select>
            ) : (
                <input id={id} type={type} placeholder={placeholder} style={fieldStyle} />
            )}
        </div>
    );
}

function FieldRow({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            {children}
        </div>
    );
}

const fieldStyle: React.CSSProperties = {
    padding: "11px 14px",
    background: "var(--surface)",
    border: "1px solid var(--rule)",
    borderRadius: 8,
    color: "var(--fg)",
    fontSize: 14,
    fontFamily: "inherit",
    outline: "none",
    width: "100%",
};
