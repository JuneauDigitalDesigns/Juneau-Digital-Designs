"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import MockupBanner from "../_components/MockupBanner";
import PlanChip from "../_components/PlanChip";

export default function AgreementMockupAPage() {
    return (
        <Suspense fallback={null}>
            <AgreementMockupA />
        </Suspense>
    );
}

function AgreementMockupA() {
    const searchParams = useSearchParams();
    const plan = searchParams.get("plan") ?? "growth";
    const isEnterprise = plan === "enterprise";

    return (
        <main style={{ minHeight: "100vh", padding: "60px 0" }}>
            <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 max(20px, 4vw)" }}>
                <MockupBanner />

                <div style={{ marginBottom: 24 }}>
                    <PlanChip plan={plan} />
                </div>

                <div className="kicker" style={{ marginBottom: 12 }}>
                    ━ STEP 1 OF 2 — REVIEW · SIGN · PAY
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
                    Review your details.
                </h1>
                <p
                    style={{
                        color: "var(--fg-2)",
                        fontSize: 14,
                        lineHeight: 1.6,
                        marginBottom: 32,
                    }}
                >
                    We&apos;ll pre-fill your Master Services Agreement with these on the next step.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                    <Field label="Legal entity name" placeholder="Acme Corp" />
                    <FieldRow>
                        <Field
                            label="Entity type"
                            type="select"
                            options={["LLC", "Corporation", "Sole Proprietor", "Partnership", "Other"]}
                        />
                        <Field label="Target launch date" type="date" />
                    </FieldRow>
                    <Field label="Business address" placeholder="123 Main St, Orlando, FL 32801" />
                    <FieldRow>
                        <Field label="Signer name" placeholder="Jane Smith" />
                        <Field label="Signer title" placeholder="Owner" />
                    </FieldRow>

                    {isEnterprise && (
                        <div
                            style={{
                                marginTop: 12,
                                paddingTop: 18,
                                borderTop: "1px solid var(--rule)",
                            }}
                        >
                            <div className="kicker" style={{ marginBottom: 14 }}>
                                ━ ENTERPRISE — SITE NAMES
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                <Field label="Site 1" placeholder="Acme Plumbing" />
                                <Field label="Site 2" placeholder="Acme HVAC" />
                                <Field label="Site 3 (optional)" placeholder="" />
                            </div>
                        </div>
                    )}
                </div>

                <div
                    style={{
                        marginTop: 32,
                        padding: 18,
                        background: "rgba(182, 168, 255, 0.06)",
                        border: "1px solid rgba(182, 168, 255, 0.18)",
                        borderRadius: 10,
                        fontSize: 13.5,
                        color: "var(--fg-2)",
                        lineHeight: 1.65,
                    }}
                >
                    <div
                        style={{
                            color: "var(--fg)",
                            fontWeight: 600,
                            marginBottom: 6,
                            fontFamily: "var(--font-display)",
                            fontSize: 15,
                        }}
                    >
                        📜 Next: Review and sign the agreement
                    </div>
                    You&apos;ll review and sign the Master Services Agreement on our secure
                    signing partner&apos;s page (eSignatures.io). The agreement will be
                    pre-filled with everything above. After signing, you&apos;ll come back
                    here to complete payment.
                </div>

                <button
                    type="button"
                    onClick={() =>
                        alert(
                            "Mockup preview — in the real flow this would call eSignatures.io and redirect you to their signing page.",
                        )
                    }
                    className="btn primary"
                    style={{
                        width: "100%",
                        marginTop: 24,
                        justifyContent: "center",
                    }}
                >
                    Review and sign agreement →
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
                    Secured by eSignatures.io · ESIGN Act & UETA compliant
                </p>
            </div>
        </main>
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
