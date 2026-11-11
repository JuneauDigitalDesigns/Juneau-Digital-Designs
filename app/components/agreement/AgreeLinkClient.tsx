"use client";

import { useCallback, useState } from "react";
import type { Section } from "@/app/lib/legal/types";
import { normalizeE164 } from "@/app/lib/phone";
import type { SmsConsentCopy } from "@/app/lib/sms-consent-text";
import TermsReader from "./TermsReader";
import LinkInactive from "./LinkInactive";
import SmsOptIn, { SMS_OPT_IN_PHONE_ERROR } from "./SmsOptIn";

/**
 * A client reading and agreeing to their agreement through a private link. Wording approved by
 * Xander 2026-11-08 (mockup: https://claude.ai/artifact/TvSLZo2M3JV4qVT784wm5p).
 *
 * Carries the same optional owner SMS opt-in as `/agreement` (Xander, 2026-11-11: "Technically,
 * it is still the agreement page"): the mobile number field and, beside it, a separate unchecked
 * box, in the words the live campaign registers. Agreeing never depends on it.
 */

const heading = { margin: "0 0 8px", fontSize: 32, lineHeight: 1.15, color: "var(--fg)" } as const;
const muted = { margin: 0, color: "var(--fg-2)", fontSize: 14.5, lineHeight: 1.6 } as const;

export function AgreeInactive() {
    return <LinkInactive />;
}

export function AgreeDone({ email }: { email: string }) {
    return (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
            <h1 style={heading}>Agreement recorded</h1>
            <p style={muted}>Copy sent to {email}.</p>
        </div>
    );
}

export default function AgreeLinkClient({
    code,
    sections,
    termsHash,
    isAddendum,
    businessLine,
    signerLine,
    email,
    smsConsentCopy,
    hasReceptionist,
}: {
    code: string;
    sections: Section[];
    termsHash: string;
    isAddendum: boolean;
    businessLine: string;
    signerLine: string;
    email: string;
    /** The consent wording beside the opt-in box, chosen on the server (`smsConsentCopy()`). */
    smsConsentCopy: SmsConsentCopy;
    /** False for a website-only order: no calls, so nothing to text about, so no opt-in. */
    hasReceptionist: boolean;
}) {
    const [pageOpenedAt] = useState(() => new Date().toISOString());
    const [scrollCompletedAt, setScrollCompletedAt] = useState<string | null>(null);
    const [accepted, setAccepted] = useState(false);
    // Separate from `accepted` in every sense: its own state, its own box, and no bearing on
    // whether Agree works.
    const [alertPhone, setAlertPhone] = useState("");
    const [smsConsent, setSmsConsent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);
    const [inactive, setInactive] = useState(false);

    const onComplete = useCallback(() => setScrollCompletedAt((prev) => prev ?? new Date().toISOString()), []);

    async function agree() {
        if (!scrollCompletedAt || !accepted || busy) return;
        // A ticked box with no usable number would record a consent pointing at nothing. An
        // unticked box sends no number at all, whatever was typed.
        const consentPhone = hasReceptionist && smsConsent ? normalizeE164(alertPhone) : null;
        if (hasReceptionist && smsConsent && !consentPhone) {
            setError(SMS_OPT_IN_PHONE_ERROR);
            return;
        }
        setBusy(true);
        setError(null);
        try {
            const res = await fetch(`/api/agree/${encodeURIComponent(code)}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    accepted: true,
                    termsHash,
                    pageOpenedAt,
                    scrollCompletedAt,
                    ...(consentPhone
                        ? { smsConsent: true, alertPhone: consentPhone, smsConsentVersion: smsConsentCopy.version }
                        : {}),
                }),
            });
            const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
            if (res.ok) return setDone(true);
            if (body.code === "inactive") return setInactive(true);
            setError(body.error ?? "The agreement could not be recorded. Try again.");
        } catch {
            setError("The agreement could not be recorded. Try again.");
        } finally {
            setBusy(false);
        }
    }

    if (done) return <AgreeDone email={email} />;
    if (inactive) return <AgreeInactive />;

    const ready = Boolean(scrollCompletedAt) && accepted && !busy;
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
                <h1 style={heading}>Service agreement</h1>
                <p style={muted}>{businessLine}</p>
            </div>
            <TermsReader sections={sections} onComplete={onComplete} height={420} />
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: scrollCompletedAt ? "pointer" : "not-allowed", opacity: scrollCompletedAt ? 1 : 0.55 }}>
                <input
                    id="agree-accept"
                    type="checkbox"
                    checked={accepted}
                    disabled={!scrollCompletedAt}
                    onChange={(e) => setAccepted(e.target.checked)}
                    style={{ width: 20, height: 20, marginTop: 1, flex: "none" }}
                />
                <span style={{ fontSize: 14.5, color: "var(--fg)", lineHeight: 1.55 }}>
                    {isAddendum
                        ? "I have read and agree to this Site Addendum and the Terms of Service it adopts."
                        : "I have read and agree to the Terms of Service."}
                </span>
            </label>
            <p style={{ ...muted, fontSize: 13, color: "var(--fg-3)" }}>{signerLine}</p>
            {hasReceptionist && (
                <SmsOptIn
                    copy={smsConsentCopy}
                    phone={alertPhone}
                    onPhoneChange={setAlertPhone}
                    checked={smsConsent}
                    onCheckedChange={setSmsConsent}
                />
            )}
            {error && (
                <p role="alert" style={{ ...muted, color: "#d2542f" }}>
                    {error}
                </p>
            )}
            <button
                type="button"
                onClick={agree}
                disabled={!ready}
                style={{
                    padding: "14px 22px",
                    borderRadius: 10,
                    border: 0,
                    fontWeight: 700,
                    fontSize: 15,
                    background: "var(--fg)",
                    color: "var(--bg)",
                    opacity: ready ? 1 : 0.5,
                    cursor: ready ? "pointer" : "not-allowed",
                }}
            >
                {busy ? "Recording…" : scrollCompletedAt ? "Agree" : "Scroll to the end of the agreement"}
            </button>
        </div>
    );
}
