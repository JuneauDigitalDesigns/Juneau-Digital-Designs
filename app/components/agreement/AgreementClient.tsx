"use client";

import { useRef, useState } from "react";
import type { PlanSlug } from "@/app/lib/agreement-types";
import PlanChip from "./PlanChip";
import SignatureCanvas, { type SignatureCanvasHandle } from "./SignatureCanvas";

interface Props {
    plan: PlanSlug;
}

const ENTITY_TYPES = ["LLC", "Corporation", "Sole Proprietor", "Partnership", "Other"];

export default function AgreementClient({ plan }: Props) {
    const isEnterprise = plan === "enterprise";
    const sigRef = useRef<SignatureCanvasHandle>(null);

    const [form, setForm] = useState({
        clientLegalName: "",
        clientEntityType: "LLC",
        clientAddress: "",
        signerName: "",
        signerTitle: "",
        signerEmail: "",
        launchDate: "",
        site1: "",
        site2: "",
        site3: "",
    });
    const [agreed, setAgreed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!agreed) {
            setError("You must agree to the Master Services Agreement to continue.");
            return;
        }
        if (sigRef.current?.isEmpty() ?? true) {
            setError("Please draw your signature.");
            return;
        }
        if (!form.clientLegalName || !form.clientAddress || !form.signerName || !form.signerTitle || !form.signerEmail || !form.launchDate) {
            setError("Please complete all fields above.");
            return;
        }
        if (isEnterprise && (!form.site1 || !form.site2)) {
            setError("Enterprise plan requires at least 2 site names.");
            return;
        }

        const signatureDataUrl = sigRef.current!.toDataUrl();
        const additionalSites = isEnterprise
            ? [form.site1, form.site2, form.site3].filter(Boolean)
            : [];

        setSubmitting(true);
        try {
            // 1. Sign agreement
            const sigRes = await fetch("/api/agreement", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    plan,
                    clientLegalName: form.clientLegalName.trim(),
                    clientEntityType: form.clientEntityType,
                    clientAddress: form.clientAddress.trim(),
                    signerName: form.signerName.trim(),
                    signerTitle: form.signerTitle.trim(),
                    signerEmail: form.signerEmail.trim(),
                    launchDate: form.launchDate,
                    additionalSites,
                    signatureDataUrl,
                }),
            });
            const sigData = (await sigRes.json()) as { agreement_id?: string; error?: string };
            if (!sigRes.ok || !sigData.agreement_id) {
                throw new Error(sigData.error || `Signing failed (${sigRes.status})`);
            }

            // 2. Create Stripe Checkout Session
            const ckRes = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plan, agreement_id: sigData.agreement_id }),
            });
            const ckData = (await ckRes.json()) as { url?: string; error?: string };
            if (!ckRes.ok || !ckData.url) {
                throw new Error(ckData.error || `Could not create checkout (${ckRes.status})`);
            }

            window.location.href = ckData.url;
        } catch (e) {
            setError(e instanceof Error ? e.message : "Something went wrong.");
            setSubmitting(false);
        }
    }

    return (
        <main style={{ minHeight: "100vh", padding: "60px 0" }}>
            <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 max(20px, 4vw)" }}>
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
                <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                    Review the agreement, fill in your details, then sign below to continue to payment.
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Agreement preview */}
                    <Section title="Agreement">
                        <div
                            style={{
                                background: "var(--surface)",
                                border: "1px solid var(--rule)",
                                borderRadius: 12,
                                overflow: "hidden",
                            }}
                        >
                            <iframe
                                src="/legal/msa-v2.pdf#toolbar=0&navpanes=0"
                                title="Master Services Agreement v2"
                                style={{
                                    width: "100%",
                                    height: 480,
                                    border: 0,
                                    display: "block",
                                    background: "#fff",
                                }}
                            />
                        </div>
                        <p
                            style={{
                                marginTop: 10,
                                fontSize: 12,
                                color: "var(--fg-3)",
                                fontFamily: "var(--font-mono)",
                                letterSpacing: "0.04em",
                            }}
                        >
                            Can&apos;t view inline?{" "}
                            <a
                                href="/legal/msa-v2.pdf"
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "var(--accent)", textDecoration: "underline" }}
                            >
                                Open the PDF in a new tab →
                            </a>
                        </p>
                    </Section>

                    {/* Form */}
                    <Section title="Your details">
                        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                            <Field
                                label="Legal entity name"
                                placeholder="Acme Corp"
                                value={form.clientLegalName}
                                onChange={(v) => update("clientLegalName", v)}
                                required
                            />
                            <FieldRow>
                                <SelectField
                                    label="Entity type"
                                    value={form.clientEntityType}
                                    onChange={(v) => update("clientEntityType", v)}
                                    options={ENTITY_TYPES}
                                />
                                <Field
                                    label="Target launch date"
                                    type="date"
                                    value={form.launchDate}
                                    onChange={(v) => update("launchDate", v)}
                                    required
                                />
                            </FieldRow>
                            <Field
                                label="Business address"
                                placeholder="123 Main St, Orlando, FL 32801"
                                value={form.clientAddress}
                                onChange={(v) => update("clientAddress", v)}
                                required
                            />
                            <FieldRow>
                                <Field
                                    label="Signer name"
                                    placeholder="Jane Smith"
                                    value={form.signerName}
                                    onChange={(v) => update("signerName", v)}
                                    required
                                />
                                <Field
                                    label="Signer title"
                                    placeholder="Owner"
                                    value={form.signerTitle}
                                    onChange={(v) => update("signerTitle", v)}
                                    required
                                />
                            </FieldRow>
                            <Field
                                label="Signer email"
                                type="email"
                                placeholder="jane@acme.com"
                                value={form.signerEmail}
                                onChange={(v) => update("signerEmail", v)}
                                required
                            />

                            {isEnterprise && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        paddingTop: 16,
                                        borderTop: "1px solid var(--rule)",
                                    }}
                                >
                                    <div className="kicker" style={{ marginBottom: 12 }}>
                                        ━ ENTERPRISE — SITE NAMES (UP TO 3)
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                                        <Field
                                            label="Site 1"
                                            placeholder="Acme Plumbing"
                                            value={form.site1}
                                            onChange={(v) => update("site1", v)}
                                            required
                                        />
                                        <Field
                                            label="Site 2"
                                            placeholder="Acme HVAC"
                                            value={form.site2}
                                            onChange={(v) => update("site2", v)}
                                            required
                                        />
                                        <Field
                                            label="Site 3 (optional)"
                                            placeholder=""
                                            value={form.site3}
                                            onChange={(v) => update("site3", v)}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </Section>

                    {/* Signature */}
                    <Section title="Signature">
                        <SignatureCanvas ref={sigRef} />
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
                            <strong style={{ color: "var(--fg)" }}>Master Services Agreement</strong>.
                            I understand my electronic signature has the same legal effect as a
                            handwritten one.
                        </span>
                    </label>

                    {error && (
                        <div
                            role="alert"
                            style={{
                                marginTop: 14,
                                padding: "10px 14px",
                                background: "rgba(255, 105, 97, 0.08)",
                                border: "1px solid rgba(255, 105, 97, 0.3)",
                                color: "#FF8A82",
                                borderRadius: 8,
                                fontSize: 13,
                            }}
                        >
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="btn primary"
                        style={{
                            width: "100%",
                            marginTop: 18,
                            justifyContent: "center",
                            opacity: submitting ? 0.6 : 1,
                            cursor: submitting ? "wait" : "pointer",
                        }}
                    >
                        {submitting ? "Signing and preparing payment…" : "Sign & continue to payment →"}
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
                </form>
            </div>
        </main>
    );
}

/* ── helpers ──────────────────────────────────────────────── */

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

function Field({
    label,
    placeholder = "",
    type = "text",
    value,
    onChange,
    required = false,
}: {
    label: string;
    placeholder?: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
}) {
    const id = label.toLowerCase().replace(/\W+/g, "-");
    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor={id} className="kicker">
                ━ {label}
                {required && <span style={{ color: "var(--accent)", marginLeft: 4 }}>*</span>}
            </label>
            <input
                id={id}
                type={type}
                placeholder={placeholder}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={fieldStyle}
                required={required}
            />
        </div>
    );
}

function SelectField({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    options: string[];
}) {
    const id = label.toLowerCase().replace(/\W+/g, "-");
    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor={id} className="kicker">
                ━ {label}
            </label>
            <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={fieldStyle}>
                {options.map((o) => (
                    <option key={o}>{o}</option>
                ))}
            </select>
        </div>
    );
}

function FieldRow({ children }: { children: React.ReactNode }) {
    return <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>{children}</div>;
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
