"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { AgreementKind, PlanSlug } from "@/app/lib/agreement-types";
import type { Section } from "@/app/lib/legal/types";
import { normalizeE164 } from "@/app/lib/phone";
import { splitConsentText } from "@/app/lib/sms-consent-text";
import PlanChip from "./PlanChip";
import SignatureCanvas, { type SignatureCanvasHandle } from "./SignatureCanvas";
import TermsReader from "./TermsReader";

interface Props {
    plan: PlanSlug;
    sections: Section[];
    version: string;
    /**
     * Set when an existing client is moving up a tier. Signing is identical; only the step
     * after it differs — an upgrade modifies the subscription they already have rather than
     * starting a second one.
     */
    upgradeSlug?: string | null;
    /**
     * Which instrument is on screen. `addendum` is the one-page Site Addendum a returning
     * client signs for a later site; it adopts their master by reference.
     */
    kind?: AgreementKind;
    /** The master an addendum hangs off. Sent back with the signature. */
    parentAgreementId?: string;
    /**
     * Contracting details carried over from the master, so a returning client isn't retyping
     * their own address. Every field stays editable — a second site bought by a different
     * legal entity is the case the addendum exists for.
     */
    prefill?: Partial<{
        clientLegalName: string;
        clientEntityType: string;
        clientAddress: string;
        signerName: string;
        signerTitle: string;
        signerEmail: string;
    }>;
}

const ENTITY_TYPES = ["LLC", "Corporation", "Sole Proprietor", "Partnership", "Other"];

