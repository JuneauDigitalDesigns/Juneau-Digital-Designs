"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type { AgreementKind, PlanSlug, ReceptionistMode } from "@/app/lib/agreement-types";
import type { Section } from "@/app/lib/legal/types";
import { normalizeE164 } from "@/app/lib/phone";
import { splitConsentText } from "@/app/lib/sms-consent-text";
import PlanChip from "./PlanChip";
import SignatureCanvas, { type SignatureCanvasHandle } from "./SignatureCanvas";
import TermsReader from "./TermsReader";

interface Props {
    plan: PlanSlug;
    /**
     * Monthly or annual prepay, resolved server side from the query string.
     *
     * Carried through to checkout so the Session opens on the right recurring price. The
     * agreement text itself does not vary: Schedule A quotes the monthly fee either way, and
     * annual prepay is a billing arrangement rather than a different set of terms.
     */
    billingPeriod: "monthly" | "annual";
    sections: Section[];
    version: string;
    /**
     * The Website-Only terms, sent only for a Starter master. When the client picks "website
     * only" the reader swaps to these instead of the standard Starter terms, so the document
     * they scroll through matches the one the server hashes and the PDF renders. Absent on every
     * other plan and on addenda.
     */
    webOnlySections?: Section[];
    webOnlyVersion?: string;
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
     * This signature authorises a Growth → Enterprise consolidation rather than a new site.
     * Same document, same signature; the step after it opens a Checkout Session that replaces
     * their existing subscriptions instead of adding one.
     */
    consolidate?: boolean;
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

/**
 * The phone-handling options, worded to match the portal onboarding form so a client who sees
 * both never meets two different explanations of the same choice. `declined` is Starter-only and
 * filtered out below for Growth — those tiers have no website-only variant.
 */
const RECEPTIONIST_OPTIONS: {
    id: ReceptionistMode;
    pill: string;
    heading: string;
    detail: string;
}[] = [
    {
        id: "forwarded",
        pill: "Forward my number",
        heading: "Forward my existing number",
        detail:
            "You keep the number you already advertise. We give you a number to forward to, and calls you do not pick up roll to your AI receptionist instead of voicemail. The number you enter below is the line that gets forwarded.",
    },
    {
        id: "published",
        pill: "Use a new number",
        heading: "Use the new number we provide",
        detail:
            "We give you a number and you start using it: cards, truck, Google listing. Calls ring your phone first, and reach the receptionist only if you miss them.",
    },
    {
        id: "declined",
        pill: "Website only",
        heading: "Website only, no receptionist",
        detail:
            "We build the site and skip the phone side entirely. Same price as Starter, and you can switch the receptionist on later with no extra onboarding fee.",
    },
];

export default function AgreementClient({
    plan,
    billingPeriod,
    sections,
    version,
    webOnlySections,
    webOnlyVersion,
    upgradeSlug = null,
    kind = "master",
    parentAgreementId,
    consolidate = false,
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

    /**
     * The phone-handling choice.
     *
     * Shown for a new Starter/Growth purchase. Hidden for Enterprise (per-site choice deferred
     * to onboarding) and for upgrades (the client already has a phone setup). Starter offers all
     * three options; Growth drops "website only", which is a Starter-only concession.
     */
    const showPhoneSection = !isEnterprise && !isUpgrade;
    const phoneOptions = RECEPTIONIST_OPTIONS.filter((o) => plan === "starter" || o.id !== "declined");
    const [receptionistMode, setReceptionistMode] = useState<ReceptionistMode | "">("");
    const [forwardingNumber, setForwardingNumber] = useState("");

    // Signing is gated on reaching the end of the terms. Both timestamps go to
    // the server, which derives dwell time from them for the audit record.
    const [pageOpenedAt] = useState(() => new Date().toISOString());
    const [scrollCompletedAt, setScrollCompletedAt] = useState<string | null>(null);
    const hasReadTerms = scrollCompletedAt !== null;

    /**
     * Website-only swaps the whole document. The reader shows the Web-Only terms, the submit
     * sends `declined`, and the server hashes and renders that variant — so the three can never
     * describe different things. Guarded on `webOnlySections` being present (Starter master only).
     */
    const isWebOnly = plan === "starter" && receptionistMode === "declined" && !!webOnlySections;
    const activeSections = isWebOnly && webOnlySections ? webOnlySections : sections;
    const activeVersion = isWebOnly && webOnlyVersion ? webOnlyVersion : version;

    /**
     * A receptionist exists to text about when the client did not decline it. Enterprise and
     * upgrades skip the phone section entirely but still carry a receptionist, so they fall
     * through to `true`. This gates the optional call-alert SMS opt-in, replacing the stale
     * pre-reprice check that hid it on all of Starter.
     */
    const hasReceptionist = showPhoneSection
        ? receptionistMode === "forwarded" || receptionistMode === "published"
        : true;

    /**
     * Switching into or out of website-only changes the terms on screen, so the client must read
     * the document that now applies. Resetting the scroll gate re-locks the signature until they
     * reach the end of it.
     */
    function chooseReceptionistMode(id: ReceptionistMode) {
        const wasWebOnly = isWebOnly;
        const willBeWebOnly = plan === "starter" && id === "declined" && !!webOnlySections;
        if (wasWebOnly !== willBeWebOnly) setScrollCompletedAt(null);
        setReceptionistMode(id);
    }

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
        // The phone choice is required wherever the section is shown, and a "forward" choice
        // needs a number to forward. Mirrors the server's validation, which does not trust this.
        if (showPhoneSection && !receptionistMode) {
            setError("Please choose how your phone should be handled.");
            return;
        }
        const normalizedForwarding =
            receptionistMode === "forwarded" ? normalizeE164(forwardingNumber) : null;
        if (receptionistMode === "forwarded" && !normalizedForwarding) {
            setError("Enter the number you want forwarded to your receptionist.");
            return;
        }
        // Consent only counts when a receptionist exists to text about: the opt-in is hidden once
        // website-only is chosen, so a box ticked before that switch is discarded here.
        const effectiveSmsConsent = hasReceptionist && smsConsent;
        // A checked box with no usable number is the one combination that must not pass:
        // it would record a consent pointing at nothing. An unchecked box discards whatever
        // was typed, so no number we have no permission to text is ever transmitted.
        const alertPhone = effectiveSmsConsent ? normalizeE164(form.alertPhone) : null;
        if (effectiveSmsConsent && !alertPhone) {
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
                    // The phone-handling choice and, for forwarding, the line to forward. Omitted
                    // when the section wasn't shown (Enterprise, upgrades) so the record stays
                    // absent rather than carrying an empty string.
                    ...(receptionistMode ? { receptionistMode } : {}),
                    ...(normalizedForwarding ? { forwardingNumber: normalizedForwarding } : {}),
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

            // 2. Charge. Three endings, and picking the wrong one costs the client money:
            //    an upgrade edits the subscription they already pay for, a consolidation opens
            //    one that replaces several, and a new site adds one. Opening a plain checkout
            //    for either of the first two would leave them paying for both old and new.
            if (consolidate) {
                const conRes = await fetch("/api/portal/consolidate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ agreement_id: sigData.agreement_id }),
                });
                // Same expired-session trap as the upgrade path below: a redirect to sign-in
                // arrives as HTML with a 200, and parsing it as JSON would show a syntax error
                // seconds after they signed.
                if (!conRes.headers.get("content-type")?.includes("application/json")) {
                    throw new Error(
                        "Your session expired while signing. Your agreement is saved. Please sign in and start the move again.",
                    );
                }
                const conData = (await conRes.json()) as { url?: string; error?: string };
                if (!conRes.ok || !conData.url) {
                    throw new Error(conData.error || `Could not start the move (${conRes.status})`);
                }
                window.location.href = conData.url;
                return;
            }

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
                        "Your session expired while signing. Your agreement is saved. Please sign in and try the upgrade again.",
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
                body: JSON.stringify({ plan, agreement_id: sigData.agreement_id, period: billingPeriod }),
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
                    <Section title={`Agreement, ${activeVersion}`}>
                        {/* Keyed on the variant so switching to/from website-only remounts the
                            reader, resetting its internal scroll tracking along with the gate. */}
                        <TermsReader
                            key={isWebOnly ? "web-only" : "standard"}
                            sections={activeSections}
                            onComplete={handleTermsComplete}
                        />
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
                            {isEnterprise && (
                                <div
                                    style={{
                                        marginTop: 8,
                                        paddingTop: 16,
                                        borderTop: "1px solid var(--rule)",
                                    }}
                                >
                                    <div className="kicker" style={{ marginBottom: 12 }}>
                                        ━ ENTERPRISE SITE NAMES (UP TO 3)
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

                    {/*
                        Your phone — the required choice. Three pills on Starter (forward / new
                        number / website only), two on Growth (no website-only). The shared box
                        below restates the selected option, and picking "forward" reveals the
                        line to forward. Hidden for Enterprise (deferred to onboarding) and
                        upgrades (phone already set up).
                    */}
                    {showPhoneSection && (
                        <Section title="Your phone">
                            <p style={{ color: "var(--fg-2)", fontSize: 13.5, lineHeight: 1.6, marginBottom: 14 }}>
                                Your AI receptionist needs a way to reach your calls. Choose how you want your
                                phone handled{isStarter ? "" : " — this is required to continue"}.
                            </p>
                            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
                                {phoneOptions.map((opt) => {
                                    const on = receptionistMode === opt.id;
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => chooseReceptionistMode(opt.id)}
                                            aria-pressed={on}
                                            style={{
                                                flex: "1 1 150px",
                                                padding: "12px 16px",
                                                borderRadius: 999,
                                                border: `1px solid ${on ? "var(--accent)" : "var(--rule)"}`,
                                                background: on ? "var(--accent)" : "var(--surface)",
                                                color: on ? "var(--on-accent)" : "var(--fg)",
                                                fontSize: 13.5,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
                                            }}
                                        >
                                            {opt.pill}
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Shared explanation box — copy follows the selected pill. */}
                            <div
                                style={{
                                    background: "var(--surface)",
                                    border: "1px solid var(--rule)",
                                    borderLeft: "3px solid var(--accent)",
                                    borderRadius: 10,
                                    padding: "14px 16px",
                                }}
                            >
                                {(() => {
                                    const sel = phoneOptions.find((o) => o.id === receptionistMode);
                                    return sel ? (
                                        <>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--fg)", marginBottom: 4 }}>
                                                {sel.heading}
                                            </div>
                                            <p style={{ margin: 0, fontSize: 13, color: "var(--fg-2)", lineHeight: 1.6 }}>
                                                {sel.detail}
                                            </p>
                                        </>
                                    ) : (
                                        <p style={{ margin: 0, fontSize: 13, color: "var(--fg-3)", lineHeight: 1.6 }}>
                                            Pick an option above and we&apos;ll explain exactly what it means.
                                        </p>
                                    );
                                })()}
                            </div>

                            {receptionistMode === "forwarded" && (
                                <div style={{ marginTop: 16 }}>
                                    <Field
                                        label="Number to forward"
                                        type="tel"
                                        placeholder="(907) 555-0142"
                                        value={forwardingNumber}
                                        onChange={setForwardingNumber}
                                        required
                                        hint="This is the existing business line we'll forward to your receptionist."
                                    />
                                </div>
                            )}
                        </Section>
                    )}

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
                    {/*
                        Shown only when a receptionist exists to text about — i.e. not when
                        website-only is chosen, and not before a phone choice is made on
                        Starter/Growth. Replaces the old plan-based gate: every tier now includes
                        the receptionist, so the one case with no calls is the website-only choice.
                    */}
                    {hasReceptionist && (
                        <div style={{ marginTop: 16 }}>
                            <div className="kicker" style={{ marginBottom: 10 }}>
                                ━ OPTIONAL · CALL ALERT TEXTS
                            </div>
                            <div style={{ marginBottom: 12 }}>
                                <Field
                                    label="Mobile number for call alerts"
                                    type="tel"
                                    placeholder="(907) 555-0142"
                                    value={form.alertPhone}
                                    onChange={(v) => update("alertPhone", v)}
                                    hint="Optional. Used only if you turn on call summary texts below."
                                />
                            </div>
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
                        </div>
                    )}

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