export default function AgreementClient({
    plan,
    sections,
    version,
    upgradeSlug = null,
    kind = "master",
    parentAgreementId,
    prefill,
}: Props) {
    const isUpgrade = upgradeSlug !== null;
    const isAddendum = kind === "addendum";
    const isEnterprise = plan === "enterprise";
    /**
     * Starter has no AI receptionist, no Retell agent, and no Twilio number, so there is
     * nothing that could ever send a call summary. Offering the opt-in here would collect
     * permission for messages the system cannot produce.
     *
     * Keyed on the plan being signed for, never on "is this an existing starter client".
     * An upgrade signature arrives as `?plan=growth&upgrade=<slug>`, and that page is
     * precisely where a starter client should be able to opt in.
     */
    const isStarter = plan === "starter";
    const sigRef = useRef<SignatureCanvasHandle>(null);

    // Signing is gated on reaching the end of the terms. Both timestamps go to
    // the server, which derives dwell time from them for the audit record.
    const [pageOpenedAt] = useState(() => new Date().toISOString());
    const [scrollCompletedAt, setScrollCompletedAt] = useState<string | null>(null);
    const hasReadTerms = scrollCompletedAt !== null;

    const handleTermsComplete = useCallback(() => {
        setScrollCompletedAt((prev) => prev ?? new Date().toISOString());
    }, []);

    const [form, setForm] = useState({
        clientLegalName: prefill?.clientLegalName ?? "",
        clientEntityType: prefill?.clientEntityType ?? "LLC",
        clientAddress: prefill?.clientAddress ?? "",
        signerName: prefill?.signerName ?? "",
        signerTitle: prefill?.signerTitle ?? "",
        signerEmail: prefill?.signerEmail ?? "",
        alertPhone: "",
        site1: "",
        site2: "",
        site3: "",
    });
    const [agreed, setAgreed] = useState(false);
    // Separate from `agreed` in every sense: its own state, its own box, its own place in
    // the form, and no bearing on whether the submit button works.
    const [smsConsent, setSmsConsent] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);

        if (!hasReadTerms) {
            setError("Please scroll to the end of the agreement before signing.");
            return;
        }
        if (!agreed) {
            setError("You must agree to the Service Agreement to continue.");
            return;
        }
        if (sigRef.current?.isEmpty() ?? true) {
            setError("Please draw your signature.");
            return;
        }
        if (!form.clientLegalName || !form.clientAddress || !form.signerName || !form.signerTitle || !form.signerEmail) {
            setError("Please complete all fields above.");
            return;
        }
        if (isEnterprise && (!form.site1 || !form.site2)) {
            setError("Enterprise plan requires at least 2 site names.");
            return;
        }
        // A checked box with no usable number is the one combination that must not pass:
        // it would record a consent pointing at nothing. An unchecked box discards whatever
        // was typed, so no number we have no permission to text is ever transmitted.
        const alertPhone = smsConsent ? normalizeE164(form.alertPhone) : null;
        if (smsConsent && !alertPhone) {
            setError(
                "Enter a valid mobile number for call alerts, or uncheck the text alerts box.",
            );
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
                    additionalSites,
                    signatureDataUrl,
                    pageOpenedAt,
                    scrollCompletedAt,
                    // Omitted entirely when the box is unchecked, rather than sent as false
                    // with a number attached. Nothing to discard server-side if it never
                    // leaves the browser.
                    ...(alertPhone ? { smsConsent: true, alertPhone } : {}),
                    // Tells the signing route to hold the client email until the upgrade
                    // below actually goes through. Not an authorization claim — the upgrade
                    // endpoint re-resolves this slug against the signed-in account.
                    ...(isUpgrade ? { upgradeSlug } : {}),
                    // Which document was on screen. The route hashes the text it is told was
                    // shown, so this has to match what the server rendered — it does, because
                    // the server decided it and passed it down as a prop.
                    ...(isAddendum ? { kind: "addendum", parentAgreementId } : {}),
                }),
            });
            const sigData = (await sigRes.json()) as { agreement_id?: string; error?: string };
            if (!sigRes.ok || !sigData.agreement_id) {
                throw new Error(sigData.error || `Signing failed (${sigRes.status})`);
            }

            // 2. Charge. An upgrade edits the subscription the client already pays for; a new
            //    client gets a Checkout Session. Opening a checkout for an upgrade would leave
            //    them holding two subscriptions.
            if (isUpgrade) {
                // Slug goes in the query string, not the body: that is where
                // resolvePortalRequest looks for it, and it re-resolves it against the
                // signed-in account rather than trusting what we send.
                const upRes = await fetch(
                    `/api/portal/upgrade?site=${encodeURIComponent(upgradeSlug!)}`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ agreement_id: sigData.agreement_id }),
                    },
                );
                // The upgrade endpoint is behind auth, and an expired session is answered
                // with a redirect to sign-in — which fetch follows, handing us an HTML page
                // with a 200. Parsing that as JSON would show the client a syntax error
                // moments after they signed, so check what came back before trusting it.
                if (!upRes.headers.get("content-type")?.includes("application/json")) {
                    throw new Error(
                        "Your session expired while signing. Your agreement is saved — please sign in and try the upgrade again.",
                    );
                }
                const upData = (await upRes.json()) as { ok?: boolean; error?: string };
                if (!upRes.ok || !upData.ok) {
                    throw new Error(upData.error || `Could not complete the upgrade (${upRes.status})`);
                }
                window.location.href = `/portal?site=${encodeURIComponent(upgradeSlug!)}&upgraded=1`;
                return;
            }

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

                <h1 style={{ fontSize: "var(--text-3xl)", marginBottom: 10 }}>
                    Service Agreement.
                </h1>
                <p style={{ color: "var(--fg-2)", fontSize: 14, lineHeight: 1.6, marginBottom: 28 }}>
                    Read the agreement in full, fill in your details, then sign below to continue to
                    payment. You&apos;ll receive a copy by email.
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Agreement — must be read to the end before signing unlocks */}
                    <Section title={`Agreement — ${version}`}>
                        <TermsReader sections={sections} onComplete={handleTermsComplete} />
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
                            {!isStarter && (
                                <Field
                                    label="Mobile number for call alerts"
                                    type="tel"
                                    placeholder="(907) 555-0142"
                                    value={form.alertPhone}
                                    onChange={(v) => update("alertPhone", v)}
                                    hint="Optional. Used only if you turn on call summary texts below."
                                />
                            )}

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

                    {/* Signature — locked until the terms have been read */}
                    <Section title="Signature">
                        <div
                            aria-disabled={!hasReadTerms}
                            style={{
                                pointerEvents: hasReadTerms ? "auto" : "none",
                                opacity: hasReadTerms ? 1 : 0.4,
                                transition: "opacity 200ms ease",
                            }}
                        >
                            <SignatureCanvas ref={sigRef} />
                        </div>
                        {!hasReadTerms && <LockNote />}
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
                            cursor: hasReadTerms ? "pointer" : "not-allowed",
                            opacity: hasReadTerms ? 1 : 0.4,
                            marginTop: 24,
                            transition: "opacity 200ms ease",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={agreed}
                            disabled={!hasReadTerms}
                            onChange={(e) => setAgreed(e.target.checked)}
                            style={{
                                marginTop: 2,
                                width: 18,
                                height: 18,
                                accentColor: "var(--accent)",
                                cursor: hasReadTerms ? "pointer" : "not-allowed",
                            }}
                        />
                        <span style={{ fontSize: 13.5, color: "var(--fg)", lineHeight: 1.55 }}>
                            I have read and agree to be legally bound by the{" "}
                            <strong style={{ color: "var(--fg)" }}>Service Agreement</strong>.
                            I understand my electronic signature has the same legal effect as a
                            handwritten one.
                        </span>
                    </label>

                    {/*
                        Optional SMS opt-in. Sits below the binding acceptance, in its own
                        visually distinct card, and is never gated on `hasReadTerms` — a
                        consent that unlocks only by working through the service agreement
                        reads as bundled into it, which is exactly what "not a condition of
                        purchase" rules out. Nothing here touches the submit button.
                    */}
                    <div style={{ marginTop: 16 }}>
                        <div className="kicker" style={{ marginBottom: 10 }}>
                            {/* No "OPTIONAL" on starter: there is nothing here to opt into. */}
                            ━ {isStarter ? "CALL ALERT TEXTS" : "OPTIONAL · CALL ALERT TEXTS"}
                        </div>
                        {isStarter ? (
                            // A statement, not a control. No checkbox, no border, nothing that
                            // invites a click — the same treatment LockNote uses for copy whose
                            // whole job is explaining why there is nothing to do here.
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 13.5,
                                    color: "var(--fg-3)",
                                    lineHeight: 1.55,
                                }}
                            >
                                Call summary texts are part of the Growth and Enterprise plans.
                                Starter does not include the AI receptionist, so there are no calls
                                for us to text you about, and we will not send you text messages on
                                this plan.
                            </p>
                        ) : (
                            <label
                                style={{
                                    display: "flex",
                                    alignItems: "flex-start",
                                    gap: 12,
                                    padding: "16px 18px",
                                    background: "transparent",
                                    border: "1px dashed var(--rule)",
                                    borderRadius: 10,
                                    cursor: "pointer",
                                }}
                            >
                                <input
                                    type="checkbox"
                                    checked={smsConsent}
                                    onChange={(e) => setSmsConsent(e.target.checked)}
                                    style={{
                                        marginTop: 2,
                                        width: 18,
                                        height: 18,
                                        accentColor: "var(--accent)",
                                        cursor: "pointer",
                                    }}
                                />
                                <span style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
                                    {/*
                                        Rendered from the same constant that gets hashed into the
                                        consent record, so the words on screen and the words we can
                                        prove they saw cannot drift apart.
                                    */}
                                    {splitConsentText().map((seg, i) =>
                                        seg.kind === "link" ? (
                                            <Link
                                                key={i}
                                                href={seg.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                // Inside a <label>, a click would otherwise toggle
                                                // the box on the way to opening the link.
                                                onClick={(e) => e.stopPropagation()}
                                                style={{ color: "var(--accent)", textDecoration: "underline" }}
                                            >
                                                {seg.value}
                                            </Link>
                                        ) : (
                                            <span key={i}>{seg.value}</span>
                                        ),
                                    )}
                                </span>
                            </label>
                        )}
                    </div>

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
                        disabled={submitting || !hasReadTerms}
                        className="btn primary"
                        style={{
                            width: "100%",
                            marginTop: 18,
                            justifyContent: "center",
                            opacity: submitting || !hasReadTerms ? 0.5 : 1,
                            cursor: submitting ? "wait" : hasReadTerms ? "pointer" : "not-allowed",
                        }}
                    >
                        {submitting
                            ? "Signing and preparing payment…"
                            : hasReadTerms
                              ? "Sign & continue to payment →"
                              : "Scroll to the end of the agreement"}
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

/** Explains *why* the controls are inert, so a locked form never reads as broken. */
function LockNote() {
    return (
        <p
            style={{
                marginTop: 10,
                fontSize: 12,
                color: "var(--fg-3)",
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.04em",
            }}
        >
            ━ SIGNING UNLOCKS ONCE YOU&apos;VE SCROLLED THROUGH THE FULL AGREEMENT ABOVE
        </p>
    );
}

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
    hint,
}: {
    label: string;
    placeholder?: string;
    type?: string;
    value: string;
    onChange: (v: string) => void;
    required?: boolean;
    /** Sub-label for fields whose purpose isn't obvious from the label alone. */
    hint?: string;
}) {
    const id = label.toLowerCase().replace(/\W+/g, "-");
    const hintId = hint ? `${id}-hint` : undefined;
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
                aria-describedby={hintId}
            />
            {hint && (
                <p id={hintId} style={{ margin: 0, fontSize: 12, color: "var(--fg-3)", lineHeight: 1.5 }}>
                    {hint}
                </p>
            )}
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
